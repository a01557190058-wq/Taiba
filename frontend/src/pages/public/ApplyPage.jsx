import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../../lib/api.js';
import { contentText, useSchoolContent } from '../../lib/content.jsx';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import { Alert, DemoBanner, PageHero } from '../../components/public/ui.jsx';

const ARABIC_DIGITS = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}\p{M}\s'.-]+$/u;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

const DOCUMENT_FIELDS = [
  {
    kind: 'success_form',
    label: 'استمارة النجاح في الشهادة الإعدادية',
    hint: 'أو بيان نجاح معتمد من المدرسة، بصيغة PDF أو صورة واضحة.',
  },
  {
    kind: 'birth_certificate',
    label: 'شهادة الميلاد الكمبيوتر الحديثة',
    hint: 'صورة واضحة تظهر بها جميع بيانات الشهادة.',
  },
  {
    kind: 'personal_photo',
    label: 'صورة شخصية حديثة للطالب',
    hint: 'صورة واضحة للوجه بخلفية بسيطة، بصيغة JPG أو PNG.',
  },
];

const DOCUMENT_KINDS = DOCUMENT_FIELDS.map((field) => field.kind);

const INITIAL = {
  full_name: '',
  date_of_birth: '',
  gender: '',
  national_id: '',
  governorate: '',
  educational_administration: '',
  department_id: '',
  preparatory_score: '',
  previous_education: '',
  guardian_name: '',
  guardian_relation: '',
  guardian_phone: '',
  phone: '',
  email: '',
  address_governorate: '',
  address_center: '',
  address_city: '',
  additional_notes: '',
  consent: false,
};

function toLatinDigits(value) {
  return String(value || '').replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] || digit);
}

function normalizePhone(value) {
  return toLatinDigits(value).replace(/[\s\-().]/g, '');
}

