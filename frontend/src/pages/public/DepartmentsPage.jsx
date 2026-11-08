import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { normalizeArabic } from '../../lib/format.js';
import { useAsync } from '../../lib/hooks.js';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import {
  DepartmentCard,
  PageHero,
  SkeletonGrid,
  StateBox,
} from '../../components/public/ui.jsx';

function matches(department, query) {
  if (!query) return true;
  const haystack = normalizeArabic(department.name || '');
  return query.split(' ').every((word) => haystack.includes(word));
}

export default function DepartmentsPage() {
  usePageMeta(
    'الأقسام التقنية | مدرسة طيبة تكنولوجي',
    'استكشف الأقسام التقنية في مدرسة طيبة تكنولوجي: البرمجة، الذكاء الاصطناعي، الأجهزة الطبية، الكهرباء، الميكانيكا، الطاقة المتجددة وغيرها.'
  );

  const { data, loading, error, reload } = useAsync(() => api('/api/departments'), []);
  const [search, setSearch] = useState('');
  const departments = Array.isArray(data) ? data : [];

  const visible = useMemo(() => {
    const query = normalizeArabic(search);
    return departments.filter((department) => matches(department, query));
  }, [departments, search]);

  const countLabel = loading
    ? 'جارٍ تحميل الأقسام…'
    : error
      ? 'تعذّر تحميل الأقسام'
      : !departments.length
        ? 'لا توجد أقسام منشورة'
        : null;

  return (
    <>
      <PageHero
        title="الأقسام التقنية"
        lead="عشرة مسارات تعليمية تغطي البرمجة والذكاء الاصطناعي والهندسة والتقنيات الصناعية والطاقة. كل قسم يعرض وصفه ومهاراته ومعلومات التقديم الخاصة به."
        breadcrumb={[{ label: 'الرئيسية', href: '/' }, { label: 'الأقسام' }]}
      />

      <section className="section">
        <div className="container">
          <div className="toolbar">
            <div className="search-field">
              <Icon name="search" size={18} />
              <label className="visually-hidden" htmlFor="department-search">
                ابحث في الأقسام
              </label>
              <input
                className="input"
                id="department-search"
                type="search"
                placeholder="ابحث باسم القسم…"
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <p className="result-count" aria-live="polite">
              {countLabel || (
                <>
                  <strong>{new Intl.NumberFormat('ar-EG').format(visible.length)}</strong>
                  {` من ${new Intl.NumberFormat('ar-EG').format(departments.length)} قسم`}
                </>
              )}
            </p>
          </div>

          <div className="department-grid" aria-live="polite">
            {loading ? <SkeletonGrid count={6} /> : null}
            {!loading && error ? (
              <StateBox
                title="تعذّر تحميل الأقسام"
                message={
                  error.message || 'حدث خطأ أثناء الاتصال بالخادم. تحقق من اتصالك ثم حاول مرة أخرى.'
                }
                actionLabel="إعادة المحاولة"
                onAction={reload}
                iconName="alert"
              />
            ) : null}
            {!loading && !error && !departments.length ? (
              <StateBox
                title="لا توجد أقسام منشورة حاليًا"
                message="تقوم إدارة المدرسة بتحديث الأقسام. يمكنك العودة لاحقًا أو التواصل معنا للاستفسار."
                actionLabel="إعادة المحاولة"
                onAction={reload}
                iconName="book"
              />
            ) : null}
            {!loading && !error && departments.length && !visible.length ? (
              <StateBox
                title="لا توجد نتائج مطابقة"
                message="جرّب كتابة اسم قسم آخر، أو امسح البحث لعرض جميع الأقسام."
                actionLabel="مسح البحث"
                onAction={() => setSearch('')}
                iconName="search"
              />
            ) : null}
            {!loading && !error
              ? visible.map((department, index) => (
                  <DepartmentCard department={department} index={index} key={department.id} />
                ))
              : null}
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="container">
          <div className="contact-card reveal">
            <div className="contact-card__main">
              <span className="eyebrow">لم تجد ما تبحث عنه؟</span>
              <h2 className="section-title mt-1 mb-2">اطّلع على معلومات القبول قبل اختيار القسم</h2>
              <p className="text-muted">
                تحتوي صفحة القبول على خطوات التقديم والمواعيد التجريبية والأسئلة الشائعة. يمكنك
                أيضًا التواصل مع إدارة المدرسة للاستفسار عن أي قسم.
              </p>
              <div className="hero__actions">
                <Link className="btn btn-primary" to="/apply">
                  قدّم الآن
                </Link>
                <Link className="btn btn-outline" to="/admission">
                  معلومات القبول
                </Link>
              </div>
            </div>
            <div className="contact-card__aside">
              <div>
                <h3>ملاحظة</h3>
                <p>
                  الأقسام المعروضة هنا منشورة من لوحة التحكم، وأي قسم غير منشور لا يظهر للزوار ولا
                  يقبل طلبات جديدة.
                </p>
              </div>
              <Link className="btn btn-primary w-full" to="/admission#notice">
                تنبيه البيانات التجريبية
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
