const express = require('express');
const { getDemoPayload } = require('../demo/demoData');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getDemoPayload());
});

module.exports = router;
