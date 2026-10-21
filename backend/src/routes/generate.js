const express = require('express');
const { prisma } = require('../db');
const { auth } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/error');
const {
  generateText,
  getPlatform,
  normalizeTuning,
} = require('../services/generate');

const router = express.Router();
router.use(auth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const topic = String(req.body?.topic || '').trim();
    if (!topic) {
      throw new AppError(400, 'INVALID_TOPIC', '请先写下这次想写什么');
    }
    if (topic.length > 5000) {
      throw new AppError(400, 'INVALID_TOPIC', '主题/素材不能超过 5000 个字符');
    }

    const platformKey = String(req.body?.platform || '');
    getPlatform(platformKey);

    const rawProfileId = req.body?.profileId;
    const hasProfile = rawProfileId !== null && rawProfileId !== undefined && rawProfileId !== 0 && rawProfileId !== '0';
    let profile = null;
    let profileId = null;

    if (hasProfile) {
      profileId = Number(rawProfileId);
      if (!Number.isInteger(profileId) || profileId <= 0) {
        throw new AppError(400, 'INVALID_PROFILE', '档案参数不正确');
      }
      profile = await prisma.profile.findFirst({
        where: { id: profileId, userId: req.userId },
        // 生成时要把档案里的原文一起发给模型，只靠 stats / semantic 的文字描述不够像。
        select: { id: true, stats: true, semantic: true, texts: true },
      });
      if (!profile) {
        throw new AppError(404, 'NOT_FOUND', '档案不存在');
      }
    }

    const tuningEnabled = Boolean(req.body?.tuningEnabled);
    const tuning = tuningEnabled ? normalizeTuning(req.body?.tuning || {}) : null;

    const result = await generateText({
      topic,
      platform: platformKey,
      profile,
      tuningEnabled,
      tuning,
    });

    const generation = await prisma.generation.create({
      data: {
        userId: req.userId,
        profileId,
        topic,
        platform: platformKey,
        tuning,
        content: result.content,
      },
      select: {
        id: true,
        profileId: true,
        platform: true,
        tuning: true,
        createdAt: true,
      },
    });

    res.json({
      id: generation.id,
      title: result.title,
      content: result.content,
      profileId: generation.profileId,
      platform: generation.platform,
      tuning: generation.tuning,
      createdAt: generation.createdAt,
    });
  })
);

module.exports = router;
