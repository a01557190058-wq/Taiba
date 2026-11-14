'use strict';

/**
 * Public photo gallery.
 *
 * The whole gallery page (hero text, sections, photos, ordering, visibility
 * and credits) is stored in the database and edited from the dashboard. Saving
 * replaces the section/photo set atomically, which keeps the page model simple:
 * the order of the arrays in the request is the order shown on the website.
 */
const db = require('../db');
const galleryMedia = require('../lib/gallery-media');
const { GALLERY_ICONS, GALLERY_LIMITS: LIMITS } = require('../lib/gallery-constants');
const { cleanText, slugify } = require('../lib/text');

const DEFAULT_SETTINGS = {
  eyebrow: 'معرض الصور',
  title: 'الحياة في مدرسة طيبة',
  lead:
    'لقطات من الفصول والمعامل والورش توثّق رحلة الطلاب بين النظرية والتطبيق، وتُظهر جانبًا من يومهم الدراسي داخل المدرسة.',
  credits_note:
    'الصور الحالية توضيحية من أنشطة تعليمية عامة، ويمكن استبدالها بصور المدرسة الفعلية دون تغيير في تصميم الصفحة.',
  show_credits: true,
};

const IMAGE_SEED = {
  theoretical: [
    {
      id: 'theoretical-teacher',
      alt: 'معلّم يشرح الدرس لطلاب داخل قاعة محاضرات',
      caption: 'شرح داخل قاعة الدرس',
      credit: 'Harrison Keely — CC BY 4.0',
      credit_url:
        'https://commons.wikimedia.org/wiki/File:A_college_professor_teaching_in_a_university_classroom_full_of_students_in_Tennessee,_United_States_07.jpg',
    },
    {
      id: 'theoretical-explaining',
      alt: 'معلّم يشرح على السبورة وسط انتباه الطلاب',
      caption: 'تفاعل الطلاب مع الشرح',
      credit: 'Harrison Keely — CC BY 4.0',
      credit_url:
        'https://commons.wikimedia.org/wiki/File:A_public_high_school_teacher_in_a_classroom_in_the_United_States_08.jpg',
    },
    {
      id: 'theoretical-discussion',
      alt: 'معلّم يناقش الطلاب داخل الفصل',
      caption: 'حوار ومناقشة صفية',
      credit: 'Harrison Keely — CC BY 4.0',
      credit_url:
        'https://commons.wikimedia.org/wiki/File:Students_and_teacher_in_a_high_school_classroom_in_North_Carolina_07.jpg',
    },
    {
      id: 'theoretical-listening',
      alt: 'طلاب يستمعون بتركيز إلى شرح المعلم',
      caption: 'الاستماع والتركيز',
      credit: 'Kwameghana (Bright Kwame Ayisi) — CC0',
      credit_url: 'https://commons.wikimedia.org/wiki/File:JHS_students_listening_to_their_teacher.jpg',
    },
    {
      id: 'theoretical-focus',
      alt: 'طلاب يتابعون الحصة داخل الفصل',
      caption: 'متابعة الحصة',
      credit: 'Kwameghana (Bright Kwame Ayisi) — CC0',
      credit_url: 'https://commons.wikimedia.org/wiki/File:Students_listening_in_class.jpg',
    },
    {
      id: 'theoretical-science',
      alt: 'طلاب ينفذون نشاطًا علميًا داخل الفصل',
      caption: 'نشاط علمي داخل الفصل',
      credit: 'Shixart1985 — CC BY 2.0',
      credit_url:
        'https://commons.wikimedia.org/wiki/File:Experimenting_with_citrus_fruits_and_syringes_in_a_classroom_setting_during_a_science_lesson_undefined.jpg',
    },
  ],
  practical: [
    {
      id: 'practical-electronics',
      alt: 'معلّم وطلاب أثناء تدريب عملي في معمل الإلكترونيات',
      caption: 'تدريب عملي في معمل الإلكترونيات',
      credit: 'Yohannes Bogale Fentie — CC0',
      credit_url: 'https://commons.wikimedia.org/wiki/File:Students-Teacher-in-the-Lab.jpg',
    },
    {
      id: 'practical-digital-lab',
      alt: 'طالب ينفذ تجربة عملية في معمل الإلكترونيات الرقمية',
      caption: 'تجربة في الإلكترونيات الرقمية',
      credit: 'Vaibhavb19.nitp — CC BY-SA 4.0',
      credit_url:
        'https://commons.wikimedia.org/wiki/File:A_student_during_lab_experiment_in_Digital_Electronics_lab.jpg',
    },
    {
      id: 'practical-computers',
      alt: 'طلاب يستخدمون أجهزة الحاسوب داخل المعمل',
      caption: 'معمل الحاسوب',
      credit: 'Mailane vanesa — CC0',
      credit_url: 'https://commons.wikimedia.org/wiki/File:COMPUTER_LABS.jpg',
    },
    {
      id: 'practical-it-lab',
      alt: 'صف مجهز بأجهزة حاسوب في معمل تقنية المعلومات',
      caption: 'معمل تقنية المعلومات',
      credit: 'RitwickSingh — CC BY-SA 4.0',
      credit_url: 'https://commons.wikimedia.org/wiki/File:COMPUTER_LAB_IMUV.jpg',
    },
    {
      id: 'practical-programming',
      alt: 'طالبان يعملان على مشروع برمجي داخل معمل الحاسوب',
      caption: 'العمل على مشروع برمجي',
      credit: 'Saintfevrier — CC BY-SA 4.0',
      credit_url:
        'https://commons.wikimedia.org/wiki/File:Kefalonia_Wild_Flora_project_students_in_computer_lab.jpg',
    },
    {
      id: 'practical-projects',
      alt: 'طلاب يعرضون مشروعاتهم أمام لجنة المناقشة',
      caption: 'عرض مشروعات الطلاب',
      credit: 'Claude Nizeyimana — CC BY-SA 4.0',
      credit_url:
        'https://commons.wikimedia.org/wiki/File:Final_year_students_defending_their_research_projects_in_Rwanda.jpg',
    },
  ],
};

