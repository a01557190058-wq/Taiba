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
