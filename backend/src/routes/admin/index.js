'use strict';

const express = require('express');
const { requireAdmin } = require('../../middleware/auth');
const { requireCsrf } = require('../../middleware/csrf');

const dashboardRoutes = require('./dashboard.routes');
const departmentRoutes = require('./departments.routes');
const applicationRoutes = require('./applications.routes');
const contentRoutes = require('./content.routes');
const newsRoutes = require('./news.routes');
const demoRoutes = require('./demo.routes');

const router = express.Router();

// Every administrative endpoint requires a valid session; state-changing
// requests additionally require a valid CSRF token.
router.use(requireAdmin);
router.use(requireCsrf);

router.use('/dashboard', dashboardRoutes);
router.use('/departments', departmentRoutes);
router.use('/applications', applicationRoutes);
router.use('/school-content', contentRoutes);
router.use('/news', newsRoutes);
router.use('/demo-data', demoRoutes);

module.exports = router;
