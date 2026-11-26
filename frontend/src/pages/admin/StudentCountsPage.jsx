import { useEffect, useMemo, useState } from 'react';
import { api, request } from '../../lib/api.js';
import { useAsync } from '../../lib/hooks.js';
import { formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  DepartmentStateBadge,
  EmptyState,
  PageHead,
  PageSkeleton,
} from '../../components/admin/ui.jsx';

const MAX_COUNT = 100000;

function toCount(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isInteger(number) && number >= 0 && number <= MAX_COUNT ? number : null;
}

function draftFrom(department) {
  return {
    students_male: String(department.students_male ?? 0),
    students_female: String(department.students_female ?? 0),
  };
}

function hasChanged(department, draft) {
  if (!draft) return false;
  return (
    toCount(draft.students_male) !== Number(department.students_male || 0) ||
    toCount(draft.students_female) !== Number(department.students_female || 0)
  );
}

/**
 * Dedicated screen for the headcount the school asked to control from the
 * dashboard. It reuses the existing department PATCH endpoint, so counts,
 * validation, CSRF and the public API all stay on the same source of truth.
 */
export default function StudentCountsPage() {
  const { toast } = useFeedback();
  const [formSearch, setFormSearch] = useState('');
  const [query, setQuery] = useState({ q: '', state: 'all' });
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const params = new URLSearchParams({ page: '1', limit: '100' });
    if (query.q) params.set('q', query.q);
    if (query.state !== 'all') params.set('state', query.state);
    return request(`/api/admin/departments?${params.toString()}`);
  }, [query.q, query.state]);

  const rows = data && Array.isArray(data.data) ? data.data : [];

  useEffect(() => {
    const next = {};
    rows.forEach((department) => {
      next[department.id] = draftFrom(department);
    });
    setDrafts(next);
  }, [data]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, department) => ({
          male: sum.male + Number(department.students_male || 0),
          female: sum.female + Number(department.students_female || 0),
          total: sum.total + Number(department.students_total || 0),
        }),
        { male: 0, female: 0, total: 0 }
      ),
    [rows]
  );

  const changedRows = rows.filter((department) => hasChanged(department, drafts[department.id]));

  const setDraft = (id, field, value) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] || { students_male: '0', students_female: '0' }), [field]: value },
    }));
  };

  const validateDraft = (department) => {
    const draft = drafts[department.id] || {};
    const male = toCount(draft.students_male);
    const female = toCount(draft.students_female);
    if (male === null || female === null) {
      toast(`أدخل أعدادًا صحيحة بين 0 و${formatNumber(MAX_COUNT)} لـ«${department.name}».`, 'error');
      return null;
    }
    return { students_male: male, students_female: female };
  };

  const saveRow = async (department) => {
    const payload = validateDraft(department);
    if (!payload) return;

    setSaving(department.id);
    try {
      const updated = await api(`/api/admin/departments/${department.id}`, {
        method: 'PATCH',
        body: payload,
      });
      toast(`تم حفظ عدد طلاب «${updated.name}»: ${formatNumber(updated.students_total)}.`);
      reload();
    } catch (saveError) {
      toast(saveError.message || 'تعذّر حفظ عدد الطلاب.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const saveAll = async () => {
    if (!changedRows.length) {
      toast('لا توجد تغييرات غير محفوظة.', 'warning');
      return;
    }

    const payloads = [];
    for (const department of changedRows) {
      const payload = validateDraft(department);
      if (!payload) return;
      payloads.push({ department, payload });
    }

    setSaving('all');
    let saved = 0;
    try {
      for (const { department, payload } of payloads) {
        await api(`/api/admin/departments/${department.id}`, { method: 'PATCH', body: payload });
        saved += 1;
      }
      toast(`تم حفظ أعداد ${formatNumber(saved)} تخصصًا بنجاح.`);
      reload();
    } catch (saveError) {
      if (saved) reload();
      toast(
        saved
          ? `تم حفظ ${formatNumber(saved)} تخصصًا، ثم توقّف الحفظ: ${saveError.message}`
          : saveError.message || 'تعذّر حفظ أعداد الطلاب.',
        'error'
      );
    } finally {
      setSaving(null);
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setQuery({ q: formSearch.trim(), state: query.state });
  };

  const resetAll = () => {
    const next = {};
    rows.forEach((department) => {
      next[department.id] = draftFrom(department);
    });
    setDrafts(next);
  };

  if (loading && !data) return <PageSkeleton stats />;

  return (
    <>
      <PageHead
        title="أعداد الطلاب بالتخصصات"
        description="حدّث عدد الطلاب الذكور والإناث لكل تخصص. يُحسب الإجمالي تلقائيًا ويظهر للمزوّرين في صفحة التخصصات."
        actions={[
          <button className="btn btn-outline" type="button" key="refresh" onClick={reload}>
            <Icon name="refresh" size={16} />
            <span>تحديث</span>
          </button>,
        ]}
      />

      <div className="stat-grid">
        <div className="stat-card stat-card--accent">
          <span className="stat-card__label">إجمالي الطلاب</span>
          <strong className="stat-card__value">{formatNumber(totals.total)}</strong>
          <span className="stat-card__meta">المجموع المعروض في التخصصات</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">ذكور</span>
          <strong className="stat-card__value">{formatNumber(totals.male)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">إناث</span>
          <strong className="stat-card__value">{formatNumber(totals.female)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">تخصصات في القائمة</span>
          <strong className="stat-card__value">{formatNumber(rows.length)}</strong>
          <span className="stat-card__meta">{formatNumber(changedRows.length)} تغيير غير محفوظ</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel__head">
          <div>
            <h3>تحرير الأعداد</h3>
            <p>التغييرات لا تظهر على الموقع إلا بعد الضغط على حفظ.</p>
          </div>
          <div className="chip-row">
            <button
              className="btn btn-outline btn-sm"
              type="button"
              onClick={resetAll}
              disabled={!changedRows.length}
            >
              <Icon name="refresh" size={15} />
              <span>تجاهل التغييرات</span>
            </button>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={saveAll}
              disabled={!changedRows.length || saving !== null}
            >
              <Icon name="check" size={15} />
              <span>{saving === 'all' ? 'جارٍ الحفظ…' : 'حفظ الكل'}</span>
            </button>
          </div>
        </div>

        <div className="panel__body">
          <form className="filters" onSubmit={applyFilters}>
            <div className="filter filter--grow">
              <label htmlFor="count-search">بحث باسم التخصص</label>
              <input
                id="count-search"
                className="input"
                type="search"
                value={formSearch}
                onChange={(event) => setFormSearch(event.target.value)}
                placeholder="مثال: خراطة، كهرباء، حاسوب"
              />
            </div>
            <div className="filter">
              <label htmlFor="count-state">الحالة</label>
              <select
                id="count-state"
                className="select"
                value={query.state}
                onChange={(event) => setQuery({ ...query, state: event.target.value })}
              >
                <option value="all">كل التخصصات</option>
                <option value="published">منشورة فقط</option>
                <option value="draft">مسودات فقط</option>
                <option value="archived">مؤرشفة فقط</option>
              </select>
            </div>
            <div className="filter-actions">
              <button className="btn btn-outline" type="submit">
                <Icon name="search" size={16} />
                <span>بحث</span>
              </button>
            </div>
          </form>
        </div>

        {error ? (
          <div className="panel__body">
            <Alert type="error" message={error.message || 'تعذّر تحميل التخصصات.'} />
          </div>
        ) : null}

        {!loading && !rows.length ? (
          <EmptyState
            title="لا توجد تخصصات مطابقة"
            message="جرّب كلمة بحث أخرى أو غيّر حالة التخصصات."
            iconName="search"
          />
        ) : null}

        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table count-table">
              <thead>
                <tr>
                  <th>التخصص</th>
                  <th>الحالة</th>
                  <th>ذكور</th>
                  <th>إناث</th>
                  <th>الإجمالي</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((department) => {
                  const draft = drafts[department.id] || draftFrom(department);
                  const preview =
                    (toCount(draft.students_male) || 0) + (toCount(draft.students_female) || 0);
                  return (
                    <tr key={department.id} className={hasChanged(department, draft) ? 'is-dirty' : undefined}>
                      <td>
                        <strong className="cell-strong">{department.name}</strong>
                        <span className="cell-muted count-table__slug">{department.slug}</span>
                      </td>
                      <td>
                        <DepartmentStateBadge department={department} />
                      </td>
                      <td>
                        <input
                          className="count-input"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={MAX_COUNT}
                          step="1"
                          aria-label={`عدد طلاب الذكور في ${department.name}`}
                          value={draft.students_male}
                          onChange={(event) => setDraft(department.id, 'students_male', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="count-input"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={MAX_COUNT}
                          step="1"
                          aria-label={`عدد طلاب الإناث في ${department.name}`}
                          value={draft.students_female}
                          onChange={(event) => setDraft(department.id, 'students_female', event.target.value)}
                        />
                      </td>
                      <td className="count-table__total">{formatNumber(preview)}</td>
                      <td className="cell-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => saveRow(department)}
                          disabled={saving !== null || !hasChanged(department, draft)}
                        >
                          <Icon name="check" size={15} />
                          <span>{saving === department.id ? 'جارٍ الحفظ…' : 'حفظ'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
