'use strict';

const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const departmentsService = require('../services/departments.service');
const applicationsService = require('../services/applications.service');
const contentService = require('../services/content.service');
const newsService = require('../services/news.service');
const galleryService = require('../services/gallery.service');
const subjectsService = require('../services/subjects.service');
const { SUBJECT_GRADES, SUBJECT_GRADE_VALUES } = require('../lib/subject-constants');
const config = require('../config');
const mediaLib = require('../lib/media');
const applicationDocuments = require('../lib/application-documents');
const { applicationCreateSchema } = require('../validators/schemas');
const { applicationLimiter } = require('../middleware/rate-limit');
const { requireCsrf } = require('../middleware/csrf');
const { toLines } = require('../lib/text');
const { parsePagination, buildMeta } = require('../lib/pagination');
const HttpError = require('../lib/http-error');

const router = express.Router();

// ---------------------------------------------------------------------------
// Admission document upload
// ---------------------------------------------------------------------------
// The three documents are submitted together with the form fields in one
// multipart request. Files are stored outside the public web root; the
// declared MIME type is only a hint and the real bytes are checked below.
const applicationUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      try {
        callback(null, applicationDocuments.ensureUploadsDir());
      } catch (error) {
        callback(error);
      }
    },
    filename(req, file, callback) {
      const extension = applicationDocuments.extensionForMime(file.mimetype) || '.bin';
      callback(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${extension}`);
    },
  }),
  limits: {
    fileSize: config.limits.applicationFileBytes,
    files: config.limits.applicationFilesPerRequest,
    fields: 40,
  },
  fileFilter(req, file, callback) {
    if (!applicationDocuments.extensionForMime(file.mimetype)) {
      return callback(
        HttpError.badRequest('صيغة الملف غير مدعومة. استخدم PDF أو صورة JPG/PNG واضحة.', {
          [file.fieldname]: 'صيغة الملف غير مدعومة.',
        })
      );
    }
    return callback(null, true);
  },
}).fields(applicationDocuments.DOCUMENT_KIND_LIST.map((kind) => ({ name: kind, maxCount: 1 })));

function uploadedFiles(req) {
  if (!req.files || typeof req.files !== 'object') return [];
  return Object.values(req.files).flat();
}

function removeUploadedFiles(files) {
  files.forEach((file) => mediaLib.removeFileQuietly(file.path));
}

function collectDocuments(req) {
  const files = uploadedFiles(req);
  const documents = [];

  for (const kind of applicationDocuments.DOCUMENT_KIND_LIST) {
    const file = (req.files && req.files[kind] && req.files[kind][0]) || null;
    if (!file) {
      return {
        error: HttpError.badRequest('أرفق جميع المستندات المطلوبة قبل إرسال الطلب.', {
          [kind]: 'هذا المستند مطلوب.',
        }),
      };
    }

    const realType = applicationDocuments.sniffDocumentFile(file.path);
    const expectedType = applicationDocuments.expectedSniffedType(file.mimetype);
    if (!realType || realType !== expectedType) {
      return {
        error: HttpError.badRequest(
          'محتوى أحد الملفات غير صالح. استخدم PDF أو صورة JPG/PNG سليمة.',
          { [kind]: 'محتوى الملف لا يطابق صيغته.' }
        ),
      };
    }

    documents.push({
      kind,
      original_name: applicationDocuments.sanitizeOriginalName(file.originalname),
      stored_name: file.filename,
      mime_type: realType,
      size_bytes: file.size,
    });
  }

  return { documents };
}


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
    return next(HttpError.notFound('التخصص غير متوفر أو غير منشور حاليًا.'));
  }
  return res.json({ data: department });
});

// ---------------------------------------------------------------------------
// School news (public, published only)
// ---------------------------------------------------------------------------
router.get('/news', (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { items, total } = newsService.listPublic({
    q: (req.query.q || '').toString().trim().slice(0, 120),
    category: (req.query.category || '').toString().trim().slice(0, 80),
    featured: req.query.featured === 'true' ? true : null,
    page,
    limit: Math.min(limit, 30),
  });
  res.json({
    data: items,
    meta: { ...buildMeta({ page, limit: Math.min(limit, 30), total }), categories: newsService.listCategories() },
  });
});

router.get('/news/:slug', (req, res, next) => {
  const article = newsService.getPublicBySlug(req.params.slug);
  if (!article) {
    return next(HttpError.notFound('الخبر غير متوفر أو غير منشور حاليًا.'));
  }
  return res.json({ data: { ...article, related: newsService.relatedPublic(article, 3) } });
});

// ---------------------------------------------------------------------------
// Photo gallery (public, published sections + photos only)
// ---------------------------------------------------------------------------
router.get('/gallery', (req, res) => {
  res.json({ data: galleryService.getPublicGallery() });
});

// ---------------------------------------------------------------------------
// Study subjects (public, published only, grouped into two sections)
//   ?grade=first|second|third  -> only that grade
//   ?department=<id>           -> department subjects + general subjects
// ---------------------------------------------------------------------------
router.get('/subjects', (req, res, next) => {
  const grade = req.query.grade === undefined ? null : String(req.query.grade);
  if (grade !== null && !SUBJECT_GRADE_VALUES.includes(grade)) {
    return next(HttpError.badRequest('الصف الدراسي غير صالح.'));
  }

  const department =
    req.query.department === undefined || req.query.department === ''
      ? null
      : Number.parseInt(String(req.query.department), 10);
  if (department !== null && (!Number.isInteger(department) || department <= 0)) {
    return next(HttpError.badRequest('التخصص المحدد غير صالح.'));
  }

  const grouped = subjectsService.getPublicGrouped({ grade, department });
  return res.json({
    data: {
      theoretical: grouped.theoretical,
      practical: grouped.practical,
      departments: grouped.departments,
    },
    meta: {
      ...grouped.counts,
      grade: grade || 'all',
      department: department || null,
      grades: SUBJECT_GRADES,
    },
  });
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
  (req, res, next) => {
    applicationUpload(req, res, (uploadError) => {
      const files = uploadedFiles(req);

      if (uploadError) {
        removeUploadedFiles(files);
        return next(uploadError);
      }

      const collected = collectDocuments(req);
      if (collected.error) {
        removeUploadedFiles(files);
        return next(collected.error);
      }

      const parsed = applicationCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        removeUploadedFiles(files);
        return next(parsed.error);
      }

      try {
        const { application } = applicationsService.create({
          ...parsed.data,
          documents: collected.documents,
        });
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
        removeUploadedFiles(files);
        return next(error);
      }
    });
  }
);

module.exports = router;
