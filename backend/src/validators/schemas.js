'use strict';

/**
 * Request schemas (zod). Every write endpoint validates its payload here,
 * server-side, independently of any frontend validation.
 */
const { z } = require('zod');
const { cleanText, normalizePhone, slugify } = require('../lib/text');
const { isImageUrl, isVideoUrl } = require('../lib/media');

const arabic = {
  required: (label) => `${label} مطلوب.`,
  string: (label) => `${label} يجب أن يكون نصًا.`,
  tooShort: (label, min) => `${label} قصير جدًا (${min} أحرف على الأقل).`,
  tooLong: (label, max) => `${label} طويل جدًا (${max} حرفًا كحد أقصى).`,
  invalid: (label) => `${label} غير صالح.`,
};

const text = (label, { min = 0, max = 2000 } = {}) =>
  z
    .string({
      error: (issue) =>
        issue.input === undefined ? arabic.required(label) : arabic.string(label),
    })
    .transform((value) => cleanText(value))
    .refine((value) => (min === 0 ? true : value.length >= min), {
      message: arabic.tooShort(label, min),
    })
    .refine((value) => value.length <= max, { message: arabic.tooLong(label, max) });

const optionalText = (label, max) =>
  z
    .string()
    .nullish()
    .transform((value) => cleanText(value ?? ''))
    .refine((value) => value.length <= max, { message: arabic.tooLong(label, max) });

const slugField = z
  .string({ error: 'المعرّف (slug) مطلوب.' })
  .transform((value) => slugify(value))
  .refine((value) => value.length >= 2, { message: 'المعرّف قصير جدًا.' })
  .refine((value) => value.length <= 140, { message: 'المعرّف طويل جدًا.' })
  .refine((value) => /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value), {
    message: 'المعرّف يقبل الحروف والأرقام والشرطات فقط.',
  });

const imageUrlField = z
  .string()
  .nullish()
  .transform((value) => cleanText(value ?? ''))
  .refine(
    (value) => {
      if (value === '') return true;
      // Reject protocol-relative URLs (//evil.example), backslashes and any
      // whitespace: only same-origin absolute paths or real http(s) URLs are
      // accepted for image sources.
      if (value.startsWith('//') || value.includes('\\') || /\s/.test(value)) return false;
      return value.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(value);
    },
    { message: 'رابط الصورة يجب أن يبدأ بـ / أو http(s)://' }
  )
  .refine((value) => value.length <= 500, { message: 'رابط الصورة طويل جدًا.' });

const booleanField = z.union([z.boolean(), z.literal(0), z.literal(1), z.enum(['true', 'false'])]).transform((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return value === 'true';
});

const sortOrderField = z.coerce
  .number({ error: 'ترتيب العرض يجب أن يكون رقمًا.' })
  .int({ message: 'ترتيب العرض يجب أن يكون عددًا صحيحًا.' })
  .min(0, { message: 'ترتيب العرض لا يمكن أن يكون سالبًا.' })
  .max(9999, { message: 'ترتيب العرض كبير جدًا.' });

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
const departmentCreateSchema = z.object({
  name: text('اسم القسم', { min: 2, max: 120 }),
  slug: z.union([slugField, z.literal('')]).optional(),
  short_description: text('الوصف المختصر', { min: 10, max: 300 }),
  description: text('الوصف الكامل', { min: 30, max: 6000 }),
  educational_focus: optionalText('التركيز التعليمي', 2000),
  skills: optionalText('المهارات', 2000),
  admission_info: optionalText('معلومات القبول', 1000),
  image_url: imageUrlField,
  is_published: booleanField.default(false),
  is_active: booleanField.default(true),
  sort_order: sortOrderField.default(0),
});

