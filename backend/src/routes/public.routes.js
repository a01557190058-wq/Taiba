'use strict';

const express = require('express');
const departmentsService = require('../services/departments.service');
const applicationsService = require('../services/applications.service');
const contentService = require('../services/content.service');
const { validate } = require('../middleware/validate');
const { applicationCreateSchema } = require('../validators/schemas');
const { applicationLimiter } = require('../middleware/rate-limit');
const { requireCsrf } = require('../middleware/csrf');
const { toLines } = require('../lib/text');
const HttpError = require('../lib/http-error');

const router = express.Router();

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({ data: { status: 'ok', time: new Date().toISOString() } });
});

// ---------------------------------------------------------------------------
// Departments (public, published + active only)
// ---------------------------------------------------------------------------
router.get('/departments', (req, res) => {
  const items = departmentsService.listPublic().map((department) => ({
    id: department.id,
    name: department.name,
    slug: department.slug,
    short_description: department.short_description,
    image_url: department.image_url,
    sort_order: department.sort_order,
    skills: department.skills,
  }));
  res.json({ data: items, meta: { total: items.length } });
});

router.get('/departments/:slug', (req, res, next) => {
  const department = departmentsService.getPublicBySlug(req.params.slug);
  if (!department) {
    return next(HttpError.notFound('القسم غير متوفر أو غير منشور حاليًا.'));
  }
  return res.json({ data: department });
});

// ---------------------------------------------------------------------------
// School content (public)
// ---------------------------------------------------------------------------
router.get('/school-content', (req, res) => {
  const { content, faqs } = contentService.getPublicContent();
  res.json({
    data: {
      content,
      faqs,
      objectives: toLines(content.objectives),
      admission_steps: toLines(content.admission_instructions),
    },
  });
});

// ---------------------------------------------------------------------------
// Student applications (public submission only)
// ---------------------------------------------------------------------------
router.post(
  '/applications',
  applicationLimiter,
  requireCsrf,
  validate(applicationCreateSchema),
  (req, res, next) => {
    try {
      const { application } = applicationsService.create(req.validated);
      // Public response deliberately excludes admin_notes and internal ids.
      return res.status(201).json({
        data: {
          reference_number: application.reference_number,
          full_name: application.full_name,
          department_name: application.department_name,
          status: application.status,
          status_label: application.status_label,
          submitted_at: application.submitted_at,
          message:
            'تم تسجيل طلبك بنجاح. احتفظ برقم الطلب لمتابعة حالته. إرسال الطلب لا يعني القبول النهائي.',
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