function normalizeNationalId(value) {
  return toLatinDigits(value).replace(/[\s-]+/g, '');
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Returns the canonical document type from the file metadata/name. */
function documentTypeOf(file) {
  if (!file) return '';
  const name = String(file.name || '').toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'application/pdf';
  if (file.type === 'image/jpeg' || /\.(jpe?g)$/.test(name)) return 'image/jpeg';
  if (file.type === 'image/png' || name.endsWith('.png')) return 'image/png';
  return '';
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} بايت`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} كيلوبايت`;
  return `${(size / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

const validators = {
  full_name(value) {
    const name = String(value || '').trim();
    if (!name) return 'الاسم الكامل مطلوب.';
    if (name.length < 3) return 'الاسم الكامل قصير جدًا (3 أحرف على الأقل).';
    if (name.length > 100) return 'الاسم الكامل طويل جدًا (100 حرف كحد أقصى).';
    if (!NAME_RE.test(name)) return 'الاسم الكامل يحتوي على رموز غير مسموحة.';
    return '';
  },
  date_of_birth(value) {
    const date = String(value || '').trim();
    if (!date) return 'تاريخ الميلاد مطلوب.';
    if (!isValidDate(date)) return 'تاريخ الميلاد غير صالح.';
    if (date > todayIso()) return 'تاريخ الميلاد لا يمكن أن يكون في المستقبل.';
    if (date < '1990-01-01') return 'يرجى التحقق من تاريخ الميلاد.';
    return '';
  },
  gender(value) {
    if (!value) return 'يجب اختيار النوع (ذكر أو أنثى).';
    return '';
  },
  national_id(value) {
    const id = normalizeNationalId(value);
    if (!id) return 'الرقم القومي أو رقم الهوية مطلوب.';
    if (id.length < 6 || id.length > 30) {
      return 'الرقم القومي أو رقم الهوية يجب أن يكون بين 6 و30 حرفًا/رقمًا.';
    }
    if (!/^[\p{L}\p{N}]+$/u.test(id)) return 'الرقم القومي أو رقم الهوية يحتوي على رموز غير مسموحة.';
    return '';
  },
  governorate(value) {
    const text = String(value || '').trim();
    if (!text) return 'المحافظة مطلوبة.';
    if (text.length < 2) return 'اسم المحافظة قصير جدًا.';
    if (text.length > 80) return 'اسم المحافظة طويل جدًا.';
    return '';
  },
  educational_administration(value) {
    const text = String(value || '').trim();
    if (!text) return 'الإدارة التعليمية مطلوبة.';
    if (text.length < 2) return 'اسم الإدارة التعليمية قصير جدًا.';
    if (text.length > 120) return 'اسم الإدارة التعليمية طويل جدًا.';
    return '';
  },
  department_id(value) {
    if (!value) return 'يجب اختيار نوع التعليم / التخصص.';
    return '';
  },
  preparatory_score(value) {
    const score = toLatinDigits(value).trim();
    if (!score) return 'المجموع أو النسبة المئوية مطلوب.';
    if (score.length > 30) return 'المجموع أو النسبة المئوية طويل جدًا.';
    if (!/^\d[\d\s.,%/]*$/.test(score)) {
      return 'أدخل المجموع أو النسبة كأرقام فقط، مثل 280 أو 85%.';
    }
    return '';
  },
  previous_education(value) {
    if (String(value || '').trim().length > 150) {
      return 'المؤهل أو المرحلة السابقة طويل جدًا (150 حرفًا كحد أقصى).';
    }
    return '';
  },
  guardian_name(value) {
    const name = String(value || '').trim();
    if (!name) return 'اسم ولي الأمر مطلوب.';
    if (name.length < 3) return 'اسم ولي الأمر قصير جدًا.';
    if (name.length > 100) return 'اسم ولي الأمر طويل جدًا.';
    if (!NAME_RE.test(name)) return 'اسم ولي الأمر يحتوي على رموز غير مسموحة.';
    return '';
  },
  guardian_relation(value) {
    if (!value) return 'يجب تحديد صلة القرابة.';
    return '';
  },
  guardian_phone(value) {
    const phone = normalizePhone(value);
    if (!phone) return 'رقم هاتف ولي الأمر مطلوب.';
    if (!/^\+?\d{7,15}$/.test(phone)) return 'رقم الهاتف يجب أن يحتوي على 7 إلى 15 رقمًا.';
    return '';
  },
  phone(value) {
    const phone = normalizePhone(value);
    if (phone && !/^\+?\d{7,15}$/.test(phone)) {
      return 'رقم الهاتف يجب أن يحتوي على 7 إلى 15 رقمًا.';
    }
    return '';
  },
  email(value) {
    const email = String(value || '').trim();
    if (email && (email.length > 120 || !EMAIL_RE.test(email))) return 'البريد الإلكتروني غير صالح.';
    return '';
  },
  address_governorate(value) {
    const text = String(value || '').trim();
    if (!text) return 'محافظة العنوان مطلوبة.';
    if (text.length < 2) return 'اسم المحافظة قصير جدًا.';
    if (text.length > 80) return 'اسم المحافظة طويل جدًا.';
    return '';
  },
  address_center(value) {
    const text = String(value || '').trim();
    if (!text) return 'المركز مطلوب.';
    if (text.length < 2) return 'اسم المركز قصير جدًا.';
    if (text.length > 120) return 'اسم المركز طويل جدًا.';
    return '';
  },
  address_city(value) {
    const text = String(value || '').trim();
    if (!text) return 'المدينة أو القرية مطلوبة.';
    if (text.length < 2) return 'اسم المدينة أو القرية قصير جدًا.';
    if (text.length > 120) return 'اسم المدينة أو القرية طويل جدًا.';
    return '';
  },
  additional_notes(value) {
    if (String(value || '').trim().length > 1000) {
      return 'الملاحظات الإضافية طويلة جدًا (1000 حرف كحد أقصى).';
    }
    return '';
  },
  consent(value, values) {
    if (!values.consent) {
      return 'يجب إقرار ولي الأمر بصحة البيانات والموافقة على شروط القبول قبل الإرسال.';
    }
    return '';
  },
};

function validateField(name, values) {
  return validators[name] ? validators[name](values[name], values) : '';
}

function validateDocument(file) {
  if (!file) return 'هذا المستند مطلوب.';
  if (!ACCEPTED_DOCUMENT_TYPES.includes(documentTypeOf(file))) {
    return 'الصيغة غير مدعومة. استخدم PDF أو صورة JPG/PNG واضحة.';
  }
  if (!file.size) return 'الملف فارغ. اختر ملفًا آخر.';
  if (file.size > MAX_FILE_BYTES) return 'حجم الملف أكبر من 8 ميجابايت. اختر ملفًا أصغر.';
  return '';
}

function DocumentField({ field, file, error, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    const type = documentTypeOf(file);
    if (!file || !type.startsWith('image/')) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clear = () => {
    if (inputRef.current) inputRef.current.value = '';
    onChange(field.kind, null);
  };

  return (
    <div className={`doc-field${error ? ' has-error' : ''}`}>
      <div className="doc-field__head">
        <label className="form-label" htmlFor={`doc-${field.kind}`}>
          {field.label} <span className="req" aria-hidden="true">*</span>
        </label>
        <p className="form-hint">{field.hint}</p>
      </div>
      <div className="doc-field__body">
        <input
          ref={inputRef}
          className="doc-field__input"
          id={`doc-${field.kind}`}
          name={field.kind}
          type="file"
          accept={DOCUMENT_ACCEPT}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={`hint-doc-${field.kind} error-doc-${field.kind}`}
          onChange={(event) => onChange(field.kind, event.target.files?.[0] || null)}
        />
        <p className="form-hint" id={`hint-doc-${field.kind}`}>
          PDF أو JPG/PNG — بحد أقصى 8 ميجابايت.
        </p>
        {file ? (
          <div className="doc-field__file">
            {preview ? (
              <img className="doc-field__thumb" src={preview} alt={`معاينة ${field.label}`} />
            ) : (
              <span className="doc-field__icon" aria-hidden="true">
                <Icon name="file" size={22} />
              </span>
            )}
            <div className="doc-field__meta">
              <strong>{file.name}</strong>
              <span className="text-small text-muted">
                {documentTypeOf(file) === 'application/pdf' ? 'PDF' : 'صورة'} — {formatFileSize(file.size)}
              </span>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={clear}>
              إزالة
            </button>
          </div>
        ) : null}
      </div>
      <p className="field-error" id={`error-doc-${field.kind}`}>
        {error || ''}
      </p>
    </div>
  );
}

export default function ApplyPage() {
  usePageMeta(
    'نموذج التقديم | مدرسة طيبة تكنولوجي',
    'املأ نموذج التقديم في مدرسة طيبة تكنولوجي واختر التخصص المناسب. إرسال الطلب لا يعني القبول النهائي.'
  );

  const { content } = useSchoolContent();
  const [searchParams] = useSearchParams();
  const preselectedSlug = searchParams.get('department') || '';

  const formRef = useRef(null);
  const successRef = useRef(null);
  const alertRef = useRef(null);

  const [values, setValues] = useState(INITIAL);
  const [files, setFiles] = useState(() =>
    Object.fromEntries(DOCUMENT_KINDS.map((kind) => [kind, null]))
  );
  const [errors, setErrors] = useState({});
  const [documentErrors, setDocumentErrors] = useState({});
  const [alert, setAlert] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [copyLabel, setCopyLabel] = useState('نسخ الرقم');

  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState(null);

  // Load the published departments once.
  useEffect(() => {
    let active = true;
    api('/api/departments')
      .then((items) => {
        if (!active) return;
        const list = Array.isArray(items) ? items : [];
        setDepartments(list);
        setDepartmentsLoading(false);
        setDepartmentsError(null);

        if (!list.length) {
          setAlert({
            type: 'info',
            message:
              'لا توجد تخصصات منشورة حاليًا، لذا لا يمكن إرسال طلب جديد الآن. يرجى العودة لاحقًا.',
          });
        }
      })
      .catch((error) => {
        if (!active) return;
        setDepartments([]);
        setDepartmentsLoading(false);
        setDepartmentsError(error);
        setAlert({
          type: 'error',
          message:
            error.message || 'تعذّر تحميل قائمة التخصصات. أعد تحميل الصفحة ثم حاول مرة أخرى.',
        });
      });
    return () => {
      active = false;
    };
  }, []);

  // Preselect the department passed via ?department=slug.
  useEffect(() => {
    if (!preselectedSlug || !departments.length) return;
    const match = departments.find((department) => department.slug === preselectedSlug);
    if (match) {
      setValues((current) =>
        current.department_id ? current : { ...current, department_id: String(match.id) }
      );
    }
  }, [preselectedSlug, departments]);

  useEffect(() => {
    if (success && successRef.current) {
      successRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [success]);

  const departmentsBlocked = departmentsLoading || Boolean(departmentsError) || !departments.length;

  const setField = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const setDocument = (kind, file) => {
    setFiles((current) => ({ ...current, [kind]: file }));
    setDocumentErrors((current) => {
      if (!current[kind]) return current;
      const next = { ...current };
      delete next[kind];
      return next;
    });
  };

  const validateOnBlur = (name) => {
    const message = validateField(name, values);
    setErrors((current) => ({ ...current, [name]: message }));
  };

  const focusField = (name) => {
    const field = formRef.current?.elements?.namedItem(name);
    if (field && typeof field.focus === 'function') {
      field.focus();
      if (typeof field.scrollIntoView === 'function') {
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const validateAll = () => {
    const fieldErrors = {};
    for (const name of Object.keys(validators)) {
      const message = validateField(name, values);
      if (message) fieldErrors[name] = message;
    }
    const docErrors = {};
    for (const kind of DOCUMENT_KINDS) {
      const message = validateDocument(files[kind]);
      if (message) docErrors[kind] = message;
    }
    return { fieldErrors, docErrors };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAlert({ type: '', message: '' });

    const { fieldErrors, docErrors } = validateAll();
    if (Object.keys(fieldErrors).length || Object.keys(docErrors).length) {
      setErrors(fieldErrors);
      setDocumentErrors(docErrors);
      const first = Object.keys(fieldErrors)[0] || Object.keys(docErrors)[0];
      focusField(first);
      setAlert({
        type: 'error',
        message: 'يرجى تصحيح الحقول والمستندات المعلّمة قبل إرسال الطلب.',
      });
      return;
    }

    const payload = {
      full_name: values.full_name.trim(),
      date_of_birth: values.date_of_birth,
      gender: values.gender,
      national_id: normalizeNationalId(values.national_id),
      governorate: values.governorate.trim(),
      educational_administration: values.educational_administration.trim(),
      department_id: String(values.department_id),
      preparatory_score: toLatinDigits(values.preparatory_score).trim(),
      previous_education: values.previous_education.trim(),
      guardian_name: values.guardian_name.trim(),
      guardian_relation: values.guardian_relation,
      guardian_phone: normalizePhone(values.guardian_phone),
      phone: normalizePhone(values.phone),
      email: values.email.trim(),
      address_governorate: values.address_governorate.trim(),
      address_center: values.address_center.trim(),
      address_city: values.address_city.trim(),
      additional_notes: values.additional_notes.trim(),
      consent: values.consent ? 'true' : 'false',
    };

    const formData = new FormData();
    for (const [name, value] of Object.entries(payload)) formData.append(name, value);
    for (const kind of DOCUMENT_KINDS) {
      if (files[kind]) formData.append(kind, files[kind]);
    }

    setSubmitting(true);
    try {
      const data = await api('/api/applications', { method: 'POST', body: formData });
      setSuccess(data);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) {
          const nextFieldErrors = { ...errors };
          const nextDocumentErrors = { ...documentErrors };
          for (const [name, message] of Object.entries(error.fields)) {
            if (DOCUMENT_KINDS.includes(name)) nextDocumentErrors[name] = message;
            else nextFieldErrors[name] = message;
          }
          setErrors(nextFieldErrors);
          setDocumentErrors(nextDocumentErrors);
          const first =
            Object.keys(error.fields).find((name) => !DOCUMENT_KINDS.includes(name)) ||
            Object.keys(error.fields).find((name) => DOCUMENT_KINDS.includes(name));
          if (first) focusField(first);
        }
        setAlert({
          type: error.code === 'DUPLICATE_APPLICATION' ? 'warning' : 'error',
          message: error.message,
        });
      } else {
        setAlert({
          type: 'error',
          message: 'تعذّر إرسال الطلب. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.',
        });
      }
      window.setTimeout(() => {
        alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    } finally {
      setSubmitting(false);
    }
  };

  const copyReference = async () => {
    const value = success?.reference_number || '';
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyLabel('تم النسخ');
    } catch {
      setCopyLabel('حدّد الرقم وانسخه');
    }
    window.setTimeout(() => setCopyLabel('نسخ الرقم'), 2200);
  };

  const successSummary = useMemo(() => {
    if (!success) return '';
    const parts = [];
    if (success.department_name) parts.push(`المهنة/التخصص: ${success.department_name}`);
    if (success.full_name) parts.push(`المتقدم: ${success.full_name}`);
    return parts.join(' • ');
  }, [success]);

  return (
    <>
      <PageHero
        title="نموذج التقديم"
        lead={
          <>
            أدخل بيانات الطالب وولي الأمر وأرفق المستندات المطلوبة. الحقول المعلّمة بـ
            <span className="req">*</span> مطلوبة. سيظهر رقم طلب فريد بعد الإرسال، احتفظ به
            لمتابعة حالة الطلب.
          </>
        }
        breadcrumb={[
          { label: 'الرئيسية', href: '/' },
          { label: 'القبول', href: '/admission' },
          { label: 'نموذج التقديم' },
        ]}
      />

      <section className="section">
        <div className="container">
          <div className="apply-intro">
            <span className="apply-intro__icon" aria-hidden="true">
              <Icon name="info" size={22} />
            </span>
            <div>
              <p>
                يرجى تجهيز صورة استمارة النجاح في الشهادة الإعدادية، وشهادة الميلاد الكمبيوتر
                الحديثة، وصورة شخصية حديثة للطالب قبل البدء في ملء النموذج.
              </p>
              <p>
                تُقبل المستندات بصيغة PDF أو صورة واضحة JPG/PNG، بحد أقصى 8 ميجابايت لكل ملف.
              </p>
            </div>
          </div>

          <div className="apply-layout">
            <div className="form-card reveal">
              {alert.message ? (
                <div ref={alertRef}>
                  <Alert type={alert.type || 'error'} message={alert.message} />
                </div>
              ) : null}

              {success ? (
                <div className="success-panel" ref={successRef}>
                  <span className="success-panel__icon" aria-hidden="true">
                    <Icon name="check" size={30} />
                  </span>
                  <h2 className="section-title mb-0">تم تسجيل طلبك بنجاح</h2>
                  <p className="text-muted">
                    احتفظ برقم الطلب التالي لمتابعة حالة طلبك مع إدارة المدرسة.
                  </p>

                  <div className="reference-box">
                    <span className="text-small text-muted">رقم الطلب</span>
                    <strong className="reference-box__value">{success.reference_number || '—'}</strong>
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={copyReference}
                    >
                      {copyLabel}
                    </button>
                  </div>

                  {successSummary ? (
                    <p className="text-small text-muted">{successSummary}</p>
                  ) : null}
                  <p className="form-note">
                    {contentText(
                      content,
                      'application_note',
                      'إرسال الطلب لا يعني القبول. سجل الطلب يصل إلى إدارة المدرسة للمراجعة.'
                    )}
                  </p>

                  <div className="success-actions">
                    <Link className="btn btn-primary" to="/">
                      العودة إلى الرئيسية
                    </Link>
                    <Link className="btn btn-outline" to="/apply">
                      تقديم طلب آخر
                    </Link>
                  </div>
                </div>
              ) : (
                <form id="application-form" noValidate ref={formRef} onSubmit={handleSubmit}>
                  <fieldset className="form-step">
                    <legend className="form-section-title">بيانات الطالب</legend>
                    <div className="form-grid">
                      <div className="form-field form-field--full">
                        <label className="form-label" htmlFor="full_name">
                          الاسم الكامل (كما هو مكتوب في شهادة الميلاد){' '}
                          <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="full_name"
                          name="full_name"
                          type="text"
                          autoComplete="name"
                          maxLength={100}
                          required
                          aria-invalid={errors.full_name ? 'true' : undefined}
                          aria-describedby="error-full_name"
                          value={values.full_name}
                          onChange={(event) => setField('full_name', event.target.value)}
                          onBlur={() => validateOnBlur('full_name')}
                        />
                        <p className="field-error" id="error-full_name">
                          {errors.full_name || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="date_of_birth">
                          تاريخ الميلاد <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="date_of_birth"
                          name="date_of_birth"
                          type="date"
                          min="1990-01-01"
                          max={todayIso()}
                          required
                          aria-invalid={errors.date_of_birth ? 'true' : undefined}
                          aria-describedby="error-date_of_birth"
                          value={values.date_of_birth}
                          onChange={(event) => setField('date_of_birth', event.target.value)}
                          onBlur={() => validateOnBlur('date_of_birth')}
                        />
                        <p className="field-error" id="error-date_of_birth">
                          {errors.date_of_birth || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="gender">
                          النوع <span className="req" aria-hidden="true">*</span>
                        </label>
                        <select
                          className="select"
                          id="gender"
                          name="gender"
                          required
                          aria-invalid={errors.gender ? 'true' : undefined}
                          aria-describedby="error-gender"
                          value={values.gender}
                          onChange={(event) => setField('gender', event.target.value)}
                          onBlur={() => validateOnBlur('gender')}
                        >
                          <option value="">اختر النوع</option>
                          <option value="male">ذكر</option>
                          <option value="female">أنثى</option>
                        </select>
                        <p className="field-error" id="error-gender">
                          {errors.gender || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="national_id">
                          الرقم القومي / شهادة الميلاد{' '}
                          <span className="text-muted text-small">(أو رقم الهوية المدرسية)</span>{' '}
                          <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="national_id"
                          name="national_id"
                          type="text"
                          inputMode="numeric"
                          maxLength={30}
                          dir="ltr"
                          required
                          aria-invalid={errors.national_id ? 'true' : undefined}
                          aria-describedby="hint-national_id error-national_id"
                          value={values.national_id}
                          onChange={(event) => setField('national_id', event.target.value)}
                          onBlur={() => validateOnBlur('national_id')}
                        />
                        <p className="form-hint" id="hint-national_id">
                          14 رقمًا للرقم القومي، أو رقم الهوية المدرسية إن وجد.
                        </p>
                        <p className="field-error" id="error-national_id">
                          {errors.national_id || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="governorate">
                          المحافظة <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="governorate"
                          name="governorate"
                          type="text"
                          maxLength={80}
                          required
                          aria-invalid={errors.governorate ? 'true' : undefined}
                          aria-describedby="error-governorate"
                          value={values.governorate}
                          onChange={(event) => setField('governorate', event.target.value)}
                          onBlur={() => validateOnBlur('governorate')}
                        />
                        <p className="field-error" id="error-governorate">
                          {errors.governorate || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="educational_administration">
                          الإدارة التعليمية <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="educational_administration"
                          name="educational_administration"
                          type="text"
                          maxLength={120}
                          required
                          aria-invalid={errors.educational_administration ? 'true' : undefined}
                          aria-describedby="error-educational_administration"
                          value={values.educational_administration}
                          onChange={(event) => setField('educational_administration', event.target.value)}
                          onBlur={() => validateOnBlur('educational_administration')}
                        />
                        <p className="field-error" id="error-educational_administration">
                          {errors.educational_administration || ''}
                        </p>
                      </div>

                      <div className="form-field form-field--full">
                        <label className="form-label" htmlFor="department_id">
                          نوع التعليم المفضل / التخصص{' '}
                          <span className="req" aria-hidden="true">*</span>
                        </label>
                        <select
                          className="select"
                          id="department_id"
                          name="department_id"
                          required
                          disabled={departmentsBlocked}
                          aria-invalid={errors.department_id ? 'true' : undefined}
                          aria-describedby="hint-department error-department_id"
                          value={values.department_id}
                          onChange={(event) => setField('department_id', event.target.value)}
                          onBlur={() => validateOnBlur('department_id')}
                        >
                          {departmentsLoading ? (
                            <option value="">جارٍ تحميل التخصصات…</option>
                          ) : null}
                          {!departmentsLoading && departmentsError ? (
                            <option value="">تعذّر تحميل التخصصات</option>
                          ) : null}
                          {!departmentsLoading && !departmentsError && !departments.length ? (
                            <option value="">لا توجد تخصصات متاحة حاليًا</option>
                          ) : null}
                          {!departmentsLoading && !departmentsError && departments.length ? (
                            <>
                              <option value="">اختر التخصص</option>
                              {departments.map((department) => (
                                <option value={String(department.id)} key={department.id}>
                                  {department.name}
                                </option>
                              ))}
                            </>
                          ) : null}
                        </select>
                        <p className="form-hint" id="hint-department">
                          تُعرض هنا التخصصات المنشورة والمتاحة للتقديم فقط.
                        </p>
                        <p className="field-error" id="error-department_id">
                          {errors.department_id || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="preparatory_score">
                          المجموع أو النسبة المئوية في الشهادة الإعدادية{' '}
                          <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="preparatory_score"
                          name="preparatory_score"
                          type="text"
                          inputMode="decimal"
                          maxLength={30}
                          placeholder="مثال: 280 أو 85%"
                          required
                          aria-invalid={errors.preparatory_score ? 'true' : undefined}
                          aria-describedby="error-preparatory_score"
                          value={values.preparatory_score}
                          onChange={(event) => setField('preparatory_score', event.target.value)}
                          onBlur={() => validateOnBlur('preparatory_score')}
                        />
                        <p className="field-error" id="error-preparatory_score">
                          {errors.preparatory_score || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="previous_education">
                          المدرسة الإعدادية السابقة{' '}
                          <span className="text-muted text-small">(اختياري)</span>
                        </label>
                        <input
                          className="input"
                          id="previous_education"
                          name="previous_education"
                          type="text"
                          maxLength={150}
                          aria-invalid={errors.previous_education ? 'true' : undefined}
                          aria-describedby="error-previous_education"
                          value={values.previous_education}
                          onChange={(event) => setField('previous_education', event.target.value)}
                          onBlur={() => validateOnBlur('previous_education')}
                        />
                        <p className="field-error" id="error-previous_education">
                          {errors.previous_education || ''}
                        </p>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="form-step">
                    <legend className="form-section-title">بيانات ولي الأمر والتواصل</legend>
                    <div className="form-grid">
                      <div className="form-field form-field--full">
                        <label className="form-label" htmlFor="guardian_name">
                          اسم ولي الأمر (الأب أو الأم){' '}
                          <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="guardian_name"
                          name="guardian_name"
                          type="text"
                          maxLength={100}
                          required
                          aria-invalid={errors.guardian_name ? 'true' : undefined}
                          aria-describedby="error-guardian_name"
                          value={values.guardian_name}
                          onChange={(event) => setField('guardian_name', event.target.value)}
                          onBlur={() => validateOnBlur('guardian_name')}
                        />
                        <p className="field-error" id="error-guardian_name">
                          {errors.guardian_name || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="guardian_relation">
                          صلة القرابة <span className="req" aria-hidden="true">*</span>
                        </label>
                        <select
                          className="select"
                          id="guardian_relation"
                          name="guardian_relation"
                          required
                          aria-invalid={errors.guardian_relation ? 'true' : undefined}
                          aria-describedby="error-guardian_relation"
                          value={values.guardian_relation}
                          onChange={(event) => setField('guardian_relation', event.target.value)}
                          onBlur={() => validateOnBlur('guardian_relation')}
                        >
                          <option value="">اختر صلة القرابة</option>
                          <option value="father">الأب</option>
                          <option value="mother">الأم</option>
                          <option value="other">أخرى</option>
                        </select>
                        <p className="field-error" id="error-guardian_relation">
                          {errors.guardian_relation || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="guardian_phone">
                          رقم هاتف ولي الأمر{' '}
                          <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="guardian_phone"
                          name="guardian_phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          maxLength={20}
                          required
                          dir="ltr"
                          aria-invalid={errors.guardian_phone ? 'true' : undefined}
                          aria-describedby="hint-guardian_phone error-guardian_phone"
                          value={values.guardian_phone}
                          onChange={(event) => setField('guardian_phone', event.target.value)}
                          onBlur={() => validateOnBlur('guardian_phone')}
                        />
                        <p className="form-hint" id="hint-guardian_phone">
                          رقم أساسي للتواصل وإرسال الإشعارات عبر الرسائل القصيرة أو واتساب.
                        </p>
                        <p className="field-error" id="error-guardian_phone">
                          {errors.guardian_phone || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="phone">
                          رقم هاتف إضافي للطالب{' '}
                          <span className="text-muted text-small">(اختياري)</span>
                        </label>
                        <input
                          className="input"
                          id="phone"
                          name="phone"
                          type="tel"
                          inputMode="tel"
                          maxLength={20}
                          dir="ltr"
                          aria-invalid={errors.phone ? 'true' : undefined}
                          aria-describedby="error-phone"
                          value={values.phone}
                          onChange={(event) => setField('phone', event.target.value)}
                          onBlur={() => validateOnBlur('phone')}
                        />
                        <p className="field-error" id="error-phone">
                          {errors.phone || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="email">
                          البريد الإلكتروني{' '}
                          <span className="text-muted text-small">(اختياري)</span>
                        </label>
                        <input
                          className="input"
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          maxLength={120}
                          dir="ltr"
                          aria-invalid={errors.email ? 'true' : undefined}
                          aria-describedby="error-email"
                          value={values.email}
                          onChange={(event) => setField('email', event.target.value)}
                          onBlur={() => validateOnBlur('email')}
                        />
                        <p className="field-error" id="error-email">
                          {errors.email || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="address_governorate">
                          محافظة العنوان <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="address_governorate"
                          name="address_governorate"
                          type="text"
                          maxLength={80}
                          required
                          aria-invalid={errors.address_governorate ? 'true' : undefined}
                          aria-describedby="error-address_governorate"
                          value={values.address_governorate}
                          onChange={(event) => setField('address_governorate', event.target.value)}
                          onBlur={() => validateOnBlur('address_governorate')}
                        />
                        <p className="field-error" id="error-address_governorate">
                          {errors.address_governorate || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="address_center">
                          المركز <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="address_center"
                          name="address_center"
                          type="text"
                          maxLength={120}
                          required
                          aria-invalid={errors.address_center ? 'true' : undefined}
                          aria-describedby="error-address_center"
                          value={values.address_center}
                          onChange={(event) => setField('address_center', event.target.value)}
                          onBlur={() => validateOnBlur('address_center')}
                        />
                        <p className="field-error" id="error-address_center">
                          {errors.address_center || ''}
                        </p>
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="address_city">
                          المدينة أو القرية <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="address_city"
                          name="address_city"
                          type="text"
                          maxLength={120}
                          required
                          aria-invalid={errors.address_city ? 'true' : undefined}
                          aria-describedby="error-address_city"
                          value={values.address_city}
                          onChange={(event) => setField('address_city', event.target.value)}
                          onBlur={() => validateOnBlur('address_city')}
                        />
                        <p className="field-error" id="error-address_city">
                          {errors.address_city || ''}
                        </p>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="form-step">
                    <legend className="form-section-title">المستندات المطلوبة</legend>
                    <div className="doc-list">
                      {DOCUMENT_FIELDS.map((field) => (
                        <DocumentField
                          key={field.kind}
                          field={field}
                          file={files[field.kind]}
                          error={documentErrors[field.kind]}
                          onChange={setDocument}
                        />
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="form-step">
                    <legend className="form-section-title">ملاحظات وإقرار ولي الأمر</legend>
                    <div className="form-grid">
                      <div className="form-field form-field--full">
                        <label className="form-label" htmlFor="additional_notes">
                          ملاحظات إضافية{' '}
                          <span className="text-muted text-small">(اختياري)</span>
                        </label>
                        <textarea
                          className="textarea"
                          id="additional_notes"
                          name="additional_notes"
                          maxLength={1000}
                          aria-invalid={errors.additional_notes ? 'true' : undefined}
                          aria-describedby="error-additional_notes"
                          value={values.additional_notes}
                          onChange={(event) => setField('additional_notes', event.target.value)}
                          onBlur={() => validateOnBlur('additional_notes')}
                        />
                        <p className="field-error" id="error-additional_notes">
                          {errors.additional_notes || ''}
                        </p>
                      </div>

                      <div className="form-field form-field--full">
                        <label className="checkbox" htmlFor="consent">
                          <input
                            type="checkbox"
                            id="consent"
                            name="consent"
                            required
                            aria-invalid={errors.consent ? 'true' : undefined}
                            aria-describedby="error-consent"
                            checked={values.consent}
                            onChange={(event) => setField('consent', event.target.checked)}
                          />
                          <span>
                            أقر أنا ولي الأمر بأن جميع البيانات المدونة صحيحة وأتحمل مسؤوليتها،
                            وأوافق على شروط وقواعد القبول الخاصة بالمدرسة.
                          </span>
                        </label>
                        <p className="field-error" id="error-consent">
                          {errors.consent || ''}
                        </p>
                      </div>
                    </div>
                  </fieldset>

                  <div className="form-actions">
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={submitting || departmentsBlocked}
                    >
                      <span>{submitting ? 'جارٍ الإرسال…' : 'إرسال الطلب'}</span>
                    </button>
                    {submitting ? (
                      <span className="loading-inline">
                        <span className="spinner spinner--dark" aria-hidden="true" />
                        جارٍ إرسال الطلب والمستندات…
                      </span>
                    ) : null}
                    <Link className="btn btn-ghost" to="/departments">
                      تصفح التخصصات أولًا
                    </Link>
                  </div>
                </form>
              )}
            </div>

            <aside className="sticky-card">
              <h3>قبل إرسال الطلب</h3>
              <p>
                جهّز المستندات الثلاثة كملفات PDF أو صور واضحة، وتأكد من رقم هاتف ولي الأمر فهو
                وسيلة التواصل الأساسية معك.
              </p>

              <ul className="skill-list mt-2">
                <li>الحقول المعلّمة بـ * مطلوبة.</li>
                <li>المستندات المطلوبة: استمارة النجاح، شهادة الميلاد، صورة شخصية.</li>
                <li>الحد الأقصى لكل ملف 8 ميجابايت بصيغة PDF أو JPG/PNG.</li>
                <li>يُمنع إرسال أكثر من طلب للتخصص نفسه بنفس رقم ولي الأمر خلال 24 ساعة.</li>
                <li>رقم الطلب يظهر مرة واحدة بعد الإرسال.</li>
              </ul>

              <DemoBanner>
                موقع تجريبي: البيانات تُستخدم لأغراض العرض فقط، ولا تمثل قبولًا رسميًا.
              </DemoBanner>

              <Link className="btn btn-outline" to="/admission">
                معلومات القبول
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
