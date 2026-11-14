'use strict';

/**
 * Request schemas (zod). Every write endpoint validates its payload here,
 * server-side, independently of any frontend validation.
 */
const { z } = require('zod');
const { cleanText, normalizePhone, slugify } = require('../lib/text');
const { isImageUrl, isVideoUrl } = require('../lib/media');
const { GALLERY_ICONS, GALLERY_LIMITS } = require('../lib/gallery-constants');
const {
  SUBJECT_TYPES,
  SUBJECT_GRADE_VALUES,
  DEFAULT_SUBJECT_GRADE,
  SUBJECT_ICONS,
  DEFAULT_SUBJECT_ICON,
} = require('../lib/subject-constants');

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
const DEPARTMENT_IMAGES_MAX = 12;

const departmentImageSchema = z.object({
  url: z
    .string({ error: 'رابط الصورة مطلوب.' })
    .transform((value) => cleanText(value))
    .refine((value) => value.length > 0, { message: 'رابط الصورة مطلوب.' })
    .refine((value) => value.length <= 500, { message: 'رابط الصورة طويل جدًا.' })
    .refine((value) => isImageUrl(value), {
      message: 'رابط الصورة غير صالح. ارفع صورة أو استخدم رابطًا يبدأ بـ http(s)://.',
    }),
  alt: optionalText('النص البديل للصورة', 200),
});

const departmentImagesSchema = z
  .array(departmentImageSchema)
  .max(DEPARTMENT_IMAGES_MAX, {
    message: `يمكن إضافة ${DEPARTMENT_IMAGES_MAX} صورة كحد أقصى للتخصص.`,
  });

const departmentCreateSchema = z.object({
  name: text('اسم المهنة/التخصص', { min: 2, max: 120 }),
  slug: z.union([slugField, z.literal('')]).optional(),
  short_description: text('الوصف المختصر', { min: 10, max: 300 }),
  description: text('الوصف الكامل', { min: 30, max: 6000 }),
  educational_focus: optionalText('التركيز التعليمي', 2000),
  skills: optionalText('المهارات', 2000),
  admission_info: optionalText('معلومات القبول', 1000),
  image_url: imageUrlField,
  images: departmentImagesSchema.optional(),
  is_published: booleanField.default(true),
  is_active: booleanField.default(true),
  sort_order: sortOrderField.default(0),
});

const departmentUpdateSchema = z
  .object({
    name: text('اسم المهنة/التخصص', { min: 2, max: 120 }).optional(),
    slug: slugField.optional(),
    short_description: text('الوصف المختصر', { min: 10, max: 300 }).optional(),
    description: text('الوصف الكامل', { min: 30, max: 6000 }).optional(),
    educational_focus: optionalText('التركيز التعليمي', 2000).optional(),
    skills: optionalText('المهارات', 2000).optional(),
    admission_info: optionalText('معلومات القبول', 1000).optional(),
    image_url: imageUrlField.optional(),
    images: departmentImagesSchema.optional(),
    is_published: booleanField.optional(),
    is_active: booleanField.optional(),
    sort_order: sortOrderField.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'لا توجد بيانات للتحديث.' });

// ---------------------------------------------------------------------------
// Public application form
// ---------------------------------------------------------------------------
const ARABIC_DIGITS = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

function toLatinDigits(value) {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] || digit);
}

const phoneSchema = z
  .string({ error: 'رقم الهاتف مطلوب.' })
  .transform((value) => normalizePhone(value))
  .refine((value) => /^\+?\d{7,15}$/.test(value), {
    message: 'رقم الهاتف يجب أن يحتوي على 7 إلى 15 رقمًا.',
  });

const optionalPhoneSchema = z
  .string()
  .nullish()
  .transform((value) => normalizePhone(value ?? ''))
  .refine((value) => value === '' || /^\+?\d{7,15}$/.test(value), {
    message: 'رقم الهاتف يجب أن يحتوي على 7 إلى 15 رقمًا.',
  });

const dateOfBirthField = z
  .string({ error: 'تاريخ الميلاد مطلوب.' })
  .transform((value) => cleanText(toLatinDigits(value)).replace(/\//g, '-'))
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: 'تاريخ الميلاد غير صالح. استخدم الصيغة يوم/شهر/سنة.',
  })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    { message: 'تاريخ الميلاد غير صالح.' }
  )
  .refine((value) => new Date(`${value}T00:00:00.000Z`) <= new Date(), {
    message: 'تاريخ الميلاد لا يمكن أن يكون في المستقبل.',
  });

