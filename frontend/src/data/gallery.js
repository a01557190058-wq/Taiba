/**
 * School gallery content.
 *
 * Adding a new photo:
 *   1. Put the optimised image in
 *      `frontend/public/assets/img/gallery/<section>/`.
 *   2. Add an entry to the matching section below, in the order it should
 *      appear on the page.
 *
 * `src` is the grid thumbnail, `full` is the large lightbox version.
 * Keep both at a 4:3 ratio for a tidy grid.
 */
export const gallerySections = [
  {
    id: 'theoretical',
    icon: 'book',
    eyebrow: 'داخل الفصول',
    title: 'صور النظري',
    description:
      'جولة داخل الفصول الدراسية: شرح المعلم، تفاعل الطلاب، والأنشطة التعليمية التي تصنع يومًا دراسيًا مليئًا بالاكتشاف.',
    images: [
      {
        id: 'theoretical-teacher',
        src: '/assets/img/gallery/theoretical/theoretical-teacher-thumb.jpg',
        full: '/assets/img/gallery/theoretical/theoretical-teacher.jpg',
        alt: 'معلّم يشرح الدرس لطلاب داخل قاعة محاضرات',
        caption: 'شرح داخل قاعة الدرس',
      },
      {
        id: 'theoretical-explaining',
        src: '/assets/img/gallery/theoretical/theoretical-explaining-thumb.jpg',
        full: '/assets/img/gallery/theoretical/theoretical-explaining.jpg',
        alt: 'معلّم يشرح على السبورة وسط انتباه الطلاب',
        caption: 'تفاعل الطلاب مع الشرح',
      },
      {
        id: 'theoretical-discussion',
        src: '/assets/img/gallery/theoretical/theoretical-discussion-thumb.jpg',
        full: '/assets/img/gallery/theoretical/theoretical-discussion.jpg',
        alt: 'معلّم يناقش الطلاب داخل الفصل',
        caption: 'حوار ومناقشة صفية',
      },
      {
        id: 'theoretical-listening',
        src: '/assets/img/gallery/theoretical/theoretical-listening-thumb.jpg',
        full: '/assets/img/gallery/theoretical/theoretical-listening.jpg',
        alt: 'طلاب يستمعون بتركيز إلى شرح المعلم',
        caption: 'الاستماع والتركيز',
      },
      {
        id: 'theoretical-focus',
        src: '/assets/img/gallery/theoretical/theoretical-focus-thumb.jpg',
        full: '/assets/img/gallery/theoretical/theoretical-focus.jpg',
        alt: 'طلاب يتابعون الحصة داخل الفصل',
        caption: 'متابعة الحصة',
      },
      {
        id: 'theoretical-science',
        src: '/assets/img/gallery/theoretical/theoretical-science-thumb.jpg',
        full: '/assets/img/gallery/theoretical/theoretical-science.jpg',
        alt: 'طلاب ينفذون نشاطًا علميًا داخل الفصل',
        caption: 'نشاط علمي داخل الفصل',
      },
    ],
  },
  {
    id: 'practical',
    icon: 'flask',
    eyebrow: 'في المعامل والورش',
    title: 'صور العملي',
    description:
      'من المعامل إلى الورش: تجارب عملية، مشروعات طلابية، وتطبيقات حقيقية تربط ما يتعلمه الطلاب بسوق العمل.',
    images: [
      {
        id: 'practical-electronics',
        src: '/assets/img/gallery/practical/practical-electronics-thumb.jpg',
        full: '/assets/img/gallery/practical/practical-electronics.jpg',
        alt: 'معلّم وطلاب أثناء تدريب عملي في معمل الإلكترونيات',
        caption: 'تدريب عملي في معمل الإلكترونيات',
      },
      {
        id: 'practical-digital-lab',
        src: '/assets/img/gallery/practical/practical-digital-lab-thumb.jpg',
        full: '/assets/img/gallery/practical/practical-digital-lab.jpg',
        alt: 'طالب ينفذ تجربة عملية في معمل الإلكترونيات الرقمية',
        caption: 'تجربة في الإلكترونيات الرقمية',
      },
      {
        id: 'practical-computers',
        src: '/assets/img/gallery/practical/practical-computers-thumb.jpg',
        full: '/assets/img/gallery/practical/practical-computers.jpg',
        alt: 'طلاب يستخدمون أجهزة الحاسوب داخل المعمل',
        caption: 'معمل الحاسوب',
      },
      {
        id: 'practical-it-lab',
        src: '/assets/img/gallery/practical/practical-it-lab-thumb.jpg',
        full: '/assets/img/gallery/practical/practical-it-lab.jpg',
        alt: 'صف مجهز بأجهزة حاسوب في معمل تقنية المعلومات',
        caption: 'معمل تقنية المعلومات',
      },
      {
        id: 'practical-programming',
        src: '/assets/img/gallery/practical/practical-programming-thumb.jpg',
        full: '/assets/img/gallery/practical/practical-programming.jpg',
        alt: 'طالبان يعملان على مشروع برمجي داخل معمل الحاسوب',
        caption: 'العمل على مشروع برمجي',
      },
      {
        id: 'practical-projects',
        src: '/assets/img/gallery/practical/practical-projects-thumb.jpg',
        full: '/assets/img/gallery/practical/practical-projects.jpg',
        alt: 'طلاب يعرضون مشروعاتهم أمام لجنة المناقشة',
        caption: 'عرض مشروعات الطلاب',
      },
    ],
  },
  {
    id: 'departments',
    icon: 'layers',
    eyebrow: 'داخل التخصصات',
    title: 'صور الأقسام',
    description:
      'لقات من ورش التخصصات ومعاملها وفرق العمل الطلابية. تظهر حاليًا صور بديلة إلى حين رفع صور المجمع الفعلية.',
    images: [
      {
        id: 'departments-workshop',
        src: '/assets/img/gallery/departments/departments-workshop.svg',
        full: '/assets/img/gallery/departments/departments-workshop.svg',
        alt: 'صورة توضيحية لورشة أحد التخصصات',
        caption: 'ورشة التخصص — صورة بديلة',
      },
      {
        id: 'departments-lab',
        src: '/assets/img/gallery/departments/departments-lab.svg',
        full: '/assets/img/gallery/departments/departments-lab.svg',
        alt: 'صورة توضيحية لمعمل أحد التخصصات',
        caption: 'معمل التخصص — صورة بديلة',
      },
      {
        id: 'departments-team',
        src: '/assets/img/gallery/departments/departments-team.svg',
        full: '/assets/img/gallery/departments/departments-team.svg',
        alt: 'صورة توضيحية لفريق طلابي داخل التخصص',
        caption: 'فريق التخصص — صورة بديلة',
      },
    ],
  },
  {
    id: 'competitions',
    icon: 'star',
    eyebrow: 'مشاركات ومنافسات',
    title: 'صور المسابقات',
    description:
      'مسابقات تقنية وعروض مشروعات ولجان تحكيم توثّق روح المنافسة والإبداع لدى الطلاب.',
    images: [
      {
        id: 'competitions-stage',
        src: '/assets/img/gallery/competitions/competitions-stage.svg',
        full: '/assets/img/gallery/competitions/competitions-stage.svg',
        alt: 'صورة توضيحية لمسابقة تقنية',
        caption: 'مسابقة تقنية — صورة بديلة',
      },
      {
        id: 'competitions-project',
        src: '/assets/img/gallery/competitions/competitions-project.svg',
        full: '/assets/img/gallery/competitions/competitions-project.svg',
        alt: 'صورة توضيحية لعرض مشروع في مسابقة',
        caption: 'عرض مشروع — صورة بديلة',
      },
      {
        id: 'competitions-jury',
        src: '/assets/img/gallery/competitions/competitions-jury.svg',
        full: '/assets/img/gallery/competitions/competitions-jury.svg',
        alt: 'صورة توضيحية للجنة تحكيم مسابقة',
        caption: 'لجنة التحكيم — صورة بديلة',
      },
    ],
  },
  {
    id: 'field-visits',
    icon: 'briefcase',
    eyebrow: 'خارج المجمع',
    title: 'صور الزيارات الميدانية',
    description:
      'زيارات إلى مواقع العمل المصنعية والخدمية، يلتقي فيها الطلاب بالمهندسين والفنيين ويرون تطبيق ما درسوه.',
    images: [
      {
        id: 'field-visits-factory',
        src: '/assets/img/gallery/field-visits/field-visits-factory.svg',
        full: '/assets/img/gallery/field-visits/field-visits-factory.svg',
        alt: 'صورة توضيحية لزيارة ميدانية إلى مصنع',
        caption: 'زيارة خط إنتاج — صورة بديلة',
      },
      {
        id: 'field-visits-guides',
        src: '/assets/img/gallery/field-visits/field-visits-guides.svg',
        full: '/assets/img/gallery/field-visits/field-visits-guides.svg',
        alt: 'صورة توضيحية للقاء مع مهندسين أثناء زيارة',
        caption: 'لقاء مع مهندسين — صورة بديلة',
      },
      {
        id: 'field-visits-site',
        src: '/assets/img/gallery/field-visits/field-visits-site.svg',
        full: '/assets/img/gallery/field-visits/field-visits-site.svg',
        alt: 'صورة توضيحية لجولة ميدانية في موقع عمل',
        caption: 'جولة في موقع العمل — صورة بديلة',
      },
    ],
  },
  {
    id: 'activities',
    icon: 'users',
    eyebrow: 'يوم المجمع',
    title: 'صور الأنشطة',
    description:
      'الطابور الصباحي والتربية الرياضية والأنشطة الجماعية التي تصنع حياة مدرسية متوازنة إلى جانب التدريب التقني.',
    images: [
      {
        id: 'activities-assembly',
        src: '/assets/img/gallery/activities/activities-assembly.svg',
        full: '/assets/img/gallery/activities/activities-assembly.svg',
        alt: 'صورة توضيحية للطابور الصباحي',
        caption: 'الطابور الصباحي — صورة بديلة',
      },
      {
        id: 'activities-sport',
        src: '/assets/img/gallery/activities/activities-sport.svg',
        full: '/assets/img/gallery/activities/activities-sport.svg',
        alt: 'صورة توضيحية لحصة التربية الرياضية',
        caption: 'التربية الرياضية — صورة بديلة',
      },
      {
        id: 'activities-group',
        src: '/assets/img/gallery/activities/activities-group.svg',
        full: '/assets/img/gallery/activities/activities-group.svg',
        alt: 'صورة توضيحية لنشاط جماعي للطلاب',
        caption: 'نشاط جماعي — صورة بديلة',
      },
    ],
  },
];

