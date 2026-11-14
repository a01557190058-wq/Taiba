import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { formatDate, toParagraphs } from '../../lib/format.js';
import { useAsync } from '../../lib/hooks.js';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import { PageHero, SmartImage, StateBox } from '../../components/public/ui.jsx';
import Lightbox from '../../components/public/Lightbox.jsx';

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
    department ? `${department.name} | مدرسة طيبة تكنولوجي` : 'تفاصيل التخصص | مدرسة طيبة تكنولوجي',
    department?.short_description ||
      'تفاصيل التخصص التقني في مدرسة طيبة تكنولوجي: الوصف والمهارات ومعلومات التقديم.'
  );

  const photos = useMemo(
    () =>
      (Array.isArray(department?.images) ? department.images : []).map((image, index) => {
        const alt =
          image.alt || `صورة ${index + 1} من ${department?.name || 'التخصص'}`;
        return {
          id: image.id ?? `department-photo-${index}`,
          full: image.url,
          src: image.url,
          alt,
          caption: alt,
          sectionTitle: 'صور التخصص',
        };
      }),
    [department]
  );

  const [activePhoto, setActivePhoto] = useState(null);
  const closeLightbox = useCallback(() => setActivePhoto(null), []);
  const stepLightbox = useCallback(
    (delta) => {
      setActivePhoto((current) => {
        if (current === null || !photos.length) return current;
        return (current + delta + photos.length) % photos.length;
      });
    },
    [photos.length]
  );

  if (notFound) {
    return (
      <>
        <PageHero
          title="التخصص غير موجود"
          lead="قد يكون التخصص غير منشور حاليًا أو تم تغيير رابطه."
          breadcrumb={[
            { label: 'الرئيسية', href: '/' },
            { label: 'التخصصات', href: '/departments' },
            { label: 'تخصص غير متوفر' },
          ]}
        />
        <section className="section">
          <div className="container">
            <div className="card p-2">
              <StateBox
                title="لم نعثر على هذا التخصص"
                message={
                  error.message ||
                  'التخصص غير متوفر أو غير منشور حاليًا. يمكنك تصفح بقية التخصصات المتاحة.'
                }
                actionLabel="العودة إلى التخصصات"
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
        ['المهنة/التخصص', department.name],
        ['حالة القبول', 'متاح للتقديم'],
      ]
    : [];
  if (department?.updated_at) metaRows.push(['آخر تحديث', formatDate(department.updated_at)]);

  return (
    <>
      <PageHero
        title={department ? department.name : loading ? 'جارٍ تحميل التخصص…' : 'تعذّر تحميل التخصص'}
        lead={
          department
            ? department.short_description ||
              'تعرّف على وصف التخصص ومهاراته ومعلومات التقديم الخاصة به.'
            : loading
              ? 'يتم جلب بيانات التخصص من قاعدة بيانات المدرسة.'
              : 'حدث خطأ أثناء الاتصال بالخادم.'
        }
        breadcrumb={[
          { label: 'الرئيسية', href: '/' },
          { label: 'التخصصات', href: '/departments' },
          { label: department ? department.name : 'تفاصيل التخصص' },
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
                title="تعذّر تحميل بيانات التخصص"
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
                <span>جميع التخصصات</span>
              </Link>
              <div className="detail-layout">
                <div>
                  <div className="detail-media">
                    <SmartImage
                      src={department.image_url}
                      alt={`رسم توضيحي لتخصص ${department.name}`}
                      width="800"
                      height="500"
                      loading="eager"
                    />
                  </div>

                  <section className="detail-section">
                    <h2>عن التخصص</h2>
                    <Paragraphs
                      value={department.description}
                      fallback="لم يُضف وصف تفصيلي لهذا التخصص بعد."
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

                  {photos.length ? (
                    <section className="detail-section">
                      <h2>صور من التخصص</h2>
                      <div className="gallery-grid">
                        {photos.map((photo, index) => (
                          <button
                            className="gallery-tile reveal"
                            type="button"
                            key={photo.id}
                            data-delay={String(index % 3)}
                            onClick={() => setActivePhoto(index)}
                            aria-label={`عرض الصورة بحجم أكبر: ${photo.alt}`}
                          >
                            <img
                              src={photo.src}
                              alt={photo.alt}
                              width="800"
                              height="600"
                              loading="lazy"
                              decoding="async"
                            />
                            <span className="gallery-tile__overlay" aria-hidden="true">
                              <span className="gallery-tile__zoom">
                                <Icon name="search" size={18} />
                              </span>
                              <span className="gallery-tile__caption">{photo.caption}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <div className="callout mt-3">
                    <h2>ملاحظة عن البيانات</h2>
                    <p>
                      وصف هذا التخصص ومهاراته ومعلومات القبول قابلة للتحديث من لوحة التحكم، وتُعرض
                      هنا كنص عادي. تأكد من إدارة المدرسة قبل الاعتماد على أي تفاصيل.
                    </p>
                  </div>
                </div>

                <aside className="sticky-card">
                  <h3>هل هذا التخصص مناسب لك؟</h3>
                  <p>
                    يمكنك تسجيل طلبك مباشرة. إرسال الطلب لا يعني القبول النهائي، بل يبدأ مراجعة
                    إدارة المدرسة لبياناتك.
                  </p>
                  <Link
                    className="btn btn-primary"
                    to={`/apply?department=${encodeURIComponent(department.slug)}`}
                  >
                    التقديم على هذا التخصص
                    <Icon name="arrowLeft" size={16} />
                  </Link>
                  <Link className="btn btn-outline" to="/departments">
                    مقارنة مع التخصصات الأخرى
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

      {activePhoto !== null && photos[activePhoto] ? (
        <Lightbox
          images={photos}
          index={activePhoto}
          onClose={closeLightbox}
          onStep={stepLightbox}
          label="صور التخصص"
        />
      ) : null}
    </>
  );
}
