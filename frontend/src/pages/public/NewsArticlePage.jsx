import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { formatDate, toParagraphs } from '../../lib/format.js';
import { useAsync } from '../../lib/hooks.js';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import {
  NewsCard,
  PageHero,
  SectionHead,
  SmartImage,
  StateBox,
} from '../../components/public/ui.jsx';

function ArticleGallery({ images }) {
  if (!images.length) return null;
  return (
    <section className="article-gallery" aria-label="معرض صور الخبر">
      <h2 className="article-section-title">معرض الصور</h2>
      <div className="article-gallery__grid">
        {images.map((item, index) => (
          <figure className="article-gallery__item" key={`${item.url}-${index}`}>
            <a
              className="article-gallery__link"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <SmartImage
                src={item.url}
                alt={item.caption || `صورة ${index + 1} من معرض الخبر`}
                loading="lazy"
              />
            </a>
            {item.caption ? <figcaption>{item.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </section>
  );
}

function ArticleVideos({ videos }) {
  if (!videos.length) return null;
  return (
    <section className="article-videos" aria-label="فيديوهات الخبر">
      <h2 className="article-section-title">فيديوهات الخبر</h2>
      <div className="article-videos__list">
        {videos.map((item, index) => (
          <figure className="article-video" key={`${item.url}-${index}`}>
            <div className="article-video__frame">
              {['youtube', 'vimeo'].includes(item.provider) && item.embed_url ? (
                <iframe
                  src={item.embed_url}
                  title={item.caption || `فيديو ${index + 1} من الخبر`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <video
                  className="article-video__player"
                  src={item.url}
                  controls
                  preload="metadata"
                  playsInline
                />
              )}
            </div>
            {item.caption ? <figcaption>{item.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function NewsArticlePage() {
  const { slug } = useParams();
  const { data: article, loading, error, reload } = useAsync(
    () => api(`/api/news/${encodeURIComponent(slug || '')}`),
    [slug]
  );

  const notFound = error && error.status === 404;
  usePageMeta(
    article ? `${article.title} | مدرسة طيبة تكنولوجي` : 'خبر | مدرسة طيبة تكنولوجي',
    article?.summary || 'تفاصيل الخبر في مدرسة طيبة تكنولوجي. جميع الأخبار المعروضة تجريبية لأغراض العرض.'
  );

  if (notFound) {
    return (
      <>
        <PageHero
          className="page-hero--news"
          title="الخبر غير موجود"
          lead="قد يكون الخبر غير منشور حاليًا أو تم تغيير رابطه."
          breadcrumb={[
            { label: 'الرئيسية', href: '/' },
            { label: 'الأخبار', href: '/news' },
            { label: 'خبر غير متوفر' },
          ]}
        />
        <section className="section">
          <div className="container">
            <div className="card p-2">
              <StateBox
                title="لم نعثر على هذا الخبر"
                message={
                  error.message ||
                  'الخبر غير متوفر أو غير منشور حاليًا. يمكنك تصفح بقية الأخبار المتاحة.'
                }
                actionLabel="العودة إلى الأخبار"
                onAction={() => {
                  window.location.href = '/news';
                }}
                iconName="inbox"
              />
            </div>
          </div>
        </section>
      </>
    );
  }

  const mediaItems = Array.isArray(article?.media) ? article.media : [];
  const coverUrl = article?.image_url || '';
  const galleryImages = mediaItems.filter((item) => item.type === 'image' && item.url !== coverUrl);
  const videos = mediaItems.filter((item) => item.type === 'video');
  const related = Array.isArray(article?.related) ? article.related : [];
  const paragraphs = toParagraphs(article?.body);

  return (
    <>
      <PageHero
        className="page-hero--news"
        eyebrow={article?.category || undefined}
        title={article ? article.title : loading ? 'جارٍ تحميل الخبر…' : 'تعذّر تحميل الخبر'}
        lead={
          article
            ? article.summary || ''
            : loading
              ? 'يتم جلب نص الخبر من قاعدة بيانات المدرسة.'
              : 'حدث خطأ أثناء الاتصال بالخادم.'
        }
        breadcrumb={[
          { label: 'الرئيسية', href: '/' },
          { label: 'الأخبار', href: '/news' },
          { label: article ? article.title : 'تفاصيل الخبر' },
        ]}
      >
        {article ? (
          <div className="article-meta">
            {article.category ? (
              <span className="article-meta__pill">{article.category}</span>
            ) : null}
            {article.published_at ? (
              <span className="article-meta__item">
                <Icon name="clock" size={16} />
                <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
              </span>
            ) : null}
            {article.is_featured ? (
              <span className="article-meta__pill article-meta__pill--gold">خبر مميز</span>
            ) : null}
          </div>
        ) : null}
      </PageHero>

      <section className="section">
        <div className="container">
          <Link className="detail-back" to="/news">
            <Icon name="arrowLeft" size={16} />
            <span>جميع الأخبار</span>
          </Link>

          <div className="detail-layout article-layout">
            <div aria-live="polite">
              {loading ? (
                <>
                  <div className="skeleton-line" />
                  <div className="skeleton-line mt-2" />
                  <div className="skeleton-line mt-2" />
                </>
              ) : null}

              {!loading && error ? (
                <div className="card p-2">
                  <StateBox
                    title="تعذّر تحميل الخبر"
                    message={error.message || 'تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.'}
                    actionLabel="إعادة المحاولة"
                    onAction={reload}
                    iconName="alert"
                  />
                </div>
              ) : null}

              {!loading && article ? (
                <>
                  <div className="article-media">
                    <SmartImage
                      src={article.image_url}
                      alt={`رسم توضيحي لخبر ${article.title}`}
                      width="960"
                      height="540"
                      loading="eager"
                    />
                  </div>
                  <div className="prose article-prose">
                    {paragraphs.length ? (
                      paragraphs.map((text, index) => <p key={`${index}-${text}`}>{text}</p>)
                    ) : (
                      <p>لم يُضف نص تفصيلي لهذا الخبر بعد.</p>
                    )}
                  </div>
                  <ArticleGallery images={galleryImages} />
                  <ArticleVideos videos={videos} />
                </>
              ) : null}
            </div>

            {article ? (
              <aside className="sticky-card article-aside">
                <h2 className="article-aside__title">عن هذا الخبر</h2>
                <p>
                  يُعرض نص الخبر كما نُشر من لوحة التحكم. تُحدَّث الأخبار وتُنشر وتُحذف بالكامل من
                  هناك.
                </p>
                <Link className="btn btn-primary" to="/news">
                  العودة إلى جميع الأخبار
                </Link>
                <dl className="meta-list">
                  <div className="meta-list__row">
                    <dt>التصنيف</dt>
                    <dd>{article.category || 'غير مصنّف'}</dd>
                  </div>
                  {article.published_at ? (
                    <div className="meta-list__row">
                      <dt>تاريخ النشر</dt>
                      <dd>{formatDate(article.published_at)}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="callout article-aside__note">
                  <h3>ملاحظة</h3>
                  <p>
                    جميع الأخبار والمواعيد والأسماء المعروضة في هذه النسخة تجريبية لأغراض العرض
                    فقط، ولا تمثل إعلانات رسمية.
                  </p>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </section>

      {related.length ? (
        <section className="section section--soft">
          <div className="container">
            <SectionHead eyebrow="اقرأ أيضًا" title="أخبار ذات صلة" />
            <div className="news-grid">
              {related.map((item, index) => (
                <NewsCard article={item} index={index} key={item.id} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
