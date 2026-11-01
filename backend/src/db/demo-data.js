'use strict';

/** Clearly fictional demonstration dataset. No real personal information. */

const DEMO_DEPARTMENTS = [
  {
    name: 'قسم البرمجة',
    slug: 'programming',
    short_description:
      'تعلّم أساسيات البرمجة وتطوير التطبيقات وبناء المشروعات البرمجية خطوة بخطوة.',
    description:
      'يقدّم قسم البرمجة مسارًا متدرجًا يبدأ من منطق البرمجة والخوارزميات ثم ينتقل إلى تطوير الويب والتطبيقات وقواعد البيانات. يعمل الطلاب على مشروعات عملية صغيرة ومتوسطة، ويتعلمون كتابة كود واضح وقابل للصيانة والعمل ضمن فريق.',
    educational_focus:
      'التفكير المنطقي، تحليل المشكلات، تطوير الويب، البرمجة كائنية التوجه، وقواعد البيانات العلائقية.',
    skills: 'كتابة الكود النظيف\nتحليل المتطلبات\nتطوير واجهات الويب\nتصميم قواعد البيانات\nاستخدام Git\nالعمل الجماعي',
    admission_info: 'يفضل إلمام أساسي بالحاسب. لا يشترط خبرة برمجية سابقة.',
    image_url: '/assets/img/departments/programming.svg',
    sort_order: 1,
  },
  {
    name: 'قسم الكيمياء التحليلية',
    slug: 'analytical-chemistry',
    short_description:
      'دراسة تقنيات التحليل الكيميائي واستخدام الأجهزة المعملية في فحص العينات.',
    description:
      'يهتم قسم الكيمياء التحليلية بطرق فحص المواد وتحليل العينات باستخدام أجهزة معملية دقيقة. يتدرب الطلاب على إعداد المحاليل، وتسجيل النتائج، وتفسير البيانات، مع الالتزام بإجراءات السلامة المعملية.',
    educational_focus:
      'الكيمياء العامة، تقنيات التحليل، أجهزة القياس، السلامة المعملية، وتوثيق النتائج.',
    skills: 'إعداد المحاليل\nتشغيل أجهزة التحليل\nقراءة النتائج\nالالتزام بالسلامة\nتوثيق التجارب',
    admission_info: 'يفضل وجود خلفية في العلوم الطبيعية. يتم توفير أدوات السلامة داخل المعمل.',
    image_url: '/assets/img/departments/analytical-chemistry.svg',
    sort_order: 2,
  },
  {
    name: 'قسم الأجهزة الطبية',
    slug: 'medical-devices',
    short_description:
      'صيانة وتشغيل الأجهزة الطبية وفهم مبادئ عملها وأنظمة السلامة المرتبطة بها.',
    description:
      'يغطي قسم الأجهزة الطبية أساسيات الإلكترونيات والأجهزة المستخدمة في البيئات الصحية، مع تدريب على الفحص والصيانة الوقائية وتوثيق الأعمال الفنية. يركز البرنامج على الدقة والسلامة واحترام إجراءات المنشآت الصحية.',
    educational_focus:
      'إلكترونيات الأجهزة الطبية، الصيانة الوقائية، القياسات، السلامة الكهربائية، وتوثيق الصيانة.',
    skills: 'قراءة المخططات الكهربائية\nاستخدام أجهزة القياس\nالصيانة الوقائية\nتشخيص الأعطال\nتوثيق الأعمال',
    admission_info: 'يتضمن البرنامج تدريبًا عمليًا على أجهزة تعليمية داخل مختبر المدرسة.',
    image_url: '/assets/img/departments/medical-devices.svg',
    sort_order: 3,
  },
  {
    name: 'قسم الذكاء الاصطناعي',
    slug: 'artificial-intelligence',
    short_description:
      'مدخل تطبيقي إلى تعلّم الآلة وتحليل البيانات وبناء نماذج ذكاء اصطناعي بسيطة.',
    description:
      'يقدّم قسم الذكاء الاصطناعي مدخلًا عمليًا إلى تحليل البيانات وتعلّم الآلة. يبدأ الطلاب بجمع البيانات وتنظيفها، ثم يجرّبون بناء نماذج بسيطة وتقييم نتائجها، مع نقاش أخلاقي حول استخدامات الذكاء الاصطناعي وحدودها.',
    educational_focus:
      'Python، تحليل البيانات، تعلّم الآلة، تقييم النماذج، وأخلاقيات الذكاء الاصطناعي.',
    skills: 'تحليل البيانات\nPython\nتجهيز البيانات\nبناء النماذج\nتقييم النتائج\nالتفكير الأخلاقي',
    admission_info: 'يفضل إلمام أساسي بالرياضيات والحاسب. البرنامج تجريبي لأغراض العرض.',
    image_url: '/assets/img/departments/artificial-intelligence.svg',
    sort_order: 4,
  },
  {
    name: 'قسم الكهرباء',
    slug: 'electrical',
    short_description:
      'أساسيات الكهرباء والتركيبات الكهربائية الآمنة وقراءة المخططات الكهربائية.',
    description:
      'يتناول قسم الكهرباء المفاهيم الأساسية للتيار والجهد والمقاومة، وأنواع التركيبات الكهربائية، وإجراءات السلامة. ينفذ الطلاب تمارين معملية على دوائر كهربائية تعليمية مع التركيز على الفحص المنظم وتجنب المخاطر.',
    educational_focus:
      'الدوائر الكهربائية، التركيبات، أجهزة القياس، السلامة الكهربائية، وقراءة المخططات.',
    skills: 'تجميع الدوائر\nاستخدام الأفوميتر\nقراءة المخططات\nاكتشاف الأعطال\nتطبيق إجراءات السلامة',
    admission_info: 'يتطلب الالتزام الكامل بإرشادات السلامة داخل المعمل.',
    image_url: '/assets/img/departments/electrical.svg',
    sort_order: 5,
  },
  {
    name: 'قسم الميكانيكا',
    slug: 'mechanical',
    short_description:
      'مبادئ التصنيع الميكانيكي واستخدام أدوات القياس والورش التعليمية.',
    description:
      'يركز قسم الميكانيكا على فهم الأنظمة الميكانيكية وأدوات القياس والعمليات الأساسية في الورش. يتدرب الطلاب على قراءة الرسومات الفنية وتنفيذ أعمال دقيقة باستخدام أدوات ومعدات تعليمية آمنة.',
    educational_focus:
      'الرسم الفني، أدوات القياس، عمليات التشغيل الأساسية، الصيانة، والسلامة في الورش.',
    skills: 'قراءة الرسومات الفنية\nاستخدام أدوات القياس\nعمليات الورش\nالصيانة الأساسية\nالدقة في التنفيذ',
    admission_info: 'يتم توفير مهمات الوقاية الشخصية أثناء التدريب العملي.',
    image_url: '/assets/img/departments/mechanical.svg',
    sort_order: 6,
  },
  {
    name: 'قسم الإلكترونيات',
    slug: 'electronics',
    short_description:
      'تصميم وفحص الدوائر الإلكترونية والمكونات الرقمية والتناظرية.',
    description:
      'يشرح قسم الإلكترونيات عمل المكونات الإلكترونية الأساسية وكيفية تجميعها وفحصها. ينتقل الطلاب من الدوائر البسيطة إلى التطبيقات الرقمية، مع تدريب على اللحام الآمن واستخدام أجهزة القياس وقراءة نشرات المكونات.',
    educational_focus:
      'المكونات الإلكترونية، الدوائر التناظرية والرقمية، اللحام، القياس، وتشخيص الأعطال.',
    skills: 'تجميع الدوائر\nاللحام الآمن\nاستخدام أجهزة القياس\nقراءة النشرات الفنية\nتشخيص الأعطال',
    admission_info: 'يشمل البرنامج تمارين معملية على لوحات تعليمية.',
    image_url: '/assets/img/departments/electronics.svg',
    sort_order: 7,
  },
  {
    name: 'قسم تكنولوجيا المعلومات',
    slug: 'information-technology',
    short_description:
      'إدارة الشبكات وأنظمة التشغيل وأمن المعلومات الأساسي ودعم المستخدمين.',
    description:
      'يغطي قسم تكنولوجيا المعلومات أساسيات الشبكات وأنظمة التشغيل وإدارة الخوادم ومبادئ أمن المعلومات. يتدرب الطلاب على تركيب الشبكات الصغيرة وإعداد الأجهزة وحل مشكلات المستخدمين وتوثيق الحلول.',
    educational_focus:
      'الشبكات، أنظمة التشغيل، إدارة الخوادم، أمن المعلومات، والدعم الفني.',
    skills: 'إعداد الشبكات\nإدارة أنظمة التشغيل\nأساسيات أمن المعلومات\nحل المشكلات\nالدعم الفني',
    admission_info: 'يفضل إلمام عام باستخدام الحاسب. لا يشترط شهادة تقنية سابقة.',
    image_url: '/assets/img/departments/information-technology.svg',
    sort_order: 8,
  },
  {
    name: 'قسم التحكم الصناعي',
    slug: 'industrial-control',
    short_description:
      'مدخل إلى أنظمة التحكم الآلي والحساسات وبرمجة وحدات التحكم المنطقي.',
    description:
      'يقدّم قسم التحكم الصناعي أساسيات أنظمة التحكم والحساسات والمحركات، مع تمارين على برمجة وحدات التحكم المنطقي (PLC) في بيئة تعليمية. يركّز البرنامج على القراءة المنظمة للأنظمة وتوثيق الاختبارات.',
    educational_focus:
      'الحساسات، المحركات، PLC، دوائر التحكم، والاختبار المنظم.',
    skills: 'قراءة دوائر التحكم\nتوصيل الحساسات\nبرمجة PLC\nاختبار الأنظمة\nتوثيق الإجراءات',
    admission_info: 'يُفضّل إلمام أساسي بالكهرباء. التدريب داخل معمل تحكم تعليمي.',
    image_url: '/assets/img/departments/industrial-control.svg',
    sort_order: 9,
  },
  {
    name: 'قسم الطاقة المتجددة',
    slug: 'renewable-energy',
    short_description:
      'دراسة أنظمة الطاقة الشمسية وطاقة الرياح وكفاءة استخدام الطاقة.',
    description:
      'يهتم قسم الطاقة المتجددة بمبادئ تحويل الطاقة الشمسية وطاقة الرياح وتخزين الطاقة. ينفذ الطلاب قياسات على أنظمة تعليمية صغيرة ويحللون كفاءة الأداء والعوامل المؤثرة فيه، مع مناقشة الأثر البيئي.',
    educational_focus:
      'الخلايا الشمسية، أنظمة التخزين، قياسات الأداء، كفاءة الطاقة، والأثر البيئي.',
    skills: 'قياس إنتاج الطاقة\nتركيب أنظمة تعليمية\nتحليل الكفاءة\nقراءة المواصفات\nالوعي البيئي',
    admission_info: 'البرنامج تجريبي ويستخدم أجهزة تعليمية صغيرة الحجم.',
    image_url: '/assets/img/departments/renewable-energy.svg',
    sort_order: 10,
  },
];

