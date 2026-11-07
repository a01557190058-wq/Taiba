import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/hooks.js';
import { formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
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
  sort_order: '0',
  is_published: false,
  is_active: true,
};

/** Client-side mirror of the API rules — the server validates again. */
function validate(values) {
  const errors = {};

  const name = values.name.trim();
  if (name.length < 2) errors.name = 'اسم القسم مطلوب (حرفان على الأقل).';
  else if (name.length > 120) errors.name = 'اسم القسم طويل جدًا (120 حرفًا كحد أقصى).';

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
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [initialised, setInitialised] = useState(false);

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
        toast('تم حفظ تعديلات القسم.');
      } else {
        await api('/api/admin/departments', { method: 'POST', body: payload });
        toast('تم إنشاء القسم بنجاح.');
      }
      window.setTimeout(() => navigate('/departments'), 500);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.fields) {
        setErrors((current) => ({ ...current, ...saveError.fields }));
      }
      setAlert({
        type: 'error',
        message: saveError.message || 'تعذّر حفظ القسم. تحقق من البيانات ثم حاول مرة أخرى.',
      });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!department) return;
    const hasApplications = (department.applications_count || 0) > 0;
    const confirmed = await confirm({
      title: 'حذف القسم نهائيًا',
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
      toast(hasApplications ? 'تم حذف القسم والطلبات المرتبطة به.' : 'تم حذف القسم.');
      window.setTimeout(() => navigate('/departments'), 500);
    } catch (deleteError) {
      toast(
        deleteError.message || 'تعذّر حذف القسم.',
        deleteError instanceof ApiError && deleteError.status === 409 ? 'warning' : 'error'
      );
    }
  };

  const backAction = (
    <Link className="btn btn-outline" to="/departments" key="back">
      <Icon name="arrowLeft" size={16} />
      <span>رجوع للأقسام</span>
    </Link>
  );

  if (isEdit && loading) return <PageSkeleton />;

  if (isEdit && error) {
    return (
      <>
        <PageHead title="تعذّر تحميل القسم" actions={[backAction]} />
        <div className="panel mt-2">
          <div className="panel__body">
            <Alert
              type="error"
              message={
                error instanceof ApiError && error.status === 404
                  ? 'القسم المطلوب غير موجود. ربما تم حذفه.'
                  : error.message || 'تعذّر تحميل بيانات القسم.'
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
        title={isEdit ? department.name : 'إضافة قسم جديد'}
        description={
          isEdit
            ? 'عدّل بيانات القسم ثم احفظ التغييرات. تُطبَّق التعديلات على الموقع مباشرة.'
            : 'أدخل بيانات القسم التعليمي. يمكنك حفظه كمسودة ونشره لاحقًا.'
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
            description="البيانات التي تظهر في بطاقة القسم وصفحة التفاصيل."
          >
            <div className="form-grid">
              <TextField
                id="name"
                label="اسم القسم"
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
                hint="يُستخدم في رابط صفحة القسم، مثل /departments/programming. اتركه فارغًا ليُولَّد تلقائيًا من الاسم."
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
                hint="يظهر في بطاقة القسم بصفحة الأقسام (10–300 حرف)."
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
                hint="يظهر في صفحة تفاصيل القسم (30 حرفًا على الأقل)."
                error={errors.description}
                full
              />
            </div>
          </FormSection>
        </div>

        <div className="mt-2">
          <FormSection
            title="المحتوى التعليمي"
            description="تفاصيل إضافية تساعد الطالب على فهم طبيعة القسم."
          >
            <div className="form-grid">
              <TextareaField
                id="educational_focus"
                label="التركيز التعليمي"
                value={values.educational_focus}
                onChange={setField('educational_focus')}
                rows={4}
                maxLength={2000}
                hint="وصف مختصر لما يركز عليه القسم في التدريس والتدريب."
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
                hint="اكتب كل مهارة في سطر منفصل. تظهر كقائمة في صفحة القسم."
                error={errors.skills}
                full
              />
              <TextareaField
                id="admission_info"
                label="معلومات القبول الخاصة بالقسم"
                value={values.admission_info}
                onChange={setField('admission_info')}
                rows={3}
                maxLength={1000}
                hint="اختياري — ملاحظات إضافية تظهر في صفحة القسم."
                error={errors.admission_info}
                full
              />
            </div>
          </FormSection>
        </div>

        <div className="mt-2">
          <FormSection
            title="العرض والنشر"
            description="تحكم في ظهور القسم وترتيبه بين الأقسام الأخرى."
          >
            <div className="form-grid">
              <TextField
                id="image_url"
                label="رابط صورة القسم"
                value={values.image_url}
                onChange={setField('image_url')}
                dir="ltr"
                maxLength={500}
                hint="اختياري — يبدأ بـ / أو https://. اتركه فارغًا لاستخدام الرسم الافتراضي."
                error={errors.image_url}
              />
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
                label="نشر القسم في الموقع"
                hint="القسم المنشور يظهر للزوار في صفحة الأقسام."
                checked={values.is_published}
                onChange={setField('is_published')}
              />
              <CheckboxField
                id="is_active"
                label="القسم نشط (غير مؤرشف)"
                hint="أزل العلامة لأرشفة القسم وإخفائه مع الحفاظ على طلباته."
                checked={values.is_active}
                onChange={setField('is_active')}
              />
            </div>
          </FormSection>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Icon name="save" size={16} />
            <span>{busy ? 'جارٍ الحفظ…' : isEdit ? 'حفظ التعديلات' : 'إنشاء القسم'}</span>
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
                  ? 'حذف القسم سيحذف طلباته المرتبطة به أيضًا. راجع العدد قبل المتابعة.'
                  : 'الحذف نهائي ولا يمكن التراجع عنه.'}
              </p>
            </div>
          </div>
          <div className="panel__body">
            {hasApplications ? (
              <div className="notice notice--danger">
                <Icon name="alert" size={18} />
                <span>
                  {`هذا القسم مرتبط بـ ${formatNumber(
                    department.applications_count
                  )} طلب/طلبات. الحذف الكامل سيحذف القسم وكل طلباته نهائيًا. إن أردت الاحتفاظ بسجل الطلبات، ألغِ نشره أو أرشِفه بدلًا من ذلك.`}
                </span>
              </div>
            ) : (
              <div className="notice">
                <Icon name="info" size={18} />
                <span>لا توجد طلبات مرتبطة بهذا القسم. الحذف نهائي ولا يمكن التراجع عنه.</span>
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-danger-outline" type="button" onClick={onDelete}>
                <Icon name="trash" size={16} />
                <span>حذف القسم نهائيًا</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
