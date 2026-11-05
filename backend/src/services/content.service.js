'use strict';

const db = require('../db');
const HttpError = require('../lib/http-error');

/**
 * Editable school content. Keys are fixed (whitelist) so administrators can
 * only edit known fields, and every value is stored/rendered as plain text.
 */
const CONTENT_DEFINITIONS = [
  { key: 'hero_badge', label: 'شعار أعلى الصفحة الرئيسية', group: 'الواجهة', type: 'text', max: 100 },
  { key: 'hero_subtitle', label: 'المقدمة القصيرة أسفل العنوان', group: 'الواجهة', type: 'textarea', max: 300 },
  { key: 'school_intro', label: 'نبذة عن المدرسة', group: 'عن المدرسة', type: 'textarea', max: 4000 },
  { key: 'vision', label: 'الرؤية', group: 'عن المدرسة', type: 'textarea', max: 1500 },
  { key: 'mission', label: 'الرسالة', group: 'عن المدرسة', type: 'textarea', max: 1500 },
  { key: 'objectives', label: 'الأهداف التعليمية (هدف في كل سطر)', group: 'عن المدرسة', type: 'textarea', max: 3000 },
  { key: 'learning_environment', label: 'البيئة التعليمية', group: 'عن المدرسة', type: 'textarea', max: 3000 },
  { key: 'practical_learning', label: 'التعلّم العملي والتقني', group: 'عن المدرسة', type: 'textarea', max: 3000 },
  { key: 'contact_phone', label: 'هاتف التواصل', group: 'التواصل', type: 'text', max: 60 },
  { key: 'contact_email', label: 'البريد الإلكتروني للتواصل', group: 'التواصل', type: 'text', max: 120 },
  { key: 'contact_address', label: 'العنوان', group: 'التواصل', type: 'text', max: 200 },
  { key: 'contact_hours', label: 'ساعات التواصل', group: 'التواصل', type: 'text', max: 120 },
  { key: 'admission_notice', label: 'تنبيه صفحة القبول', group: 'القبول', type: 'textarea', max: 500 },
  { key: 'admission_dates', label: 'مواعيد التقديم (تجريبية)', group: 'القبول', type: 'textarea', max: 500 },
  { key: 'admission_instructions', label: 'خطوات وإرشادات التقديم', group: 'القبول', type: 'textarea', max: 4000 },
  { key: 'application_note', label: 'ملاحظة أسفل نموذج التقديم', group: 'القبول', type: 'textarea', max: 500 },
];

const CONTENT_KEYS = CONTENT_DEFINITIONS.map((definition) => definition.key);
const CONTENT_BY_KEY = new Map(CONTENT_DEFINITIONS.map((definition) => [definition.key, definition]));

