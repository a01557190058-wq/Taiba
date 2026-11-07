import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, request } from '../../lib/api.js';
import { useDebounced } from '../../lib/hooks.js';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import {
  NewsCard,
  PageHero,
  SkeletonGrid,
  StateBox,
} from '../../components/public/ui.jsx';

const PAGE_SIZE = 9;

export default function NewsPage() {
  usePageMeta(
    'أخبار المدرسة | مدرسة طيبة تكنولوجي',
    'آخر أخبار مدرسة طيبة تكنولوجي: الأنشطة، الورش، المشروعات الطلابية والإعلانات الداخلية. جميع الأخبار المعروضة تجريبية لأغراض العرض.'
  );

  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const debouncedQuery = useDebounced(query, 280);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, hasNext: false, categories: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const tokenRef = useRef(0);

  const fetchPage = useCallback(
    async (pageNumber, { replace }) => {
      const token = ++tokenRef.current;
      if (replace) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams({
        page: String(pageNumber),
        limit: String(PAGE_SIZE),
      });
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (category) params.set('category', category);

      try {
        const payload = await request(`/api/news?${params.toString()}`);
        if (token !== tokenRef.current) return;

        const nextItems = Array.isArray(payload.data) ? payload.data : [];
        const nextMeta = payload.meta || {};
        setItems((current) => (replace ? nextItems : [...current, ...nextItems]));
        setMeta({
          total: Number.isFinite(nextMeta.total) ? nextMeta.total : nextItems.length,
          hasNext: Boolean(nextMeta.hasNext),
          categories: Array.isArray(nextMeta.categories) ? nextMeta.categories : [],
        });
        setPage(pageNumber);
      } catch (loadError) {
        if (token !== tokenRef.current) return;
        if (loadError instanceof ApiError || loadError instanceof Error) {
          setError(loadError);
          if (replace) setItems([]);
        }
      } finally {
        if (token === tokenRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedQuery, category]
  );

  useEffect(() => {
    fetchPage(1, { replace: true });
  }, [fetchPage]);

  const resetFilters = () => {
    setQuery('');
    setCategory('');
  };

  const categories = Array.isArray(meta.categories) ? meta.categories : [];
  const hasFilters = Boolean(query || category);
  const countLabel = loading
    ? 'جارٍ تحميل الأخبار…'
    : error
      ? 'تعذّر تحميل الأخبار'
      : !meta.total
        ? hasFilters
          ? 'لا توجد أخبار مطابقة'
          : 'لا توجد أخبار منشورة'
        : `${new Intl.NumberFormat('ar-EG').format(meta.total)} ${
            meta.total === 1 ? 'خبر' : 'أخبار'
          } متاحة`;

  return (
    <>
      <PageHero
        className="page-hero--news"
        eyebrow="مركز الأخبار"
        title="أخبار المدرسة"
        lead="تابع أنشطة الأقسام، والورش العملية، والمشروعات الطلابية، والإعلانات الداخلية. تُدار الأخبار بالكامل من لوحة التحكم، وتظهر هنا بعد نشرها فقط."
        breadcrumb={[{ label: 'الرئيسية', href: '/' }, { label: 'الأخبار' }]}
      />

      <section className="section section--news">
        <div className="container">
          <div className="news-toolbar">
            <div className="search-field">
              <Icon name="search" size={18} />
              <label className="visually-hidden" htmlFor="news-search">
                ابحث في الأخبار
              </label>
              <input
                className="input"
                id="news-search"
                type="search"
                placeholder="ابحث بعنوان الخبر أو كلمة داخله…"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <p className="result-count" aria-live="polite">
              {countLabel}
            </p>
          </div>

          <div className="news-filters" aria-label="تصفية الأخبار حسب التصنيف">
            <button
              type="button"
              className={`news-filter${category === '' ? ' is-active' : ''}`}
              aria-pressed={category === ''}
              onClick={() => setCategory('')}
            >
              الكل
            </button>
            {categories.map((item) => (
              <button
                type="button"
                className={`news-filter${category === item.name ? ' is-active' : ''}`}
                aria-pressed={category === item.name}
                key={item.name}
                onClick={() => setCategory(item.name)}
              >
                {`${item.name} (${item.count})`}
              </button>
            ))}
          </div>

          <div className="news-grid" aria-live="polite">
            {loading ? <SkeletonGrid count={3} /> : null}
            {!loading && error ? (
              <StateBox
                title="تعذّر تحميل الأخبار"
                message={error.message || 'تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.'}
                actionLabel="إعادة المحاولة"
                onAction={() => fetchPage(1, { replace: true })}
                iconName="alert"
              />
            ) : null}
            {!loading && !error && !items.length ? (
              <StateBox
                title="لا توجد أخبار مطابقة"
                message="جرّب تعديل كلمة البحث أو اختيار تصنيف آخر. تُدار الأخبار من لوحة التحكم وتظهر هنا بعد نشرها فقط."
                actionLabel="إعادة تعيين الفلاتر"
                onAction={resetFilters}
                iconName="inbox"
              />
            ) : null}
            {!loading && !error
              ? items.map((article, index) => (
                  <NewsCard article={article} index={index} key={article.id} />
                ))
              : null}
          </div>

          <div className="news-more">
            {meta.hasNext ? (
              <button
                type="button"
                className="btn btn-outline btn-lg"
                onClick={() => fetchPage(page + 1, { replace: false })}
                disabled={loadingMore}
              >
                {loadingMore ? 'جارٍ التحميل…' : 'تحميل المزيد من الأخبار'}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="container">
          <div className="cta-band reveal">
            <div>
              <h2>هل لديك خبر أو نشاط تريد مشاركته؟</h2>
              <p>
                تُضاف الأخبار وتُعدَّل وتُحذف من لوحة التحكم. يمكن لإدارة المدرسة نشر خبر جديد أو
                إبقاؤه مسودة حتى تكتمل مراجعته.
              </p>
            </div>
            <div className="cta-band__actions">
              <a className="btn btn-primary btn-lg" href="/admin/news">
                إدارة الأخبار
              </a>
              <Link className="btn btn-outline btn-lg" to="/apply">
                قدّم الآن
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
