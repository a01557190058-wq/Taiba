'use strict';

const express = require('express');
const service = require('../../services/content.service');
const { validate } = require('../../middleware/validate');
const {
  schoolContentSchema,
  faqCreateSchema,
  faqUpdateSchema,
} = require('../../validators/schemas');
const { parseId } = require('../../lib/params');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ data: service.getAdminContent() });
});

router.patch('/', validate(schoolContentSchema), (req, res) => {
  res.json({ data: service.updateContent(req.validated) });
});

router.post('/faqs', validate(faqCreateSchema), (req, res) => {
  res.status(201).json({ data: service.createFaq(req.validated) });
});

router.patch('/faqs/:id', validate(faqUpdateSchema), (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف السؤال');
    return res.json({ data: service.updateFaq(id, req.validated) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/faqs/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف السؤال');
    return res.json({ data: service.removeFaq(id) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
