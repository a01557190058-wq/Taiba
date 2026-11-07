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

const STEP_FIELDS = {
  1: ['full_name', 'phone', 'email'],
  2: ['department_id', 'previous_education'],
  3: ['additional_notes', 'consent'],
};

const STEP_LABELS = ['بيانات المتقدم', 'اختيار القسم', 'المراجعة والإرسال'];

const INITIAL = {
  full_name: '',
  phone: '',
  email: '',
  department_id: '',
  previous_education: '',
  additional_notes: '',
  consent: false,
};

function normalizePhone(value) {
  return String(value || '')
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] || digit)
    .replace(/[\s\-().]/g, '');
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
  phone(value) {
    const phone = normalizePhone(value);
    if (!phone) return 'رقم الهاتف مطلوب.';
    if (!/^\+?\d{7,15}$/.test(phone)) return 'رقم الهاتف يجب أن يحتوي على 7 إلى 15 رقمًا.';
    return '';
  },
  email(value) {
    const email = String(value || '').trim();
    if (email && (email.length > 120 || !EMAIL_RE.test(email))) return 'البريد الإلكتروني غير صالح.';
    return '';
  },
  department_id(value) {
    if (!value) return 'يجب اختيار القسم.';
    return '';
  },
  previous_education(value) {
    if (String(value || '').trim().length > 150) {
      return 'المؤهل أو المرحلة السابقة طويل جدًا (150 حرفًا كحد أقصى).';
    }
    return '';
  },
  additional_notes(value) {
    if (String(value || '').trim().length > 1000) {
      return 'الملاحظات الإضافية طويلة جدًا (1000 حرف كحد أقصى).';
    }
    return '';
  },
  consent(value, values) {
    if (!values.consent) return 'يجب الموافقة على معالجة البيانات قبل الإرسال.';
    return '';
  },
};

function validateField(name, values) {
  return validators[name] ? validators[name](values[name], values) : '';
}

function validateStep(step, values) {
  const errors = {};
  for (const name of STEP_FIELDS[step] || []) {
    const message = validateField(name, values);
    if (message) errors[name] = message;
  }
  return errors;
}

function validateAll(values) {
  const errors = {};
  for (const name of Object.keys(validators)) {
    const message = validateField(name, values);
    if (message) errors[name] = message;
  }
  return errors;
}

function stepForField(name) {
  return Number(Object.keys(STEP_FIELDS).find((step) => STEP_FIELDS[step].includes(name)) || 1);
}

