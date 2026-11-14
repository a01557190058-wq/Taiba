import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  EmptyState,
  PageHead,
  PageSkeleton,
} from '../../components/admin/ui.jsx';
import {
  CheckboxField,
  FormSection,
  TextField,
  TextareaField,
} from '../../components/admin/form.jsx';

// Keep these in sync with the server upload endpoint.
const MAX_SOURCE_BYTES = 20 * 1024 * 1024; // the browser downscales before upload
const FULL_MAX_SIZE = 1600;
const THUMB_MAX_SIZE = 800;
const UPLOAD_QUALITY = 0.86;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const ICON_LABELS = {
  image: 'صورة',
  book: 'كتاب',
  flask: 'معمل',
  grid: 'شبكة',
  layers: 'طبقات',
  sparkles: 'بريق',
  target: 'هدف',
  users: 'طلاب',
  graduation: 'تخرج',
  star: 'نجمة',
  chart: 'رسم بياني',
  shield: 'درع',
  briefcase: 'حقيبة',
  calendar: 'تقويم',
  quote: 'اقتباس',
  video: 'فيديو',
  news: 'خبر',
  file: 'ملف',
  database: 'قاعدة بيانات',
  search: 'بحث',
  eye: 'عين',
  check: 'علامة صح',
  info: 'معلومات',
};

let uidCounter = 0;
function uid(prefix) {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`;
}

function moveItem(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function serialize(settings, sections) {
  return JSON.stringify({
    settings,
    sections: sections.map((section) => ({
      slug: section.slug,
      eyebrow: section.eyebrow,
      title: section.title,
      description: section.description,
      icon: section.icon,
      is_published: section.is_published,
      images: section.images.map((image) => ({
        url: image.url,
        thumb_url: image.thumb_url,
        alt: image.alt,
        caption: image.caption,
        credit: image.credit,
        credit_url: image.credit_url,
        is_published: image.is_published,
      })),
    })),
  });
}

/** Shapes the API payload into editable rows with stable React keys. */
function toEditorState(data) {
  return {
    settings: {
      eyebrow: data.settings?.eyebrow || '',
      title: data.settings?.title || '',
      lead: data.settings?.lead || '',
      credits_note: data.settings?.credits_note || '',
      show_credits: data.settings?.show_credits !== false,
    },
    sections: (Array.isArray(data.sections) ? data.sections : []).map((section) => ({
      key: `s-${section.id}`,
      id: section.id,
      slug: section.slug || '',
      eyebrow: section.eyebrow || '',
      title: section.title || '',
      description: section.description || '',
      icon: section.icon || 'image',
      is_published: section.is_published !== false,
      images: (Array.isArray(section.images) ? section.images : []).map((image) => ({
        key: `i-${image.id}`,
        id: image.id,
        url: image.url || '',
        thumb_url: image.thumb_url || '',
        alt: image.alt || '',
        caption: image.caption || '',
        credit: image.credit || '',
        credit_url: image.credit_url || '',
        is_published: image.is_published !== false,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Browser-side image preparation
// ---------------------------------------------------------------------------
function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    // `from-image` honours the EXIF orientation of phone photos.
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() =>
      createImageBitmap(file)
    );
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذّر قراءة الصورة.'));
    };
    image.src = url;
  });
}

/** Downscales a photo to fit within `maxSize` and re-encodes it as JPEG. */
async function resizePhoto(file, maxSize, suffix) {
  // Re-encoding a GIF would freeze its animation, so it is uploaded as-is.
  if (file.type === 'image/gif') return file;

  const source = await loadImageSource(file);
  const width = source.width;
  const height = source.height;
  if (!width || !height) throw new Error('أبعاد الصورة غير صالحة.');

  const scale = Math.min(1, maxSize / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذّر تجهيز الصورة.');
  // A white background keeps transparent PNGs looking right as JPEG.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
  if (typeof source.close === 'function') source.close();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', UPLOAD_QUALITY)
  );
  if (!blob) throw new Error('تعذّر ضغط الصورة.');

  const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}-${suffix}.jpg`, { type: 'image/jpeg' });
}

