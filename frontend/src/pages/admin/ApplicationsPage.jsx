import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, request } from '../../lib/api.js';
import { useAsync, useDebounced } from '../../lib/hooks.js';
import { formatDateTime } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  DemoBadge,
  EmptyState,
  PageHead,
  PageSkeleton,
  Pagination,
  StatusBadge,
} from '../../components/admin/ui.jsx';

const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'NEW', label: 'جديد' },
  { value: 'UNDER_REVIEW', label: 'قيد المراجعة' },
  { value: 'ACCEPTED', label: 'مقبول' },
  { value: 'REJECTED', label: 'مرفوض' },
];

export default function ApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast, confirm } = useFeedback();

  const filters = useMemo(() => {
    const status = searchParams.get('status');
    const demo = searchParams.get('is_demo');
    const departmentId = Number.parseInt(searchParams.get('department_id'), 10);
    return {
      q: searchParams.get('q') || '',
      status: ['NEW', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].includes(status) ? status : 'all',
      departmentId:
        Number.isInteger(departmentId) && departmentId > 0 ? String(departmentId) : '',
      demo: ['all', 'true', 'false'].includes(demo) ? demo : 'all',
      sort: searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest',
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
              value === '1' ||
              (key === 'sort' && value === 'newest')
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

  const { data: departments } = useAsync(async () => {
    try {
      const response = await request('/api/admin/departments?limit=200&state=all');
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }, []);

  const listKey = searchParams.toString();
  const { data, loading, error, reload } = useAsync(async () => {
    const query = new URLSearchParams({ page: String(filters.page), limit: '20' });
    if (filters.q) query.set('q', filters.q);
    if (filters.status !== 'all') query.set('status', filters.status);
    if (filters.departmentId) query.set('department_id', filters.departmentId);
    if (filters.demo !== 'all') query.set('is_demo', filters.demo);
    if (filters.sort !== 'newest') query.set('sort', filters.sort);
    return request(`/api/admin/applications?${query.toString()}`);
  }, [listKey]);

  const items = data && Array.isArray(data.data) ? data.data : [];
  const meta = data && data.meta ? data.meta : { total: 0, page: 1, limit: 20, totalPages: 1 };

  const exportHref = useMemo(() => {
    const query = new URLSearchParams();
    if (filters.q) query.set('q', filters.q);
    if (filters.status !== 'all') query.set('status', filters.status);
    if (filters.departmentId) query.set('department_id', filters.departmentId);
    if (filters.demo !== 'all') query.set('is_demo', filters.demo);
    if (filters.sort !== 'newest') query.set('sort', filters.sort);
    const suffix = query.toString();
    return `/api/admin/applications/export.csv${suffix ? `?${suffix}` : ''}`;
  }, [filters]);

  const hasActiveFilters =
    Boolean(filters.q) ||
    filters.status !== 'all' ||
    Boolean(filters.departmentId) ||
    filters.demo !== 'all' ||
    filters.sort !== 'newest';

  const clearFilters = () => {
    setSearch('');
    updateParams({
      q: '',
      status: 'all',
      department_id: '',
      is_demo: 'all',
      sort: 'newest',
      page: 1,
    });
  };

  const deleteApplication = async (application) => {
    const confirmed = await confirm({
      title: application.is_demo ? 'حذف طلب تجريبي' : 'حذف طلب حقيقي',
      message: application.is_demo
        ? `سيتم حذف الطلب ${application.reference_number} نهائيًا. اكتب رقم الطلب للتأكيد.`
        : `هذا طلب حقيقي (${application.reference_number}). سيتم حذفه نهائيًا ولا يمكن التراجع. اكتب رقم الطلب للتأكيد.`,
      confirmLabel: 'حذف نهائي',
      danger: true,
      requireText: application.reference_number,
    });
    if (!confirmed) return;

    try {
      await api(`/api/admin/applications/${application.id}`, { method: 'DELETE' });
      toast(application.is_demo ? 'تم حذف الطلب التجريبي.' : 'تم حذف الطلب.');
      if (filters.page > 1) updateParams({ page: filters.page - 1 });
      else reload();
    } catch (deleteError) {
      toast(deleteError.message || 'تعذّر حذف الطلب.', 'error');
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    updateParams({ q: search.trim(), page: 1 });
  };

  if (loading && !data) return <PageSkeleton />;

  if (error) {
    return (
      <>
        <PageHead title="طلبات التقديم" />
        <div className="panel">
          <div className="panel__body">
            <Alert type="error" message={error.message || 'تعذّر تحميل الطلبات.'} />
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
        title="طلبات التقديم"
        description="تُعرض الطلبات من قاعدة البيانات مباشرة. استخدم الفلاتر للوصول السريع ثم صدّر النتائج عند الحاجة."
        actions={[
          <a className="btn btn-outline" href={exportHref} key="export">
            <Icon name="download" size={16} />
            <span>تصدير CSV</span>
          </a>,
          <button className="btn btn-primary" type="button" key="refresh" onClick={reload}>
            <Icon name="refresh" size={16} />
            <span>تحديث</span>
          </button>,
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
              placeholder="ابحث بالاسم أو رقم الطلب…"
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="filter">
            <label htmlFor="filter-status">الحالة</label>
            <select
              className="select"
              id="filter-status"
              value={filters.status}
              onChange={(event) => updateParams({ status: event.target.value, page: 1 })}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter">
            <label htmlFor="filter-department">القسم</label>
            <select
              className="select"
              id="filter-department"
              value={filters.departmentId}
              onChange={(event) => updateParams({ department_id: event.target.value, page: 1 })}
            >
              <option value="">كل الأقسام</option>
              {(departments || []).map((department) => (
                <option key={department.id} value={String(department.id)}>
                  {department.name}
                </option>
              ))}
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
              <option value="all">كل البيانات</option>
              <option value="true">بيانات تجريبية</option>
              <option value="false">بيانات حقيقية</option>
            </select>
          </div>
          <div className="filter">
            <label htmlFor="filter-sort">الترتيب</label>
            <select
              className="select"
              id="filter-sort"
              value={filters.sort}
              onChange={(event) => updateParams({ sort: event.target.value, page: 1 })}
            >
              <option value="newest">الأحدث أولًا</option>
              <option value="oldest">الأقدم أولًا</option>
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
                  <th>رقم الطلب</th>
                  <th>المتقدم</th>
                  <th>القسم</th>
                  <th>الحالة</th>
                  <th>البيانات</th>
                  <th>تاريخ التقديم</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((application) => (
                  <tr key={application.id}>
                    <td className="cell-ref">{application.reference_number}</td>
                    <td>
                      <div className="cell-strong">{application.full_name}</div>
                      <div className="cell-muted" dir="ltr">
                        {application.phone}
                      </div>
                    </td>
                    <td>{application.department_name || '—'}</td>
                    <td>
                      <StatusBadge status={application.status} />
                    </td>
                    <td>
                      <DemoBadge isDemo={application.is_demo} />
                    </td>
                    <td className="cell-muted">{formatDateTime(application.submitted_at)}</td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <Link
                          className="btn btn-outline btn-sm"
                          to={`/applications/${application.id}`}
                        >
                          <Icon name="eye" size={15} />
                          <span>عرض</span>
                        </Link>
                        <button
                          className="btn btn-danger-outline btn-sm"
                          type="button"
                          title="حذف الطلب"
                          onClick={() => deleteApplication(application)}
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
            title={hasActiveFilters ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات بعد'}
            message={
              hasActiveFilters
                ? 'جرّب تعديل كلمات البحث أو الفلاتر لعرض نتائج أخرى.'
                : 'ستظهر طلبات التقديم هنا بمجرد إرسالها من الموقع.'
            }
            actionLabel={hasActiveFilters ? 'مسح الفلاتر' : ''}
            onAction={hasActiveFilters ? clearFilters : undefined}
            iconName="inbox"
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
