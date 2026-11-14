import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, request } from '../../lib/api.js';
import { useAsync } from '../../lib/hooks.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import { Alert, DemoBadge, PageHead, PageSkeleton } from '../../components/admin/ui.jsx';
import { CheckboxField, FormSection, TextField, TextareaField } from '../../components/admin/form.jsx';
import { SubjectStateBadge, SubjectTypeBadge } from './SubjectsPage.jsx';

const ICON_OPTIONS = [
  { value: 'book', label: 'كتاب' },
  { value: 'flask', label: 'معمل' },
  { value: 'target', label: 'هدف' },
  { value: 'sparkles', label: 'بريق / مفاهيم' },
  { value: 'layers', label: 'طبقات' },
  { value: 'grid', label: 'شبكة' },
  { value: 'chart', label: 'رسم بياني' },
  { value: 'users', label: 'طلاب' },
  { value: 'graduation', label: 'تخرج' },
  { value: 'star', label: 'نجمة' },
  { value: 'shield', label: 'سلامة' },
  { value: 'briefcase', label: 'تدريب' },
  { value: 'calendar', label: 'تقويم' },
  { value: 'quote', label: 'اقتباس' },
  { value: 'search', label: 'بحث' },
  { value: 'file', label: 'ملف' },
  { value: 'image', label: 'صورة' },
  { value: 'video', label: 'فيديو' },
  { value: 'news', label: 'خبر' },
  { value: 'database', label: 'قاعدة بيانات' },
];

const GRADES = [
  { value: 'first', label: 'الصف الأول الثانوي' },
  { value: 'second', label: 'الصف الثاني الثانوي' },
  { value: 'third', label: 'الصف الثالث الثانوي' },
];

const EMPTY = {
  name: '',
  description: '',
  type: 'theoretical',
  grade: 'first',
  department_id: '',
  icon: 'book',
  sort_order: '0',
  is_published: true,
};

/** Client-side mirror of the API rules — the server validates again. */
function validate(values) {
  const errors = {};

  const name = values.name.trim();
  if (name.length < 2) errors.name = 'اسم المادة مطلوب (حرفان على الأقل).';
  else if (name.length > 120) errors.name = 'اسم المادة طويل جدًا (120 حرفًا كحد أقصى).';

  if (!['theoretical', 'practical'].includes(values.type)) {
    errors.type = 'اختر نوع المادة (نظرية أو عملية).';
  }

  if (!GRADES.some((grade) => grade.value === values.grade)) {
    errors.grade = 'اختر الصف الدراسي.';
  }

  if (values.department_id !== '' && !/^\d+$/.test(String(values.department_id))) {
    errors.department_id = 'التخصص المحدد غير صالح.';
  }

  if (!ICON_OPTIONS.some((option) => option.value === values.icon)) {
    errors.icon = 'اختر أيقونة صالحة.';
  }

  if (values.description.trim().length > 1000) {
    errors.description = 'وصف المادة طويل جدًا (1000 حرف كحد أقصى).';
  }

  const sort = Number(values.sort_order);
  if (!Number.isInteger(sort) || sort < 0) {
    errors.sort_order = 'ترتيب العرض يجب أن يكون عددًا صحيحًا غير سالب.';
  } else if (sort > 9999) {
    errors.sort_order = 'ترتيب العرض كبير جدًا.';
  }

  return errors;
}

function toFormState(subject) {
  if (!subject) return { ...EMPTY };
  return {
    name: subject.name || '',
    description: subject.description || '',
    type: subject.type === 'practical' ? 'practical' : 'theoretical',
    grade: subject.grade || 'first',
    department_id: subject.department_id ? String(subject.department_id) : '',
    icon: subject.icon || 'book',
    sort_order: String(subject.sort_order ?? 0),
    is_published: Boolean(subject.is_published),
  };
}

