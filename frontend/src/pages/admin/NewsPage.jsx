import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, request } from '../../lib/api.js';
import { useAsync, useDebounced } from '../../lib/hooks.js';
import { formatDate } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  DemoBadge,
  EmptyState,
  NewsStateBadge,
  PageHead,
  PageSkeleton,
  Pagination,
} from '../../components/admin/ui.jsx';

export default function NewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();

  const filters = useMemo(() => {
    const state = searchParams.get('state');
    const demo = searchParams.get('is_demo');
    return {
      q: searchParams.get('q') || '',
      state: ['all', 'published', 'draft', 'featured'].includes(state) ? state : 'all',
      demo: ['all', 'true', 'false'].includes(demo) ? demo : 'all',
      page: Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1),
    };
  }, [searchParams]);

  const [search, setSearch] = useState(filters.q);
  useEffect(() => setSearch(filters.q), [filters.q]);
  const debouncedSearch = useDebounced(search, 420);

  const updateParams = useCallback(
    (patch) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (
              value === undefined ||
              value === null ||
              value === '' ||
              value === 'all' ||
              value === 1 ||
              value === '1'
            ) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed !== filters.q) updateParams({ q: trimmed, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const listKey = searchParams.toString();
  const { data, loading, error, reload } = useAsync(async () => {
    const query = new URLSearchParams({ page: String(filters.page), limit: '20' });
    if (filters.q) query.set('q', filters.q);
    if (filters.state !== 'all') query.set('state', filters.state);
    if (filters.demo !== 'all') query.set('is_demo', filters.demo);
    return request(`/api/admin/news?${query.toString()}`);
  }, [listKey]);

  const items = data && Array.isArray(data.data) ? data.data : [];
  const meta = data && data.meta ? data.meta : { total: 0, page: 1, limit: 20, totalPages: 1 };

  const hasFilters = Boolean(filters.q) || filters.state !== 'all' || filters.demo !== 'all';

  const patchNews = async (item, payload, successMessage) => {
    try {
      await api(`/api/admin/news/${item.id}`, { method: 'PATCH', body: payload });
      toast(successMessage);
      reload();
    } catch (patchError) {
      toast(patchError.message || 'تعذّر تحديث الخبر.', 'error');
    }
  };

  const deleteNews = async (item) => {
    const confirmed = await confirm({
      title: 'حذف الخبر نهائيًا',
      message: `سيتم حذف «${item.title}» نهائيًا من قاعدة البيانات وإخفاؤه من الموقع. لا يمكن التراجع.`,
      confirmLabel: 'حذف نهائي',
      danger: true,
      requireText: item.title,
    });
    if (!confirmed) return;

    try {
      await api(`/api/admin/news/${item.id}`, { method: 'DELETE' });
      toast('تم حذف الخبر.');
      if (filters.page > 1) updateParams({ page: filters.page - 1 });
      else reload();
    } catch (deleteError) {
      toast(deleteError.message || 'تعذّر حذف الخبر.', 'error');
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    updateParams({ q: search.trim(), page: 1 });
  };

  const clearFilters = () => {
    setSearch('');
    updateParams({ q: '', state: 'all', is_demo: 'all', page: 1 });
  };

  if (loading && !data) return <PageSkeleton />;

  if (error) {
    return (
      <>
        <PageHead title="إدارة الأخبار" />
        <div className="panel">
          <div className="panel__body">
            <Alert type="error" message={error.message || 'تعذّر تحميل الأخبار.'} />
            <button className="btn btn-primary mt-2" type="button" onClick={reload}>
              إعادة المحاولة
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="إدارة الأخبار"
        description="أضف أخبار المدرسة وحرّرها، وتحكم في نشرها وتمييزها. تُحذف الأخبار نهائيًا بعد تأكيد كتابي."
        actions={[
          <a
            className="btn btn-outline"
            href="/news"
            target="_blank"
            rel="noopener"
            key="site"
          >
            <Icon name="external" size={16} />
            <span>عرض الصفحة</span>
          </a>,
          <Link className="btn btn-primary" to="/news/new" key="new">
            <Icon name="plus" size={16} />
            <span>خبر جديد</span>
          </Link>,
        ]}
      />

      <section className="panel">
        <form className="filters" role="search" onSubmit={applyFilters}>
          <div className="filter filter--grow">
            <label htmlFor="filter-q">بحث</label>
            <input
              className="input"
              id="filter-q"
              type="search"
              value={search}
              placeholder="ابحث بالعنوان أو المعرّف…"
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="filter">
            <label htmlFor="filter-state">حالة النشر</label>
            <select
              className="select"
              id="filter-state"
              value={filters.state}
              onChange={(event) => updateParams({ state: event.target.value, page: 1 })}
            >
              <option value="all">الكل</option>
              <option value="published">منشور</option>
              <option value="draft">مسودة</option>
              <option value="featured">مميز</option>
            </select>
          </div>
          <div className="filter">
            <label htmlFor="filter-demo">نوع البيانات</label>
            <select
              className="select"
              id="filter-demo"
              value={filters.demo}
              onChange={(event) => updateParams({ is_demo: event.target.value, page: 1 })}
            >
              <option value="all">الكل</option>
              <option value="true">بيانات تجريبية</option>
              <option value="false">بيانات حقيقية</option>
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" type="submit">
              <Icon name="search" size={16} />
              <span>تطبيق</span>
            </button>
            <button className="btn btn-ghost" type="button" onClick={clearFilters}>
              مسح
            </button>
          </div>
        </form>

        {items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الخبر</th>
                  <th>التصنيف</th>
                  <th>النشر</th>
                  <th>التمييز</th>
                  <th>البيانات</th>
                  <th>تاريخ النشر</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="cell-strong">{item.title}</div>
                      <div className="cell-muted" dir="ltr">
                        {item.slug}
                      </div>
                    </td>
                    <td>{item.category || '—'}</td>
                    <td>
                      <NewsStateBadge item={item} />
                    </td>
                    <td>
                      {item.is_featured ? (
                        <span className="badge badge--published">مميز</span>
                      ) : (
                        <span className="badge badge--draft">عادي</span>
                      )}
                    </td>
                    <td>
                      <DemoBadge isDemo={item.is_demo} />
                    </td>
                    <td className="cell-muted">{formatDate(item.published_at)}</td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <Link
                          className="btn btn-outline btn-sm"
                          to={`/news/${item.id}/edit`}
                          title="تحرير"
                        >
                          <Icon name="edit" size={15} />
                          <span>تحرير</span>
                        </Link>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() =>
                            patchNews(
                              item,
                              { is_published: !item.is_published },
                              item.is_published ? 'تم إلغاء نشر الخبر.' : 'تم نشر الخبر.'
                            )
                          }
                        >
                          <Icon name="check" size={15} />
                          <span>{item.is_published ? 'إلغاء النشر' : 'نشر'}</span>
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() =>
                            patchNews(
                              item,
                              { is_featured: !item.is_featured },
                              item.is_featured ? 'تم إلغاء تمييز الخبر.' : 'تم تمييز الخبر.'
                            )
                          }
                        >
                          <Icon name="news" size={15} />
                          <span>{item.is_featured ? 'إلغاء التمييز' : 'تمييز'}</span>
                        </button>
                        {item.is_published ? (
                          <a
                            className="btn btn-ghost btn-sm"
                            href={`/news/${encodeURIComponent(item.slug)}`}
                            target="_blank"
                            rel="noopener"
                            title="عرض في الموقع"
                          >
                            <Icon name="external" size={15} />
                            <span>عرض</span>
                          </a>
                        ) : null}
                        <button
                          className="btn btn-danger-outline btn-sm"
                          type="button"
                          title="حذف"
                          onClick={() => deleteNews(item)}
                        >
                          <Icon name="trash" size={15} />
                          <span>حذف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={hasFilters ? 'لا توجد أخبار مطابقة' : 'لا توجد أخبار بعد'}
            message={
              hasFilters
                ? 'جرّب تعديل كلمات البحث أو الفلاتر لعرض نتائج أخرى.'
                : 'ابدأ بإنشاء أول خبر ليظهر في صفحة الأخبار بالموقع.'
            }
            actionLabel="إضافة خبر"
            onAction={() => navigate('/news/new')}
            iconName="news"
          />
        )}

        <Pagination
          meta={meta}
          onPage={(page) => {
            updateParams({ page });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </section>
    </>
  );
}
