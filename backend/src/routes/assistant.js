const express = require('express');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { answerQuestion } = require('../services/assistant');

const router = express.Router();
router.use(auth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = await answerQuestion(req.body?.messages);
    res.json({ reply: result.reply });
  })
);

module.exports = router;
