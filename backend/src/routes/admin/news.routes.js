'use strict';

const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const service = require('../../services/news.service');
const mediaLib = require('../../lib/media');
const config = require('../../config');
const { validate } = require('../../middleware/validate');
const { newsCreateSchema, newsUpdateSchema } = require('../../validators/schemas');
const { parsePagination, buildMeta } = require('../../lib/pagination');
const { parseId } = require('../../lib/params');
const HttpError = require('../../lib/http-error');

const router = express.Router();

// ---------------------------------------------------------------------------
// Image uploads
// ---------------------------------------------------------------------------
// Only raster images are accepted. SVG is deliberately rejected: it can carry
// scripts and would be served from our own origin. The browser-supplied MIME
// type is the first filter; the generated filename and extension come from a
// fixed allow-list, never from the client.
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      try {
        callback(null, mediaLib.ensureUploadsDir());
      } catch (error) {
        callback(error);
      }
    },
    filename(req, file, callback) {
      const extension = ALLOWED_IMAGE_TYPES.get(file.mimetype) || '.jpg';
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
    },
  }),
  limits: {
    fileSize: config.limits.uploadFileBytes,
    files: config.limits.uploadFilesPerRequest,
    fields: 4,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return callback(
        HttpError.badRequest('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP أو GIF.', {
          image: 'صيغة الصورة غير مدعومة.',
        })
      );
    }
    return callback(null, true);
  },
});

router.post('/uploads', (req, res, next) => {
  upload.array('images', config.limits.uploadFilesPerRequest)(req, res, (error) => {
    const uploaded = req.files || [];

    if (error) {
      // Multer may already have written some files before failing.
      uploaded.forEach((file) => mediaLib.removeFileQuietly(file.path));
      return next(error);
    }

    // The declared MIME type is only a hint: verify the actual bytes so a
    // renamed HTML/script/polyglot file can never land in the public folder.
    const invalid = uploaded.find((file) => !mediaLib.sniffImageFile(file.path));
    if (invalid) {
      uploaded.forEach((file) => mediaLib.removeFileQuietly(file.path));
      return next(
        HttpError.badRequest('محتوى الملف ليس صورة صالحة. استخدم JPG أو PNG أو WebP أو GIF.', {
          image: 'محتوى الملف ليس صورة صالحة.',
        })
      );
    }

    const files = uploaded.map((file) => ({
      url: `${mediaLib.UPLOAD_URL_PREFIX}${file.filename}`,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    }));

    return res.status(201).json({ data: { files } });
  });
});

router.get('/', (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const isDemo =
    req.query.is_demo === 'true' ? true : req.query.is_demo === 'false' ? false : null;
  const { items, total } = service.listAdmin({
    q: (req.query.q || '').toString().trim().slice(0, 120),
    state: ['published', 'draft', 'featured'].includes(req.query.state)
      ? req.query.state
      : 'all',
    isDemo,
    page,
    limit,
  });
  res.json({ data: items, meta: buildMeta({ page, limit, total }) });
});

router.post('/', validate(newsCreateSchema), (req, res) => {
  res.status(201).json({ data: service.create(req.validated) });
});

router.get('/:id', (req, res, next) => {
  try {
    const news = service.getById(parseId(req.params.id, 'معرّف الخبر'));
    if (!news) throw HttpError.notFound('الخبر غير موجود.');
    return res.json({ data: news });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', validate(newsUpdateSchema), (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف الخبر');
    return res.json({ data: service.update(id, req.validated) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'معرّف الخبر');
    return res.json({ data: service.remove(id) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
