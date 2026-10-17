const express = require('express');
const { listPlatforms } = require('../services/generate');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ platforms: listPlatforms() });
});

module.exports = router;