export default function ApplyPage() {
  usePageMeta(
    'نموذج التقديم | مدرسة طيبة تكنولوجي',
    'املأ نموذج التقديم في مدرسة طيبة تكنولوجي واختر القسم المناسب. إرسال الطلب لا يعني القبول النهائي.'
  );

  const { content } = useSchoolContent();
  const [searchParams] = useSearchParams();
  const preselectedSlug = searchParams.get('department') || '';

  const formRef = useRef(null);
  const successRef = useRef(null);
  const alertRef = useRef(null);

  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1);
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
              'لا توجد أقسام منشورة حاليًا، لذا لا يمكن إرسال طلب جديد الآن. يرجى العودة لاحقًا.',
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
            error.message || 'تعذّر تحميل قائمة الأقسام. أعد تحميل الصفحة ثم حاول مرة أخرى.',
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

  const goNext = () => {
    const stepErrors = validateStep(step, values);
    if (Object.keys(stepErrors).length) {
      setErrors((current) => ({ ...current, ...stepErrors }));
      setAlert({
        type: 'error',
        message: 'يرجى تصحيح الحقول المعلّمة قبل الانتقال إلى الخطوة التالية.',
      });
      focusField(Object.keys(stepErrors)[0]);
      return;
    }
    setAlert({ type: '', message: '' });
    setStep((current) => Math.min(current + 1, STEP_LABELS.length));
  };

  const goPrev = () => {
    setAlert({ type: '', message: '' });
    setStep((current) => Math.max(current - 1, 1));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAlert({ type: '', message: '' });

    if (step < STEP_LABELS.length) {
      goNext();
      return;
    }

    const allErrors = validateAll(values);
    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      const first = Object.keys(allErrors)[0];
      setStep(stepForField(first));
      focusField(first);
      setAlert({
        type: 'error',
        message: 'يرجى تصحيح الحقول المعلّمة قبل إرسال الطلب.',
      });
      return;
    }

    const payload = {
      full_name: values.full_name.trim(),
      phone: normalizePhone(values.phone),
      email: values.email.trim(),
      department_id: Number(values.department_id),
      previous_education: values.previous_education.trim(),
      additional_notes: values.additional_notes.trim(),
      consent: Boolean(values.consent),
    };

    setSubmitting(true);
    try {
      const data = await api('/api/applications', { method: 'POST', body: payload });
      setSuccess(data);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) {
          setErrors((current) => ({ ...current, ...error.fields }));
          const first = Object.keys(error.fields)[0];
          if (first) {
            setStep(stepForField(first));
            focusField(first);
          }
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
    if (success.department_name) parts.push(`القسم: ${success.department_name}`);
    if (success.full_name) parts.push(`المتقدم: ${success.full_name}`);
    return parts.join(' • ');
  }, [success]);

  return (
    <>
      <PageHero
        title="نموذج التقديم"
        lead={
          <>
            أدخل بياناتك واختر القسم المناسب. الحقول المعلّمة بـ<span className="req">*</span>{' '}
            مطلوبة. سيظهر رقم طلب فريد بعد الإرسال، احتفظ به لمتابعة حالة الطلب.
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
                  <ol className="form-steps" aria-label="خطوات نموذج التقديم">
                    {STEP_LABELS.map((label, index) => {
                      const value = index + 1;
                      const className = `form-steps__item${
                        value === step ? ' is-active' : value < step ? ' is-complete' : ''
                      }`;
                      return (
                        <li
                          className={className}
                          key={label}
                          aria-current={value === step ? 'step' : undefined}
                        >
                          <span className="form-steps__num">{value}</span>
                          <span className="form-steps__label">{label}</span>
                        </li>
                      );
                    })}
                  </ol>

                  <fieldset className="form-step" data-step="1" hidden={step !== 1}>
                    <legend className="form-section-title">بيانات المتقدم</legend>
                    <div className="form-grid">
                      <div className="form-field">
                        <label className="form-label" htmlFor="full_name">
                          الاسم الكامل <span className="req" aria-hidden="true">*</span>
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
                        <label className="form-label" htmlFor="phone">
                          رقم الهاتف <span className="req" aria-hidden="true">*</span>
                        </label>
                        <input
                          className="input"
                          id="phone"
                          name="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          maxLength={20}
                          required
                          dir="ltr"
                          aria-invalid={errors.phone ? 'true' : undefined}
                          aria-describedby="hint-phone error-phone"
                          value={values.phone}
                          onChange={(event) => setField('phone', event.target.value)}
                          onBlur={() => validateOnBlur('phone')}
                        />
                        <p className="form-hint" id="hint-phone">
                          أدخل 7 إلى 15 رقمًا، ويمكن استخدام رمز الدولة.
                        </p>
                        <p className="field-error" id="error-phone">
                          {errors.phone || ''}
                        </p>
                      </div>

                      <div className="form-field form-field--full">
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
                    </div>
                  </fieldset>

                  <fieldset className="form-step" data-step="2" hidden={step !== 2}>
                    <legend className="form-section-title">اختيار القسم</legend>
                    <div className="form-grid">
                      <div className="form-field form-field--full">
                        <label className="form-label" htmlFor="department_id">
                          القسم المطلوب <span className="req" aria-hidden="true">*</span>
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
                            <option value="">جارٍ تحميل الأقسام…</option>
                          ) : null}
                          {!departmentsLoading && departmentsError ? (
                            <option value="">تعذّر تحميل الأقسام</option>
                          ) : null}
                          {!departmentsLoading && !departmentsError && !departments.length ? (
                            <option value="">لا توجد أقسام متاحة حاليًا</option>
                          ) : null}
                          {!departmentsLoading && !departmentsError && departments.length ? (
                            <>
                              <option value="">اختر القسم</option>
                              {departments.map((department) => (
                                <option value={String(department.id)} key={department.id}>
                                  {department.name}
                                </option>
                              ))}
                            </>
                          ) : null}
                        </select>
                        <p className="form-hint" id="hint-department">
                          تُعرض هنا الأقسام المنشورة والمتاحة للتقديم فقط.
                        </p>
                        <p className="field-error" id="error-department_id">
                          {errors.department_id || ''}
                        </p>
                      </div>

                      <div className="form-field form-field--full">
                        <label className="form-label" htmlFor="previous_education">
                          المؤهل أو المرحلة الدراسية السابقة{' '}
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

                  <fieldset className="form-step" data-step="3" hidden={step !== 3}>
                    <legend className="form-section-title">معلومات إضافية</legend>
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
                            أوافق على معالجة البيانات المقدمة لمراجعة طلب التقديم والتواصل معي
                            بخصوصه، وأفهم أن إرسال الطلب لا يعني القبول النهائي.
                          </span>
                        </label>
                        <p className="field-error" id="error-consent">
                          {errors.consent || ''}
                        </p>
                      </div>
                    </div>
                  </fieldset>

                  <div className="form-actions">
                    {step > 1 ? (
                      <button className="btn btn-outline" type="button" onClick={goPrev}>
                        السابق
                      </button>
                    ) : null}
                    {step < STEP_LABELS.length ? (
                      <button className="btn btn-primary" type="button" onClick={goNext}>
                        التالي
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={submitting || departmentsBlocked}
                      >
                        <span>{submitting ? 'جارٍ الإرسال…' : 'إرسال الطلب'}</span>
                      </button>
                    )}
                    {submitting ? (
                      <span className="loading-inline">
                        <span className="spinner spinner--dark" aria-hidden="true" />
                        جارٍ إرسال الطلب…
                      </span>
                    ) : null}
                    <Link className="btn btn-ghost" to="/departments">
                      تصفح الأقسام أولًا
                    </Link>
                  </div>
                </form>
              )}
            </div>

            <aside className="sticky-card">
              <h3>قبل إرسال الطلب</h3>
              <p>
                تأكد من صحة رقم الهاتف، فهو وسيلة التواصل الأساسية معك. يمكنك اختيار القسم المناسب
                من صفحة الأقسام والاطلاع على مهاراته أولًا.
              </p>

              <ul className="skill-list mt-2">
                <li>الحقول المعلّمة بـ * مطلوبة.</li>
                <li>يُمنع إرسال أكثر من طلب للقسم نفسه خلال 24 ساعة.</li>
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