const genderField = z.enum(['male', 'female'], {
  error: 'يجب اختيار النوع (ذكر أو أنثى).',
});

const guardianRelationField = z.enum(['father', 'mother', 'other'], {
  error: 'يجب تحديد صلة القرابة بولي الأمر.',
});

const nationalIdField = z
  .string({ error: 'الرقم القومي أو رقم الهوية مطلوب.' })
  .transform((value) => cleanText(toLatinDigits(value)).replace(/[\s-]+/g, ''))
  .refine((value) => value.length >= 6 && value.length <= 30, {
    message: 'الرقم القومي أو رقم الهوية يجب أن يكون بين 6 و30 حرفًا/رقمًا.',
  })
  .refine((value) => /^[\p{L}\p{N}]+$/u.test(value), {
    message: 'الرقم القومي أو رقم الهوية يحتوي على رموز غير مسموحة.',
  });

const preparatoryScoreField = z
  .string({ error: 'المجموع أو النسبة المئوية مطلوب.' })
  .transform((value) => cleanText(toLatinDigits(value)))
  .refine((value) => value.length > 0 && value.length <= 30, {
    message: 'أدخل المجموع أو النسبة المئوية (30 حرفًا كحد أقصى).',
  })
  .refine((value) => /^\d[\d\s.,%/]*$/.test(value), {
    message: 'أدخل المجموع أو النسبة كأرقام فقط، مثل 280 أو 85%.',
  });

const consentField = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || ['true', 'on', '1', 'yes'].includes(String(value).toLowerCase()))
  .refine((value) => value === true, {
    message: 'يجب إقرار ولي الأمر بصحة البيانات والموافقة على شروط القبول قبل الإرسال.',
  });

