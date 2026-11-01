'use strict';

const express = require('express');
const { getDashboardStats } = require('../../services/stats.service');

const router = express.Router();

router.get('/stats', (req, res) => {
  res.json({ data: getDashboardStats() });
});

module.exports = router;
