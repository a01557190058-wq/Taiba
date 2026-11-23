'use strict';

/**
 * Real study plan for Taiba Technology Complex – Beni Suef.
 *
 * The numbers supplied by the complex are weekly periods per subject. They are
 * stored in `weekly_periods` and rendered on the public subject card. Shared
 * subjects (Arabic, English, sport, mechanics, etc.) are seeded once per grade
 * with no department, so the existing public API shows them for every section.
 * The four trade groups in section 3 share one list across their four existing
 * departments, exactly as requested.
 */

const GRADE_KEYS = ['first', 'second', 'third'];

const DESCRIPTIONS = {
  عربي: 'اللغة العربية: قراءة وفهم نصوص، وتعبير كتابي واضح يدعم التواصل المهني والإبلاغ عن الأعمال.',
  إنجليزي: 'اللغة الإنجليزية: مفردات وتعابير تقنية تساعد على قراءة الأدلة والتعليمات والمواصفات.',
  رياضة: 'التربية الرياضية: أنشطة بدنية منظمة تنمّي اللياقة والانضباط والعمل الجماعي.',
  ميكا: 'الميكانيكا: أساسيات القوى والحركة والقياسات المرتبطة بالأجهزة والماكينات.',
  معلومات: 'تكنولوجيا المعلومات: أساسيات الحاسب واستخدام الأدوات الرقمية في التعلّم والتطبيق.',
  دين: 'التربية الدينية: قيم ومبادئ أخلاقية تعزّز المسؤولية والسلوك المهني السليم.',
  جودة: 'إدارة الجودة: مبادئ ضبط الجودة والقياس والتحسين المستمر في بيئة العمل.',
  ريادة: 'الريادة: أساسيات المشروعات الصغيرة وتخطيط الأفكار وتحويلها إلى مبادرات عملية.',
  تكنولوجيا: 'التكنولوجيا: تقنيات حديثة وتطبيقات عملية تخدم التخصص وتدعم حل المشكلات.',
  'رسم دوائر': 'رسم الدوائر: قراءة المخططات الكهربائية وترميز المكونات وتنفيذ دوائر تعليمية.',
  'هندسة كهربية': 'الهندسة الكهربية: قوانين الدوائر والقياسات الكهربائية وتطبيقاتها في التركيبات.',
  'رسم ومحاكاة': 'الرسم والمحاكاة: إعداد الرسومات واستخدام برمجيات المحاكاة لاختبار الأفكار قبل التنفيذ.',
  'رسم CAD+': 'الرسم بمساعدة الحاسوب (CAD): إنشاء الرسومات الهندسية الدقيقة وتعديلها رقميًا.',
  'رسم فني': 'الرسم الفني: قراءة المخططات وإنتاج رسومات تنفيذية بالقياسات والمواصفات الصحيحة.',
  ألوميتال: 'الألومتال: تشكيل مقاطع الألومنيوم وقطعها وتجميعها وفق الرسومات.',
  إنتاج: 'الإنتاج: تخطيط خطوات التشغيل وترتيب مراحل العمل ومراقبة الإنتاج.',
  'علم المواد': 'علم المواد: خصائص المعادن والمواد واختيارها بما يناسب الاستخدام الصناعي.',
  'مقدمة صيانة لاب': 'مقدمة صيانة اللاب: التعرف على أجهزة الحاسب وصيانة مكوناتها وأعطالها الشائعة.',
  'رسم دوائر إلكترونية': 'رسم الدوائر الإلكترونية: تمثيل المكونات وقراءة المخططات وتحليل الدوائر الإلكترونية.',
  'إحصاء واحتمالات': 'الإحصاء والاحتمالات: جمع البيانات وتلخيصها واستخدام الاحتمالات في تحليل النتائج.',
  'إدارة مشروعات': 'إدارة المشروعات: تخطيط المهام وتحديد الموارد ومتابعة التنفيذ حتى التسليم.',
  'جسم الإنسان': 'جسم الإنسان: أساسيات التشريح والوظائف الحيوية المرتبطة بالأجهزة الطبية.',
  فيزياء: 'الفيزياء: مفاهيم المادة والطاقة والحركة، مع تطبيقات في المختبر والتخصص.',
  كيمياء: 'الكيمياء: التفاعلات والمحاليل والتحاليل الأساسية مع الالتزام بأمان المعمل.',
  'مقدمة مشروعات': 'مقدمة المشروعات: بناء فكرة مشروع وتخطيطها وتنفيذ نموذج أولي وعرض النتائج.',
};

