const express = require('express');
const { prisma } = require('../db');
const { auth } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/error');
const { getPlatform } = require('../services/generate');

const router = express.Router();
router.use(auth);

const MAX_CONTENT_CHARS = 100000;
const MAX_TOPIC_CHARS = 5000;
const MAX_TITLE_CHARS = 120;

function parseArticleId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(404, 'NOT_FOUND', '文章不存在');
  }
  return id;
}

function normalizeContent(value) {
  const content = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!content) {
    throw new AppError(400, 'INVALID_CONTENT', '文章内容不能为空');
  }
  if (content.length > MAX_CONTENT_CHARS) {
    throw new AppError(
      400,
      'INVALID_CONTENT',
      `文章内容不能超过 ${MAX_CONTENT_CHARS} 个字符`
    );
  }
  return content;
}

function normalizeTopic(value) {
  const topic = String(value || '').replace(/\r\n/g, '\n').trim();
  if (topic.length > MAX_TOPIC_CHARS) {
    throw new AppError(400, 'INVALID_TOPIC', `主题/素材不能超过 ${MAX_TOPIC_CHARS} 个字符`);
  }
  return topic;
}

function normalizePlatform(value) {
  const key = String(value || '').trim();
  if (!key) {
    throw new AppError(400, 'INVALID_PLATFORM', '请选择发布平台');
  }
  getPlatform(key);
  return key;
}

function platformLabel(key) {
  try {
    return getPlatform(key).label;
  } catch {
    return key || '未知平台';
  }
}

function countChars(text) {
  return Array.from(String(text || '').replace(/\s/g, '')).length;
}

function deriveTitle({ title, topic, content }) {
  const explicit = String(title || '').replace(/\s+/g, ' ').trim();
  if (explicit) return explicit.slice(0, MAX_TITLE_CHARS);

  const topicLine = String(topic || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (topicLine) return topicLine.slice(0, 60);

  const contentLine = String(content || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (contentLine) return contentLine.slice(0, 60);

  return '未命名文章';
}

async function resolveProfile(userId, rawProfileId) {
  const hasProfile =
    rawProfileId !== null &&
    rawProfileId !== undefined &&
    rawProfileId !== 0 &&
    rawProfileId !== '0';

  if (!hasProfile) {
    return { profileId: null, profileName: null };
  }

  const profileId = Number(rawProfileId);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    throw new AppError(400, 'INVALID_PROFILE', '档案参数不正确');
  }

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: { id: true, name: true },
  });
  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', '档案不存在');
  }
  return { profileId: profile.id, profileName: profile.name };
}

function articleResponse(article) {
  return {
    id: article.id,
    title: article.title,
    topic: article.topic,
    platform: article.platform,
    platformLabel: platformLabel(article.platform),
    profileId: article.profileId,
    profileName: article.profileName,
    content: article.content,
    charCount: countChars(article.content),
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}

const ARTICLE_FIELDS = {
  id: true,
  title: true,
  topic: true,
  platform: true,
  profileId: true,
  profileName: true,
  content: true,
  createdAt: true,
  updatedAt: true,
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const articles = await prisma.article.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: ARTICLE_FIELDS,
    });

    res.json({
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        platform: article.platform,
        platformLabel: platformLabel(article.platform),
        profileId: article.profileId,
        profileName: article.profileName,
        preview: article.content.replace(/\s+/g, ' ').slice(0, 140),
        charCount: countChars(article.content),
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      })),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const content = normalizeContent(req.body?.content);
    const topic = normalizeTopic(req.body?.topic);
    const platform = normalizePlatform(req.body?.platform);
    const { profileId, profileName } = await resolveProfile(
      req.userId,
      req.body?.profileId
    );
    const title = deriveTitle({ title: req.body?.title, topic, content });

    const article = await prisma.article.create({
      data: {
        userId: req.userId,
        profileId,
        profileName,
        title,
        topic,
        platform,
        content,
      },
      select: ARTICLE_FIELDS,
    });

    res.status(201).json({ article: articleResponse(article) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseArticleId(req.params.id);
    const article = await prisma.article.findFirst({
      where: { id, userId: req.userId },
      select: ARTICLE_FIELDS,
    });
    if (!article) {
      throw new AppError(404, 'NOT_FOUND', '文章不存在');
    }
    res.json({ article: articleResponse(article) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseArticleId(req.params.id);
    const existing = await prisma.article.findFirst({
      where: { id, userId: req.userId },
      select: ARTICLE_FIELDS,
    });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', '文章不存在');
    }

    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'content')) {
      data.content = normalizeContent(req.body?.content);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'topic')) {
      data.topic = normalizeTopic(req.body?.topic);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'platform')) {
      data.platform = normalizePlatform(req.body?.platform);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'profileId')) {
      const profile = await resolveProfile(req.userId, req.body?.profileId);
      data.profileId = profile.profileId;
      data.profileName = profile.profileName;
    }

    const nextTopic = data.topic ?? existing.topic;
    const nextContent = data.content ?? existing.content;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
      data.title = deriveTitle({
        title: req.body?.title,
        topic: nextTopic,
        content: nextContent,
      });
    } else if (!existing.title) {
      data.title = deriveTitle({ topic: nextTopic, content: nextContent });
    }

    if (!Object.keys(data).length) {
      return res.json({ article: articleResponse(existing) });
    }

    await prisma.article.updateMany({
      where: { id, userId: req.userId },
      data,
    });

    const article = await prisma.article.findFirst({
      where: { id, userId: req.userId },
      select: ARTICLE_FIELDS,
    });
    if (!article) {
      throw new AppError(404, 'NOT_FOUND', '文章不存在');
    }

    res.json({ article: articleResponse(article) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseArticleId(req.params.id);
    const result = await prisma.article.deleteMany({
      where: { id, userId: req.userId },
    });
    if (!result.count) {
      throw new AppError(404, 'NOT_FOUND', '文章不存在');
    }
    res.json({ ok: true });
  })
);

module.exports = router;