/**
 * Photo credits. The images above are illustrative placeholders sourced from
 * Wikimedia Commons; replace them with real school photos and drop the
 * matching entry here when the official photos are ready.
 */
export const galleryCredits = [
  {
    id: 'theoretical-teacher',
    label: 'شرح داخل قاعة الدرس',
    author: 'Harrison Keely',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:A_college_professor_teaching_in_a_university_classroom_full_of_students_in_Tennessee,_United_States_07.jpg',
  },
  {
    id: 'theoretical-explaining',
    label: 'تفاعل الطلاب مع الشرح',
    author: 'Harrison Keely',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:A_public_high_school_teacher_in_a_classroom_in_the_United_States_08.jpg',
  },
  {
    id: 'theoretical-discussion',
    label: 'حوار ومناقشة صفية',
    author: 'Harrison Keely',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:Students_and_teacher_in_a_high_school_classroom_in_North_Carolina_07.jpg',
  },
  {
    id: 'theoretical-listening',
    label: 'الاستماع والتركيز',
    author: 'Kwameghana (Bright Kwame Ayisi)',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:JHS_students_listening_to_their_teacher.jpg',
  },
  {
    id: 'theoretical-focus',
    label: 'متابعة الحصة',
    author: 'Kwameghana (Bright Kwame Ayisi)',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Students_listening_in_class.jpg',
  },
  {
    id: 'theoretical-science',
    label: 'نشاط علمي داخل الفصل',
    author: 'Shixart1985',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:Experimenting_with_citrus_fruits_and_syringes_in_a_classroom_setting_during_a_science_lesson_undefined.jpg',
  },
  {
    id: 'practical-electronics',
    label: 'تدريب عملي في معمل الإلكترونيات',
    author: 'Yohannes Bogale Fentie',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Students-Teacher-in-the-Lab.jpg',
  },
  {
    id: 'practical-digital-lab',
    label: 'تجربة في الإلكترونيات الرقمية',
    author: 'Vaibhavb19.nitp',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:A_student_during_lab_experiment_in_Digital_Electronics_lab.jpg',
  },
  {
    id: 'practical-computers',
    label: 'معمل الحاسوب',
    author: 'Mailane vanesa',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:COMPUTER_LABS.jpg',
  },
  {
    id: 'practical-it-lab',
    label: 'معمل تقنية المعلومات',
    author: 'RitwickSingh',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:COMPUTER_LAB_IMUV.jpg',
  },
  {
    id: 'practical-programming',
    label: 'العمل على مشروع برمجي',
    author: 'Saintfevrier',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:Kefalonia_Wild_Flora_project_students_in_computer_lab.jpg',
  },
  {
    id: 'practical-projects',
    label: 'عرض مشروعات الطلاب',
    author: 'Claude Nizeyimana',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:Final_year_students_defending_their_research_projects_in_Rwanda.jpg',
  },
];
