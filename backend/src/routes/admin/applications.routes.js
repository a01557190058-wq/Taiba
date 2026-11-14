'use strict';

const fs = require('node:fs');
const express = require('express');
const service = require('../../services/applications.service');
const applicationDocuments = require('../../lib/application-documents');
const { validate } = require('../../middleware/validate');
const {
  applicationStatusSchema,
  applicationNotesSchema,
  APPLICATION_STATUSES,
} = require('../../validators/schemas');
const { parsePagination, buildMeta } = require('../../lib/pagination');
const { parseId } = require('../../lib/params');
const HttpError = require('../../lib/http-error');

const router = express.Router();

function filtersFromQuery(query) {
  const departmentId = Number.parseInt(query.department_id, 10);
  return {
    q: (query.q || '').toString().trim().slice(0, 120),
    status: APPLICATION_STATUSES.includes(query.status) ? query.status : '',
    departmentId: Number.isInteger(departmentId) && departmentId > 0 ? departmentId : null,
    isDemo: query.is_demo === 'true' ? true : query.is_demo === 'false' ? false : null,
    sort: query.sort === 'oldest' ? 'oldest' : 'newest',
  };
}

// Declared before /:id so "export.csv" is never parsed as an id.
router.get('/export.csv', (req, res) => {
  const rows = service.listForExport(filtersFromQuery(req.query));
  const csv = service.toCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="taiba-applications-${stamp}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
});

router.get('/', (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { items, total } = service.listAdmin({
    ...filtersFromQuery(req.query),
    page,
    limit,
    includeAdminNotes: false,
  });
  res.json({ data: items, meta: buildMeta({ page, limit, total }) });
});

router.get('/:id/documents/:documentId', (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف الطلب');
    const documentId = parseId(req.params.documentId, 'معرّف المستند');
    const document = service.getDocument(id, documentId);
    if (!document) throw HttpError.notFound('المستند غير موجود.');

    const fullPath = applicationDocuments.storedFilePath(document.stored_name);
    if (!fullPath || !fs.existsSync(fullPath)) {
      throw HttpError.notFound('ملف المستند غير موجود.');
    }

    res.setHeader('Cache-Control', 'no-store');
    res.type(document.mime_type || 'application/octet-stream');
    return res.download(fullPath, document.original_name || document.stored_name);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف الطلب');
    const application = service.getById(id, { includeAdminNotes: true });
    if (!application) throw HttpError.notFound('الطلب غير موجود.');
    return res.json({ data: application });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', validate(applicationStatusSchema), (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف الطلب');
    return res.json({ data: service.updateStatus(id, req.validated.status) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/notes', validate(applicationNotesSchema), (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف الطلب');
    return res.json({ data: service.updateNotes(id, req.validated.admin_notes) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف الطلب');
    return res.json({ data: service.remove(id) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
