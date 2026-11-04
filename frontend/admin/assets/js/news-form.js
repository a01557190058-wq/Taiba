/**
 * News create / edit form.
 * The same page serves `/admin/news/new` and `/admin/news/:id/edit`.
 * Client validation mirrors the API rules for convenience; the server
 * validates every field again.
 */
import {
  boot,
  api,
  ApiError,
  qs,
  el,
  icon,
  pageHead,
  toast,
  setAlert,
  setButtonBusy,
  confirmDialog,
  newsStateBadge,
} from './admin.js';

const content = qs('#admin-content');
const match = window.location.pathname.match(/^\/admin\/news\/(\d+)\/edit$/);
const newsId = match ? Number(match[1]) : null;
const isEdit = newsId !== null;

const admin = await boot({
  active: 'news',
  title: isEdit ? 'تحرير خبر' : 'خبر جديد',
  subtitle: isEdit ? 'تحديث نص الخبر وحالة نشره' : 'إضافة خبر جديد إلى صفحة الأخبار',
});

const fields = new Map();

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------
function createField({
  id,
  label,
  type = 'text',
  value = '',
  required = false,
  hint = '',
  placeholder = '',
  rows = 5,
  dir = '',
  maxlength = '',
  inputmode = '',
  full = false,
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  let input;

  if (type === 'textarea') {
    input = el('textarea', {
      className: 'textarea',
      attrs: {
        id,
        rows,
        placeholder,
        ...(dir ? { dir } : {}),
        ...(maxlength ? { maxlength } : {}),
        ...(required ? { 'aria-required': 'true' } : {}),
        'aria-describedby': hint ? hintId : null,
      },
    });
    input.value = value ?? '';
  } else {
    input = el('input', {
      className: 'input',
      attrs: {
        id,
        type,
        placeholder,
        autocomplete: 'off',
        ...(dir ? { dir } : {}),
        ...(maxlength ? { maxlength } : {}),
        ...(inputmode ? { inputmode } : {}),
        ...(required ? { 'aria-required': 'true' } : {}),
        'aria-describedby': hint ? hintId : null,
      },
    });
    input.value = value ?? '';
  }

  const labelNode = el('label', { attrs: { for: id } }, [
    el('span', { text: label }),
    required ? el('span', { className: 'req', text: ' *' }) : null,
  ]);

  const errorNode = el('p', { className: 'error-text', attrs: { id: errorId } });

  const node = el('div', { className: `field${full ? ' field--full' : ''}` }, [
    labelNode,
    input,
    hint ? el('p', { className: 'hint', attrs: { id: hintId }, text: hint }) : null,
    errorNode,
  ]);

  const field = {
    id,
    input,
    node,
    setError(message) {
      errorNode.textContent = message || '';
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    },
    clearError() {
      this.setError('');
    },
  };

  fields.set(id, field);
  return field;
}

function checkboxField({ id, label, hint = '', checked = false }) {
  const input = el('input', { attrs: { type: 'checkbox', id } });
  input.checked = Boolean(checked);

  const node = el('label', { className: 'checkbox', attrs: { for: id } }, [
    input,
    el('span', {}, [
      el('strong', { text: label }),
      hint ? el('span', { className: 'hint', text: hint }) : null,
    ]),
  ]);

  return { node, input };
}

function clearFieldErrors() {
  for (const field of fields.values()) field.clearError();
}

function applyServerErrors(errorFields) {
  if (!errorFields) return;
  for (const [key, message] of Object.entries(errorFields)) {
    const field = fields.get(key);
    if (field) field.setError(message);
  }
}

function section(title, description, children) {
  return el('section', { className: 'panel' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: title }),
        description ? el('p', { text: description }) : null,
      ]),
    ]),
    el('div', { className: 'panel__body' }, children),
  ]);
}

