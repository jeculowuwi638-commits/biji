const express = require('express');
const { prisma } = require('../db');
const { auth } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/error');
const {
  NARRATORS,
  CORRECTION_TYPES,
  NARRATOR_KEYS,
  analyzeStoryBible,
  answerNovelQuestion,
  appendCorrection,
  buildStyleProfileDraft,
  chapterLabel,
  checkNovelConsistency,
  countChars,
  generateNovelCandidates,
  normalizeCorrections,
  narratorLabel,
} = require('../services/novel');

const router = express.Router();
router.use(auth);

const MAX_NOVEL_TITLE_CHARS = 120;
const MAX_DESCRIPTION_CHARS = 3000;
const MAX_CHAPTER_TITLE_CHARS = 160;
const MAX_CHAPTER_CHARS = 200000;
const MAX_IMPORT_CHAPTERS = 20;
const MAX_IMPORT_TOTAL_CHARS = 1000000;
const MAX_CHAPTERS_PER_NOVEL = 500;
const MAX_REQUIREMENTS_CHARS = 3000;
const MAX_PLOT_DIRECTION_CHARS = 500;
const MAX_CHECK_CHARS = 40000;

function parseId(value, message) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(404, 'NOT_FOUND', message);
  }
  return id;
}

function normalizeTitle(value, { fallback = '', required = true } = {}) {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  if (!title) {
    if (!required) return fallback;
    throw new AppError(400, 'INVALID_TITLE', '请填写作品名称');
  }
  return title.slice(0, MAX_NOVEL_TITLE_CHARS);
}

function normalizeDescription(value) {
  const description = String(value || '').replace(/\r\n/g, '\n').trim();
  if (description.length > MAX_DESCRIPTION_CHARS) {
    throw new AppError(
      400,
      'INVALID_DESCRIPTION',
      `作品说明不能超过 ${MAX_DESCRIPTION_CHARS} 个字符`
    );
  }
  return description;
}

function normalizeNarrator(value, fallback = 'third-limited') {
  const key = String(value || '').trim() || fallback;
  if (!NARRATOR_KEYS.has(key)) {
    throw new AppError(400, 'INVALID_NARRATOR', '叙事视角不在可选范围内');
  }
  return key;
}

function normalizeBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  throw new AppError(400, 'INVALID_SETTING', '设定遵守选项必须是布尔值');
}

function normalizeChapterTitle(value, index) {
  const title = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!title) return `第 ${index + 1} 章`;
  return title.slice(0, MAX_CHAPTER_TITLE_CHARS);
}

function normalizeChapterContent(value) {
  const content = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!content) {
    throw new AppError(400, 'INVALID_CONTENT', '章节正文不能为空');
  }
  if (content.length > MAX_CHAPTER_CHARS) {
    throw new AppError(
      400,
      'INVALID_CONTENT',
      `单章正文不能超过 ${MAX_CHAPTER_CHARS} 个字符`
    );
  }
  return content;
}

async function resolveStyleProfile(userId, rawProfileId) {
  const hasProfile =
    rawProfileId !== null &&
    rawProfileId !== undefined &&
    rawProfileId !== 0 &&
    rawProfileId !== '0';

  if (!hasProfile) return null;

  const profileId = Number(rawProfileId);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    throw new AppError(400, 'INVALID_PROFILE', '笔迹档案参数不正确');
  }
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: { id: true, name: true },
  });
  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', '笔迹档案不存在');
  }
  return profile;
}