const DEFAULT_CONTENT = {
  hero_badge: 'بيانات تجريبية — مدرسة تقنية',
  hero_subtitle:
    'بيئة تعليمية تجمع بين الأساس النظري والتطبيق العملي في مجالات التقنية والهندسة، لإعداد طلاب قادرين على مواكبة سوق العمل الرقمي.',
  school_intro:
    'مدرسة طيبة تكنولوجي مدرسة تقنية تجريبية تهدف إلى تقديم تعليم تطبيقي في مجالات الحاسوب والهندسة والتقنيات الصناعية. يعتمد المنهج على مشروعات عملية ومختبرات مجهزة ومسارات تعليمية متدرجة، مع متابعة مستمرة لمستوى الطلاب. جميع البيانات والمواعيد والشهادات المذكورة في هذا الموقع تجريبية لأغراض العرض.',
  vision:
    'أن تكون مدرسة تقنية نموذجية في التعليم التطبيقي، تُخرّج كوادر قادرة على حل المشكلات التقنية والعمل ضمن فرق متعددة التخصصات.',
  mission:
    'تقديم تعليم تقني متوازن يجمع بين المعرفة النظرية والتدريب العملي، وبناء بيئة تعليمية آمنة ومحفزة، وتنمية مهارات التواصل والعمل الجماعي والمسؤولية المهنية لدى الطلاب.',
  objectives: [
    'ربط المناهج التقنية باحتياجات سوق العمل والمشروعات الواقعية.',
    'تنمية مهارات التفكير التحليلي وحل المشكلات لدى الطلاب.',
    'توفير تدريب عملي منتظم داخل مختبرات وورش المدرسة.',
    'تعزيز العمل الجماعي والتواصل المهني والمسؤولية الأخلاقية.',
    'دعم الطلاب في بناء ملف أعمال ومشروعات تخرّج تطبيقية.',
  ].join('\n'),
  learning_environment:
    'توفّر المدرسة بيئة تعليمية منظمة تجمع بين الفصول الدراسية والمختبرات التقنية ومساحات العمل الجماعي. يعمل الطلاب في مجموعات صغيرة على مشروعات موجهة، ويتابع المعلمون تقدم كل طالب بشكل دوري، مع مراعاة الفروق الفردية وتوفير أنشطة داعمة لمن يحتاجها.',
  practical_learning:
    'يعتمد التعلّم في مدرسة طيبة تكنولوجي على التطبيق أولًا: يبدأ الطالب بالأساسيات النظرية ثم ينتقل إلى تمارين معملية ومشروعات متكاملة. تُقيَّم الأعمال عبر ملفات إنجاز وعروض عملية، مما يساعد الطالب على بناء خبرة قابلة للعرض عند التقدم للعمل أو لمتابعة الدراسة.',
  contact_phone: '0100 000 0000 (رقم تجريبي)',
  contact_email: 'info@taiba.demo',
  contact_address: 'المدينة التعليمية — العنوان تجريبي لأغراض العرض',
  contact_hours: 'الأحد – الخميس، من 8:00 صباحًا إلى 3:00 مساءً',
  admission_notice:
    'هذه الصفحة تعرض بيانات قبول تجريبية لأغراض العرض فقط. لا تُعد المواعيد أو الشروط المذكورة متطلبات رسمية، ويجب التحقق منها من إدارة المدرسة.',
  admission_dates:
    'التقديم التجريبي مفتوح من 1 سبتمبر 2026 إلى 30 سبتمبر 2026. هذه المواعيد افتراضية وتستخدم لعرض عمل النظام فقط.',
  admission_instructions: [
    'اختر القسم المناسب من صفحة الأقسام واطّلع على وصفه ومهاراته.',
    'افتح نموذج التقديم وأدخل الاسم الكامل ورقم هاتف صحيحًا.',
    'اختر القسم المطلوب من القائمة، وأضف أي ملاحظات تساعد إدارة المدرسة.',
    'وافق على معالجة البيانات ثم أرسل الطلب.',
    'احتفظ برقم الطلب الظاهر بعد الإرسال لمتابعة الحالة لاحقًا.',
  ].join('\n'),
  application_note:
    'إرسال الطلب لا يعني القبول. سجل الطلب يصل إلى إدارة المدرسة للمراجعة، ويتم التواصل مع المتقدم عبر بيانات الاتصال المسجلة.',
};

const FAQ_SEED = [
  {
    question: 'هل إرسال الطلب يعني القبول النهائي؟',
    answer:
      'لا. إرسال الطلب يعني تسجيله لدى إدارة المدرسة فقط، ثم تتم مراجعته. حالة الطلب الأولية «جديد» ولا تعني القبول.',
    sort_order: 1,
  },
  {
    question: 'كيف أتابع حالة طلبي؟',
    answer:
      'احتفظ برقم الطلب الذي يظهر بعد الإرسال. يمكنك التواصل مع إدارة المدرسة وذكر الرقم للاستفسار عن الحالة.',
    sort_order: 2,
  },
  {
    question: 'هل يمكنني التقديم لأكثر من قسم؟',
    answer:
      'يمكنك إرسال طلب لكل قسم ترغب في الالتحاق به. يرجى استخدام نفس بيانات التواصل حتى تتمكن الإدارة من ربط الطلبات.',
    sort_order: 3,
  },
  {
    question: 'ما البيانات المطلوبة للتقديم؟',
    answer:
      'الاسم الكامل، رقم هاتف صحيح، القسم المطلوب، وموافقة على معالجة البيانات. البريد الإلكتروني والمؤهل السابق اختياريان في هذا العرض التجريبي.',
    sort_order: 4,
  },
  {
    question: 'هل هذه المواعيد والشروط رسمية؟',
    answer:
      'لا. جميع المواعيد والأقسام والبيانات المعروضة في هذا الموقع تجريبية لأغراض العرض التقني، ويجب الرجوع إلى إدارة المدرسة للتحقق منها.',
    sort_order: 5,
  },
];

