const express = require('express');
const { getDemoPayload } = require('../demo/demoData');
const llm = require('../services/llm');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    ...getDemoPayload(),
    llm: {
      configured: llm.isConfigured(),
      cache: llm.getCacheStatus().status,
    },
  });
});

module.exports = router;
