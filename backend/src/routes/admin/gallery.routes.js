'use strict';

const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const service = require('../../services/gallery.service');
const mediaLib = require('../../lib/media');
const galleryMedia = require('../../lib/gallery-media');
const config = require('../../config');
const { validate } = require('../../middleware/validate');
const { gallerySaveSchema } = require('../../validators/schemas');
const HttpError = require('../../lib/http-error');

const router = express.Router();

// ---------------------------------------------------------------------------
// Photo uploads
// ---------------------------------------------------------------------------
// Same policy as news uploads: raster images only, SVG rejected, filename and
// extension generated server-side. The declared MIME type is only a hint; the
// actual bytes are sniffed before a file is accepted.
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
        callback(null, galleryMedia.ensureUploadsDir());
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
      uploaded.forEach((file) => mediaLib.removeFileQuietly(file.path));
      return next(error);
    }

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
      url: `${galleryMedia.UPLOAD_URL_PREFIX}${file.filename}`,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    }));

    return res.status(201).json({ data: { files } });
  });
});

// ---------------------------------------------------------------------------
// Gallery settings + sections + photos (single atomic save)
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  res.json({ data: service.getAdminGallery() });
});

router.put('/', validate(gallerySaveSchema), (req, res) => {
  res.json({ data: service.saveGallery(req.validated) });
});

module.exports = router;
