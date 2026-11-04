'use strict';

const express = require('express');
const service = require('../../services/departments.service');
const { validate } = require('../../middleware/validate');
const { departmentCreateSchema, departmentUpdateSchema } = require('../../validators/schemas');
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
    state: ['published', 'draft', 'archived'].includes(req.query.state) ? req.query.state : 'all',
    isDemo,
    page,
    limit,
  });
  res.json({ data: items, meta: buildMeta({ page, limit, total }) });
});

router.post('/', validate(departmentCreateSchema), (req, res) => {
  res.status(201).json({ data: service.create(req.validated) });
});

router.get('/:id', (req, res, next) => {
  try {
    const department = service.getById(parseId(req.params.id, 'معرّف القسم'));
    if (!department) throw HttpError.notFound('القسم غير موجود.');
    return res.json({ data: department });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', validate(departmentUpdateSchema), (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف القسم');
    return res.json({ data: service.update(id, req.validated) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف القسم');
    const force = req.query.force === 'true' || req.query.force === '1';
    return res.json({ data: service.remove(id, { force }) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