async function uploadFiles(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  const data = await api('/api/admin/gallery/uploads', { method: 'POST', body: formData });
  return data && Array.isArray(data.files) ? data.files : [];
}

/** Downscales one photo, uploads the full + thumbnail pair and returns URLs. */
async function uploadPhoto(file) {
  const [full, thumb] = await Promise.all([
    resizePhoto(file, FULL_MAX_SIZE, 'full'),
    resizePhoto(file, THUMB_MAX_SIZE, 'thumb'),
  ]);
  const sameFile = full === thumb;
  const uploaded = await uploadFiles(sameFile ? [full] : [full, thumb]);
  if (!uploaded.length) throw new Error('لم يتم استلام الملف من الخادم.');
  return {
    url: uploaded[0].url,
    thumb_url: uploaded[1] ? uploaded[1].url : uploaded[0].url,
  };
}

// ---------------------------------------------------------------------------
// Client-side validation (mirrors the API limits)
// ---------------------------------------------------------------------------
function validateForm(settings, sections) {
  const errors = {};

  const title = String(settings.title || '').trim();
  if (title.length < 3) errors['settings.title'] = 'عنوان الصفحة مطلوب (3 أحرف على الأقل).';
  else if (title.length > 160) errors['settings.title'] = 'العنوان طويل جدًا (160 حرفًا كحد أقصى).';

  const lead = String(settings.lead || '').trim();
  if (lead.length < 10) errors['settings.lead'] = 'وصف الصفحة مطلوب (10 أحرف على الأقل).';
  else if (lead.length > 600) errors['settings.lead'] = 'الوصف طويل جدًا (600 حرف كحد أقصى).';

  if (String(settings.eyebrow || '').length > 80) {
    errors['settings.eyebrow'] = 'العنوان الفرعي طويل جدًا (80 حرفًا كحد أقصى).';
  }
  if (String(settings.credits_note || '').length > 500) {
    errors['settings.credits_note'] = 'الملاحظة طويلة جدًا (500 حرف كحد أقصى).';
  }

  sections.forEach((section, index) => {
    const prefix = `sections.${index}`;
    const name = String(section.title || '').trim();
    if (name.length < 2) errors[`${prefix}.title`] = 'اسم القسم مطلوب (حرفان على الأقل).';
    else if (name.length > 120) errors[`${prefix}.title`] = 'اسم القسم طويل جدًا (120 حرفًا كحد أقصى).';

    if (String(section.eyebrow || '').length > 80) {
      errors[`${prefix}.eyebrow`] = 'العنوان الفرعي طويل جدًا (80 حرفًا كحد أقصى).';
    }
    if (String(section.description || '').length > 1000) {
      errors[`${prefix}.description`] = 'وصف القسم طويل جدًا (1000 حرف كحد أقصى).';
    }
    if (String(section.slug || '').length > 140) {
      errors[`${prefix}.slug`] = 'المعرّف طويل جدًا (140 حرفًا كحد أقصى).';
    }
  });

  return errors;
}