/** Subjects shared by every section of the same grade (department_id = NULL). */
const GENERAL_SUBJECTS = {
  first: [
    { name: 'عربي', weekly_periods: 2, type: 'theoretical', icon: 'book' },
    { name: 'إنجليزي', weekly_periods: 2, type: 'theoretical', icon: 'book' },
    { name: 'رياضة', weekly_periods: 2, type: 'practical', icon: 'users' },
    { name: 'ميكا', weekly_periods: 2, type: 'theoretical', icon: 'grid' },
    { name: 'معلومات', weekly_periods: 2, type: 'theoretical', icon: 'database' },
    { name: 'دين', weekly_periods: 1, type: 'theoretical', icon: 'star' },
  ],
  second: [
    { name: 'عربي', weekly_periods: 1, type: 'theoretical', icon: 'book' },
    { name: 'إنجليزي', weekly_periods: 2, type: 'theoretical', icon: 'book' },
    { name: 'رياضة', weekly_periods: 2, type: 'practical', icon: 'users' },
    { name: 'ميكا', weekly_periods: 2, type: 'theoretical', icon: 'grid' },
    { name: 'جودة', weekly_periods: 1, type: 'theoretical', icon: 'shield' },
    { name: 'ريادة', weekly_periods: 2, type: 'theoretical', icon: 'briefcase' },
  ],
  third: [
    { name: 'إنجليزي', weekly_periods: 1, type: 'theoretical', icon: 'book' },
    { name: 'ميكا', weekly_periods: 2, type: 'theoretical', icon: 'grid' },
    { name: 'تكنولوجيا', weekly_periods: 3, type: 'theoretical', icon: 'database' },
  ],
};

/**
 * Department-specific subjects. The shared subjects above are NOT repeated
 * here; they are added automatically by the public API for every department.
 */
