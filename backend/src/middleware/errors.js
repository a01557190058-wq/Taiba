'use strict';

const { ZodError } = require('zod');
const multer = require('multer');
const HttpError = require('../lib/http-error');
const { formatZodError } = require('../validators/schemas');
const config = require('../config');

/** 404 for unmatched API routes. */
function apiNotFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'المسار المطلوب غير موجود.' },
  });
}

/** Centralised error handler: one consistent JSON shape for the whole API. */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'تحقق من البيانات المدخلة.',
        fields: formatZodError(error),
      },
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    });
  }

  // multer (news/gallery/department images and admission documents)
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'حجم الملف أكبر من الحد المسموح. اختر ملفًا أصغر ثم حاول مرة أخرى.',
          fields: { _form: 'حجم الملف كبير جدًا.' },
        },
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: {
          code: 'TOO_MANY_FILES',
          message: 'عدد الملفات في الطلب أكبر من الحد المسموح.',
        },
      });
    }
    return res.status(400).json({
      error: { code: 'UPLOAD_ERROR', message: 'تعذّر رفع الملف. تحقق من الملف ثم حاول مرة أخرى.' },
    });
  }

  // body-parser / payload errors
  if (error && error.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'حجم البيانات المرسلة كبير جدًا.' },
    });
  }
  if (error && (error.type === 'entity.parse.failed' || error instanceof SyntaxError)) {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'صيغة البيانات المرسلة غير صحيحة.' },
    });
  }

  // express-rate-limit
  if (error && error.status === 429) {
    return res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'عدد المحاولات كبير. يرجى المحاولة لاحقًا.' },
    });
  }

  // Unexpected errors: log server-side, never leak internals to clients.
  // eslint-disable-next-line no-console
  console.error('[error]', error && error.stack ? error.stack : error);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isProduction
        ? 'حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.'
        : 'حدث خطأ غير متوقع في الخادم.',
    },
  });
}

module.exports = { apiNotFound, errorHandler };