// ---------------------------------------------------------------------------
// Section editor
// ---------------------------------------------------------------------------
function SectionEditor({
  section,
  index,
  total,
  icons,
  maxImages,
  errors,
  open,
  uploading,
  onToggle,
  onSectionField,
  onImageField,
  onFiles,
  onMove,
  onRemove,
  onMoveImage,
  onRemoveImage,
  onToggleImage,
}) {
  const inputRef = useRef(null);
  const prefix = `sections.${index}`;
  const atLimit = section.images.length >= maxImages;

  return (
    <article className={`gallery-admin-section${open ? ' is-open' : ''}`}>
      <header className="gallery-admin-section__head">
        <button
          className="gallery-admin-section__toggle"
          type="button"
          aria-expanded={open}
          onClick={onToggle}
        >
          <Icon name={section.icon} size={18} />
          <span className="gallery-admin-section__title">
            {section.title || 'قسم بدون عنوان'}
          </span>
          <span
            className={`badge ${section.is_published ? 'badge--published' : 'badge--draft'}`}
          >
            {section.is_published ? 'منشور' : 'مخفي'}
          </span>
          <span className="gallery-admin-section__count">
            {formatNumber(section.images.length)} صور
          </span>
          <Icon
            name="arrowUp"
            size={16}
            className={`gallery-admin-section__chevron${open ? '' : ' is-collapsed'}`}
          />
        </button>

        <div className="gallery-admin-section__tools">
          <button
            className="btn btn-ghost btn-icon"
            type="button"
            aria-label="تحريك القسم لأعلى"
            title="تحريك لأعلى"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <Icon name="arrowUp" size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            type="button"
            aria-label="تحريك القسم لأسفل"
            title="تحريك لأسفل"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <Icon name="arrowUp" size={16} className="icon-flip" />
          </button>
          <button
            className="btn btn-danger-outline btn-icon"
            type="button"
            aria-label="حذف القسم"
            title="حذف القسم"
            onClick={onRemove}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </header>

      {open ? (
        <div className="gallery-admin-section__body">
          <div className="form-grid">
            <TextField
              id={`${prefix}-title`}
              label="اسم القسم"
              required
              value={section.title}
              onChange={onSectionField('title')}
              error={errors[`${prefix}.title`]}
              maxLength={120}
            />
            <TextField
              id={`${prefix}-slug`}
              label="معرّف القسم (Anchor)"
              value={section.slug}
              onChange={onSectionField('slug')}
              hint="يُستخدم في رابط القسم داخل الصفحة. اتركه فارغًا ليُولَّد تلقائيًا."
              dir="ltr"
              maxLength={140}
              error={errors[`${prefix}.slug`]}
            />
            <TextField
              id={`${prefix}-eyebrow`}
              label="العنوان الفرعي"
              value={section.eyebrow}
              onChange={onSectionField('eyebrow')}
              maxLength={80}
              error={errors[`${prefix}.eyebrow`]}
            />

            <div className="field">
              <label htmlFor={`${prefix}-icon`}>
                <span>أيقونة القسم</span>
              </label>
              <select
                id={`${prefix}-icon`}
                className="input"
                value={section.icon}
                onChange={onSectionField('icon')}
              >
                {icons.map((name) => (
                  <option value={name} key={name}>
                    {ICON_LABELS[name] || name}
                  </option>
                ))}
              </select>
              <p className="error-text">{errors[`${prefix}.icon`] || ''}</p>
            </div>

            <TextareaField
              id={`${prefix}-description`}
              label="وصف القسم"
              value={section.description}
              onChange={onSectionField('description')}
              rows={3}
              maxLength={1000}
              error={errors[`${prefix}.description`]}
              full
            />

            <CheckboxField
              id={`${prefix}-published`}
              label="عرض القسم في صفحة المعرض"
              hint="عند إخفائه لن يظهر القسم أو صوره للزوار."
              checked={section.is_published}
              onChange={onSectionField('is_published')}
            />
          </div>

          <div className="media-block">
            <div className="media-block__head">
              <h4>صور القسم</h4>
              <span className="media-counter">{`${section.images.length} / ${maxImages}`}</span>
            </div>
            <p className="hint">
              ارفع صورًا من جهازك (JPG أو PNG أو WebP أو GIF). تُصغَّر الصور تلقائيًا قبل
              الرفع، ويمكنك ترتيبها أو إخفاء أي صورة دون حذفها.
            </p>

            <div className="media-block__actions">
              <button
                className="btn btn-outline btn-sm"
                type="button"
                disabled={uploading || atLimit}
                onClick={() => inputRef.current && inputRef.current.click()}
              >
                <Icon name="plus" size={16} />
                <span>{uploading ? 'جارٍ رفع الصور…' : 'إضافة صور من الجهاز'}</span>
              </button>
              <input
                ref={inputRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                tabIndex={-1}
                onChange={(event) => {
                  // Copy the FileList before clearing the input: clearing
                  // `value` empties the live selection in some browsers.
                  const files = Array.from(event.target.files || []);
                  event.target.value = '';
                  onFiles(files);
                }}
              />
            </div>

            {section.images.length ? (
              <div className="gallery-admin-photos">
                {section.images.map((image, imageIndex) => (
                  <div
                    className={`gallery-admin-photo${
                      image.is_published ? '' : ' is-hidden'
                    }`}
                    key={image.key}
                  >
                    <div className="gallery-admin-photo__media">
                      <img
                        src={image.thumb_url || image.url}
                        alt={image.alt || image.caption || `صورة ${imageIndex + 1}`}
                        loading="lazy"
                      />
                      <span
                        className={`badge ${
                          image.is_published ? 'badge--published' : 'badge--draft'
                        }`}
                      >
                        {image.is_published ? 'ظاهرة' : 'مخفية'}
                      </span>
                    </div>

                    <div className="gallery-admin-photo__body">
                      <input
                        className="input"
                        type="text"
                        maxLength={200}
                        placeholder="النص البديل (Alt)"
                        aria-label="النص البديل للصورة"
                        value={image.alt}
                        onChange={onImageField(image.key, 'alt')}
                      />
                      <input
                        className="input"
                        type="text"
                        maxLength={200}
                        placeholder="وصف الصورة"
                        aria-label="وصف الصورة"
                        value={image.caption}
                        onChange={onImageField(image.key, 'caption')}
                      />
                      <input
                        className="input"
                        type="text"
                        maxLength={200}
                        placeholder="حقوق الصورة (اختياري)"
                        aria-label="حقوق الصورة"
                        value={image.credit}
                        onChange={onImageField(image.key, 'credit')}
                      />
                      <input
                        className="input"
                        type="url"
                        maxLength={500}
                        placeholder="https://رابط-المصدر"
                        aria-label="رابط مصدر الصورة"
                        dir="ltr"
                        value={image.credit_url}
                        onChange={onImageField(image.key, 'credit_url')}
                      />

                      <div className="gallery-admin-photo__actions">
                        <button
                          className="btn btn-ghost btn-icon"
                          type="button"
                          aria-label="تحريك الصورة لأعلى"
                          title="تحريك لأعلى"
                          disabled={imageIndex === 0}
                          onClick={() => onMoveImage(image.key, -1)}
                        >
                          <Icon name="arrowUp" size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          type="button"
                          aria-label="تحريك الصورة لأسفل"
                          title="تحريك لأسفل"
                          disabled={imageIndex === section.images.length - 1}
                          onClick={() => onMoveImage(image.key, 1)}
                        >
                          <Icon name="arrowUp" size={15} className="icon-flip" />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => onToggleImage(image.key)}
                        >
                          <Icon name={image.is_published ? 'eye' : 'check'} size={15} />
                          <span>{image.is_published ? 'إخفاء' : 'إظهار'}</span>
                        </button>
                        <button
                          className="btn btn-danger-outline btn-icon"
                          type="button"
                          aria-label="حذف الصورة"
                          title="حذف الصورة"
                          onClick={() => onRemoveImage(image.key)}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">لا توجد صور في هذا القسم بعد.</p>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function GalleryAdminPage() {
  const { toast, confirm } = useFeedback();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [settings, setSettings] = useState(null);
  const [sections, setSections] = useState([]);
  const [icons, setIcons] = useState([]);
  const [limits, setLimits] = useState({ sections: 8, imagesPerSection: 40 });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingSection, setUploadingSection] = useState(null);
  const [openSections, setOpenSections] = useState(() => new Set());
  const [baseline, setBaseline] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api('/api/admin/gallery');
      const next = toEditorState(data);
      setSettings(next.settings);
      setSections(next.sections);
      setIcons(Array.isArray(data.icons) ? data.icons : []);
      setLimits(data.limits || { sections: 8, imagesPerSection: 40 });
      setOpenSections(new Set(next.sections.map((section) => section.key)));
      setBaseline(serialize(next.settings, next.sections));
      setErrors({});
    } catch (error) {
      setLoadError(error.message || 'تعذّر تحميل معرض الصور. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => (settings ? serialize(settings, sections) !== baseline : false),
    [settings, sections, baseline]
  );

  // Warn before losing unsaved changes (including freshly uploaded photos).
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const totalImages = useMemo(
    () => sections.reduce((sum, section) => sum + section.images.length, 0),
    [sections]
  );

  const setSetting = (key) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setSettings((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const field = `settings.${key}`;
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updateSection = useCallback((key, patch) => {
    setSections((current) =>
      current.map((section) =>
        section.key === key ? { ...section, ...patch } : section
      )
    );
  }, []);

  const onSectionField = (section, index, field) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    updateSection(section.key, { [field]: value });
    setErrors((current) => {
      const key = `sections.${index}.${field}`;
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateImage = useCallback((sectionKey, imageKey, patch) => {
    setSections((current) =>
      current.map((section) =>
        section.key === sectionKey
          ? {
              ...section,
              images: section.images.map((image) =>
                image.key === imageKey ? { ...image, ...patch } : image
              ),
            }
          : section
      )
    );
  }, []);

  const onImageField = (sectionKey, imageKey, field) => (event) => {
    updateImage(sectionKey, imageKey, { [field]: event.target.value });
  };

  const toggleSection = (key) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addSection = () => {
    if (sections.length >= limits.sections) {
      toast(`وصلت إلى الحد الأقصى (${limits.sections} أقسام).`, 'error');
      return;
    }
    const key = uid('s');
    setSections((current) => [
      ...current,
      {
        key,
        id: null,
        slug: '',
        eyebrow: '',
        title: `قسم جديد ${current.length + 1}`,
        description: '',
        icon: 'image',
        is_published: true,
        images: [],
      },
    ]);
    setOpenSections((current) => new Set(current).add(key));
  };

  const removeSection = async (section) => {
    const ok = await confirm({
      title: 'حذف القسم',
      message: `سيتم حذف «${section.title || 'قسم بدون عنوان'}» وكل صوره عند حفظ التغييرات.`,
      confirmLabel: 'حذف القسم',
      danger: true,
    });
    if (!ok) return;
    setSections((current) => current.filter((item) => item.key !== section.key));
  };

  const moveSection = (index, delta) => {
    setSections((current) => moveItem(current, index, delta));
  };

  const onFiles = async (section, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const remaining = limits.imagesPerSection - section.images.length;
    if (remaining <= 0) {
      toast(`وصلت إلى الحد الأقصى (${limits.imagesPerSection} صورة للقسم).`, 'error');
      return;
    }

    let accepted = files;
    if (files.length > remaining) {
      accepted = files.slice(0, remaining);
      toast(`تم اختيار أول ${remaining} صور فقط بسبب الحد الأقصى.`, 'warning');
    }

    for (const file of accepted) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP أو GIF.', 'error');
        return;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        toast('حجم الصورة كبير جدًا (20 ميجابايت كحد أقصى).', 'error');
        return;
      }
    }

    setUploadingSection(section.key);
    try {
      let added = 0;
      for (const file of accepted) {
        const uploaded = await uploadPhoto(file);
        setSections((current) =>
          current.map((item) => {
            if (item.key !== section.key) return item;
            if (item.images.length >= limits.imagesPerSection) return item;
            return {
              ...item,
              images: [
                ...item.images,
                {
                  key: uid('i'),
                  id: null,
                  url: uploaded.url,
                  thumb_url: uploaded.thumb_url,
                  alt: '',
                  caption: '',
                  credit: '',
                  credit_url: '',
                  is_published: true,
                },
              ],
            };
          })
        );
        added += 1;
      }
      if (added) toast(`تم رفع ${added} صورة. لا تنس حفظ التغييرات.`);
    } catch (error) {
      toast(error.message || 'تعذّر رفع الصور. حاول مرة أخرى.', 'error');
    } finally {
      setUploadingSection(null);
    }
  };

  const removeImage = async (section, image) => {
    const ok = await confirm({
      title: 'حذف الصورة',
      message: 'ستُحذف الصورة من القسم عند حفظ التغييرات.',
      confirmLabel: 'حذف الصورة',
      danger: true,
    });
    if (!ok) return;
    setSections((current) =>
      current.map((item) =>
        item.key === section.key
          ? { ...item, images: item.images.filter((photo) => photo.key !== image.key) }
          : item
      )
    );
  };

  const onSave = async (event) => {
    event.preventDefault();
    if (!settings || saving) return;

    const nextErrors = validateForm(settings, sections);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast('تحقق من الحقول المطلوبة قبل الحفظ.', 'error');
      const firstInvalid = document.querySelector('.gallery-admin [aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    setSaving(true);
    try {
      const payload = {
        settings: {
          eyebrow: settings.eyebrow,
          title: settings.title,
          lead: settings.lead,
          credits_note: settings.credits_note,
          show_credits: settings.show_credits,
        },
        sections: sections.map((section) => ({
          slug: section.slug,
          eyebrow: section.eyebrow,
          title: section.title,
          description: section.description,
          icon: section.icon,
          is_published: section.is_published,
          images: section.images.map((image) => ({
            url: image.url,
            thumb_url: image.thumb_url,
            alt: image.alt,
            caption: image.caption,
            credit: image.credit,
            credit_url: image.credit_url,
            is_published: image.is_published,
          })),
        })),
      };

      const data = await api('/api/admin/gallery', { method: 'PUT', body: payload });
      const next = toEditorState(data);
      setSettings(next.settings);
      setSections(next.sections);
      setIcons(Array.isArray(data.icons) ? data.icons : icons);
      setLimits(data.limits || limits);
      setOpenSections(new Set(next.sections.map((section) => section.key)));
      setBaseline(serialize(next.settings, next.sections));
      setErrors({});
      toast('تم حفظ معرض الصور بنجاح.');
    } catch (error) {
      if (error.fields) setErrors(error.fields);
      toast(error.message || 'تعذّر حفظ المعرض. حاول مرة أخرى.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    if (!dirty) return;
    const ok = await confirm({
      title: 'إلغاء التغييرات',
      message:
        'ستُفقد كل التعديلات غير المحفوظة، بما فيها الصور التي رُفعت للتو. هل تريد المتابعة؟',
      confirmLabel: 'إلغاء التغييرات',
      danger: true,
    });
    if (ok) load();
  };

  const previewAction = (
    <a
      className="btn btn-outline"
      href="/gallery"
      target="_blank"
      rel="noopener"
      key="preview"
    >
      <Icon name="external" size={16} />
      <span>معاينة الصفحة</span>
    </a>
  );

  if (loading) {
    return (
      <>
        <PageHead title="معرض الصور" description="جارٍ تحميل محتوى المعرض…" />
        <PageSkeleton />
      </>
    );
  }

  if (loadError || !settings) {
    return (
      <>
        <PageHead title="معرض الصور" actions={[previewAction]} />
        <div className="panel">
          <div className="panel__body">
            <Alert message={loadError || 'تعذّر تحميل معرض الصور.'} />
            <div className="form-actions">
              <button className="btn btn-primary" type="button" onClick={load}>
                إعادة المحاولة
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="gallery-admin">
      <PageHead
        title="معرض الصور"
        description="تحكّم كامل في صفحة المعرض: النصوص، الأقسام، الصور، الترتيب، الظهور وحقوق الصور."
        actions={[previewAction]}
      />

      <div className="gallery-admin__summary">
        <span>
          <Icon name="layers" size={16} />
          {formatNumber(sections.length)} / {formatNumber(limits.sections)} أقسام
        </span>
        <span>
          <Icon name="image" size={16} />
          {formatNumber(totalImages)} صورة
        </span>
        {dirty ? (
          <span className="gallery-admin__dirty">
            <Icon name="alert" size={16} />
            تغييرات غير محفوظة
          </span>
        ) : (
          <span className="gallery-admin__saved">
            <Icon name="check" size={16} />
            كل التغييرات محفوظة
          </span>
        )}
      </div>

      <form onSubmit={onSave} noValidate>
        <FormSection
          title="نصوص صفحة المعرض"
          description="العنوان والوصف اللذان يظهران أعلى صفحة المعرض العامة."
        >
          <div className="form-grid">
            <TextField
              id="gallery-eyebrow"
              label="العنوان الفرعي"
              value={settings.eyebrow}
              onChange={setSetting('eyebrow')}
              maxLength={80}
              error={errors['settings.eyebrow']}
            />
            <TextField
              id="gallery-title"
              label="عنوان الصفحة"
              required
              value={settings.title}
              onChange={setSetting('title')}
              maxLength={160}
              error={errors['settings.title']}
            />
            <TextareaField
              id="gallery-lead"
              label="وصف الصفحة"
              required
              value={settings.lead}
              onChange={setSetting('lead')}
              rows={3}
              maxLength={600}
              error={errors['settings.lead']}
              full
            />
            <TextareaField
              id="gallery-credits-note"
              label="ملاحظة مصادر الصور"
              value={settings.credits_note}
              onChange={setSetting('credits_note')}
              hint="تظهر أعلى قائمة حقوق الصور في أسفل الصفحة."
              rows={2}
              maxLength={500}
              error={errors['settings.credits_note']}
              full
            />
            <CheckboxField
              id="gallery-show-credits"
              label="إظهار قسم حقوق الصور"
              hint="عند إيقافه يُخفى قسم المصادر بالكامل من الصفحة العامة."
              checked={settings.show_credits}
              onChange={setSetting('show_credits')}
            />
          </div>
        </FormSection>

        <section className="panel mt-2">
          <div className="panel__head">
            <div>
              <h3>أقسام المعرض</h3>
              <p>أضف أقسامًا، رتّبها، وارفع صور كل قسم من جهازك.</p>
            </div>
            <button
              className="btn btn-outline btn-sm"
              type="button"
              disabled={sections.length >= limits.sections}
              onClick={addSection}
            >
              <Icon name="plus" size={16} />
              <span>إضافة قسم</span>
            </button>
          </div>

          <div className="panel__body">
            {sections.length === 0 ? (
              <EmptyState
                title="لا توجد أقسام بعد"
                message="أضف قسمًا أولًا (مثل «صور النظري») ثم ارفع صوره من جهازك."
                actionLabel="إضافة قسم"
                onAction={addSection}
                iconName="layers"
              />
            ) : (
              <div className="gallery-admin-sections">
                {sections.map((section, index) => (
                  <SectionEditor
                    key={section.key}
                    section={section}
                    index={index}
                    total={sections.length}
                    icons={icons}
                    maxImages={limits.imagesPerSection}
                    errors={errors}
                    open={openSections.has(section.key)}
                    uploading={uploadingSection === section.key}
                    onToggle={() => toggleSection(section.key)}
                    onSectionField={(field) => onSectionField(section, index, field)}
                    onImageField={(imageKey, field) =>
                      onImageField(section.key, imageKey, field)
                    }
                    onFiles={(files) => onFiles(section, files)}
                    onMove={(delta) => moveSection(index, delta)}
                    onRemove={() => removeSection(section)}
                    onMoveImage={(imageKey, delta) =>
                      setSections((current) =>
                        current.map((item) => {
                          if (item.key !== section.key) return item;
                          const imageIndex = item.images.findIndex(
                            (image) => image.key === imageKey
                          );
                          if (imageIndex < 0) return item;
                          return {
                            ...item,
                            images: moveItem(item.images, imageIndex, delta),
                          };
                        })
                      )
                    }
                    onRemoveImage={(imageKey) => {
                      const image = section.images.find((photo) => photo.key === imageKey);
                      if (image) removeImage(section, image);
                    }}
                    onToggleImage={(imageKey) => {
                      const image = section.images.find((photo) => photo.key === imageKey);
                      if (image) {
                        updateImage(section.key, imageKey, {
                          is_published: !image.is_published,
                        });
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="form-actions gallery-admin__savebar">
          <button className="btn btn-primary" type="submit" disabled={saving || !dirty}>
            <Icon name="save" size={16} />
            <span>{saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}</span>
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={saving || !dirty}
            onClick={onReset}
          >
            <Icon name="refresh" size={16} />
            <span>إلغاء التغييرات</span>
          </button>
          <span className="spacer" />
          <Link className="btn btn-ghost" to="/dashboard">
            العودة إلى النظرة العامة
          </Link>
        </div>
      </form>
    </div>
  );
}
