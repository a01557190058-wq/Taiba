import { Icon } from '../../lib/icons.jsx';
import { formatNumber } from '../../lib/format.js';

export const STATUS_LABELS = {
  NEW: 'جديد',
  UNDER_REVIEW: 'قيد المراجعة',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
};

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge--${String(status || '').toLowerCase()}`}>
      {STATUS_LABELS[status] || status || '—'}
    </span>
  );
}

export function DepartmentStateBadge({ department }) {
  if (!department.is_active) return <span className="badge badge--archived">مؤرشف</span>;
  if (department.is_published) return <span className="badge badge--published">منشور</span>;
  return <span className="badge badge--draft">مسودة</span>;
}

export function NewsStateBadge({ item }) {
  if (item.is_published) return <span className="badge badge--published">منشور</span>;
  return <span className="badge badge--draft">مسودة</span>;
}

export function DemoBadge({ isDemo, demoLabel = 'تجريبي', realLabel = 'حقيقي' }) {
  return isDemo ? (
    <span className="badge badge--demo">{demoLabel}</span>
  ) : (
    <span className="badge badge--real">{realLabel}</span>
  );
}

export function PageHead({ title, description, actions }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions && actions.length ? <div className="page-head__actions">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, message, actionLabel, onAction, iconName = 'inbox' }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon name={iconName} size={26} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="btn btn-outline btn-sm" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function Alert({ type = 'error', message, iconName }) {
  if (!message) return null;
  const names = { error: 'alert', success: 'check', warning: 'alert', info: 'info' };
  return (
    <div className={`alert alert--${type}`} role="alert">
      <Icon name={iconName || names[type] || 'info'} size={18} />
      <div>{message}</div>
    </div>
  );
}

/**
 * Pagination bar driven by the API `meta` object
 * ({ total, page, limit, totalPages, hasNext, hasPrev }).
 */
export function Pagination({ meta, onPage }) {
  const total = Number(meta && meta.total) || 0;
  const page = Number(meta && meta.page) || 1;
  const limit = Number(meta && meta.limit) || 20;
  const totalPages = Number(meta && meta.totalPages) || 1;

  const from = total ? (page - 1) * limit + 1 : 0;
  const to = total ? Math.min(page * limit, total) : 0;

  const makeButton = (label, targetPage, { disabled = false, current = false, ariaLabel = '' } = {}) => (
    <button
      key={`${label}-${targetPage}-${current ? 'current' : ''}`}
      className="page-btn"
      type="button"
      aria-label={ariaLabel || undefined}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={disabled || current ? undefined : () => onPage(targetPage)}
    >
      {label}
    </button>
  );

  const pages = [
    makeButton('السابق', page - 1, { disabled: page <= 1, ariaLabel: 'الصفحة السابقة' }),
  ];

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  if (start > 1) {
    pages.push(makeButton('1', 1, { current: page === 1 }));
    if (start > 2) {
      pages.push(
        <span className="text-muted" key="start-gap">
          …
        </span>
      );
    }
  }

  for (let index = start; index <= end; index += 1) {
    pages.push(makeButton(String(index), index, { current: index === page }));
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      pages.push(
        <span className="text-muted" key="end-gap">
          …
        </span>
      );
    }
    pages.push(makeButton(String(totalPages), totalPages, { current: page === totalPages }));
  }

  pages.push(
    makeButton('التالي', page + 1, { disabled: page >= totalPages, ariaLabel: 'الصفحة التالية' })
  );

  return (
    <div className="pagination">
      <span>
        {total
          ? `عرض ${formatNumber(from)}–${formatNumber(to)} من ${formatNumber(total)}`
          : 'لا توجد نتائج'}
      </span>
      <div className="pagination__pages">{pages}</div>
    </div>
  );
}

export function SkeletonLine() {
  return <div className="skel skel-line" aria-hidden="true" />;
}

export function SkeletonBlock() {
  return <div className="skel skel-block" aria-hidden="true" />;
}

export function PageSkeleton({ stats = false }) {
  return (
    <>
      <SkeletonLine />
      {stats ? (
        <div className="stat-grid">
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      ) : null}
      <SkeletonBlock />
    </>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
