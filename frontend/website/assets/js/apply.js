/**
 * Public application form.
 * - Departments are loaded dynamically (only published + active ones).
 * - Client-side validation mirrors the server rules, but the server remains
 *   the source of truth (field errors are rendered from API responses).
 * - Success shows the unique reference number; it never claims acceptance.
 */
import { api, ApiError } from './api.js';
import { qs, el, setAlert } from './ui.js';

const form = qs('#application-form');
const alertBox = qs('#form-alert');
const submitButton = qs('#submit-button');
const submitLabel = qs('#submit-label');
const submitSpinner = qs('#submit-spinner');
const successPanel = qs('#success-panel');
const departmentSelect = qs('#department_id');
const referenceValue = qs('#reference-value');
const successSummary = qs('#success-summary');
const copyButton = qs('#copy-reference');

const ARABIC_DIGITS = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

function normalizePhone(value) {
  return String(value || '')
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] || digit)
    .replace(/[\s\-().]/g, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}\p{M}\s'.-]+$/u;

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
    if (String(value || '').trim().length > 150) return 'المؤهل أو المرحلة السابقة طويل جدًا (150 حرفًا كحد أقصى).';
    return '';
  },
  additional_notes(value) {
    if (String(value || '').trim().length > 1000) return 'الملاحظات الإضافية طويلة جدًا (1000 حرف كحد أقصى).';
    return '';
  },
  consent(value, field) {
    if (!field.checked) return 'يجب الموافقة على معالجة البيانات قبل الإرسال.';
    return '';
  },
};

function getField(name) {
  return form.elements.namedItem(name);
}

function setFieldError(name, message) {
  const errorNode = qs(`#error-${name}`);
  const field = getField(name);
  if (errorNode) errorNode.textContent = message || '';
  if (field) {
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
}

function validateField(name) {
  const field = getField(name);
  if (!field) return '';
  const message = validators[name] ? validators[name](field.value, field) : '';
  setFieldError(name, message);
  return message;
}

function validateAll() {
  const names = Object.keys(validators);
  const errors = [];
  for (const name of names) {
    const message = validateField(name);
    if (message) errors.push({ name, message });
  }
  return errors;
}

function setBusy(isBusy) {
  if (submitButton) submitButton.disabled = isBusy;
  if (submitSpinner) submitSpinner.hidden = !isBusy;
  if (submitLabel) submitLabel.textContent = isBusy ? 'جارٍ الإرسال…' : 'إرسال الطلب';
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
function preselectDepartment() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('department');
  if (!slug || !departmentSelect) return;

  const match = Array.from(departmentSelect.options).find(
    (option) => option.dataset.slug === slug
  );
  if (match) departmentSelect.value = match.value;
}

async function loadDepartments() {
  if (!departmentSelect) return;

  try {
    const items = await api('/api/departments');
    const departments = Array.isArray(items) ? items : [];

    if (!departments.length) {
      departmentSelect.replaceChildren(el('option', { text: 'لا توجد أقسام متاحة حاليًا', attrs: { value: '' } }));
      departmentSelect.disabled = true;
      if (submitButton) submitButton.disabled = true;
      setAlert(alertBox, {
        type: 'info',
        message: 'لا توجد أقسام منشورة حاليًا، لذا لا يمكن إرسال طلب جديد الآن. يرجى العودة لاحقًا.',
      });
      return;
    }

    departmentSelect.replaceChildren(
      el('option', { text: 'اختر القسم', attrs: { value: '' } }),
      ...departments.map((department) =>
        el('option', {
          text: department.name,
          attrs: { value: String(department.id), 'data-slug': department.slug },
        })
      )
    );
    departmentSelect.disabled = false;
    preselectDepartment();
  } catch (error) {
    departmentSelect.replaceChildren(el('option', { text: 'تعذّر تحميل الأقسام', attrs: { value: '' } }));
    departmentSelect.disabled = true;
    if (submitButton) submitButton.disabled = true;
    setAlert(alertBox, {
      type: 'error',
      message: error.message || 'تعذّر تحميل قائمة الأقسام. أعد تحميل الصفحة ثم حاول مرة أخرى.',
    });
  }
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------
function showSuccess(data) {
  form.hidden = true;
  if (alertBox) alertBox.hidden = true;
  successPanel.hidden = false;

  if (referenceValue) referenceValue.textContent = data.reference_number || '—';
  if (successSummary) {
    const parts = [];
    if (data.department_name) parts.push(`القسم: ${data.department_name}`);
    if (data.full_name) parts.push(`المتقدم: ${data.full_name}`);
    successSummary.textContent = parts.join(' • ');
  }

  successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (copyButton) copyButton.focus({ preventScroll: true });
}

function applyServerFieldErrors(fields) {
  if (!fields || typeof fields !== 'object') return;
  for (const [name, message] of Object.entries(fields)) {
    if (typeof message === 'string' && getField(name)) setFieldError(name, message);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  setAlert(alertBox, {});

  const errors = validateAll();
  if (errors.length) {
    const first = getField(errors[0].name);
    if (first && typeof first.focus === 'function') first.focus();
    setAlert(alertBox, {
      type: 'error',
      message: 'يرجى تصحيح الحقول المعلّمة قبل إرسال الطلب.',
    });
    return;
  }

  const payload = {
    full_name: getField('full_name').value.trim(),
    phone: normalizePhone(getField('phone').value),
    email: getField('email').value.trim(),
    department_id: Number(getField('department_id').value),
    previous_education: getField('previous_education').value.trim(),
    additional_notes: getField('additional_notes').value.trim(),
    consent: getField('consent').checked,
  };

  setBusy(true);
  try {
    const data = await api('/api/applications', { method: 'POST', body: payload });
    showSuccess(data);
  } catch (error) {
    if (error instanceof ApiError) {
      applyServerFieldErrors(error.fields);
      if (error.code === 'DUPLICATE_APPLICATION') {
        setAlert(alertBox, { type: 'warning', message: error.message });
      } else {
        setAlert(alertBox, { type: 'error', message: error.message });
      }
    } else {
      setAlert(alertBox, {
        type: 'error',
        message: 'تعذّر إرسال الطلب. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.',
      });
    }
    if (alertBox) alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------------------------
// Wire up
// ---------------------------------------------------------------------------
if (form) {
  form.addEventListener('submit', handleSubmit);

  const names = Object.keys(validators);
  for (const name of names) {
    const field = getField(name);
    if (!field) continue;
    field.addEventListener('blur', () => validateField(name));
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') validateField(name);
    });
    if (field.type === 'checkbox') {
      field.addEventListener('change', () => validateField(name));
    }
  }
}

if (copyButton) {
  copyButton.addEventListener('click', async () => {
    const value = referenceValue ? referenceValue.textContent : '';
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      copyButton.textContent = 'تم النسخ';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(referenceValue);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copyButton.textContent = 'حدّد الرقم وانسخه';
    }
    window.setTimeout(() => {
      copyButton.textContent = 'نسخ الرقم';
    }, 2200);
  });
}

loadDepartments();
