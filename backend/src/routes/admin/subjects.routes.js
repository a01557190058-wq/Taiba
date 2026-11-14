'use strict';

const express = require('express');
const service = require('../../services/subjects.service');
const { validate } = require('../../middleware/validate');
const { subjectCreateSchema, subjectUpdateSchema } = require('../../validators/schemas');
const { parsePagination, buildMeta } = require('../../lib/pagination');
const { parseId } = require('../../lib/params');
const HttpError = require('../../lib/http-error');

const router = express.Router();

router.get('/', (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const isDemo =
    req.query.is_demo === 'true' ? true : req.query.is_demo === 'false' ? false : null;
  const { items, total } = service.listAdmin({
    q: (req.query.q || '').toString().trim().slice(0, 120),
    type: ['theoretical', 'practical'].includes(req.query.type) ? req.query.type : 'all',
    grade: ['first', 'second', 'third'].includes(req.query.grade) ? req.query.grade : 'all',
    departmentId: req.query.department_id,
    state: ['published', 'draft'].includes(req.query.state) ? req.query.state : 'all',
    isDemo,
    page,
    limit,
  });
  res.json({ data: items, meta: buildMeta({ page, limit, total }) });
});

router.post('/', validate(subjectCreateSchema), (req, res) => {
  res.status(201).json({ data: service.create(req.validated) });
});

router.get('/:id', (req, res, next) => {
  try {
    const subject = service.getById(parseId(req.params.id, 'معرّف المادة'));
    if (!subject) throw HttpError.notFound('المادة الدراسية غير موجودة.');
    return res.json({ data: subject });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', validate(subjectUpdateSchema), (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف المادة');
    return res.json({ data: service.update(id, req.validated) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف المادة');
    return res.json({ data: service.remove(id) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