/** Fictional applicants. Phones and emails are intentionally non-real. */
const DEMO_APPLICATIONS = [
  {
    reference_number: 'DEMO-2026-0001',
    full_name: 'سارة عبد الرحمن',
    phone: '01000000001',
    email: 'sara.demo@example.com',
    department_slug: 'programming',
    previous_education: 'الثانوية العامة — علمي',
    additional_notes: 'مهتمة بتطوير الويب ولديها خبرة بسيطة في HTML.',
    status: 'NEW',
    admin_notes: '',
    submitted_at: '2026-09-02T09:15:00.000Z',
  },
  {
    reference_number: 'DEMO-2026-0002',
    full_name: 'محمد خالد النجار',
    phone: '01000000002',
    email: 'mohamed.demo@example.com',
    department_slug: 'information-technology',
    previous_education: 'دبلوم تقني',
    additional_notes: 'يرغب في التخصص في الشبكات.',
    status: 'UNDER_REVIEW',
    admin_notes: 'ملاحظة تجريبية: تم التحقق من بيانات التواصل مبدئيًا.',
    submitted_at: '2026-09-04T11:40:00.000Z',
  },
  {
    reference_number: 'DEMO-2026-0003',
    full_name: 'نورهان سمير',
    phone: '01000000003',
    email: '',
    department_slug: 'artificial-intelligence',
    previous_education: 'الثانوية العامة — رياضيات',
    additional_notes: 'لديها اهتمام بتحليل البيانات.',
    status: 'ACCEPTED',
    admin_notes: 'ملاحظة تجريبية: مقابلة تعريفية افتراضية تمت بنجاح.',
    submitted_at: '2026-09-06T08:05:00.000Z',
  },
  {
    reference_number: 'DEMO-2026-0004',
    full_name: 'يوسف إبراهيم',
    phone: '01000000004',
    email: 'youssef.demo@example.com',
    department_slug: 'electronics',
    previous_education: 'الصف الثالث الثانوي',
    additional_notes: '',
    status: 'REJECTED',
    admin_notes: 'ملاحظة تجريبية: بيانات غير مكتملة في هذا السجل التجريبي.',
    submitted_at: '2026-09-08T13:20:00.000Z',
  },
  {
    reference_number: 'DEMO-2026-0005',
    full_name: 'مريم حسن',
    phone: '01000000005',
    email: 'mariam.demo@example.com',
    department_slug: 'renewable-energy',
    previous_education: 'الثانوية العامة — علمي علوم',
    additional_notes: 'مهتمة بالطاقة الشمسية.',
    status: 'NEW',
    admin_notes: '',
    submitted_at: '2026-09-10T10:00:00.000Z',
  },
  {
    reference_number: 'DEMO-2026-0006',
    full_name: 'عمر فاروق',
    phone: '01000000006',
    email: '',
    department_slug: 'mechanical',
    previous_education: 'دبلوم صناعي',
    additional_notes: 'خبرة عملية بسيطة في ورشة عائلية.',
    status: 'UNDER_REVIEW',
    admin_notes: '',
    submitted_at: '2026-09-12T14:30:00.000Z',
  },
  {
    reference_number: 'DEMO-2026-0007',
    full_name: 'هبة الله عادل',
    phone: '01000000007',
    email: 'heba.demo@example.com',
    department_slug: 'medical-devices',
    previous_education: 'الثانوية العامة — علمي',
    additional_notes: 'ترغب في العمل بمجال صيانة الأجهزة الطبية.',
    status: 'ACCEPTED',
    admin_notes: 'ملاحظة تجريبية: سجل مقبول للعرض فقط.',
    submitted_at: '2026-09-14T09:45:00.000Z',
  },
  {
    reference_number: 'DEMO-2026-0008',
    full_name: 'كريم مصطفى',
    phone: '01000000008',
    email: 'karim.demo@example.com',
    department_slug: 'industrial-control',
    previous_education: 'دبلوم كهرباء',
    additional_notes: '',
    status: 'NEW',
    admin_notes: '',
    submitted_at: '2026-09-16T12:10:00.000Z',
  },
];

module.exports = { DEMO_DEPARTMENTS, DEMO_APPLICATIONS };