// ---------------------------------------------------------------------------
// News media (cover, gallery images, video links)
// ---------------------------------------------------------------------------
const MAX_IMAGES = 12;
const MAX_VIDEOS = 8;
const MAX_UPLOAD_FILES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const VIDEO_PROVIDER_LABELS = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  file: 'ملف فيديو',
};

/** Mirrors the server-side video parser closely enough for instant feedback. */
function detectVideoProvider(value) {
  const url = String(value || '').trim();
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  if (host === 'youtu.be') return 'youtube';
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    return 'youtube';
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') return 'vimeo';
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(?:[?#].*)?$/i.test(parsed.pathname)) return 'file';
  return null;
}

function checkImageFile(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP أو GIF.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'حجم الصورة أكبر من 5 ميجابايت.';
  }
  return '';
}

async function uploadImages(files) {
  const formData = new FormData();
  for (const file of files) formData.append('images', file);
  const data = await api('/api/admin/news/uploads', { method: 'POST', body: formData });
  return data && Array.isArray(data.files) ? data.files : [];
}

/**
 * Builds the media panel and keeps its state in sync with the form.
 * `getMedia()` returns the array sent to the API; images keep their gallery
 * order, videos follow them.
 */
function mediaEditor({ article, imageField }) {
  const existing = Array.isArray(article?.media) ? article.media : [];
  const gallery = existing
    .filter((item) => item.type === 'image')
    .map((item) => ({ url: item.url, caption: item.caption || '' }));
  const videos = existing
    .filter((item) => item.type === 'video')
    .map((item) => ({ url: item.url, caption: item.caption || '' }));

  // --- Cover ---------------------------------------------------------------
  const coverImage = el('img', {
    className: 'cover-upload__image',
    attrs: { alt: 'معاينة صورة الغلاف', loading: 'lazy', hidden: true },
  });
  const coverEmpty = el('span', {
    className: 'cover-upload__empty',
    text: 'لا توجد صورة غلاف — ارفع صورة أو ألصق رابطًا في حقل رابط الصورة.',
  });
  const coverPreview = el('div', { className: 'cover-upload__preview' }, [coverImage, coverEmpty]);

  const coverInput = el('input', {
    className: 'visually-hidden',
    attrs: {
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp,image/gif',
      id: 'cover-upload',
      tabindex: '-1',
    },
  });
  const coverButton = el(
    'button',
    { className: 'btn btn-outline btn-sm', attrs: { type: 'button' } },
    [icon('plus', 16), el('span', { text: 'رفع صورة غلاف' })]
  );

  function syncCoverPreview() {
    const url = imageField.input.value.trim();
    if (!url) {
      coverImage.hidden = true;
      coverImage.removeAttribute('src');
      coverEmpty.hidden = false;
      coverEmpty.textContent =
        'لا توجد صورة غلاف — ارفع صورة أو ألصق رابطًا في حقل رابط الصورة.';
      return;
    }
    coverEmpty.hidden = true;
    coverImage.hidden = false;
    coverImage.src = url;
  }

  coverImage.addEventListener('error', () => {
    coverImage.hidden = true;
    coverEmpty.hidden = false;
    coverEmpty.textContent = 'تعذّر عرض صورة الغلاف. تحقق من الرابط.';
  });
  imageField.input.addEventListener('input', syncCoverPreview);

  coverButton.addEventListener('click', () => coverInput.click());
  coverInput.addEventListener('change', async () => {
    const file = coverInput.files && coverInput.files[0];
    coverInput.value = '';
    if (!file) return;

    const problem = checkImageFile(file);
    if (problem) {
      toast(problem, 'error');
      return;
    }

    setButtonBusy(coverButton, true, 'جارٍ رفع الصورة…');
    try {
      const [uploaded] = await uploadImages([file]);
      if (uploaded) {
        imageField.input.value = uploaded.url;
        imageField.clearError();
        syncCoverPreview();
        toast('تم رفع صورة الغلاف.');
      }
    } catch (error) {
      toast(error.message || 'تعذّر رفع صورة الغلاف. حاول مرة أخرى.', 'error');
    } finally {
      setButtonBusy(coverButton, false);
    }
  });

  // --- Gallery -------------------------------------------------------------
  const galleryList = el('div', { className: 'media-grid' });
  const galleryEmpty = el('p', { className: 'hint' });
  const galleryCount = el('span', { className: 'media-counter' });

  function renderGallery() {
    galleryList.replaceChildren(
      ...gallery.map((item, index) => {
        const thumb = el('img', {
          className: 'media-card__thumb',
          attrs: {
            src: item.url,
            alt: item.caption || `صورة ${index + 1} من معرض الخبر`,
            loading: 'lazy',
          },
        });
        thumb.addEventListener('error', () => {
          thumb.src = '/assets/img/departments/default.svg';
        });

        const caption = el('input', {
          className: 'input',
          attrs: {
            type: 'text',
            maxlength: 200,
            placeholder: 'وصف الصورة (اختياري)',
            'aria-label': 'وصف الصورة',
          },
        });
        caption.value = item.caption;
        caption.addEventListener('input', () => {
          item.caption = caption.value;
        });

        const remove = el(
          'button',
          { className: 'btn btn-danger-outline btn-sm', attrs: { type: 'button' } },
          [icon('trash', 14), el('span', { text: 'إزالة' })]
        );
        remove.addEventListener('click', () => {
          gallery.splice(index, 1);
          renderGallery();
        });

        return el('div', { className: 'media-card' }, [
          thumb,
          el('div', { className: 'media-card__body' }, [caption, remove]),
        ]);
      })
    );
    galleryEmpty.hidden = gallery.length > 0;
    galleryEmpty.textContent =
      'لم تُضف صور إلى المعرض بعد. الصور المرفوعة تظهر أسفل نص الخبر.',
    galleryCount.textContent = `${gallery.length} / ${MAX_IMAGES}`;
  }

  const galleryInput = el('input', {
    className: 'visually-hidden',
    attrs: {
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp,image/gif',
      multiple: true,
      id: 'gallery-upload',
      tabindex: '-1',
    },
  });
  const galleryButton = el(
    'button',
    { className: 'btn btn-outline btn-sm', attrs: { type: 'button' } },
    [icon('plus', 16), el('span', { text: 'رفع صور للمعرض' })]
  );

  galleryButton.addEventListener('click', () => galleryInput.click());
  galleryInput.addEventListener('change', async () => {
    let files = Array.from(galleryInput.files || []);
    galleryInput.value = '';
    if (!files.length) return;

    const remaining = MAX_IMAGES - gallery.length;
    if (remaining <= 0) {
      toast(`وصلت إلى الحد الأقصى (${MAX_IMAGES} صورة).`, 'error');
      return;
    }
    if (files.length > remaining) {
      files = files.slice(0, remaining);
      toast(`تم اختيار أول ${remaining} صور فقط بسبب الحد الأقصى.`, 'warning');
    }

    for (const file of files) {
      const problem = checkImageFile(file);
      if (problem) {
        toast(problem, 'error');
        return;
      }
    }

    setButtonBusy(galleryButton, true, 'جارٍ رفع الصور…');
    try {
      let uploadedCount = 0;
      for (let index = 0; index < files.length; index += MAX_UPLOAD_FILES) {
        const batch = files.slice(index, index + MAX_UPLOAD_FILES);
        const uploaded = await uploadImages(batch);
        uploaded.forEach((file) => gallery.push({ url: file.url, caption: '' }));
        uploadedCount += uploaded.length;
      }
      renderGallery();
      toast(`تم رفع ${uploadedCount} صورة إلى المعرض.`);
    } catch (error) {
      renderGallery();
      toast(error.message || 'تعذّر رفع الصور. حاول مرة أخرى.', 'error');
    } finally {
      setButtonBusy(galleryButton, false);
    }
  });

  // --- Videos --------------------------------------------------------------
  const videoList = el('div', { className: 'media-list' });
  const videoEmpty = el('p', { className: 'hint' });
  const videoCount = el('span', { className: 'media-counter' });

  const videoUrl = el('input', {
    className: 'input',
    attrs: {
      type: 'url',
      dir: 'ltr',
      placeholder: 'https://www.youtube.com/watch?v=…',
      'aria-label': 'رابط الفيديو',
      maxlength: 500,
    },
  });
  const videoCaption = el('input', {
    className: 'input',
    attrs: {
      type: 'text',
      placeholder: 'وصف الفيديو (اختياري)',
      'aria-label': 'وصف الفيديو',
      maxlength: 200,
    },
  });
  const videoAdd = el(
    'button',
    { className: 'btn btn-primary btn-sm', attrs: { type: 'button' } },
    [icon('plus', 16), el('span', { text: 'إضافة فيديو' })]
  );

  function renderVideos() {
    videoList.replaceChildren(
      ...videos.map((item, index) => {
        const provider = detectVideoProvider(item.url) || 'file';
        const caption = el('input', {
          className: 'input',
          attrs: {
            type: 'text',
            maxlength: 200,
            placeholder: 'وصف الفيديو (اختياري)',
            'aria-label': 'وصف الفيديو',
          },
        });
        caption.value = item.caption;
        caption.addEventListener('input', () => {
          item.caption = caption.value;
        });

        const remove = el(
          'button',
          { className: 'btn btn-danger-outline btn-sm', attrs: { type: 'button' } },
          [icon('trash', 14), el('span', { text: 'إزالة' })]
        );
        remove.addEventListener('click', () => {
          videos.splice(index, 1);
          renderVideos();
        });

        return el('div', { className: 'media-list__item' }, [
          el('span', { className: 'badge badge--published', text: VIDEO_PROVIDER_LABELS[provider] || 'فيديو' }),
          el('div', { className: 'media-list__body' }, [
            el('a', {
              className: 'media-list__link',
              attrs: { href: item.url, target: '_blank', rel: 'noopener noreferrer', dir: 'ltr' },
              text: item.url,
            }),
            caption,
          ]),
          remove,
        ]);
      })
    );
    videoEmpty.hidden = videos.length > 0;
    videoEmpty.textContent = 'لم تُضف فيديوهات بعد. أضف رابط YouTube أو Vimeo أو ملف MP4.';
    videoCount.textContent = `${videos.length} / ${MAX_VIDEOS}`;
  }

  videoAdd.addEventListener('click', () => {
    const url = videoUrl.value.trim();
    if (!url) {
      toast('أدخل رابط الفيديو أولًا.', 'error');
      videoUrl.focus();
      return;
    }
    if (!detectVideoProvider(url)) {
      toast('رابط الفيديو غير مدعوم. استخدم YouTube أو Vimeo أو ملف MP4/WebM مباشر.', 'error');
      videoUrl.focus();
      return;
    }
    if (videos.length >= MAX_VIDEOS) {
      toast(`وصلت إلى الحد الأقصى (${MAX_VIDEOS} فيديوهات).`, 'error');
      return;
    }
    videos.push({ url, caption: videoCaption.value.trim() });
    videoUrl.value = '';
    videoCaption.value = '';
    renderVideos();
    videoUrl.focus();
  });

  videoUrl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      videoAdd.click();
    }
  });

  renderGallery();
  renderVideos();
  syncCoverPreview();

  const node = section(
    'صور وفيديو الخبر',
    'ارفع صورًا من جهازك (حتى 5 ميجابايت للصورة)، وأضف الفيديوهات بروابط YouTube أو Vimeo أو ملف مباشر.',
    [
      el('div', { className: 'media-block' }, [
        el('div', { className: 'media-block__head' }, [
          el('h4', { text: 'صورة الغلاف' }),
          el('span', { className: 'hint', text: 'تظهر أعلى صفحة الخبر وفي بطاقات الأخبار.' }),
        ]),
        el('div', { className: 'cover-upload' }, [
          coverPreview,
          el('div', { className: 'cover-upload__actions' }, [coverButton, coverInput]),
        ]),
      ]),
      el('div', { className: 'media-block' }, [
        el('div', { className: 'media-block__head' }, [
          el('h4', { text: 'معرض الصور' }),
          galleryCount,
        ]),
        el('p', { className: 'hint', text: 'الصور المرفوعة تظهر في معرض أسفل نص الخبر. يمكنك إضافة وصف لكل صورة.' }),
        el('div', { className: 'media-block__actions' }, [galleryButton, galleryInput]),
        galleryEmpty,
        galleryList,
      ]),
      el('div', { className: 'media-block' }, [
        el('div', { className: 'media-block__head' }, [
          el('h4', { text: 'الفيديوهات' }),
          videoCount,
        ]),
        el('p', { className: 'hint', text: 'الصق رابط الفيديو ثم أضفه. لا يتم رفع ملفات الفيديو إلى الخادم.' }),
        el('div', { className: 'media-add' }, [
          el('div', { className: 'media-add__url' }, [videoUrl]),
          el('div', { className: 'media-add__caption' }, [videoCaption]),
          videoAdd,
        ]),
        videoEmpty,
        videoList,
      ]),
    ]
  );

  function getMedia() {
    return [
      ...gallery.map((item, index) => ({
        type: 'image',
        url: item.url,
        caption: item.caption,
        sort_order: index,
      })),
      ...videos.map((item, index) => ({
        type: 'video',
        url: item.url,
        caption: item.caption,
        sort_order: gallery.length + index,
      })),
    ];
  }

  return { node, getMedia };
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 140);
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function validate(values) {
  clearFieldErrors();
  let ok = true;

  const check = (id, condition, message) => {
    if (condition) return;
    const field = fields.get(id);
    if (field) field.setError(message);
    ok = false;
  };

  check('title', values.title.length >= 3, 'عنوان الخبر مطلوب (3 أحرف على الأقل).');
  check('title', values.title.length <= 160, 'عنوان الخبر طويل جدًا (160 حرفًا كحد أقصى).');
  check('summary', values.summary.length >= 10, 'الملخص مطلوب (10 أحرف على الأقل).');
  check('summary', values.summary.length <= 500, 'الملخص طويل جدًا (500 حرف كحد أقصى).');
  check('body', values.body.length >= 20, 'نص الخبر مطلوب (20 حرفًا على الأقل).');
  check('body', values.body.length <= 12000, 'نص الخبر طويل جدًا (12000 حرف كحد أقصى).');
  check('category', values.category.length <= 80, 'التصنيف طويل جدًا (80 حرفًا كحد أقصى).');
  check('slug', values.slug.length <= 160, 'المعرّف طويل جدًا (160 حرفًا كحد أقصى).');
  check('image_url', values.image_url.length <= 500, 'رابط الصورة طويل جدًا.');

  if (values.image_url) {
    const valid = values.image_url.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(values.image_url);
    check('image_url', valid, 'رابط الصورة يجب أن يبدأ بـ / أو http(s)://');
  }

  const sort = Number(values.sort_order);
  check('sort_order', Number.isInteger(sort) && sort >= 0, 'ترتيب العرض يجب أن يكون عددًا صحيحًا غير سالب.');
  check('sort_order', sort <= 9999, 'ترتيب العرض كبير جدًا.');

  if (values.published_at) {
    check(
      'published_at',
      !Number.isNaN(Date.parse(values.published_at)),
      'تاريخ النشر غير صالح.'
    );
  }

  return ok;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderForm(article) {
  const editing = Boolean(article);

  const titleField = createField({
    id: 'title',
    label: 'عنوان الخبر',
    value: article?.title || '',
    required: true,
    maxlength: 160,
    placeholder: 'مثال: انطلاق أسبوع المشروعات التطبيقية',
  });

  const slugField = createField({
    id: 'slug',
    label: 'المعرّف في الرابط (slug)',
    value: article?.slug || '',
    dir: 'ltr',
    maxlength: 160,
    hint: 'يُستخدم في رابط الخبر، مثل /news/projects-week. اتركه فارغًا ليُولَّد تلقائيًا من العنوان.',
  });

  const summaryField = createField({
    id: 'summary',
    label: 'الملخص',
    type: 'textarea',
    value: article?.summary || '',
    required: true,
    rows: 3,
    maxlength: 500,
    hint: 'يظهر في بطاقة الخبر بصفحة الأخبار وفي نتائج البحث (10–500 حرف).',
  });

  const bodyField = createField({
    id: 'body',
    label: 'نص الخبر',
    type: 'textarea',
    value: article?.body || '',
    required: true,
    rows: 10,
    maxlength: 12000,
    hint: 'اكتب فقرة في كل سطر. يُعرض النص كنص عادي على الموقع.',
    full: true,
  });

  const categoryField = createField({
    id: 'category',
    label: 'التصنيف',
    value: article?.category || '',
    maxlength: 80,
    placeholder: 'مثال: أنشطة، ورش عمل، إعلانات',
    hint: 'اختياري — يُستخدم لتصفية الأخبار في الموقع.',
  });

  const imageField = createField({
    id: 'image_url',
    label: 'رابط صورة الخبر',
    value: article?.image_url || '',
    dir: 'ltr',
    maxlength: 500,
    hint: 'اختياري — يمكنك رفع صورة الغلاف من قسم الوسائط بالأسفل، أو لصق رابط يبدأ بـ / أو https://.',
  });

  const media = mediaEditor({ article, imageField });

  const publishedAtField = createField({
    id: 'published_at',
    label: 'تاريخ النشر',
    type: 'datetime-local',
    value: toLocalInput(article?.published_at),
    hint: 'اتركه فارغًا لاستخدام وقت الحفظ. يُستخدم في ترتيب الأخبار.',
  });

  const sortField = createField({
    id: 'sort_order',
    label: 'ترتيب العرض',
    type: 'number',
    value: article?.sort_order ?? 0,
    inputmode: 'numeric',
    hint: 'الأرقام الأصغر تظهر أولًا عند تساوي تاريخ النشر.',
  });

  const published = checkboxField({
    id: 'is_published',
    label: 'نشر الخبر في الموقع',
    hint: 'الخبر المنشور يظهر للزوار في صفحة الأخبار والصفحة الرئيسية.',
    checked: article ? article.is_published : false,
  });

  const featured = checkboxField({
    id: 'is_featured',
    label: 'تمييز الخبر',
    hint: 'الأخبار المميزة تظهر أولًا وتُبرز في الصفحة الرئيسية.',
    checked: article ? article.is_featured : false,
  });

  // Keep the slug in sync with the title until the administrator edits it.
  let slugTouched = Boolean(article?.slug);
  slugField.input.addEventListener('input', () => {
    slugTouched = true;
  });
  if (!editing) {
    titleField.input.addEventListener('input', () => {
      if (!slugTouched) slugField.input.value = slugify(titleField.input.value);
    });
  }

  const alertBox = el('div', { className: 'alert alert--error', attrs: { id: 'form-alert', hidden: true } });

  const form = el('form', { attrs: { id: 'news-form', novalidate: true } }, [
    alertBox,
    el('div', { className: 'mt-2' }, [
      section('المعلومات الأساسية', 'العنوان والملخص والتصنيف والرابط الذي يظهر للزائر.', [
        el('div', { className: 'form-grid' }, [
          titleField.node,
          slugField.node,
          summaryField.node,
          categoryField.node,
          imageField.node,
        ]),
      ]),
      el('div', { className: 'mt-2' }, [
        section('نص الخبر', 'المحتوى الكامل الذي يظهر في صفحة الخبر.', [bodyField.node]),
      ]),
      el('div', { className: 'mt-2' }, [media.node]),
      el('div', { className: 'mt-2' }, [
        section('النشر والترتيب', 'تحكم في ظهور الخبر وترتيبه بين الأخبار الأخرى.', [
          el('div', { className: 'form-grid' }, [
            publishedAtField.node,
            sortField.node,
            el('div', { className: 'field' }, [published.node]),
            el('div', { className: 'field' }, [featured.node]),
          ]),
        ]),
      ]),
    ]),
  ]);

  const saveButton = el('button', { className: 'btn btn-primary', attrs: { type: 'submit', id: 'save-button' } }, [
    icon('save', 16),
    el('span', { text: editing ? 'حفظ التعديلات' : 'إنشاء الخبر' }),
  ]);

  const actions = el('div', { className: 'form-actions' }, [
    saveButton,
    el('a', { className: 'btn btn-outline', attrs: { href: '/admin/news' }, text: 'إلغاء' }),
    el('span', { className: 'spacer' }),
    editing && article.is_published
      ? el('a', {
          className: 'btn btn-ghost',
          attrs: {
            href: `/news/${encodeURIComponent(article.slug)}`,
            target: '_blank',
            rel: 'noopener',
          },
        }, [icon('external', 16), el('span', { text: 'عرض في الموقع' })])
      : null,
  ]);

  form.append(actions);

  // --- Submit --------------------------------------------------------------
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setAlert(alertBox, {});

    const values = {
      title: titleField.input.value.trim(),
      slug: slugField.input.value.trim(),
      summary: summaryField.input.value.trim(),
      body: bodyField.input.value.trim(),
      category: categoryField.input.value.trim(),
      image_url: imageField.input.value.trim(),
      published_at: publishedAtField.input.value,
      sort_order: sortField.input.value.trim(),
    };

    if (!validate(values)) {
      setAlert(alertBox, { type: 'error', message: 'يرجى تصحيح الحقول المميزة بالأحمر قبل الحفظ.' });
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const payload = {
      title: values.title,
      summary: values.summary,
      body: values.body,
      category: values.category,
      image_url: values.image_url,
      media: media.getMedia(),
      sort_order: Number(values.sort_order),
      is_published: published.input.checked,
      is_featured: featured.input.checked,
    };
    if (values.slug) payload.slug = values.slug;
    if (values.published_at) payload.published_at = new Date(values.published_at).toISOString();

    setButtonBusy(saveButton, true, 'جارٍ الحفظ…');
    try {
      if (editing) {
        await api(`/api/admin/news/${article.id}`, { method: 'PATCH', body: payload });
        toast('تم حفظ تعديلات الخبر.');
      } else {
        await api('/api/admin/news', { method: 'POST', body: payload });
        toast('تم إنشاء الخبر بنجاح.');
      }
      window.setTimeout(() => {
        window.location.href = '/admin/news';
      }, 550);
    } catch (error) {
      applyServerErrors(error.fields);
      setAlert(alertBox, {
        type: 'error',
        message: error.message || 'تعذّر حفظ الخبر. تحقق من البيانات ثم حاول مرة أخرى.',
      });
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      else alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      setButtonBusy(saveButton, false);
    }
  });

  // --- Header --------------------------------------------------------------
  const head = pageHead({
    title: editing ? article.title : 'إضافة خبر جديد',
    description: editing
      ? 'عدّل بيانات الخبر ثم احفظ التغييرات. تُطبَّق التعديلات على الموقع مباشرة.'
      : 'أدخل بيانات الخبر. يمكنك حفظه كمسودة ونشره لاحقًا.',
    actions: [
      el('a', { className: 'btn btn-outline', attrs: { href: '/admin/news' } }, [
        icon('arrowLeft', 16),
        el('span', { text: 'رجوع للأخبار' }),
      ]),
    ],
  });

  const nodes = [head];

  if (editing) {
    nodes.push(
      el('div', { className: 'panel' }, [
        el('div', { className: 'panel__body' }, [
          el('div', { className: 'chip-row' }, [
            newsStateBadge(article),
            article.is_demo
              ? el('span', { className: 'badge badge--demo', text: 'بيانات تجريبية' })
              : el('span', { className: 'badge badge--real', text: 'بيانات حقيقية' }),
            article.is_featured
              ? el('span', { className: 'badge badge--published', text: 'مميز' })
              : null,
          ]),
        ]),
      ])
    );
  }

  nodes.push(el('div', { className: 'mt-2' }, [form]));

  if (editing) {
    const deleteButton = el('button', {
      className: 'btn btn-danger-outline',
      attrs: { type: 'button', id: 'delete-news' },
    }, [icon('trash', 16), el('span', { text: 'حذف الخبر نهائيًا' })]);

    deleteButton.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'حذف الخبر نهائيًا',
        message: `سيتم حذف «${article.title}» نهائيًا من قاعدة البيانات وإخفاؤه من الموقع. لا يمكن التراجع.`,
        confirmLabel: 'حذف نهائي',
        danger: true,
        requireText: article.title,
      });
      if (!confirmed) return;

      setButtonBusy(deleteButton, true, 'جارٍ الحذف…');
      try {
        await api(`/api/admin/news/${article.id}`, { method: 'DELETE' });
        toast('تم حذف الخبر.');
        window.setTimeout(() => {
          window.location.href = '/admin/news';
        }, 550);
      } catch (error) {
        const message =
          error instanceof ApiError && error.status === 404
            ? 'الخبر غير موجود. ربما تم حذفه بالفعل.'
            : error.message || 'تعذّر حذف الخبر.';
        toast(message, 'error');
        setButtonBusy(deleteButton, false);
      }
    });

    nodes.push(
      el('section', { className: 'panel mt-2' }, [
        el('div', { className: 'panel__head' }, [
          el('div', {}, [
            el('h3', { text: 'منطقة الخطر' }),
            el('p', { text: 'الحذف نهائي ولا يمكن التراجع عنه.' }),
          ]),
        ]),
        el('div', { className: 'panel__body' }, [
          el('div', { className: 'notice notice--danger' }, [
            icon('alert', 18),
            el('span', {
              text: 'سيُحذف الخبر من قاعدة البيانات ومن الموقع. إن أردت إخفاءه مؤقتًا، ألغِ نشره بدلًا من حذفه.',
            }),
          ]),
          el('div', { className: 'form-actions' }, [deleteButton]),
        ]),
      ])
    );
  }

  content.replaceChildren(...nodes);
  titleField.input.focus();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function init() {
  if (!isEdit) {
    renderForm(null);
    return;
  }

  try {
    const article = await api(`/api/admin/news/${newsId}`);
    renderForm(article);
  } catch (error) {
    const head = pageHead({
      title: 'تعذّر تحميل الخبر',
      actions: [
        el('a', { className: 'btn btn-outline', attrs: { href: '/admin/news' } }, [
          icon('arrowLeft', 16),
          el('span', { text: 'رجوع للأخبار' }),
        ]),
      ],
    });
    const alertBox = el('div');
    setAlert(alertBox, {
      type: 'error',
      message:
        error instanceof ApiError && error.status === 404
          ? 'الخبر المطلوب غير موجود. ربما تم حذفه.'
          : error.message || 'تعذّر تحميل بيانات الخبر.',
    });
    content.replaceChildren(
      head,
      el('div', { className: 'panel mt-2' }, [el('div', { className: 'panel__body' }, [alertBox])])
    );
  }
}

// Start only after every constant used by the form is initialised.
if (admin) {
  init();
}
