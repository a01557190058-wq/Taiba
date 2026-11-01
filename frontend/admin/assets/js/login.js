/**
 * Admin login. Real server-side authentication: bcrypt verification, a new
 * session id on success and an HttpOnly session cookie set by the server.
 */
import { api, ApiError, qs, setAlert, setButtonBusy } from './admin.js';

const form = qs('#login-form');
const alertBox = qs('#login-alert');
const submitButton = qs('#login-button');

function safeNext() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '';
  // Only allow internal admin paths; never redirect off-site.
  if (next.startsWith('/admin/') && !next.startsWith('/admin/login')) return next;
  return '/admin/dashboard';
}

function setFieldError(name, message) {
  const node = qs(`#error-${name}`);
  const field = qs(`#${name}`);
  if (node) node.textContent = message || '';
  if (field) {
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
}

function validate() {
  const identifier = qs('#identifier').value.trim();
  const password = qs('#password').value;
  let ok = true;

  if (!identifier) {
    setFieldError('identifier', 'البريد الإلكتروني أو اسم المستخدم مطلوب.');
    ok = false;
  } else if (identifier.length < 3) {
    setFieldError('identifier', 'المعرّف قصير جدًا.');
    ok = false;
  } else {
    setFieldError('identifier', '');
  }

  if (!password) {
    setFieldError('password', 'كلمة المرور مطلوبة.');
    ok = false;
  } else {
    setFieldError('password', '');
  }

  return ok;
}

async function onSubmit(event) {
  event.preventDefault();
  setAlert(alertBox, {});

  if (!validate()) {
    setAlert(alertBox, { type: 'error', message: 'يرجى تصحيح الحقول المطلوبة.' });
    return;
  }

  const body = {
    identifier: qs('#identifier').value.trim(),
    password: qs('#password').value,
  };

  setButtonBusy(submitButton, true, 'جارٍ التحقق…');
  try {
    await api('/api/auth/login', { method: 'POST', body });
    window.location.replace(safeNext());
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      setAlert(alertBox, {
        type: 'warning',
        message: error.message || 'عدد محاولات الدخول كبير. انتظر قليلًا ثم حاول مرة أخرى.',
      });
    } else if (error instanceof ApiError && error.status === 401) {
      setAlert(alertBox, { type: 'error', message: error.message || 'بيانات الدخول غير صحيحة.' });
      qs('#password').value = '';
      qs('#password').focus();
    } else {
      setAlert(alertBox, {
        type: 'error',
        message: error.message || 'تعذّر تسجيل الدخول. تحقق من الاتصال ثم حاول مرة أخرى.',
      });
    }
  } finally {
    setButtonBusy(submitButton, false);
  }
}

// Already signed in? Skip the login screen.
async function redirectIfAuthenticated() {
  try {
    await api('/api/auth/me');
    window.location.replace(safeNext());
  } catch {
    // Not signed in — expected on this page.
  }
}

if (form) {
  form.addEventListener('submit', onSubmit);
  for (const name of ['identifier', 'password']) {
    const field = qs(`#${name}`);
    if (field) {
      field.addEventListener('input', () => {
        if (field.getAttribute('aria-invalid') === 'true') setFieldError(name, '');
      });
    }
  }
}

redirectIfAuthenticated();
