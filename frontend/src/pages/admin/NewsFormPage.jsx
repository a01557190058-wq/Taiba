import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/hooks.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  DemoBadge,
  NewsStateBadge,
  PageHead,
  PageSkeleton,
} from '../../components/admin/ui.jsx';
import {
  CheckboxField,
  FormSection,
  TextField,
  TextareaField,
  slugify,
  toLocalInput,
} from '../../components/admin/form.jsx';

const MAX_IMAGES = 12;
const MAX_VIDEOS = 8;
const MAX_UPLOAD_FILES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DEFAULT_IMAGE = '/assets/img/departments/default.svg';

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

const EMPTY = {
  title: '',
  slug: '',
  summary: '',
  body: '',
  category: '',
  image_url: '',
  published_at: '',
  sort_order: '0',
  is_published: false,
  is_featured: false,
};

function validate(values) {
  const errors = {};

  const title = values.title.trim();
  if (title.length < 3) errors.title = 'عنوان الخبر مطلوب (3 أحرف على الأقل).';
  else if (title.length > 160) errors.title = 'عنوان الخبر طويل جدًا (160 حرفًا كحد أقصى).';

  const summary = values.summary.trim();
  if (summary.length < 10) errors.summary = 'الملخص مطلوب (10 أحرف على الأقل).';
  else if (summary.length > 500) errors.summary = 'الملخص طويل جدًا (500 حرف كحد أقصى).';

  const body = values.body.trim();
  if (body.length < 20) errors.body = 'نص الخبر مطلوب (20 حرفًا على الأقل).';
  else if (body.length > 12000) errors.body = 'نص الخبر طويل جدًا (12000 حرف كحد أقصى).';

  if (values.category.trim().length > 80) errors.category = 'التصنيف طويل جدًا (80 حرفًا كحد أقصى).';
  if (values.slug.trim().length > 160) errors.slug = 'المعرّف طويل جدًا (160 حرفًا كحد أقصى).';

  const image = values.image_url.trim();
  if (image.length > 500) errors.image_url = 'رابط الصورة طويل جدًا.';
  else if (image && !(image.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(image))) {
    errors.image_url = 'رابط الصورة يجب أن يبدأ بـ / أو http(s)://';
  }

  const sort = Number(values.sort_order);
  if (!Number.isInteger(sort) || sort < 0) {
    errors.sort_order = 'ترتيب العرض يجب أن يكون عددًا صحيحًا غير سالب.';
  } else if (sort > 9999) {
    errors.sort_order = 'ترتيب العرض كبير جدًا.';
  }

  if (values.published_at && Number.isNaN(Date.parse(values.published_at))) {
    errors.published_at = 'تاريخ النشر غير صالح.';
  }

  return errors;
}

function splitMedia(article) {
  const media = Array.isArray(article?.media) ? article.media : [];
  return {
    gallery: media
      .filter((item) => item.type === 'image')
      .map((item) => ({ url: item.url, caption: item.caption || '' })),
    videos: media
      .filter((item) => item.type === 'video')
      .map((item) => ({ url: item.url, caption: item.caption || '' })),
  };
}

