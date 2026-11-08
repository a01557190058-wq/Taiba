import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, request } from '../../lib/api.js';
import { useAsync, useDebounced } from '../../lib/hooks.js';
import { formatDate, formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  DemoBadge,
  DepartmentStateBadge,
  EmptyState,
  PageHead,
  PageSkeleton,
  Pagination,
} from '../../components/admin/ui.jsx';

export default function DepartmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();

  const filters = useMemo(() => {
    const state = searchParams.get('state');
    const demo = searchParams.get('is_demo');
    return {
      q: searchParams.get('q') || '',
      state: ['all', 'published', 'draft', 'archived'].includes(state) ? state : 'all',
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
    return request(`/api/admin/departments?${query.toString()}`);
  }, [listKey]);

  const items = data && Array.isArray(data.data) ? data.data : [];
  const meta = data && data.meta ? data.meta : { total: 0, page: 1, limit: 20, totalPages: 1 };

  const patchDepartment = async (department, payload, successMessage) => {
    try {
      await api(`/api/admin/departments/${department.id}`, { method: 'PATCH', body: payload });
      toast(successMessage);
      reload();
    } catch (patchError) {
      toast(patchError.message || 'تعذّر تحديث القسم.', 'error');
    }
  };

  const deleteDepartment = async (department) => {
    const hasApplications = (department.applications_count || 0) > 0;
    const confirmed = await confirm({
      title: 'حذف القسم نهائيًا',
      message: hasApplications
        ? `سيتم حذف «${department.name}» و${formatNumber(
            department.applications_count
          )} طلب/طلبات مرتبطة به نهائيًا. لا يمكن التراجع عن هذه العملية.`
        : `سيتم حذف «${department.name}» نهائيًا. لا يمكن التراجع عن هذه العملية.`,
      confirmLabel: 'حذف نهائي',
      danger: true,
      requireText: hasApplications ? department.name : '',
    });
    if (!confirmed) return;

    try {
      const suffix = hasApplications ? '?force=true' : '';
      await api(`/api/admin/departments/${department.id}${suffix}`, { method: 'DELETE' });
      toast(hasApplications ? 'تم حذف القسم والطلبات المرتبطة به.' : 'تم حذف القسم.');
      if (filters.page > 1) updateParams({ page: filters.page - 1 });
      else reload();
    } catch (deleteError) {
      if (deleteError.status === 409) toast(deleteError.message, 'warning');
      else toast(deleteError.message || 'تعذّر حذف القسم.', 'error');
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    updateParams({ q: search.trim(), page: 1 });
  };

  const clearFilters = () => {
    setSearch('');
    updateParams({ q: '', state: 'all', demo: 'all', page: 1 });
  };

  const hasFilters = Boolean(filters.q) || filters.state !== 'all' || filters.demo !== 'all';

  const rowActions = (department) => {
    const actions = [
      <Link
        className="btn btn-outline btn-sm"
        to={`/departments/${department.id}/edit`}
        title="تحرير"
        key="edit"
      >
        <Icon name="edit" size={15} />
        <span>تحرير</span>
      </Link>,
    ];

    if (!department.is_active) {
      actions.push(
        <button
          className="btn btn-outline btn-sm"
          type="button"
          key="restore"
          onClick={() => patchDepartment(department, { is_active: true }, 'تمت استعادة القسم كمسودة.')}
        >
          <Icon name="refresh" size={15} />
          <span>استعادة</span>
        </button>
      );
    } else {
      actions.push(
        <button
          className="btn btn-outline btn-sm"
          type="button"
          key="publish"
          onClick={() =>
            patchDepartment(
              department,
              { is_published: !department.is_published },
              department.is_published ? 'تم إلغاء نشر القسم.' : 'تم نشر القسم.'
            )
          }
        >
          <Icon name="check" size={15} />
          <span>{department.is_published ? 'إلغاء النشر' : 'نشر'}</span>
        </button>
      );

      actions.push(
        <button
          className="btn btn-outline btn-sm"
          type="button"
          key="archive"
          onClick={async () => {
            const confirmed = await confirm({
              title: 'أرشفة القسم',
              message: `سيتم إخفاء «${department.name}» من الموقع مع الحفاظ على جميع الطلبات المرتبطة به. يمكنك استعادته لاحقًا.`,
              confirmLabel: 'أرشفة',
            });
            if (confirmed) {
              patchDepartment(
                department,
                { is_active: false, is_published: false },
                'تمت أرشفة القسم.'
              );
            }
          }}
        >
          <Icon name="book" size={15} />
          <span>أرشفة</span>
        </button>
      );
    }

    actions.push(
      <button
        className="btn btn-danger-outline btn-sm"
        type="button"
        title="حذف"
        key="delete"
        onClick={() => deleteDepartment(department)}
      >
        <Icon name="trash" size={15} />
        <span>حذف</span>
      </button>
    );

    return <div className="row-actions">{actions}</div>;
  };

  if (loading && !data) return <PageSkeleton />;

  if (error) {
    return (
      <>
        <PageHead title="إدارة الأقسام" />
        <div className="panel">
          <div className="panel__body">
            <Alert type="error" message={error.message || 'تعذّر تحميل الأقسام.'} />
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
        title="إدارة الأقسام"
        description="أنشئ الأقسام وحرّر محتواها، وتحكم في نشرها وأرشفتها. الأقسام المؤرشفة لا تظهر للزوار."
        actions={[
          <a
            className="btn btn-outline"
            href="/departments"
            target="_blank"
            rel="noopener"
            key="site"
          >
            <Icon name="external" size={16} />
            <span>عرض الصفحة</span>
          </a>,
          <Link className="btn btn-primary" to="/departments/new" key="new">
            <Icon name="plus" size={16} />
            <span>قسم جديد</span>
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
              placeholder="ابحث باسم القسم…"
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
              <option value="archived">مؤرشف</option>
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
                  <th>القسم</th>
                  <th>النشر</th>
                  <th>البيانات</th>
                  <th>الطلبات</th>
                  <th>الترتيب</th>
                  <th>آخر تحديث</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((department) => (
                  <tr key={department.id}>
                    <td>
                      <div className="cell-strong">{department.name}</div>
                      <div className="cell-muted" dir="ltr">
                        {department.slug}
                      </div>
                    </td>
                    <td>
                      <DepartmentStateBadge department={department} />
                    </td>
                    <td>
                      <DemoBadge isDemo={department.is_demo} />
                    </td>
                    <td>
                      <Link
                        className="cell-strong"
                        to={`/applications?department_id=${department.id}`}
                      >
                        {formatNumber(department.applications_count || 0)}
                      </Link>
                    </td>
                    <td className="cell-muted">{formatNumber(department.sort_order)}</td>
                    <td className="cell-muted">{formatDate(department.updated_at)}</td>
                    <td className="cell-actions">{rowActions(department)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={hasFilters ? 'لا توجد أقسام مطابقة' : 'لا توجد أقسام بعد'}
            message={
              hasFilters
                ? 'جرّب تعديل كلمات البحث أو الفلاتر لعرض نتائج أخرى.'
                : 'ابدأ بإنشاء أول قسم تعليمي ليظهر في الموقع.'
            }
            actionLabel="إضافة قسم"
            onAction={() => navigate('/departments/new')}
            iconName="layers"
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
