import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/hooks.js';
import { formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_SOURCE_BYTES,
  uploadImage,
} from '../../lib/image-upload.js';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  DemoBadge,
  DepartmentStateBadge,
  PageHead,
  PageSkeleton,
} from '../../components/admin/ui.jsx';
import {
  CheckboxField,
  FormSection,
  TextField,
  TextareaField,
  slugify,
} from '../../components/admin/form.jsx';

const EMPTY = {
  name: '',
  slug: '',
  short_description: '',
  description: '',
  educational_focus: '',
  skills: '',
  admission_info: '',
  image_url: '',
  images: [],
  sort_order: '0',
  is_published: true,
  is_active: true,
};

const MAX_PHOTOS = 12;
const UPLOAD_MAX_SIZE = 1600;

let uidCounter = 0;
function uid() {
  uidCounter += 1;
  return `photo-${Date.now().toString(36)}-${uidCounter}`;
}

function moveItem(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/** Client-side mirror of the API rules — the server validates again. */
function validate(values) {
  const errors = {};

  const name = values.name.trim();
  if (name.length < 2) errors.name = 'اسم التخصص مطلوب (حرفان على الأقل).';
  else if (name.length > 120) errors.name = 'اسم التخصص طويل جدًا (120 حرفًا كحد أقصى).';

  const short = values.short_description.trim();
  if (short.length < 10) errors.short_description = 'الوصف المختصر مطلوب (10 أحرف على الأقل).';
  else if (short.length > 300) errors.short_description = 'الوصف المختصر طويل جدًا (300 حرف كحد أقصى).';

  const description = values.description.trim();
  if (description.length < 30) errors.description = 'الوصف الكامل مطلوب (30 حرفًا على الأقل).';
  else if (description.length > 6000) errors.description = 'الوصف الكامل طويل جدًا (6000 حرف كحد أقصى).';

  if (values.educational_focus.trim().length > 2000) {
    errors.educational_focus = 'حقل التركيز التعليمي طويل جدًا.';
  }
  if (values.skills.trim().length > 2000) errors.skills = 'قائمة المهارات طويلة جدًا.';
  if (values.admission_info.trim().length > 1000) {
    errors.admission_info = 'معلومات القبول طويلة جدًا.';
  }
  if (values.slug.trim().length > 140) errors.slug = 'المعرّف طويل جدًا (140 حرفًا كحد أقصى).';

  const image = values.image_url.trim();
  if (image.length > 500) errors.image_url = 'رابط الصورة طويل جدًا.';
  else if (image && !(image.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(image))) {
    errors.image_url = 'رابط الصورة يجب أن يبدأ بـ / أو http(s)://';
  }

  if (values.images.length > MAX_PHOTOS) {
    errors.images = `يمكن إضافة ${MAX_PHOTOS} صورة كحد أقصى.`;
  } else {
    values.images.forEach((photo, index) => {
      const url = photo.url.trim();
      if (!url) errors[`images.${index}.url`] = 'رابط الصورة مطلوب.';
      else if (url.length > 500) errors[`images.${index}.url`] = 'رابط الصورة طويل جدًا.';
      else if (!(url.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(url))) {
        errors[`images.${index}.url`] = 'رابط الصورة يجب أن يبدأ بـ / أو http(s)://';
      }
      if (photo.alt.trim().length > 200) {
        errors[`images.${index}.alt`] = 'النص البديل طويل جدًا.';
      }
    });
  }

  const sort = Number(values.sort_order);
  if (!Number.isInteger(sort) || sort < 0) {
    errors.sort_order = 'ترتيب العرض يجب أن يكون عددًا صحيحًا غير سالب.';
  } else if (sort > 9999) {
    errors.sort_order = 'ترتيب العرض كبير جدًا.';
  }

  return errors;
}

function toFormState(department) {
  if (!department) return { ...EMPTY };
  return {
    name: department.name || '',
    slug: department.slug || '',
    short_description: department.short_description || '',
    description: department.description || '',
    educational_focus: department.educational_focus || '',
    skills: Array.isArray(department.skills)
      ? department.skills.join('\n')
      : department.skills || '',
    admission_info: department.admission_info || '',
    image_url: department.image_url || '',
    images: (Array.isArray(department.images) ? department.images : []).map(
      (image, index) => ({
        key: `saved-${image.id ?? index}`,
        url: image.url || '',
        alt: image.alt || '',
      })
    ),
    sort_order: String(department.sort_order ?? 0),
    is_published: Boolean(department.is_published),
    is_active: Boolean(department.is_active),
  };
}

export default function DepartmentFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();

  const { data: department, loading, error } = useAsync(async () => {
    if (!isEdit) return null;
    return api(`/api/admin/departments/${id}`);
  }, [id, isEdit]);

  const [values, setValues] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [initialised, setInitialised] = useState(false);
  const coverInputRef = useRef(null);
  const photosInputRef = useRef(null);

  useEffect(() => {
    if (isEdit && department) {
      setValues(toFormState(department));
      setSlugTouched(true);
      setInitialised(true);
    } else if (!isEdit) {
      setInitialised(true);
    }
  }, [department, isEdit]);

  const setField = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'name' && !slugTouched) next.slug = slugify(value);
      return next;
    });
    if (errors[key]) setErrors((current) => ({ ...current, [key]: '' }));
  };

  const onSlugChange = (event) => {
    setSlugTouched(true);
    setField('slug')(event);
  };

  const clearFieldError = (key) => {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const onUploadCover = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP أو GIF.', 'error');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast('حجم الصورة كبير جدًا (20 ميجابايت كحد أقصى).', 'error');
      return;
    }

    setUploadingCover(true);
    try {
      const url = await uploadImage(
        '/api/admin/departments/uploads',
        file,
        UPLOAD_MAX_SIZE
      );
      setValues((current) => ({ ...current, image_url: url }));
      clearFieldError('image_url');
      toast('تم رفع صورة الغلاف. لا تنس حفظ التغييرات.');
    } catch (error) {
      toast(error.message || 'تعذّر رفع صورة الغلاف. حاول مرة أخرى.', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const onUploadPhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const remaining = MAX_PHOTOS - values.images.length;
    if (remaining <= 0) {
      toast(`وصلت إلى الحد الأقصى (${MAX_PHOTOS} صورة للتخصص).`, 'error');
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

    setUploadingPhotos(true);
    try {
      let added = 0;
      for (const file of accepted) {
        const url = await uploadImage(
          '/api/admin/departments/uploads',
          file,
          UPLOAD_MAX_SIZE
        );
        setValues((current) => {
          if (current.images.length >= MAX_PHOTOS) return current;
          return {
            ...current,
            images: [...current.images, { key: uid(), url, alt: '' }],
          };
        });
        added += 1;
      }
      if (added) {
        clearFieldError('images');
        toast(`تم رفع ${added} صورة. لا تنس حفظ التغييرات.`);
      }
    } catch (error) {
      toast(error.message || 'تعذّر رفع الصور. حاول مرة أخرى.', 'error');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const updatePhoto = (key, patch) => {
    setValues((current) => ({
      ...current,
      images: current.images.map((photo) =>
        photo.key === key ? { ...photo, ...patch } : photo
      ),
    }));
  };

  const movePhoto = (index, delta) => {
    setValues((current) => ({
      ...current,
      images: moveItem(current.images, index, delta),
    }));
  };

  const removePhoto = (key) => {
    setValues((current) => ({
      ...current,
      images: current.images.filter((photo) => photo.key !== key),
    }));
  };

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
      name: values.name.trim(),
      short_description: values.short_description.trim(),
      description: values.description.trim(),
      educational_focus: values.educational_focus.trim(),
      skills: values.skills.trim(),
      admission_info: values.admission_info.trim(),
      image_url: values.image_url.trim(),
      images: values.images.map((photo) => ({
        url: photo.url.trim(),
        alt: photo.alt.trim(),
      })),
      sort_order: Number(values.sort_order),
      is_published: values.is_published,
      is_active: values.is_active,
    };
    const slug = values.slug.trim();
    if (slug) payload.slug = slug;

    setBusy(true);
    try {
      if (isEdit) {
        await api(`/api/admin/departments/${id}`, { method: 'PATCH', body: payload });
        toast(
          values.is_published
            ? 'تم حفظ تعديلات التخصص.'
            : 'تم حفظ تعديلات التخصص كمسودة — لن يظهر في الموقع حتى تنشره.'
        );
      } else {
        await api('/api/admin/departments', { method: 'POST', body: payload });
        toast(
          values.is_published
            ? 'تم إنشاء التخصص ونشره في الموقع.'
            : 'تم حفظ التخصص كمسودة — لن يظهر في الموقع حتى تنشره.'
        );
      }
      window.setTimeout(() => navigate('/departments'), 500);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.fields) {
        setErrors((current) => ({ ...current, ...saveError.fields }));
      }
      setAlert({
        type: 'error',
        message: saveError.message || 'تعذّر حفظ التخصص. تحقق من البيانات ثم حاول مرة أخرى.',
      });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!department) return;
    const hasApplications = (department.applications_count || 0) > 0;
    const confirmed = await confirm({
      title: 'حذف التخصص نهائيًا',
      message: hasApplications
        ? `سيتم حذف «${department.name}» و${formatNumber(
            department.applications_count
          )} طلب/طلبات مرتبطة به نهائيًا. لا يمكن التراجع عن هذه العملية.`
        : `سيتم حذف «${department.name}» نهائيًا ولا يمكن التراجع. هل تريد المتابعة؟`,
      confirmLabel: 'حذف نهائي',
      danger: true,
      requireText: hasApplications ? department.name : '',
    });
    if (!confirmed) return;

    try {
      const suffix = hasApplications ? '?force=true' : '';
      await api(`/api/admin/departments/${id}${suffix}`, { method: 'DELETE' });
      toast(hasApplications ? 'تم حذف التخصص والطلبات المرتبطة به.' : 'تم حذف التخصص.');
      window.setTimeout(() => navigate('/departments'), 500);
    } catch (deleteError) {
      toast(
        deleteError.message || 'تعذّر حذف التخصص.',
        deleteError instanceof ApiError && deleteError.status === 409 ? 'warning' : 'error'
      );
    }
  };

  const backAction = (
    <Link className="btn btn-outline" to="/departments" key="back">
      <Icon name="arrowLeft" size={16} />
      <span>رجوع للتخصصات</span>
    </Link>
  );

  if (isEdit && loading) return <PageSkeleton />;

  if (isEdit && error) {
    return (
      <>
        <PageHead title="تعذّر تحميل التخصص" actions={[backAction]} />
        <div className="panel mt-2">
          <div className="panel__body">
            <Alert
              type="error"
              message={
                error instanceof ApiError && error.status === 404
                  ? 'التخصص المطلوب غير موجود. ربما تم حذفه.'
                  : error.message || 'تعذّر تحميل بيانات التخصص.'
              }
            />
          </div>
        </div>
      </>
    );
  }

  if (!initialised) return <PageSkeleton />;

  const hasApplications = (department?.applications_count || 0) > 0;

  return (
    <>
      <PageHead
        title={isEdit ? department.name : 'إضافة تخصص جديد'}
        description={
          isEdit
            ? 'عدّل بيانات التخصص ثم احفظ التغييرات. تُطبَّق التعديلات على الموقع مباشرة.'
            : 'أدخل بيانات التخصص التعليمي. يُنشر التخصص مباشرة في الموقع، ويمكنك حفظه كمسودة بإزالة علامة النشر.'
        }
        actions={[backAction]}
      />

      {isEdit && department ? (
        <div className="panel">
          <div className="panel__body">
            <div className="chip-row">
              <DepartmentStateBadge department={department} />
              <DemoBadge isDemo={department.is_demo} />
              <span className="chip">
                {`الطلبات المرتبطة: ${formatNumber(department.applications_count || 0)}`}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <form className="mt-2" onSubmit={onSubmit} noValidate>
        <Alert type={alert?.type} message={alert?.message} />

        <div className="mt-2">
          <FormSection
            title="المعلومات الأساسية"
            description="البيانات التي تظهر في بطاقة التخصص وصفحة التفاصيل."
          >
            <div className="form-grid">
              <TextField
                id="name"
                label="اسم المهنة/التخصص"
                value={values.name}
                onChange={setField('name')}
                required
                maxLength={120}
                placeholder="مثال: تكنولوجيا البرمجة"
                error={errors.name}
              />
              <TextField
                id="slug"
                label="المعرّف في الرابط (slug)"
                value={values.slug}
                onChange={onSlugChange}
                dir="ltr"
                maxLength={140}
                hint="يُستخدم في رابط صفحة التخصص، مثل /departments/programming. اتركه فارغًا ليُولَّد تلقائيًا من الاسم."
                error={errors.slug}
              />
              <TextareaField
                id="short_description"
                label="الوصف المختصر"
                value={values.short_description}
                onChange={setField('short_description')}
                required
                rows={3}
                maxLength={300}
                hint="يظهر في بطاقة التخصص بصفحة التخصصات (10–300 حرف)."
                error={errors.short_description}
                full
              />
              <TextareaField
                id="description"
                label="الوصف الكامل"
                value={values.description}
                onChange={setField('description')}
                required
                rows={7}
                maxLength={6000}
                hint="يظهر في صفحة تفاصيل التخصص (30 حرفًا على الأقل)."
                error={errors.description}
                full
              />
            </div>
          </FormSection>
        </div>

        <div className="mt-2">
          <FormSection
            title="المحتوى التعليمي"
            description="تفاصيل إضافية تساعد الطالب على فهم طبيعة التخصص."
          >
            <div className="form-grid">
              <TextareaField
                id="educational_focus"
                label="التركيز التعليمي"
                value={values.educational_focus}
                onChange={setField('educational_focus')}
                rows={4}
                maxLength={2000}
                hint="وصف مختصر لما يركز عليه التخصص في التدريس والتدريب."
                error={errors.educational_focus}
                full
              />
              <TextareaField
                id="skills"
                label="المهارات المكتسبة"
                value={values.skills}
                onChange={setField('skills')}
                rows={5}
                maxLength={2000}
                hint="اكتب كل مهارة في سطر منفصل. تظهر كقائمة في صفحة التخصص."
                error={errors.skills}
                full
              />
              <TextareaField
                id="admission_info"
                label="معلومات القبول الخاصة بالتخصص"
                value={values.admission_info}
                onChange={setField('admission_info')}
                rows={3}
                maxLength={1000}
                hint="اختياري — ملاحظات إضافية تظهر في صفحة التخصص."
                error={errors.admission_info}
                full
              />
            </div>
          </FormSection>
        </div>

        <div className="mt-2">
          <FormSection
            title="صور التخصص"
            description="أضف صورة الغلاف والصور الإضافية التي تظهر في صفحة التخصص."
          >
            <div className="media-block">
              <div className="media-block__head">
                <h4>صورة الغلاف</h4>
                <span className="media-counter">
                  {values.image_url ? 'مضافة' : 'بدون صورة'}
                </span>
              </div>
              <p className="hint">
                ارفع صورة غلاف من جهازك، أو ألصق رابطًا خارجيًا في الحقل أدناه. تُصغَّر
                الصور تلقائيًا قبل الرفع.
              </p>

              {values.image_url ? (
                <div className="department-cover-preview">
                  <img src={values.image_url} alt="معاينة صورة غلاف التخصص" />
                </div>
              ) : null}

              <div className="media-block__actions">
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current && coverInputRef.current.click()}
                >
                  <Icon name="plus" size={16} />
                  <span>{uploadingCover ? 'جارٍ رفع الصورة…' : 'إضافة صورة من الجهاز'}</span>
                </button>
                {values.image_url ? (
                  <button
                    className="btn btn-danger-outline btn-sm"
                    type="button"
                    onClick={() => {
                      setValues((current) => ({ ...current, image_url: '' }));
                      clearFieldError('image_url');
                    }}
                  >
                    <Icon name="trash" size={16} />
                    <span>إزالة الصورة</span>
                  </button>
                ) : null}
                <input
                  ref={coverInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  tabIndex={-1}
                  onChange={onUploadCover}
                />
              </div>

              <TextField
                id="image_url"
                label="أو رابط صورة الغلاف"
                value={values.image_url}
                onChange={setField('image_url')}
                dir="ltr"
                maxLength={500}
                hint="اختياري — يبدأ بـ / أو https://. اتركه فارغًا لاستخدام الرسم الافتراضي."
                error={errors.image_url}
              />
            </div>

            <div className="media-block">
              <div className="media-block__head">
                <h4>صور إضافية للتخصص</h4>
                <span className="media-counter">{`${values.images.length} / ${MAX_PHOTOS}`}</span>
              </div>
              <p className="hint">
                ارفع صورًا من جهازك (JPG أو PNG أو WebP أو GIF) لعرضها في معرض صفحة
                التخصص. يمكنك ترتيب الصور وإضافة نص بديل لكل صورة.
              </p>

              <div className="media-block__actions">
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  disabled={uploadingPhotos || values.images.length >= MAX_PHOTOS}
                  onClick={() => photosInputRef.current && photosInputRef.current.click()}
                >
                  <Icon name="plus" size={16} />
                  <span>
                    {uploadingPhotos ? 'جارٍ رفع الصور…' : 'إضافة صور من الجهاز'}
                  </span>
                </button>
                <input
                  ref={photosInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  tabIndex={-1}
                  onChange={onUploadPhotos}
                />
              </div>

              <p className="error-text">{errors.images || ''}</p>

              {values.images.length ? (
                <div className="gallery-admin-photos">
                  {values.images.map((photo, index) => (
                    <div className="gallery-admin-photo" key={photo.key}>
                      <div className="gallery-admin-photo__media">
                        <img
                          src={photo.url}
                          alt={photo.alt || `صورة ${index + 1} للتخصص`}
                          loading="lazy"
                        />
                      </div>
                      <div className="gallery-admin-photo__body">
                        <input
                          className="input"
                          type="text"
                          maxLength={200}
                          placeholder="النص البديل (Alt)"
                          aria-label="النص البديل للصورة"
                          value={photo.alt}
                          onChange={(event) =>
                            updatePhoto(photo.key, { alt: event.target.value })
                          }
                        />
                        <p className="error-text">{errors[`images.${index}.alt`] || ''}</p>
                        <p className="error-text">{errors[`images.${index}.url`] || ''}</p>

                        <div className="gallery-admin-photo__actions">
                          <button
                            className="btn btn-ghost btn-icon"
                            type="button"
                            aria-label="تحريك الصورة لأعلى"
                            title="تحريك لأعلى"
                            disabled={index === 0}
                            onClick={() => movePhoto(index, -1)}
                          >
                            <Icon name="arrowUp" size={15} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon"
                            type="button"
                            aria-label="تحريك الصورة لأسفل"
                            title="تحريك لأسفل"
                            disabled={index === values.images.length - 1}
                            onClick={() => movePhoto(index, 1)}
                          >
                            <Icon name="arrowUp" size={15} className="icon-flip" />
                          </button>
                          <button
                            className="btn btn-danger-outline btn-icon"
                            type="button"
                            aria-label="حذف الصورة"
                            title="حذف الصورة"
                            onClick={() => removePhoto(photo.key)}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hint">لا توجد صور إضافية لهذا التخصص بعد.</p>
              )}
            </div>
          </FormSection>
        </div>

        <div className="mt-2">
          <FormSection
            title="العرض والنشر"
            description="تحكم في ظهور التخصص وترتيبه بين التخصصات الأخرى."
          >
            <div className="form-grid">
              <TextField
                id="sort_order"
                label="ترتيب العرض"
                type="number"
                inputMode="numeric"
                value={values.sort_order}
                onChange={setField('sort_order')}
                hint="الأرقام الأصغر تظهر أولًا في الموقع."
                error={errors.sort_order}
              />
              <CheckboxField
                id="is_published"
                label="نشر التخصص في الموقع"
                hint="التخصص الجديد يُنشر افتراضيًا. أزل العلامة لحفظه كمسودة لا تظهر للزوار."
                checked={values.is_published}
                onChange={setField('is_published')}
              />
              <CheckboxField
                id="is_active"
                label="التخصص نشط (غير مؤرشف)"
                hint="أزل العلامة لأرشفة التخصص وإخفائه مع الحفاظ على طلباته."
                checked={values.is_active}
                onChange={setField('is_active')}
              />
            </div>
          </FormSection>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Icon name="save" size={16} />
            <span>{busy ? 'جارٍ الحفظ…' : isEdit ? 'حفظ التعديلات' : 'إنشاء التخصص'}</span>
          </button>
          <Link className="btn btn-outline" to="/departments">
            إلغاء
          </Link>
          <span className="spacer" />
          {isEdit && department?.is_published && department?.is_active ? (
            <a
              className="btn btn-ghost"
              href={`/departments/${encodeURIComponent(department.slug)}`}
              target="_blank"
              rel="noopener"
            >
              <Icon name="external" size={16} />
              <span>عرض في الموقع</span>
            </a>
          ) : null}
        </div>
      </form>

      {isEdit && department ? (
        <section className="panel mt-2">
          <div className="panel__head">
            <div>
              <h3>منطقة الخطر</h3>
              <p>
                {hasApplications
                  ? 'حذف التخصص سيحذف طلباته المرتبطة به أيضًا. راجع العدد قبل المتابعة.'
                  : 'الحذف نهائي ولا يمكن التراجع عنه.'}
              </p>
            </div>
          </div>
          <div className="panel__body">
            {hasApplications ? (
              <div className="notice notice--danger">
                <Icon name="alert" size={18} />
                <span>
                  {`هذا التخصص مرتبط بـ ${formatNumber(
                    department.applications_count
                  )} طلب/طلبات. الحذف الكامل سيحذف التخصص وكل طلباته نهائيًا. إن أردت الاحتفاظ بسجل الطلبات، ألغِ نشره أو أرشِفه بدلًا من ذلك.`}
                </span>
              </div>
            ) : (
              <div className="notice">
                <Icon name="info" size={18} />
                <span>لا توجد طلبات مرتبطة بهذا التخصص. الحذف نهائي ولا يمكن التراجع عنه.</span>
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-danger-outline" type="button" onClick={onDelete}>
                <Icon name="trash" size={16} />
                <span>حذف التخصص نهائيًا</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