const SECTIONS = [
  {
    key: 'electrical',
    departments: ['electrical-technician'],
    grades: {
      first: [{ name: 'رسم دوائر', weekly_periods: 3, type: 'practical', icon: 'grid' }],
      second: [
        { name: 'هندسة كهربية', weekly_periods: 3, type: 'theoretical', icon: 'sparkles' },
        { name: 'رسم دوائر', weekly_periods: 3, type: 'practical', icon: 'grid' },
      ],
      third: [{ name: 'رسم دوائر', weekly_periods: 3, type: 'practical', icon: 'grid' }],
    },
  },
  {
    key: 'networks',
    departments: ['computer-networks-technician'],
    grades: {
      first: [{ name: 'رسم ومحاكاة', weekly_periods: 3, type: 'practical', icon: 'image' }],
      second: [],
      third: [{ name: 'مقدمة صيانة لاب', weekly_periods: 3, type: 'practical', icon: 'flask' }],
    },
  },
  {
    key: 'pipes-cooling-aluminium-welding',
    departments: [
      'industrial-plumbing-technician',
      'refrigeration-hvac-technician',
      'aluminium-technician',
      'metal-welding-technician',
    ],
    grades: {
      first: [
        { name: 'رسم CAD+', weekly_periods: 3, type: 'practical', icon: 'image' },
        { name: 'هندسة كهربية', weekly_periods: 2, type: 'theoretical', icon: 'sparkles' },
      ],
      second: [
        { name: 'رسم فني', weekly_periods: 3, type: 'practical', icon: 'image' },
        { name: 'ألوميتال', weekly_periods: 2, type: 'practical', icon: 'layers' },
      ],
      third: [{ name: 'رسم فني', weekly_periods: 3, type: 'practical', icon: 'image' }],
    },
  },
  {
    key: 'lathe',
    departments: ['metal-lathe-technician'],
    grades: {
      first: [
        { name: 'رسم CAD+', weekly_periods: 3, type: 'practical', icon: 'image' },
        { name: 'هندسة كهربية', weekly_periods: 2, type: 'theoretical', icon: 'sparkles' },
        { name: 'إنتاج', weekly_periods: 2, type: 'practical', icon: 'layers' },
      ],
      second: [
        { name: 'رسم CAD+', weekly_periods: 3, type: 'practical', icon: 'image' },
        { name: 'علم المواد', weekly_periods: 2, type: 'theoretical', icon: 'layers' },
      ],
      third: [{ name: 'رسم CAD+', weekly_periods: 3, type: 'practical', icon: 'image' }],
    },
  },
  {
    key: 'garments',
    departments: ['garment-manufacturing-technician'],
    grades: {
      first: [{ name: 'هندسة كهربية', weekly_periods: 2, type: 'theoretical', icon: 'sparkles' }],
      second: [],
      third: [{ name: 'رسم فني', weekly_periods: 3, type: 'practical', icon: 'image' }],
    },
  },
  {
    key: 'maintenance',
    departments: ['home-appliances-technician'],
    grades: {
      first: [{ name: 'رسم ومحاكاة', weekly_periods: 3, type: 'practical', icon: 'image' }],
      second: [
        { name: 'هندسة كهربية', weekly_periods: 3, type: 'theoretical', icon: 'sparkles' },
        { name: 'رسم دوائر', weekly_periods: 3, type: 'practical', icon: 'grid' },
      ],
      third: [{ name: 'رسم دوائر', weekly_periods: 3, type: 'practical', icon: 'grid' }],
    },
  },
  {
    key: 'programming',
    departments: ['computer-programming-technician'],
    grades: {
      first: [{ name: 'رسم دوائر', weekly_periods: 3, type: 'practical', icon: 'grid' }],
      second: [{ name: 'هندسة كهربية', weekly_periods: 3, type: 'theoretical', icon: 'sparkles' }],
      third: [{ name: 'مقدمة مشروعات', weekly_periods: 3, type: 'practical', icon: 'briefcase' }],
    },
  },
  {
    key: 'industrial-electronics',
    departments: ['industrial-electronics-technician'],
    grades: {
      first: [{ name: 'رسم دوائر', weekly_periods: 3, type: 'practical', icon: 'grid' }],
      second: [
        { name: 'رسم دوائر إلكترونية', weekly_periods: 3, type: 'practical', icon: 'grid' },
      ],
      third: [
        { name: 'رسم دوائر إلكترونية', weekly_periods: 3, type: 'practical', icon: 'grid' },
      ],
    },
  },
  {
    key: 'ai',
    departments: ['embedded-systems-ai-technician'],
    grades: {
      first: [{ name: 'رسم دوائر', weekly_periods: 3, type: 'practical', icon: 'grid' }],
      second: [
        { name: 'إحصاء واحتمالات', weekly_periods: 2, type: 'theoretical', icon: 'chart' },
      ],
      third: [{ name: 'إدارة مشروعات', weekly_periods: 3, type: 'theoretical', icon: 'briefcase' }],
    },
  },
  {
    key: 'medical-devices',
    departments: ['medical-devices-technician'],
    grades: {
      first: [{ name: 'رسم دوائر', weekly_periods: 3, type: 'practical', icon: 'grid' }],
      second: [{ name: 'جسم الإنسان', weekly_periods: 2, type: 'theoretical', icon: 'users' }],
      third: [{ name: 'رسم فني', weekly_periods: 3, type: 'practical', icon: 'image' }],
    },
  },
  {
    key: 'chemical-lab',
    departments: ['chemical-laboratory-technician'],
    grades: {
      first: [
        { name: 'فيزياء', weekly_periods: 2, type: 'theoretical', icon: 'flask' },
        { name: 'كيمياء', weekly_periods: 2, type: 'theoretical', icon: 'flask' },
      ],
      second: [
        { name: 'فيزياء', weekly_periods: 2, type: 'theoretical', icon: 'flask' },
        { name: 'كيمياء', weekly_periods: 2, type: 'theoretical', icon: 'flask' },
      ],
      third: [],
    },
  },
];

function toRecord(subject, grade, departmentSlug, sectionKey, sortOrder) {
  return {
    name: subject.name,
    description: DESCRIPTIONS[subject.name] || '',
    type: subject.type,
    grade,
    department_slug: departmentSlug,
    weekly_periods: subject.weekly_periods,
    icon: subject.icon,
    sort_order: sortOrder,
    section_key: sectionKey,
  };
}

/** Flat, deterministic seed list ordered by grade then the supplied section order. */
const REAL_SUBJECTS = [];
for (const grade of GRADE_KEYS) {
  let sortOrder = 1;
  for (const subject of GENERAL_SUBJECTS[grade]) {
    REAL_SUBJECTS.push(toRecord(subject, grade, null, 'general', sortOrder++));
  }
  for (const section of SECTIONS) {
    const gradeSubjects = section.grades[grade] || [];
    for (const departmentSlug of section.departments) {
      for (const subject of gradeSubjects) {
        REAL_SUBJECTS.push(toRecord(subject, grade, departmentSlug, section.key, sortOrder++));
      }
    }
  }
}

module.exports = { REAL_SUBJECTS, GRADE_KEYS, SECTIONS, GENERAL_SUBJECTS };