const applicationCreateSchema = z.object({
  full_name: text('الاسم الكامل', { min: 3, max: 100 }).refine(
    (value) => /^[\p{L}\p{M}\s'.-]+$/u.test(value),
    { message: 'الاسم الكامل يحتوي على رموز غير مسموحة.' }
  ),
  date_of_birth: dateOfBirthField,
  gender: genderField,
  national_id: nationalIdField,
  governorate: text('المحافظة', { min: 2, max: 80 }),
  educational_administration: text('الإدارة التعليمية', { min: 2, max: 120 }),
  // Guardian / primary contact
  guardian_name: text('اسم ولي الأمر', { min: 3, max: 100 }).refine(
    (value) => /^[\p{L}\p{M}\s'.-]+$/u.test(value),
    { message: 'اسم ولي الأمر يحتوي على رموز غير مسموحة.' }
  ),
  guardian_relation: guardianRelationField,
  guardian_phone: phoneSchema,
  // Optional extra contact for the student.
  phone: optionalPhoneSchema,
  email: z
    .string()
    .nullish()
    .transform((value) => cleanText(value ?? '').toLowerCase())
    .refine((value) => value === '' || (value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)), {
      message: 'البريد الإلكتروني غير صالح.',
    }),
  // Detailed address
  address_governorate: text('محافظة العنوان', { min: 2, max: 80 }),
  address_center: text('المركز', { min: 2, max: 120 }),
  address_city: text('المدينة أو القرية', { min: 2, max: 120 }),
  // Academic details
  department_id: z.coerce
    .number({
      error: (issue) => (issue.input === undefined ? 'يجب اختيار التخصص.' : 'التخصص غير صالح.'),
    })
    .int({ message: 'التخصص غير صالح.' })
    .positive({ message: 'يجب اختيار التخصص.' }),
  preparatory_score: preparatoryScoreField,
  previous_education: optionalText('المؤهل أو المرحلة السابقة', 150),
  additional_notes: optionalText('ملاحظات إضافية', 1000),
  consent: consentField,
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
// Admin: public gallery
// ---------------------------------------------------------------------------
const galleryImageSchema = z.object({
  url: z
    .string({ error: 'رابط الصورة مطلوب.' })
    .transform((value) => cleanText(value))
    .refine((value) => value.length > 0, { message: 'رابط الصورة مطلوب.' })
    .refine((value) => value.length <= 500, { message: 'رابط الصورة طويل جدًا.' })
    .refine((value) => isImageUrl(value), {
      message: 'رابط الصورة غير صالح. ارفع صورة أو استخدم رابطًا يبدأ بـ http(s)://.',
    }),
  thumb_url: z
    .string()
    .nullish()
    .transform((value) => cleanText(value ?? ''))
    .refine((value) => value === '' || (value.length <= 500 && isImageUrl(value)), {
      message: 'رابط الصورة المصغّرة غير صالح.',
    }),
  alt: optionalText('النص البديل للصورة', 200),
  caption: optionalText('وصف الصورة', 200),
  credit: optionalText('حقوق الصورة', 200),
  credit_url: z
    .string()
    .nullish()
    .transform((value) => cleanText(value ?? ''))
    .refine(
      (value) => value === '' || (value.length <= 500 && /^https?:\/\/[^\s]+$/i.test(value)),
      { message: 'رابط حقوق الصورة يجب أن يبدأ بـ http(s)://' }
    ),
  is_published: booleanField.default(true),
});

const gallerySectionSchema = z.object({
  slug: z
    .string()
    .nullish()
    .transform((value) => cleanText(value ?? ''))
    .refine((value) => value.length <= 140, { message: 'معرّف القسم طويل جدًا.' }),
  eyebrow: optionalText('العنوان الفرعي للقسم', 80),
  title: text('اسم القسم', { min: 2, max: 120 }),
  description: optionalText('وصف القسم', 1000),
  icon: z.enum(GALLERY_ICONS, { error: 'أيقونة القسم غير صالحة.' }).default('image'),
  is_published: booleanField.default(true),
  images: z
    .array(galleryImageSchema)
    .max(GALLERY_LIMITS.imagesPerSection, {
      message: `يمكن إضافة ${GALLERY_LIMITS.imagesPerSection} صورة كحد أقصى للقسم.`,
    }),
});

const gallerySettingsSchema = z.object({
  eyebrow: optionalText('العنوان الفرعي للصفحة', 80),
  title: text('عنوان صفحة المعرض', { min: 3, max: 160 }),
  lead: text('وصف صفحة المعرض', { min: 10, max: 600 }),
  credits_note: optionalText('ملاحظة مصادر الصور', 500),
  show_credits: booleanField.default(true),
});

const gallerySaveSchema = z.object({
  settings: gallerySettingsSchema,
  sections: z
    .array(gallerySectionSchema)
    .max(GALLERY_LIMITS.sections, {
      message: `يمكن إضافة ${GALLERY_LIMITS.sections} أقسام كحد أقصى.`,
    }),
});

// ---------------------------------------------------------------------------
// Admin: subjects (المواد الدراسية)
// ---------------------------------------------------------------------------
const subjectTypeField = z.enum(SUBJECT_TYPES, {
  error: 'نوع المادة يجب أن يكون نظرية أو عملية.',
});

const subjectIconField = z.enum(SUBJECT_ICONS, {
  error: 'أيقونة المادة غير صالحة.',
});

const subjectGradeField = z.enum(SUBJECT_GRADE_VALUES, {
  error: 'الصف الدراسي غير صالح.',
});

const subjectDepartmentField = z
  .union([z.number().int().positive(), z.null()], {
    error: 'التخصص المحدد غير صالح.',
  });

const subjectCreateSchema = z.object({
  name: text('اسم المادة', { min: 2, max: 120 }),
  description: optionalText('وصف المادة', 1000),
  type: subjectTypeField,
  grade: subjectGradeField.default(DEFAULT_SUBJECT_GRADE),
  department_id: subjectDepartmentField.default(null),
  icon: subjectIconField.default(DEFAULT_SUBJECT_ICON),
  sort_order: sortOrderField.default(0),
  is_published: booleanField.default(true),
});

const subjectUpdateSchema = z
  .object({
    name: text('اسم المادة', { min: 2, max: 120 }).optional(),
    description: optionalText('وصف المادة', 1000).optional(),
    type: subjectTypeField.optional(),
    grade: subjectGradeField.optional(),
    department_id: subjectDepartmentField.optional(),
    icon: subjectIconField.optional(),
    sort_order: sortOrderField.optional(),
    is_published: booleanField.optional(),
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
  departmentImageSchema,
  applicationCreateSchema,
  applicationStatusSchema,
  applicationNotesSchema,
  schoolContentSchema,
  faqCreateSchema,
  faqUpdateSchema,
  newsCreateSchema,
  newsUpdateSchema,
  galleryImageSchema,
  gallerySectionSchema,
  gallerySettingsSchema,
  gallerySaveSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
  loginSchema,
  demoResetSchema,
  demoCleanupSchema,
  formatZodError,
};
