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
  EmptyState,
  PageHead,
  PageSkeleton,
  Pagination,
} from '../../components/admin/ui.jsx';

export function SubjectTypeBadge({ type }) {
  if (type === 'practical') return <span className="badge badge--practical">عملية</span>;
  return <span className="badge badge--theoretical">نظرية</span>;
}

const GRADES = [
  { value: 'first', label: 'الصف الأول الثانوي', short: 'الأول' },
  { value: 'second', label: 'الصف الثاني الثانوي', short: 'الثاني' },
  { value: 'third', label: 'الصف الثالث الثانوي', short: 'الثالث' },
];

export function SubjectGradeBadge({ grade }) {
  const found = GRADES.find((item) => item.value === grade);
  return <span className="badge badge--neutral">{found ? found.label : 'الصف الأول الثانوي'}</span>;
}

export function SubjectStateBadge({ subject }) {
  return subject.is_published ? (
    <span className="badge badge--published">منشورة</span>
  ) : (
    <span className="badge badge--draft">مسودة</span>
  );
}

export default function SubjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();

  const filters = useMemo(() => {
    const type = searchParams.get('type');
    const grade = searchParams.get('grade');
    const state = searchParams.get('state');
    const demo = searchParams.get('is_demo');
    return {
      q: searchParams.get('q') || '',
      type: ['all', 'theoretical', 'practical'].includes(type) ? type : 'all',
      grade: ['all', 'first', 'second', 'third'].includes(grade) ? grade : 'all',
      state: ['all', 'published', 'draft'].includes(state) ? state : 'all',
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
    if (filters.type !== 'all') query.set('type', filters.type);
    if (filters.grade !== 'all') query.set('grade', filters.grade);
    if (filters.state !== 'all') query.set('state', filters.state);
    if (filters.demo !== 'all') query.set('is_demo', filters.demo);
    return request(`/api/admin/subjects?${query.toString()}`);
  }, [listKey]);

  const items = data && Array.isArray(data.data) ? data.data : [];
  const meta = data && data.meta ? data.meta : { total: 0, page: 1, limit: 20, totalPages: 1 };

  const patchSubject = async (subject, payload, successMessage) => {
    try {
      await api(`/api/admin/subjects/${subject.id}`, { method: 'PATCH', body: payload });
      toast(successMessage);
      reload();
    } catch (patchError) {
      toast(patchError.message || 'تعذّر تحديث المادة الدراسية.', 'error');
    }
  };

  const deleteSubject = async (subject) => {
    const confirmed = await confirm({
      title: 'حذف المادة الدراسية',
      message: `سيتم حذف «${subject.name}» نهائيًا. لا يمكن التراجع عن هذه العملية.`,
      confirmLabel: 'حذف نهائي',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api(`/api/admin/subjects/${subject.id}`, { method: 'DELETE' });
      toast('تم حذف المادة الدراسية.');
      if (filters.page > 1) updateParams({ page: filters.page - 1 });
      else reload();
    } catch (deleteError) {
      toast(deleteError.message || 'تعذّر حذف المادة الدراسية.', 'error');
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    updateParams({ q: search.trim(), page: 1 });
  };

  const clearFilters = () => {
    setSearch('');
    updateParams({ q: '', type: 'all', grade: 'all', state: 'all', demo: 'all', page: 1 });
  };

  const hasFilters =
    Boolean(filters.q) ||
    filters.type !== 'all' ||
    filters.grade !== 'all' ||
    filters.state !== 'all' ||
    filters.demo !== 'all';

  if (loading && !data) return <PageSkeleton />;

  if (error) {
    return (
      <>
        <PageHead title="إدارة المواد الدراسية" />
        <div className="panel">
          <div className="panel__body">
            <Alert type="error" message={error.message || 'تعذّر تحميل المواد الدراسية.'} />
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
        title="إدارة المواد الدراسية"
        description="أضف المواد الدراسية وحدّد نوعها (نظرية أو عملية). تظهر المواد المنشورة فقط في صفحة المواد بالموقع."
        actions={[
          <a className="btn btn-outline" href="/subjects" target="_blank" rel="noopener" key="site">
            <Icon name="external" size={16} />
            <span>عرض الصفحة</span>
          </a>,
          <Link className="btn btn-primary" to="/subjects/new" key="new">
            <Icon name="plus" size={16} />
            <span>مادة جديدة</span>
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
              placeholder="ابحث باسم المادة…"
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="filter">
            <label htmlFor="filter-type">نوع المادة</label>
            <select
              className="select"
              id="filter-type"
              value={filters.type}
              onChange={(event) => updateParams({ type: event.target.value, page: 1 })}
            >
              <option value="all">الكل</option>
              <option value="theoretical">نظرية</option>
              <option value="practical">عملية</option>
            </select>
          </div>
          <div className="filter">
            <label htmlFor="filter-grade">الصف الدراسي</label>
            <select
              className="select"
              id="filter-grade"
              value={filters.grade}
              onChange={(event) => updateParams({ grade: event.target.value, page: 1 })}
            >
              <option value="all">الكل</option>
              {GRADES.map((grade) => (
                <option value={grade.value} key={grade.value}>
                  {grade.label}
                </option>
              ))}
            </select>
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
              <option value="published">منشورة</option>
              <option value="draft">مسودة</option>
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
                  <th>المادة</th>
                  <th>النوع</th>
                  <th>الصف</th>
                  <th>التخصص</th>
                  <th>النشر</th>
                  <th>البيانات</th>
                  <th>الترتيب</th>
                  <th>آخر تحديث</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((subject) => (
                  <tr key={subject.id}>
                    <td>
                      <div className="cell-strong">{subject.name}</div>
                      {subject.description ? (
                        <div className="cell-muted">{subject.description}</div>
                      ) : null}
                    </td>
                    <td>
                      <SubjectTypeBadge type={subject.type} />
                    </td>
                    <td>
                      <SubjectGradeBadge grade={subject.grade} />
                    </td>
                    <td className="cell-muted">
                      {subject.department_name || 'عامة'}
                    </td>
                    <td>
                      <SubjectStateBadge subject={subject} />
                    </td>
                    <td>
                      <DemoBadge isDemo={subject.is_demo} />
                    </td>
                    <td className="cell-muted">{formatNumber(subject.sort_order)}</td>
                    <td className="cell-muted">{formatDate(subject.updated_at)}</td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <Link
                          className="btn btn-outline btn-sm"
                          to={`/subjects/${subject.id}/edit`}
                          title="تحرير"
                        >
                          <Icon name="edit" size={15} />
                          <span>تحرير</span>
                        </Link>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() =>
                            patchSubject(
                              subject,
                              { is_published: !subject.is_published },
                              subject.is_published
                                ? 'تم إلغاء نشر المادة.'
                                : 'تم نشر المادة.'
                            )
                          }
                        >
                          <Icon name="check" size={15} />
                          <span>{subject.is_published ? 'إلغاء النشر' : 'نشر'}</span>
                        </button>
                        <button
                          className="btn btn-danger-outline btn-sm"
                          type="button"
                          title="حذف"
                          onClick={() => deleteSubject(subject)}
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
            title={hasFilters ? 'لا توجد مواد مطابقة' : 'لا توجد مواد دراسية بعد'}
            message={
              hasFilters
                ? 'جرّب تعديل كلمات البحث أو الفلاتر لعرض نتائج أخرى.'
                : 'ابدأ بإضافة أول مادة دراسية لتظهر في صفحة المواد بالموقع.'
            }
            actionLabel="إضافة مادة"
            onAction={() => navigate('/subjects/new')}
            iconName="book"
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
