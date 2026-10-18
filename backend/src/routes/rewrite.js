const express = require('express');
const { prisma } = require('../db');
const { auth } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/error');
const { getPlatform } = require('../services/generate');
const { rewriteContent, evaluateRewriteGuard } = require('../services/rewrite');

const router = express.Router();
router.use(auth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const content = String(req.body?.content || '').trim();
    if (!content) {
      throw new AppError(400, 'INVALID_CONTENT', '没有可以改写的正文');
    }
    if (content.length > 30000) {
      throw new AppError(400, 'INVALID_CONTENT', '正文太长了，最多 30000 个字符');
    }

    const platformKey = req.body?.platform ? String(req.body.platform) : null;
    if (platformKey) getPlatform(platformKey);

    const rawProfileId = req.body?.profileId;
    const hasProfile =
      rawProfileId !== null &&
      rawProfileId !== undefined &&
      rawProfileId !== 0 &&
      rawProfileId !== '0';

    let profile = null;
    if (hasProfile) {
      const profileId = Number(rawProfileId);
      if (!Number.isInteger(profileId) || profileId <= 0) {
        throw new AppError(400, 'INVALID_PROFILE', '档案参数不正确');
      }
      profile = await prisma.profile.findFirst({
        where: { id: profileId, userId: req.userId },
        select: { id: true, stats: true, semantic: true },
      });
      if (!profile) {
        throw new AppError(404, 'NOT_FOUND', '档案不存在');
      }
    }

    const problems = Array.isArray(req.body?.problems) ? req.body.problems : [];
    const result = await rewriteContent({
      content,
      problems,
      profile,
      platform: platformKey,
      topic: req.body?.topic ? String(req.body.topic).slice(0, 5000) : '',
    });

    const guard = evaluateRewriteGuard({
      originalContent: content,
      candidateContent: result.content,
      profile,
      platform: platformKey,
    });

    res.json({
      content: guard.content,
      accepted: guard.accepted,
      beforeScore: guard.beforeScore,
      afterScore: guard.afterScore,
      score: guard.score,
    });
  })
);

module.exports = router;