function mapFaq(row) {
  if (!row) return null;
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sort_order: row.sort_order,
    is_published: Boolean(row.is_published),
    is_demo: Boolean(row.is_demo),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function readContentMap() {
  const rows = db.all('SELECT content_key, content_value FROM school_content');
  const map = { ...DEFAULT_CONTENT };
  for (const row of rows) {
    if (CONTENT_KEYS.includes(row.content_key)) {
      map[row.content_key] = row.content_value;
    }
  }
  return map;
}

function listPublishedFaqs() {
  return db
    .all('SELECT * FROM faqs WHERE is_published = 1 ORDER BY sort_order ASC, id ASC')
    .map(mapFaq);
}

function listAllFaqs() {
  return db.all('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').map(mapFaq);
}

/** Public payload: content + published FAQ only. */
function getPublicContent() {
  return { content: readContentMap(), faqs: listPublishedFaqs() };
}

/** Admin payload: everything plus the field definitions that drive the form. */
function getAdminContent() {
  return {
    content: readContentMap(),
    faqs: listAllFaqs(),
    definitions: CONTENT_DEFINITIONS,
  };
}

function updateContent(patch) {
  const entries = Object.entries(patch);
  if (!entries.length) throw HttpError.badRequest('لا توجد بيانات للتحديث.');

  for (const [key, value] of entries) {
    const definition = CONTENT_BY_KEY.get(key);
    if (!definition) {
      throw HttpError.badRequest(`حقل محتوى غير معروف: ${key}`);
    }
    if (value.length > definition.max) {
      throw HttpError.badRequest(
        `حقل «${definition.label}» أطول من الحد المسموح (${definition.max} حرفًا).`,
        { [key]: `الحد الأقصى ${definition.max} حرفًا.` }
      );
    }
  }

  db.transaction(() => {
    for (const [key, value] of entries) {
      db.run(
        `INSERT INTO school_content (content_key, content_value, updated_at)
         VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT (content_key) DO UPDATE SET
           content_value = excluded.content_value,
           updated_at = excluded.updated_at`,
        [key, value]
      );
    }
  });

  return getAdminContent();
}

function createFaq(payload) {
  const result = db.run(
    `INSERT INTO faqs (question, answer, sort_order, is_published, is_demo)
     VALUES (?, ?, ?, ?, 0)`,
    [payload.question, payload.answer, payload.sort_order || 0, payload.is_published ? 1 : 0]
  );
  return mapFaq(db.get('SELECT * FROM faqs WHERE id = ?', [Number(result.lastInsertRowid)]));
}

function updateFaq(id, payload) {
  const current = db.get('SELECT * FROM faqs WHERE id = ?', [id]);
  if (!current) throw HttpError.notFound('السؤال غير موجود.');

  const fields = [];
  const params = [];
  if (payload.question !== undefined) {
    fields.push('question = ?');
    params.push(payload.question);
  }
  if (payload.answer !== undefined) {
    fields.push('answer = ?');
    params.push(payload.answer);
  }
  if (payload.sort_order !== undefined) {
    fields.push('sort_order = ?');
    params.push(payload.sort_order);
  }
  if (payload.is_published !== undefined) {
    fields.push('is_published = ?');
    params.push(payload.is_published ? 1 : 0);
  }
  if (!fields.length) return mapFaq(current);

  fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  params.push(id);
  db.run(`UPDATE faqs SET ${fields.join(', ')} WHERE id = ?`, params);
  return mapFaq(db.get('SELECT * FROM faqs WHERE id = ?', [id]));
}

function removeFaq(id) {
  const current = db.get('SELECT id FROM faqs WHERE id = ?', [id]);
  if (!current) throw HttpError.notFound('السؤال غير موجود.');
  db.run('DELETE FROM faqs WHERE id = ?', [id]);
  return { id };
}

module.exports = {
  CONTENT_DEFINITIONS,
  CONTENT_KEYS,
  DEFAULT_CONTENT,
  FAQ_SEED,
  getPublicContent,
  getAdminContent,
  updateContent,
  createFaq,
  updateFaq,
  removeFaq,
  listPublishedFaqs,
  listAllFaqs,
  mapFaq,
};
