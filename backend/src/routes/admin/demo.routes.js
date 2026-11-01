'use strict';

const express = require('express');
const demoService = require('../../services/demo.service');
const { validate } = require('../../middleware/validate');
const { demoResetSchema, demoCleanupSchema } = require('../../validators/schemas');

const router = express.Router();

/** Identify demo records (read-only overview). */
router.get('/', (req, res) => {
  res.json({ data: demoService.getDemoSummary() });
});

/** Insert any missing demo records (idempotent, never duplicates). */
router.post('/seed', (req, res) => {
  const summary = demoService.seedDemoData();
  res.json({ data: { summary, overview: demoService.getDemoSummary() } });
});

/** Delete demo records, then restore the demo dataset. Explicit confirmation. */
router.post('/reset', validate(demoResetSchema), (req, res) => {
  const result = demoService.resetDemoData();
  res.json({ data: result });
});

/** Delete demo records only (no reseed). Real records are untouched. */
router.post('/cleanup', validate(demoCleanupSchema), (req, res) => {
  const result = demoService.cleanupDemoData();
  res.json({ data: { ...result, overview: demoService.getDemoSummary() } });
});

module.exports = router;
