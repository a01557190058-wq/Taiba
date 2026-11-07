import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { formatDate, toParagraphs } from '../../lib/format.js';
import { useAsync } from '../../lib/hooks.js';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import { PageHero, SmartImage, StateBox } from '../../components/public/ui.jsx';

function Paragraphs({ value, fallback }) {
  const paragraphs = toParagraphs(value);
  return (
    <div className="prose">
      {paragraphs.length ? (
        paragraphs.map((text, index) => <p key={`${index}-${text}`}>{text}</p>)
      ) : (
        <p>{fallback}</p>
      )}
    </div>
  );
}

export default function DepartmentPage() {
  const { slug } = useParams();
  const { data: department, loading, error, reload } = useAsync(
    () => api(`/api/departments/${encodeURIComponent(slug || '')}`),
    [slug]
  );

  const notFound = error && error.status === 404;
  usePageMeta(
    department ? `${department.name} | مدرسة طيبة تكنولوجي` : 'تفاصيل القسم | مدرسة طيبة تكنولوجي',
    department?.short_description ||
      'تفاصيل القسم التقني في مدرسة طيبة تكنولوجي: الوصف والمهارات ومعلومات التقديم.'
  );

  if (notFound) {
    return (
      <>
        <PageHero
          title="القسم غير موجود"
          lead="قد يكون القسم غير منشور حاليًا أو تم تغيير رابطه."
          breadcrumb={[
            { label: 'الرئيسية', href: '/' },
            { label: 'الأقسام', href: '/departments' },
            { label: 'قسم غير متوفر' },
          ]}
        />
        <section className="section">
          <div className="container">
            <div className="card p-2">
              <StateBox
                title="لم نعثر على هذا القسم"
                message={
                  error.message ||
                  'القسم غير متوفر أو غير منشور حاليًا. يمكنك تصفح بقية الأقسام المتاحة.'
                }
                actionLabel="العودة إلى الأقسام"
                onAction={() => {
                  window.location.href = '/departments';
                }}
                iconName="book"
              />
            </div>
          </div>
        </section>
      </>
    );
  }

  const metaRows = department
    ? [
        ['القسم', department.name],
        ['حالة القبول', 'متاح للتقديم'],
      ]
    : [];
  if (department?.updated_at) metaRows.push(['آخر تحديث', formatDate(department.updated_at)]);

  return (
    <>
      <PageHero
        title={department ? department.name : loading ? 'جارٍ تحميل القسم…' : 'تعذّر تحميل القسم'}
        lead={
          department
            ? department.short_description ||
              'تعرّف على وصف القسم ومهاراته ومعلومات التقديم الخاصة به.'
            : loading
              ? 'يتم جلب بيانات القسم من قاعدة بيانات المدرسة.'
              : 'حدث خطأ أثناء الاتصال بالخادم.'
        }
        breadcrumb={[
          { label: 'الرئيسية', href: '/' },
          { label: 'الأقسام', href: '/departments' },
          { label: department ? department.name : 'تفاصيل القسم' },
        ]}
      />

      <section className="section">
        <div className="container" aria-live="polite">
          {loading ? (
            <div className="detail-layout">
              <div>
                <div className="skeleton-line" />
                <div className="skeleton-line mt-2" />
                <div className="skeleton-line mt-2" />
              </div>
              <div className="skeleton-line" />
            </div>
          ) : null}

          {!loading && error ? (
            <div className="card p-2">
              <StateBox
                title="تعذّر تحميل بيانات القسم"
                message={error.message || 'تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.'}
                actionLabel="إعادة المحاولة"
                onAction={reload}
                iconName="alert"
              />
            </div>
          ) : null}

          {!loading && department ? (
            <>
              <Link className="detail-back" to="/departments">
                <Icon name="arrowLeft" size={16} />
                <span>جميع الأقسام</span>
              </Link>
              <div className="detail-layout">
                <div>
                  <div className="detail-media">
                    <SmartImage
                      src={department.image_url}
                      alt={`رسم توضيحي لقسم ${department.name}`}
                      width="800"
                      height="500"
                      loading="eager"
                    />
                  </div>

                  <section className="detail-section">
                    <h2>عن القسم</h2>
                    <Paragraphs
                      value={department.description}
                      fallback="لم يُضف وصف تفصيلي لهذا القسم بعد."
                    />
                  </section>

                  {department.educational_focus ? (
                    <section className="detail-section">
                      <h2>التركيز التعليمي</h2>
                      <Paragraphs value={department.educational_focus} fallback="" />
                    </section>
                  ) : null}

                  {Array.isArray(department.skills) && department.skills.length ? (
                    <section className="detail-section">
                      <h2>المهارات المستهدفة</h2>
                      <ul className="skill-list">
                        {department.skills.map((skill) => (
                          <li key={skill}>{skill}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {department.admission_info ? (
                    <section className="detail-section">
                      <h2>معلومات القبول</h2>
                      <Paragraphs value={department.admission_info} fallback="" />
                    </section>
                  ) : null}

                  <div className="callout mt-3">
                    <h2>ملاحظة عن البيانات</h2>
                    <p>
                      وصف هذا القسم ومهاراته ومعلومات القبول قابلة للتحديث من لوحة التحكم، وتُعرض
                      هنا كنص عادي. تأكد من إدارة المدرسة قبل الاعتماد على أي تفاصيل.
                    </p>
                  </div>
                </div>

                <aside className="sticky-card">
                  <h3>هل هذا القسم مناسب لك؟</h3>
                  <p>
                    يمكنك تسجيل طلبك مباشرة. إرسال الطلب لا يعني القبول النهائي، بل يبدأ مراجعة
                    إدارة المدرسة لبياناتك.
                  </p>
                  <Link
                    className="btn btn-primary"
                    to={`/apply?department=${encodeURIComponent(department.slug)}`}
                  >
                    التقديم على هذا القسم
                    <Icon name="arrowLeft" size={16} />
                  </Link>
                  <Link className="btn btn-outline" to="/departments">
                    مقارنة مع الأقسام الأخرى
                  </Link>
                  <dl className="meta-list">
                    {metaRows.map(([label, value]) => (
                      <div className="meta-list__row" key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </aside>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}