const departmentUpdateSchema = z
  .object({
    name: text('اسم القسم', { min: 2, max: 120 }).optional(),
    slug: slugField.optional(),
    short_description: text('الوصف المختصر', { min: 10, max: 300 }).optional(),
    description: text('الوصف الكامل', { min: 30, max: 6000 }).optional(),
    educational_focus: optionalText('التركيز التعليمي', 2000).optional(),
    skills: optionalText('المهارات', 2000).optional(),
    admission_info: optionalText('معلومات القبول', 1000).optional(),
    image_url: imageUrlField.optional(),
    is_published: booleanField.optional(),
    is_active: booleanField.optional(),
    sort_order: sortOrderField.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'لا توجد بيانات للتحديث.' });

// ---------------------------------------------------------------------------
// Public application form
// ---------------------------------------------------------------------------
const phoneSchema = z
  .string({ error: 'رقم الهاتف مطلوب.' })
  .transform((value) => normalizePhone(value))
  .refine((value) => /^\+?\d{7,15}$/.test(value), {
    message: 'رقم الهاتف يجب أن يحتوي على 7 إلى 15 رقمًا.',
  });

const applicationCreateSchema = z.object({
  full_name: text('الاسم الكامل', { min: 3, max: 100 }).refine(
    (value) => /^[\p{L}\p{M}\s'.-]+$/u.test(value),
    { message: 'الاسم الكامل يحتوي على رموز غير مسموحة.' }
  ),
  phone: phoneSchema,
  email: z
    .string()
    .nullish()
    .transform((value) => cleanText(value ?? '').toLowerCase())
    .refine((value) => value === '' || (value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)), {
      message: 'البريد الإلكتروني غير صالح.',
    }),
  department_id: z.coerce
    .number({
      error: (issue) => (issue.input === undefined ? 'يجب اختيار القسم.' : 'القسم غير صالح.'),
    })
    .int({ message: 'القسم غير صالح.' })
    .positive({ message: 'يجب اختيار القسم.' }),
  previous_education: optionalText('المؤهل أو المرحلة السابقة', 150),
  additional_notes: optionalText('ملاحظات إضافية', 1000),
  consent: z.literal(true, {
    error: 'يجب الموافقة على معالجة البيانات قبل الإرسال.',
  }),
});

// ---------------------------------------------------------------------------
// Admin: applications
// ---------------------------------------------------------------------------
const APPLICATION_STATUSES = ['NEW', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'];

const applicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES, {
    error: 'حالة الطلب غير صالحة.',
  }),
});

const applicationNotesSchema = z.object({
  admin_notes: optionalText('الملاحظات الإدارية', 2000),
});

// ---------------------------------------------------------------------------
// Admin: school content & FAQ
// ---------------------------------------------------------------------------
const schoolContentSchema = z
  .record(z.string(), z.string({ error: 'قيمة المحتوى يجب أن تكون نصًا.' }))
  .transform((record) => {
    const cleaned = {};
    for (const [key, value] of Object.entries(record)) cleaned[key] = cleanText(value);
    return cleaned;
  });

const faqCreateSchema = z.object({
  question: text('السؤال', { min: 5, max: 300 }),
  answer: text('الإجابة', { min: 5, max: 2000 }),
  sort_order: sortOrderField.default(0),
  is_published: booleanField.default(true),
});

const faqUpdateSchema = z
  .object({
    question: text('السؤال', { min: 5, max: 300 }).optional(),
    answer: text('الإجابة', { min: 5, max: 2000 }).optional(),
    sort_order: sortOrderField.optional(),
    is_published: booleanField.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'لا توجد بيانات للتحديث.' });

// ---------------------------------------------------------------------------
// Admin: news
// ---------------------------------------------------------------------------
const publishedAtField = z
  .string()
  .nullish()
  .transform((value) => cleanText(value ?? ''))
  .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), {
    message: 'تاريخ النشر غير صالح.',
  })
  .transform((value) => (value === '' ? null : new Date(value).toISOString()));

