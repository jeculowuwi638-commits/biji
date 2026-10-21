const express = require('express');
const { prisma } = require('../db');
const { auth } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/error');
const {
  analyzeStats,
  extractSemantic,
  normalizeTexts,
} = require('../services/style');

const router = express.Router();
router.use(auth);

const MIN_ARTICLE_CHARS = 20;
const MAX_ARTICLE_CHARS = 20000;
const MAX_PROFILE_CHARS = 60000;
const MAX_PROFILE_ARTICLES = 20;
const MAX_APPEND_ARTICLES = 10;

const PROFILE_FIELDS = {
  id: true,
  name: true,
  stats: true,
  semantic: true,
  createdAt: true,
};

const PROFILE_FIELDS_WITH_TEXTS = {
  ...PROFILE_FIELDS,
  texts: true,
};

function profileResponse(profile) {
  return {
    id: profile.id,
    name: profile.name,
    stats: profile.stats,
    semantic: profile.semantic,
    createdAt: profile.createdAt,
    // 旧档案没有保存原文，不能增量分析；新档案和回填后的演示档案可以。
    canAppend:
      profile.texts === undefined
        ? undefined
        : Array.isArray(profile.texts) && profile.texts.length > 0,
  };
}

function parseProfileId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(404, 'NOT_FOUND', '档案不存在');
  }
  return id;
}

function assertArticleLengths(texts) {
  if (texts.some((text) => text.length < MIN_ARTICLE_CHARS)) {
    throw new AppError(
      400,
      'INVALID_TEXTS',
      `有一篇文章太短了，至少需要 ${MIN_ARTICLE_CHARS} 个字符`
    );
  }
  if (texts.some((text) => text.length > MAX_ARTICLE_CHARS)) {
    throw new AppError(
      400,
      'INVALID_TEXTS',
      `单篇文章不能超过 ${MAX_ARTICLE_CHARS} 个字符`
    );
  }
}

// 与 stats.charCount 保持一致：不计空白字符，避免页面两处字数对不上。
function countChars(texts) {
  return texts.reduce(
    (sum, text) => sum + String(text).replace(/\s/g, '').length,
    0
  );
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const profiles = await prisma.profile.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        stats: true,
        semantic: true,
        createdAt: true,
      },
    });
    res.json({ profiles: profiles.map(profileResponse) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 30);
    if (!name) {
      throw new AppError(400, 'INVALID_NAME', '请给这份笔迹起一个名字');
    }

    const texts = normalizeTexts(req.body?.texts);
    if (texts.length < 3 || texts.length > 10) {
      throw new AppError(400, 'INVALID_TEXTS', '请提供 3–10 篇文章');
    }
    assertArticleLengths(texts);
    const totalChars = countChars(texts);
    if (totalChars < 200) {
      throw new AppError(400, 'INVALID_TEXTS', '语料太少了，建议至少提供 200 个字');
    }
    if (totalChars > MAX_PROFILE_CHARS) {
      throw new AppError(
        400,
        'INVALID_TEXTS',
        `总字数不能超过 ${MAX_PROFILE_CHARS} 个字符`
      );
    }

    const stats = analyzeStats(texts);
    const { semantic } = await extractSemantic(texts);

    const profile = await prisma.profile.create({
      data: {
        userId: req.userId,
        name,
        stats,
        semantic,
        // 保存原文，之后可以继续追加文章并重新提取风格。
        texts,
      },
      select: PROFILE_FIELDS_WITH_TEXTS,
    });

    res.status(201).json({
      profile: profileResponse(profile),
    });
  })
);

