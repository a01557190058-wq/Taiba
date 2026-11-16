import { useState } from 'react';
import { api, ApiError } from '../../lib/api.js';
import { Icon } from '../../lib/icons.jsx';
import { useAdminAuth } from '../../lib/admin-auth.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import { Alert, PageHead } from '../../components/admin/ui.jsx';
import { FormSection, PasswordField } from '../../components/admin/form.jsx';

const EMPTY = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

/** Client-side mirror of the API rules — the server validates again. */
function validate(values) {
  const errors = {};

  if (!values.current_password) {
    errors.current_password = 'كلمة المرور الحالية مطلوبة.';
  }

  if (!values.new_password) {
    errors.new_password = 'كلمة المرور الجديدة مطلوبة.';
  } else if (values.new_password.length < 8) {
    errors.new_password = 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.';
  } else if (values.new_password.length > 200) {
    errors.new_password = 'كلمة المرور الجديدة طويلة جدًا (200 حرف كحد أقصى).';
  } else if (values.new_password !== values.new_password.trim()) {
    errors.new_password = 'لا تبدأ أو تنتهي كلمة المرور بمسافة فارغة.';
  } else if (values.new_password === values.current_password) {
    errors.new_password = 'كلمة المرور الجديدة يجب أن تختلف عن الحالية.';
  }

  if (!values.confirm_password) {
    errors.confirm_password = 'تأكيد كلمة المرور مطلوب.';
  } else if (values.confirm_password !== values.new_password) {
    errors.confirm_password = 'تأكيد كلمة المرور غير مطابق.';
  }

  return errors;
}

export default function AccountPage() {
  const { admin } = useAdminAuth();
  const { toast } = useFeedback();

  const [values, setValues] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  const setField = (key) => (event) => {
    const value = event.target.value;
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

    setBusy(true);
    try {
      await api('/api/auth/password', {
        method: 'PATCH',
        body: {
          current_password: values.current_password,
          new_password: values.new_password,
          confirm_password: values.confirm_password,
        },
      });
      setValues({ ...EMPTY });
      setErrors({});
      setAlert({
        type: 'success',
        message:
          'تم تغيير كلمة المرور. استخدم الكلمة الجديدة في تسجيل الدخول القادم. إن أردت التأكد الآن، سجّل الخروج ثم ادخل بالكلمة الجديدة.',
      });
      toast('تم تغيير كلمة المرور بنجاح.');
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.fields) {
        setErrors((current) => ({ ...current, ...saveError.fields }));
      }
      setAlert({
        type: 'error',
        message:
          saveError.message || 'تعذّر تغيير كلمة المرور. تحقق من كلمة المرور الحالية ثم حاول مرة أخرى.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        title="الحساب وكلمة المرور"
        description="راجع بيانات حسابك الإداري وغيّر كلمة المرور في أي وقت. تبقى جلستك الحالية نشطة بعد التغيير."
      />

      <div className="panel">
        <div className="panel__body">
          <div className="chip-row">
            <span className="badge badge--neutral">
              <Icon name="users" size={14} /> {admin?.display_name || admin?.username || 'مدير'}
            </span>
            <span className="badge badge--neutral">{admin?.username}</span>
            <span className="badge badge--neutral">{admin?.email}</span>
          </div>
        </div>
      </div>

      <form className="mt-2" onSubmit={onSubmit} noValidate>
        <Alert type={alert?.type} message={alert?.message} />

        <div className="mt-2">
          <FormSection
            title="تغيير كلمة المرور"
            description="أدخل كلمة المرور الحالية ثم كلمة مرور جديدة قوية (8 أحرف على الأقل). سيتم تسجيل الخروج من أي جلسات أخرى مفتوحة لنفس الحساب."
          >
            <div className="form-grid">
              <PasswordField
                id="current_password"
                label="كلمة المرور الحالية"
                value={values.current_password}
                onChange={setField('current_password')}
                required
                autoComplete="current-password"
                maxLength={200}
                hint="اضغط أيقونة العين لعرض الكلمة والتأكد من كتابتها."
                error={errors.current_password}
                full
              />
              <PasswordField
                id="new_password"
                label="كلمة المرور الجديدة"
                value={values.new_password}
                onChange={setField('new_password')}
                required
                autoComplete="new-password"
                maxLength={200}
                hint="8 أحرف على الأقل، ويُفضّل أن تجمع بين حروف وأرقام ورموز. تُكتب من اليسار إلى اليمين."
                error={errors.new_password}
              />
              <PasswordField
                id="confirm_password"
                label="تأكيد كلمة المرور الجديدة"
                value={values.confirm_password}
                onChange={setField('confirm_password')}
                required
                autoComplete="new-password"
                maxLength={200}
                error={errors.confirm_password}
              />
            </div>
          </FormSection>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Icon name="shield" size={16} />
            <span>{busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</span>
          </button>
        </div>
      </form>
    </>
  );
}