async function findNovel(userId, novelId) {
  const novel = await prisma.novelProject.findFirst({
    where: { id: novelId, userId },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      styleProfileId: true,
      narrator: true,
      strictSettings: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!novel) {
    throw new AppError(404, 'NOT_FOUND', '作品不存在');
  }
  return novel;
}

function chapterResponse(chapter, { includeContent = false } = {}) {
  const data = {
    id: chapter.id,
    order: chapter.order,
    orderLabel: chapterLabel(chapter.order),
    title: chapter.title,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt,
  };
  if (includeContent) {
    data.content = chapter.content;
    data.charCount = countChars(chapter.content);
  }
  return data;
}

function bibleResponse(bible) {
  if (!bible) return null;
  const corrections = normalizeCorrections(bible.corrections);
  return {
    id: bible.id,
    core: bible.core,
    corrections,
    sourceChapters: bible.sourceChapters,
    analyzedAt: bible.analyzedAt,
    updatedAt: bible.updatedAt,
    stats: {
      characters: Array.isArray(bible.core?.characters) ? bible.core.characters.length : 0,
      places: Array.isArray(bible.core?.places) ? bible.core.places.length : 0,
      worldRules: Array.isArray(bible.core?.worldRules) ? bible.core.worldRules.length : 0,
      events: Array.isArray(bible.core?.events) ? bible.core.events.length : 0,
      openForeshadowing: Array.isArray(bible.core?.foreshadowing)
        ? bible.core.foreshadowing.filter((item) => item.status === 'open').length
        : 0,
      corrections: corrections.notes.length,
    },
  };
}

function novelSummary(novel) {
  return {
    id: novel.id,
    title: novel.title,
    description: novel.description,
    narrator: novel.narrator,
    narratorLabel: narratorLabel(novel.narrator),
    strictSettings: novel.strictSettings,
    styleProfile: novel.styleProfile || null,
    chapterCount: novel._count?.chapters ?? novel.chapters?.length ?? 0,
    latestChapter: novel.chapters?.[0]
      ? chapterResponse(novel.chapters[0])
      : null,
    bible: novel.bible
      ? {
          sourceChapters: novel.bible.sourceChapters,
          analyzedAt: novel.bible.analyzedAt,
          analyzed: Boolean(novel.bible.analyzedAt),
        }
      : null,
    createdAt: novel.createdAt,
    updatedAt: novel.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* 元数据                                                              */
/* ------------------------------------------------------------------ */

router.get('/meta', (req, res) => {
  res.json({
    narrators: NARRATORS,
    correctionTypes: CORRECTION_TYPES,
    limits: {
      maxNovelTitleChars: MAX_NOVEL_TITLE_CHARS,
      maxDescriptionChars: MAX_DESCRIPTION_CHARS,
      maxChapterChars: MAX_CHAPTER_CHARS,
      maxImportChapters: MAX_IMPORT_CHAPTERS,
      maxChaptersPerNovel: MAX_CHAPTERS_PER_NOVEL,
      maxCheckChars: MAX_CHECK_CHARS,
    },
  });
});

/* ------------------------------------------------------------------ */
/* 作品                                                                */
/* ------------------------------------------------------------------ */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const novels = await prisma.novelProject.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        narrator: true,
        strictSettings: true,
        createdAt: true,
        updatedAt: true,
        styleProfile: { select: { id: true, name: true } },
        bible: { select: { sourceChapters: true, analyzedAt: true } },
        chapters: {
          orderBy: { order: 'desc' },
          take: 1,
          select: {
            id: true,
            order: true,
            title: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: { select: { chapters: true } },
      },
    });

    res.json({ novels: novels.map(novelSummary) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const title = normalizeTitle(req.body?.title);
    const description = normalizeDescription(req.body?.description);
    const narrator = normalizeNarrator(req.body?.narrator);
    const strictSettings = normalizeBoolean(req.body?.strictSettings, true);
    const styleProfile = await resolveStyleProfile(req.userId, req.body?.styleProfileId);

    const novel = await prisma.novelProject.create({
      data: {
        userId: req.userId,
        title,
        description: description || null,
        narrator,
        strictSettings,
        styleProfileId: styleProfile?.id ?? null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        narrator: true,
        strictSettings: true,
        createdAt: true,
        updatedAt: true,
        styleProfile: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ novel: novelSummary(novel) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    const novel = await prisma.novelProject.findFirst({
      where: { id, userId: req.userId },
      select: {
        id: true,
        title: true,
        description: true,
        narrator: true,
        strictSettings: true,
        createdAt: true,
        updatedAt: true,
        styleProfile: { select: { id: true, name: true } },
        bible: true,
        chapters: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            title: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!novel) {
      throw new AppError(404, 'NOT_FOUND', '作品不存在');
    }

    const latestChapter = novel.chapters.length
      ? novel.chapters[novel.chapters.length - 1]
      : null;
    const summary = novelSummary({
      ...novel,
      _count: { chapters: novel.chapters.length },
      chapters: latestChapter ? [latestChapter] : [],
    });

    res.json({
      novel: {
        ...summary,
        chapters: novel.chapters.map((chapter) => chapterResponse(chapter)),
        bible: bibleResponse(novel.bible),
      },
    });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    const existing = await findNovel(req.userId, id);
    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
      data.title = normalizeTitle(req.body?.title);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
      data.description = normalizeDescription(req.body?.description) || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'narrator')) {
      data.narrator = normalizeNarrator(req.body?.narrator, existing.narrator);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'strictSettings')) {
      data.strictSettings = normalizeBoolean(req.body?.strictSettings, existing.strictSettings);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'styleProfileId')) {
      const profile = await resolveStyleProfile(req.userId, req.body?.styleProfileId);
      data.styleProfileId = profile?.id ?? null;
    }

    if (!Object.keys(data).length) {
      throw new AppError(400, 'NOTHING_TO_UPDATE', '没有需要更新的内容');
    }

    const result = await prisma.novelProject.updateMany({
      where: { id, userId: req.userId },
      data,
    });
    if (!result.count) {
      throw new AppError(404, 'NOT_FOUND', '作品不存在');
    }

    const novel = await prisma.novelProject.findFirst({
      where: { id, userId: req.userId },
      select: {
        id: true,
        title: true,
        description: true,
        narrator: true,
        strictSettings: true,
        createdAt: true,
        updatedAt: true,
        styleProfile: { select: { id: true, name: true } },
        bible: { select: { sourceChapters: true, analyzedAt: true } },
        chapters: {
          orderBy: { order: 'desc' },
          take: 1,
          select: {
            id: true,
            order: true,
            title: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: { select: { chapters: true } },
      },
    });

    res.json({ novel: novelSummary(novel) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    const result = await prisma.novelProject.deleteMany({
      where: { id, userId: req.userId },
    });
    if (!result.count) {
      throw new AppError(404, 'NOT_FOUND', '作品不存在');
    }
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ */
/* 章节                                                                */
/* ------------------------------------------------------------------ */

router.get(
  '/:id/chapters',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    await findNovel(req.userId, id);
    const chapters = await prisma.novelChapter.findMany({
      where: { novelId: id, userId: req.userId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        order: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ chapters: chapters.map((chapter) => chapterResponse(chapter)) });
  })
);

router.get(
  '/:id/chapters/:chapterId',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    const chapterId = parseId(req.params.chapterId, '章节不存在');
    const chapter = await prisma.novelChapter.findFirst({
      where: { id: chapterId, novelId: id, userId: req.userId },
    });
    if (!chapter) {
      throw new AppError(404, 'NOT_FOUND', '章节不存在');
    }
    res.json({ chapter: chapterResponse(chapter, { includeContent: true }) });
  })
);

router.post(
  '/:id/chapters',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    await findNovel(req.userId, id);

    const rawList = Array.isArray(req.body?.chapters)
      ? req.body.chapters
      : [{ title: req.body?.title, content: req.body?.content }];

    if (!rawList.length || rawList.length > MAX_IMPORT_CHAPTERS) {
      throw new AppError(
        400,
        'INVALID_CHAPTERS',
        `每次可导入 1–${MAX_IMPORT_CHAPTERS} 章`
      );
    }

    const normalized = rawList.map((item, index) => ({
      title: normalizeChapterTitle(item?.title, index),
      content: normalizeChapterContent(item?.content),
    }));
    const totalChars = normalized.reduce((sum, item) => sum + item.content.length, 0);
    if (totalChars > MAX_IMPORT_TOTAL_CHARS) {
      throw new AppError(
        400,
        'INVALID_CHAPTERS',
        `本次导入总字数不能超过 ${MAX_IMPORT_TOTAL_CHARS} 个字符`
      );
    }

    const existingCount = await prisma.novelChapter.count({
      where: { novelId: id, userId: req.userId },
    });
    if (existingCount + normalized.length > MAX_CHAPTERS_PER_NOVEL) {
      throw new AppError(
        400,
        'CHAPTER_LIMIT',
        `每部作品最多保存 ${MAX_CHAPTERS_PER_NOVEL} 章`
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const last = await tx.novelChapter.findFirst({
        where: { novelId: id, userId: req.userId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      let nextOrder = (last?.order || 0) + 1;
      const rows = [];

      for (const item of normalized) {
        const chapter = await tx.novelChapter.create({
          data: {
            userId: req.userId,
            novelId: id,
            order: nextOrder,
            title: item.title,
            content: item.content,
          },
          select: {
            id: true,
            order: true,
            title: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        rows.push(chapter);
        nextOrder += 1;
      }

      await tx.novelProject.updateMany({
        where: { id, userId: req.userId },
        data: { updatedAt: new Date() },
      });

      return rows;
    });

    res.status(201).json({
      chapters: created.map((chapter) => chapterResponse(chapter)),
      meta: {
        added: created.length,
        chapterCount: existingCount + created.length,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* 故事记忆卡                                                          */
/* ------------------------------------------------------------------ */

router.get(
  '/:id/bible',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    await findNovel(req.userId, id);
    const bible = await prisma.storyBible.findFirst({
      where: { novelId: id, userId: req.userId },
    });
    res.json({ bible: bibleResponse(bible) });
  })
);

router.post(
  '/:id/analyze',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    const novel = await findNovel(req.userId, id);

    const [chapters, existingBible] = await Promise.all([
      prisma.novelChapter.findMany({
        where: { novelId: id, userId: req.userId },
        orderBy: { order: 'asc' },
      }),
      prisma.storyBible.findFirst({
        where: { novelId: id, userId: req.userId },
      }),
    ]);

    if (!chapters.length) {
      throw new AppError(400, 'NO_CHAPTERS', '请先导入至少一章正文，再分析故事记忆卡');
    }

    const { core, sourceChapters } = await analyzeStoryBible({
      novel,
      chapters,
      previousCore: existingBible?.core || null,
    });
    const analyzedAt = new Date();

    let bible;
    if (existingBible) {
      const result = await prisma.storyBible.updateMany({
        where: { id: existingBible.id, userId: req.userId },
        data: { core, sourceChapters, analyzedAt },
      });
      if (!result.count) {
        throw new AppError(404, 'NOT_FOUND', '故事记忆卡不存在');
      }
      bible = await prisma.storyBible.findFirst({
        where: { id: existingBible.id, userId: req.userId },
      });
    } else {
      bible = await prisma.storyBible.create({
        data: {
          userId: req.userId,
          novelId: id,
          core,
          corrections: { notes: [] },
          sourceChapters,
          analyzedAt,
        },
      });
    }

    let styleProfile = null;
    let styleProfileWarning = null;

    if (!novel.styleProfileId) {
      try {
        const draft = await buildStyleProfileDraft({ novel, chapters });
        const created = await prisma.profile.create({
          data: {
            userId: req.userId,
            name: draft.name,
            stats: draft.stats,
            semantic: draft.semantic,
            texts: draft.texts,
          },
          select: { id: true, name: true },
        });
        const claimed = await prisma.novelProject.updateMany({
          where: { id, userId: req.userId, styleProfileId: null },
          data: { styleProfileId: created.id },
        });
        if (claimed.count) {
          styleProfile = created;
        } else {
          // 另一个请求已经先写入了档案，删除本次多余产物，避免孤儿档案。
          await prisma.profile.deleteMany({
            where: { id: created.id, userId: req.userId },
          });
        }
      } catch (error) {
        if (error.code === 'NO_API_KEY') throw error;
        styleProfileWarning = {
          code: error.code || 'STYLE_PROFILE_FAILED',
          message:
            error.status && error.status < 500
              ? error.message
              : '故事记忆卡已生成，但自动文风档案没有建成；可以稍后重新分析，或手动绑定已有档案。',
        };
      }
    } else {
      styleProfile = await prisma.profile.findFirst({
        where: { id: novel.styleProfileId, userId: req.userId },
        select: { id: true, name: true },
      });
    }

    res.json({
      bible: bibleResponse(bible),
      styleProfile,
      styleProfileWarning,
      meta: {
        sourceChapters,
        analyzedAt,
      },
    });
  })
);

router.post(
  '/:id/bible/corrections',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    await findNovel(req.userId, id);

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'core')) {
      throw new AppError(
        400,
        'BIBLE_READONLY',
        '模型提取的核心统计不能直接修改；请提交“纠正设定”或“补充设定”'
      );
    }

    const bible = await prisma.storyBible.findFirst({
      where: { novelId: id, userId: req.userId },
    });
    if (!bible) {
      throw new AppError(409, 'BIBLE_NOT_READY', '请先分析章节，生成故事记忆卡');
    }

    const { corrections, note } = appendCorrection(bible.corrections, {
      type: req.body?.type,
      target: req.body?.target,
      content: req.body?.content,
    });
    const result = await prisma.storyBible.updateMany({
      where: { id: bible.id, userId: req.userId },
      data: { corrections },
    });
    if (!result.count) {
      throw new AppError(404, 'NOT_FOUND', '故事记忆卡不存在');
    }

    const updated = await prisma.storyBible.findFirst({
      where: { id: bible.id, userId: req.userId },
    });
    res.status(201).json({ bible: bibleResponse(updated), note });
  })
);

router.delete(
  '/:id/bible/corrections/:noteId',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    await findNovel(req.userId, id);

    const bible = await prisma.storyBible.findFirst({
      where: { novelId: id, userId: req.userId },
    });
    if (!bible) {
      throw new AppError(404, 'NOT_FOUND', '故事记忆卡不存在');
    }

    const corrections = normalizeCorrections(bible.corrections);
    const nextNotes = corrections.notes.filter((item) => item.id !== req.params.noteId);
    if (nextNotes.length === corrections.notes.length) {
      throw new AppError(404, 'NOT_FOUND', '这条纠正记录不存在');
    }

    await prisma.storyBible.updateMany({
      where: { id: bible.id, userId: req.userId },
      data: { corrections: { notes: nextNotes } },
    });
    const updated = await prisma.storyBible.findFirst({
      where: { id: bible.id, userId: req.userId },
    });
    res.json({ bible: bibleResponse(updated) });
  })
);

/* ------------------------------------------------------------------ */
/* 续写                                                                */
/* ------------------------------------------------------------------ */

async function loadNovelContext(userId, novelId, { withChapters = true } = {}) {
  const novel = await prisma.novelProject.findFirst({
    where: { id: novelId, userId },
    include: {
      styleProfile: true,
      bible: true,
      chapters: withChapters ? { orderBy: { order: 'asc' } } : false,
    },
  });
  if (!novel) {
    throw new AppError(404, 'NOT_FOUND', '作品不存在');
  }
  return novel;
}

router.post(
  '/:id/continue',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    const novel = await loadNovelContext(req.userId, id);
    const chapters = novel.chapters || [];

    if (!chapters.length) {
      throw new AppError(400, 'NO_CHAPTERS', '请先导入章节正文，再生成续写候选');
    }
    if (!novel.bible) {
      throw new AppError(409, 'BIBLE_NOT_READY', '请先分析章节，生成故事记忆卡');
    }

    const latest = chapters[chapters.length - 1];
    if (req.body?.currentChapterId !== undefined && req.body?.currentChapterId !== null) {
      const currentChapterId = Number(req.body.currentChapterId);
      if (currentChapterId !== latest.id) {
        throw new AppError(
          400,
          'CHAPTER_NOT_LATEST',
          '续写只从最新章节继续；历史章节仅供回看。请选择最新章节后再生成。'
        );
      }
    }

    const requirements = String(req.body?.requirements || '')
      .replace(/\r\n/g, '\n')
      .trim();
    if (requirements.length > MAX_REQUIREMENTS_CHARS) {
      throw new AppError(
        400,
        'INVALID_REQUIREMENTS',
        `续写要求不能超过 ${MAX_REQUIREMENTS_CHARS} 个字符`
      );
    }

    const plotDirection = String(req.body?.plotDirection || '').trim();
    if (plotDirection.length > MAX_PLOT_DIRECTION_CHARS) {
      throw new AppError(
        400,
        'INVALID_DIRECTION',
        `剧情方向不能超过 ${MAX_PLOT_DIRECTION_CHARS} 个字符`
      );
    }

    const rawLength = req.body?.targetLength;
    const targetLength =
      rawLength === undefined || rawLength === null || rawLength === ''
        ? 1500
        : Number(rawLength);
    if (!Number.isFinite(targetLength) || targetLength < 400 || targetLength > 3000) {
      throw new AppError(
        400,
        'INVALID_LENGTH',
        '期望续写长度需在 400–3000 字之间'
      );
    }

    const narrator = normalizeNarrator(req.body?.narrator, novel.narrator);
    const strictSettings = normalizeBoolean(req.body?.strictSettings, novel.strictSettings);

    const result = await generateNovelCandidates({
      novel,
      chapters,
      bible: novel.bible,
      profile: novel.styleProfile,
      requirements,
      targetLength,
      narrator,
      plotDirection,
      strictSettings,
    });

    res.json({
      ...result,
      context: {
        currentChapter: chapterResponse(latest),
        chapterCount: chapters.length,
        styleProfile: novel.styleProfile
          ? { id: novel.styleProfile.id, name: novel.styleProfile.name }
          : null,
        bibleAnalyzedAt: novel.bible.analyzedAt,
        corrections: normalizeCorrections(novel.bible.corrections).notes.length,
      },
      nextOrder: latest.order + 1,
    });
  })
);

router.post(
  '/:id/consistency',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    const novel = await loadNovelContext(req.userId, id);
    const chapters = novel.chapters || [];

    if (!novel.bible) {
      throw new AppError(409, 'BIBLE_NOT_READY', '请先分析章节，生成故事记忆卡');
    }

    let draft = '';
    let title = '';
    let checkedChapterId = null;
    let contextChapters = chapters;

    if (req.body?.content !== undefined && String(req.body.content).trim()) {
      draft = String(req.body.content).replace(/\r\n/g, '\n').trim();
      title = String(req.body?.title || '').trim().slice(0, 120);
    } else if (req.body?.chapterId !== undefined && req.body?.chapterId !== null) {
      const chapterId = parseId(req.body.chapterId, '章节不存在');
      const chapter = await prisma.novelChapter.findFirst({
        where: { id: chapterId, novelId: id, userId: req.userId },
      });
      if (!chapter) {
        throw new AppError(404, 'NOT_FOUND', '章节不存在');
      }
      draft = chapter.content.trim();
      title = chapter.title;
      checkedChapterId = chapter.id;
      contextChapters = chapters.filter((item) => item.id !== chapter.id);
    } else {
      throw new AppError(400, 'INVALID_CONTENT', '请提供待检查的续写稿或章节');
    }

    if (draft.length < 80) {
      throw new AppError(400, 'INVALID_CONTENT', '待检查内容太短，至少需要 80 个字符');
    }
    if (draft.length > MAX_CHECK_CHARS) {
      throw new AppError(
        400,
        'CONTENT_TOO_LONG',
        `一致性检查一次最多 ${MAX_CHECK_CHARS} 个字符；长章节可以分段检查`
      );
    }

    const result = await checkNovelConsistency({
      novel,
      chapters: contextChapters,
      bible: novel.bible,
      profile: novel.styleProfile,
      draft,
      title,
    });

    res.json({
      consistency: result,
      meta: {
        title: title || '未命名续写',
        charCount: countChars(draft),
        checkedChapterId,
        chapterCount: chapters.length,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* 小说助手                                                            */
/* ------------------------------------------------------------------ */

router.post(
  '/:id/assistant',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, '作品不存在');
    const novel = await prisma.novelProject.findFirst({
      where: { id, userId: req.userId },
      select: { id: true, title: true, narrator: true },
    });
    if (!novel) {
      throw new AppError(404, 'NOT_FOUND', '作品不存在');
    }

    // 助手只带最近三章原文；更早章节依赖故事记忆卡中的摘要，避免把整本书塞进上下文。
    const [recentDesc, bible] = await Promise.all([
      prisma.novelChapter.findMany({
        where: { novelId: id, userId: req.userId },
        orderBy: { order: 'desc' },
        take: 3,
      }),
      prisma.storyBible.findFirst({
        where: { novelId: id, userId: req.userId },
      }),
    ]);

    const chapters = recentDesc.slice().reverse();
    const result = await answerNovelQuestion({
      novel,
      chapters,
      bible,
      messages: req.body?.messages,
    });

    res.json({
      reply: result.reply,
      meta: {
        recentChapters: chapters.map((chapter) => chapterResponse(chapter)),
        hasBible: Boolean(bible),
      },
    });
  })
);

module.exports = router;