router.post(
  '/:id/append',
  asyncHandler(async (req, res) => {
    const id = parseProfileId(req.params.id);
    const newTexts = normalizeTexts(req.body?.texts);
    if (newTexts.length < 1 || newTexts.length > MAX_APPEND_ARTICLES) {
      throw new AppError(
        400,
        'INVALID_TEXTS',
        `每次可追加 1–${MAX_APPEND_ARTICLES} 篇文章`
      );
    }
    assertArticleLengths(newTexts);

    const profile = await prisma.profile.findFirst({
      where: { id, userId: req.userId },
      select: {
        id: true,
        texts: true,
      },
    });
    if (!profile) {
      throw new AppError(404, 'NOT_FOUND', '档案不存在');
    }

    const existingTexts = Array.isArray(profile.texts)
      ? profile.texts.map((text) => String(text || '')).filter(Boolean)
      : [];
    if (!existingTexts.length) {
      throw new AppError(
        409,
        'PROFILE_NO_SOURCE',
        '这份档案创建时没有保存原始文章，无法追加更新；请新建一份档案后再继续投喂'
      );
    }

    const allTexts = [...existingTexts, ...newTexts];
    if (allTexts.length > MAX_PROFILE_ARTICLES) {
      throw new AppError(
        400,
        'TEXT_LIMIT',
        `追加后最多保存 ${MAX_PROFILE_ARTICLES} 篇文章（当前 ${existingTexts.length} 篇，本次 ${newTexts.length} 篇）`
      );
    }
    const totalChars = countChars(allTexts);
    if (totalChars > MAX_PROFILE_CHARS) {
      throw new AppError(
        400,
        'TEXT_LIMIT',
        `追加后总字数不能超过 ${MAX_PROFILE_CHARS} 个字符（当前 ${countChars(existingTexts)} 字，本次 ${countChars(newTexts)} 字）`
      );
    }

    // 合并新旧语料后完整重算两层结果，保证档案仍然来自真实原文。
    const stats = analyzeStats(allTexts);
    const { semantic } = await extractSemantic(allTexts);

    const result = await prisma.profile.updateMany({
      where: { id, userId: req.userId },
      data: {
        texts: allTexts,
        stats,
        semantic,
      },
    });
    if (!result.count) {
      throw new AppError(404, 'NOT_FOUND', '档案不存在');
    }

    const updated = await prisma.profile.findFirst({
      where: { id, userId: req.userId },
      select: PROFILE_FIELDS_WITH_TEXTS,
    });
    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', '档案不存在');
    }

    res.json({
      profile: profileResponse(updated),
      meta: {
        addedArticles: newTexts.length,
        totalArticles: allTexts.length,
        addedChars: countChars(newTexts),
        totalChars,
      },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseProfileId(req.params.id);

    const profile = await prisma.profile.findFirst({
      where: { id, userId: req.userId },
      select: PROFILE_FIELDS_WITH_TEXTS,
    });
    if (!profile) {
      throw new AppError(404, 'NOT_FOUND', '档案不存在');
    }

    res.json({ profile: profileResponse(profile) });
  })
);

router.get(
  '/:id/articles',
  asyncHandler(async (req, res) => {
    const id = parseProfileId(req.params.id);

    const profile = await prisma.profile.findFirst({
      where: { id, userId: req.userId },
      select: {
        id: true,
        name: true,
        texts: true,
      },
    });
    if (!profile) {
      throw new AppError(404, 'NOT_FOUND', '档案不存在');
    }

    const articles = Array.isArray(profile.texts)
      ? profile.texts.map((text) => String(text || '')).filter(Boolean)
      : [];

    res.json({
      profile: { id: profile.id, name: profile.name },
      articles,
      meta: {
        count: articles.length,
        chars: countChars(articles),
        canAppend: articles.length > 0,
      },
    });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, 'stats') ||
      Object.prototype.hasOwnProperty.call(req.body || {}, 'semantic') ||
      Object.prototype.hasOwnProperty.call(req.body || {}, 'texts')
    ) {
      throw new AppError(
        400,
        'PROFILE_READONLY',
        '档案的统计与语义结果不能手动编辑；想更新风格，请使用「追加文章」投喂新语料'
      );
    }

    const id = parseProfileId(req.params.id);
    const name = String(req.body?.name || '').trim().slice(0, 30);
    if (!name) {
      throw new AppError(400, 'INVALID_NAME', '档案名不能为空');
    }

    // updateMany 也要带 userId：即使 id 猜对了，也只能改到自己名下的档案。
    const result = await prisma.profile.updateMany({
      where: { id, userId: req.userId },
      data: { name },
    });
    if (!result.count) {
      throw new AppError(404, 'NOT_FOUND', '档案不存在');
    }

    const profile = await prisma.profile.findFirst({
      where: { id, userId: req.userId },
      select: PROFILE_FIELDS_WITH_TEXTS,
    });
    if (!profile) {
      throw new AppError(404, 'NOT_FOUND', '档案不存在');
    }

    res.json({ profile: profileResponse(profile) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseProfileId(req.params.id);

    const result = await prisma.profile.deleteMany({
      where: { id, userId: req.userId },
    });
    if (!result.count) {
      throw new AppError(404, 'NOT_FOUND', '档案不存在');
    }

    res.json({ ok: true });
  })
);

module.exports = router;