function seedImages(sectionSlug) {
  return IMAGE_SEED[sectionSlug].map((image, index) => ({
    url: `/assets/img/gallery/${sectionSlug}/${image.id}.jpg`,
    thumb_url: `/assets/img/gallery/${sectionSlug}/${image.id}-thumb.jpg`,
    alt: image.alt,
    caption: image.caption,
    credit: image.credit,
    credit_url: image.credit_url,
    is_published: true,
    sort_order: index,
  }));
}

const GALLERY_SEED = {
  settings: DEFAULT_SETTINGS,
  sections: [
    {
      slug: 'theoretical',
      eyebrow: 'داخل الفصول',
      title: 'صور النظري',
      description:
        'جولة داخل الفصول الدراسية: شرح المعلم، تفاعل الطلاب، والأنشطة التعليمية التي تصنع يومًا دراسيًا مليئًا بالاكتشاف.',
      icon: 'book',
      is_published: true,
      sort_order: 0,
      images: seedImages('theoretical'),
    },
    {
      slug: 'practical',
      eyebrow: 'في المعامل والورش',
      title: 'صور العملي',
      description:
        'من المعامل إلى الورش: تجارب عملية، مشروعات طلابية، وتطبيقات حقيقية تربط ما يتعلمه الطلاب بسوق العمل.',
      icon: 'flask',
      is_published: true,
      sort_order: 1,
      images: seedImages('practical'),
    },
  ],
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------
function mapSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    eyebrow: row.eyebrow,
    title: row.title,
    lead: row.lead,
    credits_note: row.credits_note,
    show_credits: Boolean(row.show_credits),
  };
}