export default function SubjectFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();

  const { data: subject, loading, error } = useAsync(async () => {
    if (!isEdit) return null;
    return api(`/api/admin/subjects/${id}`);
  }, [id, isEdit]);

  const { data: departmentsData } = useAsync(
    () => request('/api/admin/departments?limit=200'),
    []
  );
  const departments =
    departmentsData && Array.isArray(departmentsData.data) ? departmentsData.data : [];

  const [values, setValues] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (isEdit && subject) {
      setValues(toFormState(subject));
      setInitialised(true);
    } else if (!isEdit) {
      setInitialised(true);
    }
  }, [subject, isEdit]);

  const setField = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: '' }));
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
      description: values.description.trim(),
      type: values.type,
      grade: values.grade,
      department_id: values.department_id === '' ? null : Number(values.department_id),
      icon: values.icon,
      sort_order: Number(values.sort_order),
      is_published: values.is_published,
    };

    setBusy(true);
    try {
      if (isEdit) {
        await api(`/api/admin/subjects/${id}`, { method: 'PATCH', body: payload });
        toast('تم حفظ تعديلات المادة الدراسية.');
      } else {
        await api('/api/admin/subjects', { method: 'POST', body: payload });
        toast('تمت إضافة المادة الدراسية.');
      }
      window.setTimeout(() => navigate('/subjects'), 500);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.fields) {
        setErrors((current) => ({ ...current, ...saveError.fields }));
      }
      setAlert({
        type: 'error',
        message: saveError.message || 'تعذّر حفظ المادة الدراسية. تحقق من البيانات ثم حاول مرة أخرى.',
      });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!subject) return;
    const confirmed = await confirm({
      title: 'حذف المادة الدراسية',
      message: `سيتم حذف «${subject.name}» نهائيًا ولا يمكن التراجع. هل تريد المتابعة؟`,
      confirmLabel: 'حذف نهائي',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api(`/api/admin/subjects/${id}`, { method: 'DELETE' });
      toast('تم حذف المادة الدراسية.');
      window.setTimeout(() => navigate('/subjects'), 500);
    } catch (deleteError) {
      toast(deleteError.message || 'تعذّر حذف المادة الدراسية.', 'error');
    }
  };

  const backAction = (
    <Link className="btn btn-outline" to="/subjects" key="back">
      <Icon name="arrowLeft" size={16} />
      <span>رجوع للمواد</span>
    </Link>
  );

  if (isEdit && loading) return <PageSkeleton />;

  if (isEdit && error) {
    return (
      <>
        <PageHead title="تعذّر تحميل المادة" actions={[backAction]} />
        <div className="panel mt-2">
          <div className="panel__body">
            <Alert
              type="error"
              message={
                error instanceof ApiError && error.status === 404
                  ? 'المادة المطلوبة غير موجودة. ربما تم حذفها.'
                  : error.message || 'تعذّر تحميل بيانات المادة الدراسية.'
              }
            />
          </div>
        </div>
      </>
    );
  }

  if (!initialised) return <PageSkeleton />;

  return (
    <>
      <PageHead
        title={isEdit ? subject.name : 'إضافة مادة دراسية'}
        description={
          isEdit
            ? 'عدّل بيانات المادة ثم احفظ التغييرات. تُطبَّق التعديلات على صفحة المواد مباشرة.'
            : 'أدخل اسم المادة ونوعها وصفها الدراسي ثم حدّد تخصصها (أو اتركها عامة) وانشرها.'
        }
        actions={[backAction]}
      />

      {isEdit && subject ? (
        <div className="panel">
          <div className="panel__body">
            <div className="chip-row">
              <SubjectTypeBadge type={subject.type} />
              <span className="badge badge--neutral">{subject.grade_label || 'الصف الأول الثانوي'}</span>
              <SubjectStateBadge subject={subject} />
              <DemoBadge isDemo={subject.is_demo} />
            </div>
          </div>
        </div>
      ) : null}

      <form className="mt-2" onSubmit={onSubmit} noValidate>
        <Alert type={alert?.type} message={alert?.message} />

        <div className="mt-2">
          <FormSection
            title="بيانات المادة"
            description="الاسم والوصف والنوع والصف والتخصص الذي يحدد أين تظهر المادة بالموقع."
          >
            <div className="form-grid">
              <TextField
                id="name"
                label="اسم المادة الدراسية"
                value={values.name}
                onChange={setField('name')}
                required
                maxLength={120}
                placeholder="مثال: الرياضيات التطبيقية"
                error={errors.name}
              />
              <div className="field">
                <label htmlFor="type">
                  <span>نوع المادة</span>
                  <span className="req"> *</span>
                </label>
                <select
                  className="select"
                  id="type"
                  value={values.type}
                  aria-required="true"
                  aria-invalid={errors.type ? 'true' : undefined}
                  onChange={setField('type')}
                >
                  <option value="theoretical">نظرية</option>
                  <option value="practical">عملية</option>
                </select>
                <p className="hint">المواد النظرية والقسم العملي يظهران في قسمين منفصلين بالصفحة.</p>
                <p className="error-text">{errors.type || ''}</p>
              </div>
              <div className="field">
                <label htmlFor="grade">
                  <span>الصف الدراسي</span>
                  <span className="req"> *</span>
                </label>
                <select
                  className="select"
                  id="grade"
                  value={values.grade}
                  aria-required="true"
                  aria-invalid={errors.grade ? 'true' : undefined}
                  onChange={setField('grade')}
                >
                  {GRADES.map((grade) => (
                    <option value={grade.value} key={grade.value}>
                      {grade.label}
                    </option>
                  ))}
                </select>
                <p className="hint">يظهر الصف كأول اختيار في صفحة المواد الدراسية.</p>
                <p className="error-text">{errors.grade || ''}</p>
              </div>
              <div className="field">
                <label htmlFor="department_id">التخصص</label>
                <select
                  className="select"
                  id="department_id"
                  value={values.department_id}
                  aria-invalid={errors.department_id ? 'true' : undefined}
                  onChange={setField('department_id')}
                >
                  <option value="">عامة — تظهر لكل التخصصات</option>
                  {departments.map((department) => (
                    <option value={String(department.id)} key={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <p className="hint">
                  اتركها عامة لتظهر المادة مع كل تخصصات الصف، أو اربطها بتخصص محدد.
                </p>
                <p className="error-text">{errors.department_id || ''}</p>
              </div>
              <TextareaField
                id="description"
                label="وصف المادة"
                value={values.description}
                onChange={setField('description')}
                rows={4}
                maxLength={1000}
                hint="وصف مختصر يظهر أسفل اسم المادة (اختياري، 1000 حرف كحد أقصى)."
                error={errors.description}
                full
              />
            </div>
          </FormSection>
        </div>

        <div className="mt-2">
          <FormSection
            title="العرض والنشر"
            description="اختر أيقونة المادة وترتيب ظهورها، وحدد ما إذا كانت منشورة للزوار."
          >
            <div className="form-grid">
              <div className="field">
                <label htmlFor="icon">أيقونة المادة</label>
                <select
                  className="select"
                  id="icon"
                  value={values.icon}
                  aria-invalid={errors.icon ? 'true' : undefined}
                  onChange={setField('icon')}
                >
                  {ICON_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="hint">
                  <span className="subject-icon-preview" aria-hidden="true">
                    <Icon name={values.icon} size={18} />
                  </span>
                  {` معاينة الأيقونة المختارة: ${ICON_OPTIONS.find((option) => option.value === values.icon)?.label || 'كتاب'}`}
                </p>
                <p className="error-text">{errors.icon || ''}</p>
              </div>
              <TextField
                id="sort_order"
                label="ترتيب العرض"
                type="number"
                inputMode="numeric"
                value={values.sort_order}
                onChange={setField('sort_order')}
                hint="الأرقام الأصغر تظهر أولًا داخل القسم."
                error={errors.sort_order}
              />
              <CheckboxField
                id="is_published"
                label="نشر المادة في الموقع"
                hint="المادة غير المنشورة تبقى محفوظة في لوحة التحكم ولا تظهر للزوار."
                checked={values.is_published}
                onChange={setField('is_published')}
              />
            </div>
          </FormSection>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Icon name="save" size={16} />
            <span>{busy ? 'جارٍ الحفظ…' : isEdit ? 'حفظ التعديلات' : 'إضافة المادة'}</span>
          </button>
          <Link className="btn btn-outline" to="/subjects">
            إلغاء
          </Link>
          <span className="spacer" />
          {isEdit && subject?.is_published ? (
            <a className="btn btn-ghost" href="/subjects" target="_blank" rel="noopener">
              <Icon name="external" size={16} />
              <span>عرض في الموقع</span>
            </a>
          ) : null}
        </div>
      </form>

      {isEdit && subject ? (
        <section className="panel mt-2">
          <div className="panel__head">
            <div>
              <h3>منطقة الخطر</h3>
              <p>الحذف نهائي ولا يمكن التراجع عنه.</p>
            </div>
          </div>
          <div className="panel__body">
            <div className="notice">
              <Icon name="info" size={18} />
              <span>
                حذف المادة يزيلها من صفحة المواد الدراسية نهائيًا. إن أردت إخفاءها مؤقتًا، ألغِ
                نشرها بدلًا من حذفها.
              </span>
            </div>
            <div className="form-actions">
              <button className="btn btn-danger-outline" type="button" onClick={onDelete}>
                <Icon name="trash" size={16} />
                <span>حذف المادة نهائيًا</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
