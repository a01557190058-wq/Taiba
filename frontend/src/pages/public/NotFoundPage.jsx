import { Link } from 'react-router-dom';
import { usePageMeta } from '../../lib/motion.jsx';

export default function NotFoundPage() {
  usePageMeta('الصفحة غير موجودة | مدرسة طيبة تكنولوجي', 'الصفحة المطلوبة غير موجودة.');

  return (
    <section className="section">
      <div className="container">
        <div className="card p-2 text-center">
          <p className="eyebrow">خطأ 404</p>
          <h1 className="section-title mt-2">لم نعثر على هذه الصفحة</h1>
          <p className="text-muted mt-2">
            قد يكون الرابط قديمًا أو تم تغييره. يمكنك العودة إلى الصفحة الرئيسية أو تصفح الأقسام
            المتاحة للتقديم.
          </p>
          <div className="inline-actions mt-3">
            <Link className="btn btn-primary" to="/">
              العودة إلى الرئيسية
            </Link>
            <Link className="btn btn-outline" to="/departments">
              تصفح الأقسام
            </Link>
            <Link className="btn btn-ghost" to="/apply">
              قدّم الآن
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