function mapImage(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    thumb_url: row.thumb_url || row.url,
    alt: row.alt,
    caption: row.caption,
    credit: row.credit,
    credit_url: row.credit_url,
    is_published: Boolean(row.is_published),
    sort_order: row.sort_order,
  };
}

function mapSection(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    eyebrow: row.eyebrow,
    title: row.title,
    description: row.description,
    icon: row.icon,
    is_published: Boolean(row.is_published),
    sort_order: row.sort_order,
  };
}

function readSettings() {
  return mapSettings(db.get('SELECT * FROM gallery_settings WHERE id = 1'));
}

function getImages(sectionId, { publishedOnly = false } = {}) {
  const where = publishedOnly ? 'AND is_published = 1' : '';
  return db
    .all(
      `SELECT * FROM gallery_images
        WHERE section_id = ? ${where}
        ORDER BY sort_order ASC, id ASC`,
      [sectionId]
    )
    .map(mapImage);
}

function listSections({ publishedOnly = false } = {}) {
  const where = publishedOnly ? 'WHERE is_published = 1' : '';
  return db
    .all(`SELECT * FROM gallery_sections ${where} ORDER BY sort_order ASC, id ASC`)
    .map(mapSection);
}

// ---------------------------------------------------------------------------
// Public / admin payloads
// ---------------------------------------------------------------------------
function getPublicGallery() {
  const sections = listSections({ publishedOnly: true })
    .map((section) => ({ ...section, images: getImages(section.id, { publishedOnly: true }) }))
    // A section with no visible photos is noise on the public page.
    .filter((section) => section.images.length > 0);

  return { settings: readSettings(), sections };
}

function getAdminGallery() {
  const sections = listSections().map((section) => ({
    ...section,
    images: getImages(section.id),
  }));

  return {
    settings: readSettings(),
    sections,
    icons: GALLERY_ICONS,
    limits: {
      sections: LIMITS.sections,
      imagesPerSection: LIMITS.imagesPerSection,
    },
  };
}

// ---------------------------------------------------------------------------
// Save (full replace, atomic)
// ---------------------------------------------------------------------------
function uniqueSlug(base, used) {
  const cleaned = slugify(base) || 'section';
  let candidate = cleaned;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${cleaned}-${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function normalizeSettings(settings = {}) {
  return {
    eyebrow: cleanText(settings.eyebrow ?? DEFAULT_SETTINGS.eyebrow),
    title: cleanText(settings.title ?? DEFAULT_SETTINGS.title),
    lead: cleanText(settings.lead ?? DEFAULT_SETTINGS.lead),
    credits_note: cleanText(settings.credits_note ?? DEFAULT_SETTINGS.credits_note),
    show_credits: settings.show_credits === undefined ? true : Boolean(settings.show_credits),
  };
}

/** Uploaded photos referenced by the previous gallery state. */
function readUploadedUrls() {
  return db
    .all('SELECT url, thumb_url FROM gallery_images')
    .flatMap((row) => [row.url, row.thumb_url])
    .filter((value) => galleryMedia.isGalleryUploadUrl(value));
}

function saveGallery(payload) {
  const settings = normalizeSettings(payload.settings);
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const previousUploads = readUploadedUrls();
  const nextUploads = new Set();

  db.transaction(() => {
    // Replacing the set is simpler than diffing and keeps ordering exact.
    // `gallery_images` rows are removed by the ON DELETE CASCADE clause.
    db.run('DELETE FROM gallery_sections');

    const usedSlugs = new Set();
    sections.forEach((section, sectionIndex) => {
      const slug = uniqueSlug(section.slug || section.title, usedSlugs);
      const sectionResult = db.run(
        `INSERT INTO gallery_sections
           (slug, eyebrow, title, description, icon, is_published, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          slug,
          cleanText(section.eyebrow || ''),
          cleanText(section.title),
          cleanText(section.description || ''),
          GALLERY_ICONS.includes(section.icon) ? section.icon : 'image',
          section.is_published === false ? 0 : 1,
          sectionIndex,
        ]
      );
      const sectionId = Number(sectionResult.lastInsertRowid);

      const images = Array.isArray(section.images) ? section.images : [];
      images.forEach((image, imageIndex) => {
        const url = cleanText(image.url);
        const thumbUrl = cleanText(image.thumb_url || '');
        if (galleryMedia.isGalleryUploadUrl(url)) nextUploads.add(url);
        if (galleryMedia.isGalleryUploadUrl(thumbUrl)) nextUploads.add(thumbUrl);

        db.run(
          `INSERT INTO gallery_images
             (section_id, url, thumb_url, alt, caption, credit, credit_url,
              is_published, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sectionId,
            url,
            thumbUrl,
            cleanText(image.alt || ''),
            cleanText(image.caption || ''),
            cleanText(image.credit || ''),
            cleanText(image.credit_url || ''),
            image.is_published === false ? 0 : 1,
            imageIndex,
          ]
        );
      });
    });

    db.run(
      `INSERT INTO gallery_settings
         (id, eyebrow, title, lead, credits_note, show_credits, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT (id) DO UPDATE SET
         eyebrow = excluded.eyebrow,
         title = excluded.title,
         lead = excluded.lead,
         credits_note = excluded.credits_note,
         show_credits = excluded.show_credits,
         updated_at = excluded.updated_at`,
      [
        settings.eyebrow,
        settings.title,
        settings.lead,
        settings.credits_note,
        settings.show_credits ? 1 : 0,
      ]
    );
  });

  // Remove uploaded files that are no longer referenced. Never throws.
  previousUploads.forEach((url) => {
    if (!nextUploads.has(url)) galleryMedia.removeUploadedFile(url);
  });

  return getAdminGallery();
}