export default function NewsFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();

  const { data: article, loading, error } = useAsync(async () => {
    if (!isEdit) return null;
    return api(`/api/admin/news/${id}`);
  }, [id, isEdit]);

  const [values, setValues] = useState({ ...EMPTY });
  const [gallery, setGallery] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoCaption, setVideoCaption] = useState('');
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [initialised, setInitialised] = useState(false);
  const [coverBroken, setCoverBroken] = useState(false);

  const coverInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    if (isEdit && article) {
      setValues({
        title: article.title || '',
        slug: article.slug || '',
        summary: article.summary || '',
        body: article.body || '',
        category: article.category || '',
        image_url: article.image_url || '',
        published_at: toLocalInput(article.published_at),
        sort_order: String(article.sort_order ?? 0),
        is_published: Boolean(article.is_published),
        is_featured: Boolean(article.is_featured),
      });
      const { gallery: nextGallery, videos: nextVideos } = splitMedia(article);
      setGallery(nextGallery);
      setVideos(nextVideos);
      setSlugTouched(true);
      setInitialised(true);
    } else if (!isEdit) {
      setInitialised(true);
    }
  }, [article, isEdit]);

  useEffect(() => {
    setCoverBroken(false);
  }, [values.image_url]);

  const setField = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'title' && !slugTouched) next.slug = slugify(value);
      return next;
    });
    if (errors[key]) setErrors((current) => ({ ...current, [key]: '' }));
  };

  const onSlugChange = (event) => {
    setSlugTouched(true);
    setField('slug')(event);
  };

  // --- Cover upload --------------------------------------------------------
  const onCoverPicked = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const problem = checkImageFile(file);
    if (problem) {
      toast(problem, 'error');
      return;
    }

    setCoverBusy(true);
    try {
      const [uploaded] = await uploadImages([file]);
      if (uploaded) {
        setValues((current) => ({ ...current, image_url: uploaded.url }));
        setErrors((current) => ({ ...current, image_url: '' }));
        toast('تم رفع صورة الغلاف.');
      }
    } catch (uploadError) {
      toast(uploadError.message || 'تعذّر رفع صورة الغلاف. حاول مرة أخرى.', 'error');
    } finally {
      setCoverBusy(false);
    }
  };

  // --- Gallery upload ------------------------------------------------------
  const onGalleryPicked = async (event) => {
    let files = Array.from(event.target.files || []);
    event.target.value = '';
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

    setGalleryBusy(true);
    try {
      let uploadedCount = 0;
      for (let index = 0; index < files.length; index += MAX_UPLOAD_FILES) {
        const batch = files.slice(index, index + MAX_UPLOAD_FILES);
        const uploaded = await uploadImages(batch);
        uploaded.forEach((file) => setGallery((current) => [...current, { url: file.url, caption: '' }]));
        uploadedCount += uploaded.length;
      }
      toast(`تم رفع ${uploadedCount} صورة إلى المعرض.`);
    } catch (uploadError) {
      toast(uploadError.message || 'تعذّر رفع الصور. حاول مرة أخرى.', 'error');
    } finally {
      setGalleryBusy(false);
    }
  };

  const removeGalleryItem = (index) => {
    setGallery((current) => current.filter((_, position) => position !== index));
  };

  const updateGalleryCaption = (index, caption) => {
    setGallery((current) =>
      current.map((item, position) => (position === index ? { ...item, caption } : item))
    );
  };

  // --- Videos --------------------------------------------------------------
  const addVideo = () => {
    const url = videoUrl.trim();
    if (!url) {
      toast('أدخل رابط الفيديو أولًا.', 'error');
      return;
    }
    if (!detectVideoProvider(url)) {
      toast('رابط الفيديو غير مدعوم. استخدم YouTube أو Vimeo أو ملف MP4/WebM مباشر.', 'error');
      return;
    }
    if (videos.length >= MAX_VIDEOS) {
      toast(`وصلت إلى الحد الأقصى (${MAX_VIDEOS} فيديوهات).`, 'error');
      return;
    }
    setVideos((current) => [...current, { url, caption: videoCaption.trim() }]);
    setVideoUrl('');
    setVideoCaption('');
  };

  const removeVideo = (index) => {
    setVideos((current) => current.filter((_, position) => position !== index));
  };

  const updateVideoCaption = (index, caption) => {
    setVideos((current) =>
      current.map((item, position) => (position === index ? { ...item, caption } : item))
    );
  };

  const getMedia = () => [
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

  // --- Submit / delete -----------------------------------------------------
  const onSubmit = async (event) => {
    event.preventDefault();
    setAlert(null);

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setAlert({ type: 'error', message: 'يرجى تصحيح الحقول المميزة بالأحمر قبل الحفظ.' });
      return;
    }

    const payload = {
      title: values.title.trim(),
      summary: values.summary.trim(),
      body: values.body.trim(),
      category: values.category.trim(),
      image_url: values.image_url.trim(),
      media: getMedia(),
      sort_order: Number(values.sort_order),
      is_published: values.is_published,
      is_featured: values.is_featured,
    };
    const slug = values.slug.trim();
    if (slug) payload.slug = slug;
    if (values.published_at) payload.published_at = new Date(values.published_at).toISOString();

    setBusy(true);
    try {
      if (isEdit) {
        await api(`/api/admin/news/${id}`, { method: 'PATCH', body: payload });
        toast('تم حفظ تعديلات الخبر.');
      } else {
        await api('/api/admin/news', { method: 'POST', body: payload });
        toast('تم إنشاء الخبر بنجاح.');
      }
      window.setTimeout(() => navigate('/news'), 500);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.fields) {
        setErrors((current) => ({ ...current, ...saveError.fields }));
      }
      setAlert({
        type: 'error',
        message: saveError.message || 'تعذّر حفظ الخبر. تحقق من البيانات ثم حاول مرة أخرى.',
      });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!article) return;
    const confirmed = await confirm({
      title: 'حذف الخبر نهائيًا',
      message: `سيتم حذف «${article.title}» نهائيًا من قاعدة البيانات وإخفاؤه من الموقع. لا يمكن التراجع.`,
      confirmLabel: 'حذف نهائي',
      danger: true,
      requireText: article.title,
    });
    if (!confirmed) return;

    try {
      await api(`/api/admin/news/${id}`, { method: 'DELETE' });
      toast('تم حذف الخبر.');
      window.setTimeout(() => navigate('/news'), 500);
    } catch (deleteError) {
      toast(
        deleteError instanceof ApiError && deleteError.status === 404
          ? 'الخبر غير موجود. ربما تم حذفه بالفعل.'
          : deleteError.message || 'تعذّر حذف الخبر.',
        'error'
      );
    }
  };

  const backAction = (
    <Link className="btn btn-outline" to="/news" key="back">
      <Icon name="arrowLeft" size={16} />
      <span>رجوع للأخبار</span>
    </Link>
  );

  if (isEdit && loading) return <PageSkeleton />;

  if (isEdit && error) {
    return (
      <>
        <PageHead title="تعذّر تحميل الخبر" actions={[backAction]} />
        <div className="panel mt-2">
          <div className="panel__body">
            <Alert
              type="error"
              message={
                error instanceof ApiError && error.status === 404
                  ? 'الخبر المطلوب غير موجود. ربما تم حذفه.'
                  : error.message || 'تعذّر تحميل بيانات الخبر.'
              }
            />
          </div>
        </div>
      </>
    );
  }

  if (!initialised) return <PageSkeleton />;

  const coverUrl = values.image_url.trim();

  return (
    <>
      <PageHead
        title={isEdit ? article.title : 'إضافة خبر جديد'}
        description={
          isEdit
            ? 'عدّل بيانات الخبر ثم احفظ التغييرات. تُطبَّق التعديلات على الموقع مباشرة.'
            : 'أدخل بيانات الخبر. يمكنك حفظه كمسودة ونشره لاحقًا.'
        }
        actions={[backAction]}
      />

      {isEdit && article ? (
        <div className="panel">
          <div className="panel__body">
            <div className="chip-row">
              <NewsStateBadge item={article} />
              <DemoBadge isDemo={article.is_demo} />
              {article.is_featured ? <span className="badge badge--published">مميز</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      <form className="mt-2" onSubmit={onSubmit} noValidate>
        <Alert type={alert?.type} message={alert?.message} />

        <div className="mt-2">
          <FormSection
            title="المعلومات الأساسية"
            description="العنوان والملخص والتصنيف والرابط الذي يظهر للزائر."
          >
            <div className="form-grid">
              <TextField
                id="title"
                label="عنوان الخبر"
                value={values.title}
                onChange={setField('title')}
                required
                maxLength={160}
                placeholder="مثال: انطلاق أسبوع المشروعات التطبيقية"
                error={errors.title}
              />
              <TextField
                id="slug"
                label="المعرّف في الرابط (slug)"
                value={values.slug}
                onChange={onSlugChange}
                dir="ltr"
                maxLength={160}
                hint="يُستخدم في رابط الخبر، مثل /news/projects-week. اتركه فارغًا ليُولَّد تلقائيًا من العنوان."
                error={errors.slug}
              />
              <TextareaField
                id="summary"
                label="الملخص"
                value={values.summary}
                onChange={setField('summary')}
                required
                rows={3}
                maxLength={500}
                hint="يظهر في بطاقة الخبر بصفحة الأخبار وفي نتائج البحث (10–500 حرف)."
                error={errors.summary}
                full
              />
              <TextField
                id="category"
                label="التصنيف"
                value={values.category}
                onChange={setField('category')}
                maxLength={80}
                placeholder="مثال: أنشطة، ورش عمل، إعلانات"
                hint="اختياري — يُستخدم لتصفية الأخبار في الموقع."
                error={errors.category}
              />
              <TextField
                id="image_url"
                label="رابط صورة الخبر"
                value={values.image_url}
                onChange={setField('image_url')}
                dir="ltr"
                maxLength={500}
                hint="اختياري — يمكنك رفع صورة الغلاف من قسم الوسائط بالأسفل، أو لصق رابط يبدأ بـ / أو https://."
                error={errors.image_url}
              />
            </div>
          </FormSection>
        </div>

        <div className="mt-2">
          <FormSection title="نص الخبر" description="المحتوى الكامل الذي يظهر في صفحة الخبر.">
            <TextareaField
              id="body"
              label="نص الخبر"
              value={values.body}
              onChange={setField('body')}
              required
              rows={10}
              maxLength={12000}
              hint="اكتب فقرة في كل سطر. يُعرض النص كنص عادي على الموقع."
              error={errors.body}
              full
            />
          </FormSection>
        </div>

        <div className="mt-2">
          <FormSection
            title="صور وفيديو الخبر"
            description="ارفع صورًا من جهازك (حتى 5 ميجابايت للصورة)، وأضف الفيديوهات بروابط YouTube أو Vimeo أو ملف مباشر."
          >
            <div className="media-block">
              <div className="media-block__head">
                <h4>صورة الغلاف</h4>
                <span className="hint">تظهر أعلى صفحة الخبر وفي بطاقات الأخبار.</span>
              </div>
              <div className="cover-upload">
                <div className="cover-upload__preview">
                  {coverUrl && !coverBroken ? (
                    <img
                      className="cover-upload__image"
                      src={coverUrl}
                      alt="معاينة صورة الغلاف"
                      loading="lazy"
                      onError={() => setCoverBroken(true)}
                    />
                  ) : (
                    <span className="cover-upload__empty">
                      {coverBroken
                        ? 'تعذّر عرض صورة الغلاف. تحقق من الرابط.'
                        : 'لا توجد صورة غلاف — ارفع صورة أو ألصق رابطًا في حقل رابط الصورة.'}
                    </span>
                  )}
                </div>
                <div className="cover-upload__actions">
                  <button
                    className="btn btn-outline btn-sm"
                    type="button"
                    disabled={coverBusy}
                    onClick={() => coverInputRef.current && coverInputRef.current.click()}
                  >
                    <Icon name="plus" size={16} />
                    <span>{coverBusy ? 'جارٍ رفع الصورة…' : 'رفع صورة غلاف'}</span>
                  </button>
                  <input
                    ref={coverInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    tabIndex={-1}
                    onChange={onCoverPicked}
                  />
                </div>
              </div>
            </div>

            <div className="media-block">
              <div className="media-block__head">
                <h4>معرض الصور</h4>
                <span className="media-counter">{`${gallery.length} / ${MAX_IMAGES}`}</span>
              </div>
              <p className="hint">
                الصور المرفوعة تظهر في معرض أسفل نص الخبر. يمكنك إضافة وصف لكل صورة.
              </p>
              <div className="media-block__actions">
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  disabled={galleryBusy}
                  onClick={() => galleryInputRef.current && galleryInputRef.current.click()}
                >
                  <Icon name="plus" size={16} />
                  <span>{galleryBusy ? 'جارٍ رفع الصور…' : 'رفع صور للمعرض'}</span>
                </button>
                <input
                  ref={galleryInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  tabIndex={-1}
                  onChange={onGalleryPicked}
                />
              </div>
              {gallery.length ? null : (
                <p className="hint">
                  لم تُضف صور إلى المعرض بعد. الصور المرفوعة تظهر أسفل نص الخبر.
                </p>
              )}
              <div className="media-grid">
                {gallery.map((item, index) => (
                  <div className="media-card" key={`${item.url}-${index}`}>
                    <img
                      className="media-card__thumb"
                      src={item.url}
                      alt={item.caption || `صورة ${index + 1} من معرض الخبر`}
                      loading="lazy"
                      onError={(event) => {
                        const image = event.currentTarget;
                        if (!image.src.endsWith('/default.svg')) image.src = DEFAULT_IMAGE;
                      }}
                    />
                    <div className="media-card__body">
                      <input
                        className="input"
                        type="text"
                        maxLength={200}
                        placeholder="وصف الصورة (اختياري)"
                        aria-label="وصف الصورة"
                        value={item.caption}
                        onChange={(event) => updateGalleryCaption(index, event.target.value)}
                      />
                      <button
                        className="btn btn-danger-outline btn-sm"
                        type="button"
                        onClick={() => removeGalleryItem(index)}
                      >
                        <Icon name="trash" size={14} />
                        <span>إزالة</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="media-block">
              <div className="media-block__head">
                <h4>الفيديوهات</h4>
                <span className="media-counter">{`${videos.length} / ${MAX_VIDEOS}`}</span>
              </div>
              <p className="hint">
                الصق رابط الفيديو ثم أضفه. لا يتم رفع ملفات الفيديو إلى الخادم.
              </p>
              <div className="media-add">
                <div className="media-add__url">
                  <input
                    className="input"
                    type="url"
                    dir="ltr"
                    placeholder="https://www.youtube.com/watch?v=…"
                    aria-label="رابط الفيديو"
                    maxLength={500}
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addVideo();
                      }
                    }}
                  />
                </div>
                <div className="media-add__caption">
                  <input
                    className="input"
                    type="text"
                    placeholder="وصف الفيديو (اختياري)"
                    aria-label="وصف الفيديو"
                    maxLength={200}
                    value={videoCaption}
                    onChange={(event) => setVideoCaption(event.target.value)}
                  />
                </div>
                <button className="btn btn-primary btn-sm" type="button" onClick={addVideo}>
                  <Icon name="plus" size={16} />
                  <span>إضافة فيديو</span>
                </button>
              </div>
              {videos.length ? null : (
                <p className="hint">
                  لم تُضف فيديوهات بعد. أضف رابط YouTube أو Vimeo أو ملف MP4.
                </p>
              )}
              <div className="media-list">
                {videos.map((item, index) => {
                  const provider = detectVideoProvider(item.url) || 'file';
                  return (
                    <div className="media-list__item" key={`${item.url}-${index}`}>
                      <span className="badge badge--published">
                        {VIDEO_PROVIDER_LABELS[provider] || 'فيديو'}
                      </span>
                      <div className="media-list__body">
                        <a
                          className="media-list__link"
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="ltr"
                        >
                          {item.url}
                        </a>
                        <input
                          className="input"
                          type="text"
                          maxLength={200}
                          placeholder="وصف الفيديو (اختياري)"
                          aria-label="وصف الفيديو"
                          value={item.caption}
                          onChange={(event) => updateVideoCaption(index, event.target.value)}
                        />
                      </div>
                      <button
                        className="btn btn-danger-outline btn-sm"
                        type="button"
                        onClick={() => removeVideo(index)}
                      >
                        <Icon name="trash" size={14} />
                        <span>إزالة</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </FormSection>
        </div>

        <div className="mt-2">
          <FormSection
            title="النشر والترتيب"
            description="تحكم في ظهور الخبر وترتيبه بين الأخبار الأخرى."
          >
            <div className="form-grid">
              <TextField
                id="published_at"
                label="تاريخ النشر"
                type="datetime-local"
                value={values.published_at}
                onChange={setField('published_at')}
                hint="اتركه فارغًا لاستخدام وقت الحفظ. يُستخدم في ترتيب الأخبار."
                error={errors.published_at}
              />
              <TextField
                id="sort_order"
                label="ترتيب العرض"
                type="number"
                inputMode="numeric"
                value={values.sort_order}
                onChange={setField('sort_order')}
                hint="الأرقام الأصغر تظهر أولًا عند تساوي تاريخ النشر."
                error={errors.sort_order}
              />
              <CheckboxField
                id="is_published"
                label="نشر الخبر في الموقع"
                hint="الخبر المنشور يظهر للزوار في صفحة الأخبار والصفحة الرئيسية."
                checked={values.is_published}
                onChange={setField('is_published')}
              />
              <CheckboxField
                id="is_featured"
                label="تمييز الخبر"
                hint="الأخبار المميزة تظهر أولًا وتُبرز في الصفحة الرئيسية."
                checked={values.is_featured}
                onChange={setField('is_featured')}
              />
            </div>
          </FormSection>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Icon name="save" size={16} />
            <span>{busy ? 'جارٍ الحفظ…' : isEdit ? 'حفظ التعديلات' : 'إنشاء الخبر'}</span>
          </button>
          <Link className="btn btn-outline" to="/news">
            إلغاء
          </Link>
          <span className="spacer" />
          {isEdit && article?.is_published ? (
            <a
              className="btn btn-ghost"
              href={`/news/${encodeURIComponent(article.slug)}`}
              target="_blank"
              rel="noopener"
            >
              <Icon name="external" size={16} />
              <span>عرض في الموقع</span>
            </a>
          ) : null}
        </div>
      </form>

      {isEdit && article ? (
        <section className="panel mt-2">
          <div className="panel__head">
            <div>
              <h3>منطقة الخطر</h3>
              <p>الحذف نهائي ولا يمكن التراجع عنه.</p>
            </div>
          </div>
          <div className="panel__body">
            <div className="notice notice--danger">
              <Icon name="alert" size={18} />
              <span>
                سيُحذف الخبر من قاعدة البيانات ومن الموقع. إن أردت إخفاءه مؤقتًا، ألغِ نشره بدلًا من
                حذفه.
              </span>
            </div>
            <div className="form-actions">
              <button className="btn btn-danger-outline" type="button" onClick={onDelete}>
                <Icon name="trash" size={16} />
                <span>حذف الخبر نهائيًا</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
