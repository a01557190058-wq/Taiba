import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api.js';
import { useAdminAuth } from '../../lib/admin-auth.jsx';
import { Alert, Spinner } from '../../components/admin/ui.jsx';

/** Only internal admin paths are accepted as a post-login destination. */
function safeNext() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '';
  if (!next.startsWith('/admin/') || next.startsWith('/admin/login')) return '/admin/dashboard';
  if (next.includes('\\') || /[\u0000-\u001f]/.test(next)) return '/admin/dashboard';
  return next;
}

export default function LoginPage() {
  const { admin, loading, login } = useAdminAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  const identifierRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    if (!loading && admin) window.location.replace(safeNext());
  }, [admin, loading]);

  const validate = () => {
    const next = {};
    const trimmed = identifier.trim();
    if (!trimmed) next.identifier = 'البريد الإلكتروني أو اسم المستخدم مطلوب.';
    else if (trimmed.length < 3) next.identifier = 'المعرّف قصير جدًا.';
    if (!password) next.password = 'كلمة المرور مطلوبة.';
    return next;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setAlert(null);

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setAlert({ type: 'error', message: 'يرجى تصحيح الحقول المطلوبة.' });
      return;
    }

    setBusy(true);
    try {
      await login(identifier.trim(), password);
      window.location.replace(safeNext());
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setAlert({
          type: 'warning',
          message: error.message || 'عدد محاولات الدخول كبير. انتظر قليلًا ثم حاول مرة أخرى.',
        });
      } else if (error instanceof ApiError && error.status === 401) {
        setAlert({ type: 'error', message: error.message || 'بيانات الدخول غير صحيحة.' });
        setPassword('');
        if (passwordRef.current) passwordRef.current.focus();
      } else {
        setAlert({
          type: 'error',
          message: error.message || 'تعذّر تسجيل الدخول. تحقق من الاتصال ثم حاول مرة أخرى.',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <aside className="login-aside">
        <div className="login-aside__brand">
          <img src="/assets/img/logo.jpg" alt="" width="52" height="52" />
          <div>
            <strong>مدرسة طيبة تكنولوجي</strong>
            <span>Taiba Technology School</span>
          </div>
        </div>

        <div>
          <h1>لوحة تحكم الموقع التعليمي</h1>
          <p>
            مساحة إدارية محمية لإدارة الأقسام وطلبات التقديم ومحتوى الموقع. كل العمليات تُنفَّذ
            على الخادم مع التحقق من الجلسة والصلاحيات.
          </p>
        </div>

        <ul>
          <li>إدارة الأقسام: نشر، إلغاء نشر، وأرشفة دون فقدان الطلبات.</li>
          <li>متابعة طلبات التقديم وتغيير حالتها وإضافة ملاحظات داخلية.</li>
          <li>تحرير محتوى الصفحات والأسئلة الشائعة كنص آمن.</li>
          <li>التحكم في البيانات التجريبية مع الحفاظ على السجلات الحقيقية.</li>
        </ul>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <div className="login-card__head">
            <h2>تسجيل الدخول</h2>
            <p>أدخل بيانات حساب الإدارة للمتابعة. الجلسة محفوظة في كوكي آمنة على الخادم.</p>
          </div>

          <Alert type={alert?.type} message={alert?.message} />

          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="identifier">البريد الإلكتروني أو اسم المستخدم</label>
              <input
                ref={identifierRef}
                className="input"
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                dir="ltr"
                required
                value={identifier}
                aria-invalid={errors.identifier ? 'true' : undefined}
                aria-describedby="error-identifier"
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  if (errors.identifier) setErrors((current) => ({ ...current, identifier: '' }));
                }}
              />
              <p className="error-text" id="error-identifier">
                {errors.identifier || ''}
              </p>
            </div>

            <div className="field mt-2">
              <label htmlFor="password">كلمة المرور</label>
              <input
                ref={passwordRef}
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                required
                value={password}
                aria-invalid={errors.password ? 'true' : undefined}
                aria-describedby="error-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (errors.password) setErrors((current) => ({ ...current, password: '' }));
                }}
              />
              <p className="error-text" id="error-password">
                {errors.password || ''}
              </p>
            </div>

            <button className="btn btn-primary btn-block mt-3" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <Spinner />
                  <span>جارٍ التحقق…</span>
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>

          <p className="login-demo-note">
            لا توجد بيانات دخول افتراضية في النسخة الإنتاجية. يُنشأ حساب الإدارة عبر سكربت{' '}
            <span dir="ltr">npm run admin:init</span> في الخادم.
          </p>

          <div className="login-card__foot">
            <a href="/">العودة إلى الموقع</a>
            <span>نسخة تجريبية — بيانات العرض فقط</span>
          </div>
        </div>
      </main>
    </div>
  );
}
