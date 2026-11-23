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
    'التخصصات التقنية | مجمع طيبة تكنولوجي',
    'استكشف التخصصات التقنية في مجمع طيبة تكنولوجي: خراطة المعادن، لحام المعادن، التبريد والتكييف، شبكات الحاسب، المخارط والفرايز CNC، والإلكترونيات الصناعية وغيرها.'
  );

  const { data, loading, error, reload } = useAsync(() => api('/api/departments'), []);
  const [search, setSearch] = useState('');
  const departments = Array.isArray(data) ? data : [];

  const visible = useMemo(() => {
    const query = normalizeArabic(search);
    return departments.filter((department) => matches(department, query));
  }, [departments, search]);

  const countLabel = loading
    ? 'جارٍ تحميل التخصصات…'
    : error
      ? 'تعذّر تحميل التخصصات'
      : !departments.length
        ? 'لا توجد تخصصات منشورة'
        : null;

  const numberFormat = new Intl.NumberFormat('ar-EG');
  const examples = departments.slice(0, 3).map((department) => department.name).join('، ');
  const heroLead = loading
    ? 'استكشف المسارات التقنية العملية التي يقدمها مجمع طيبة تكنولوجي.'
    : departments.length
      ? `${numberFormat.format(departments.length)} تخصصًا تقنيًا تغطي مجالات مثل ${examples} وغيرها. كل تخصص يعرض وصفه ومهاراته ومعلومات التقديم الخاصة به.`
      : 'لا توجد تخصصات منشورة حاليًا. يُرجى المتابعة لاحقًا.';

  return (
    <>
      <PageHero
        title="التخصصات التقنية"
        lead={heroLead}
        breadcrumb={[{ label: 'الرئيسية', href: '/' }, { label: 'التخصصات' }]}
      />

      <section className="section" data-cinematic-reveal>
        <div className="container">
          <div className="toolbar">
            <div className="search-field">
              <Icon name="search" size={18} />
              <label className="visually-hidden" htmlFor="department-search">
                ابحث في التخصصات
              </label>
              <input
                className="input"
                id="department-search"
                type="search"
                placeholder="ابحث باسم التخصص…"
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <p className="result-count" aria-live="polite">
              {countLabel || (
                <>
                  <strong>{new Intl.NumberFormat('ar-EG').format(visible.length)}</strong>
                  {` من ${new Intl.NumberFormat('ar-EG').format(departments.length)} تخصص`}
                </>
              )}
            </p>
          </div>

          <div className="department-grid" aria-live="polite">
            {loading ? <SkeletonGrid count={6} /> : null}
            {!loading && error ? (
              <StateBox
                title="تعذّر تحميل التخصصات"
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
                title="لا توجد تخصصات منشورة حاليًا"
                message="تقوم إدارة المجمع بتحديث التخصصات. يمكنك العودة لاحقًا أو التواصل معنا للاستفسار."
                actionLabel="إعادة المحاولة"
                onAction={reload}
                iconName="book"
              />
            ) : null}
            {!loading && !error && departments.length && !visible.length ? (
              <StateBox
                title="لا توجد نتائج مطابقة"
                message="جرّب كتابة اسم تخصص آخر، أو امسح البحث لعرض جميع التخصصات."
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

      <section className="section section--soft" data-cinematic-reveal>
        <div className="container">
          <div className="contact-card reveal">
            <div className="contact-card__main">
              <span className="eyebrow">لم تجد ما تبحث عنه؟</span>
              <h2 className="section-title mt-1 mb-2">اطّلع على معلومات القبول قبل اختيار التخصص</h2>
              <p className="text-muted">
                تحتوي صفحة القبول على خطوات التقديم والمواعيد التجريبية والأسئلة الشائعة. يمكنك
                أيضًا التواصل مع إدارة المجمع للاستفسار عن أي تخصص.
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
                  التخصصات المعروضة هنا منشورة من لوحة التحكم، وأي تخصص غير منشور لا يظهر للزوار ولا
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