const newsMediaItemSchema = z
  .object({
    type: z.enum(['image', 'video'], {
      error: 'نوع الوسيط يجب أن يكون صورة أو فيديو.',
    }),
    url: z
      .string({ error: 'رابط الوسيط مطلوب.' })
      .transform((value) => cleanText(value))
      .refine((value) => value.length > 0, { message: 'رابط الوسيط مطلوب.' })
      .refine((value) => value.length <= 500, { message: 'رابط الوسيط طويل جدًا.' }),
    caption: optionalText('وصف الوسيط', 200),
    sort_order: sortOrderField.default(0),
  })
  .superRefine((item, ctx) => {
    if (item.type === 'image' && !isImageUrl(item.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'رابط الصورة غير صالح. استخدم صورة مرفوعة أو رابطًا يبدأ بـ http(s)://.',
      });
    }
    if (item.type === 'video' && !isVideoUrl(item.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'رابط الفيديو غير مدعوم. استخدم رابط YouTube أو Vimeo أو ملف MP4/WebM مباشر.',
      });
    }
  });

const newsMediaSchema = z
  .array(newsMediaItemSchema)
  .max(20, { message: 'يمكن إضافة 20 وسيطًا كحد أقصى لكل خبر.' })
  .superRefine((items, ctx) => {
    const images = items.filter((item) => item.type === 'image').length;
    const videos = items.filter((item) => item.type === 'video').length;
    if (images > 12) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'يمكن إضافة 12 صورة كحد أقصى.' });
    }
    if (videos > 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'يمكن إضافة 8 فيديوهات كحد أقصى.' });
    }
  });

const newsCreateSchema = z.object({
  title: text('عنوان الخبر', { min: 3, max: 160 }),
  slug: z.union([slugField, z.literal('')]).optional(),
  summary: text('الملخص', { min: 10, max: 500 }),
  body: text('نص الخبر', { min: 20, max: 12000 }),
  category: optionalText('التصنيف', 80),
  image_url: imageUrlField,
  media: newsMediaSchema.default([]),
  is_published: booleanField.default(false),
  is_featured: booleanField.default(false),
  published_at: publishedAtField,
  sort_order: sortOrderField.default(0),
});

const newsUpdateSchema = z
  .object({
    title: text('عنوان الخبر', { min: 3, max: 160 }).optional(),
    slug: slugField.optional(),
    summary: text('الملخص', { min: 10, max: 500 }).optional(),
    body: text('نص الخبر', { min: 20, max: 12000 }).optional(),
    category: optionalText('التصنيف', 80).optional(),
    image_url: imageUrlField.optional(),
    media: newsMediaSchema.optional(),
    is_published: booleanField.optional(),
    is_featured: booleanField.optional(),
    published_at: publishedAtField.optional(),
    sort_order: sortOrderField.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'لا توجد بيانات للتحديث.' });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  identifier: text('البريد الإلكتروني أو اسم المستخدم', { min: 3, max: 160 }),
  password: z
    .string({ error: 'كلمة المرور مطلوبة.' })
    .min(1, { message: 'كلمة المرور مطلوبة.' })
    .max(200, { message: 'كلمة المرور طويلة جدًا.' }),
});

const demoResetSchema = z.object({
  confirm: z.literal('RESET_DEMO_DATA', {
    error: 'تأكيد غير صالح لعملية إعادة التهيئة.',
  }),
});

const demoCleanupSchema = z.object({
  confirm: z.literal('DELETE_DEMO_DATA', {
    error: 'تأكيد غير صالح لعملية حذف البيانات التجريبية.',
  }),
});

/** Flatten a ZodError into { field: message } for the API response. */
function formatZodError(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_form';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

module.exports = {
  APPLICATION_STATUSES,
  departmentCreateSchema,
  departmentUpdateSchema,
  applicationCreateSchema,
  applicationStatusSchema,
  applicationNotesSchema,
  schoolContentSchema,
  faqCreateSchema,
  faqUpdateSchema,
  newsCreateSchema,
  newsUpdateSchema,
  loginSchema,
  demoResetSchema,
  demoCleanupSchema,
  formatZodError,
};