/**
 * Seeds the default gallery once. Used by the demo seeder; never overwrites an
 * existing gallery so administrator edits stay intact.
 */
function seedGallery() {
  const existing = db.get('SELECT COUNT(*) AS count FROM gallery_sections');
  if (existing && existing.count > 0) return { inserted: false, sections: 0, images: 0 };

  let images = 0;
  db.transaction(() => {
    GALLERY_SEED.sections.forEach((section, sectionIndex) => {
      const result = db.run(
        `INSERT INTO gallery_sections
           (slug, eyebrow, title, description, icon, is_published, sort_order)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [
          section.slug,
          section.eyebrow,
          section.title,
          section.description,
          section.icon,
          sectionIndex,
        ]
      );
      const sectionId = Number(result.lastInsertRowid);
      section.images.forEach((image, imageIndex) => {
        db.run(
          `INSERT INTO gallery_images
             (section_id, url, thumb_url, alt, caption, credit, credit_url,
              is_published, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            sectionId,
            image.url,
            image.thumb_url,
            image.alt,
            image.caption,
            image.credit,
            image.credit_url,
            imageIndex,
          ]
        );
        images += 1;
      });
    });

    db.run(
      `INSERT INTO gallery_settings
         (id, eyebrow, title, lead, credits_note, show_credits)
       VALUES (1, ?, ?, ?, ?, 1)
       ON CONFLICT (id) DO NOTHING`,
      [
        GALLERY_SEED.settings.eyebrow,
        GALLERY_SEED.settings.title,
        GALLERY_SEED.settings.lead,
        GALLERY_SEED.settings.credits_note,
      ]
    );
  });

  return { inserted: true, sections: GALLERY_SEED.sections.length, images };
}

function countImages() {
  return db.get('SELECT COUNT(*) AS count FROM gallery_images').count;
}

module.exports = {
  GALLERY_ICONS,
  GALLERY_SEED,
  LIMITS,
  DEFAULT_SETTINGS,
  getPublicGallery,
  getAdminGallery,
  saveGallery,
  seedGallery,
  countImages,
};
