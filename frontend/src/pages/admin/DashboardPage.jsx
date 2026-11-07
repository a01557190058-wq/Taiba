import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAsync } from '../../lib/hooks.js';
import { formatDateTime, formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import {
  Alert,
  EmptyState,
  PageHead,
  PageSkeleton,
  StatusBadge,
} from '../../components/admin/ui.jsx';

function StatCard({ label, value, meta, accent = false }) {
  return (
    <article className={`stat-card${accent ? ' stat-card--accent' : ''}`}>
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{formatNumber(value)}</strong>
      {meta ? <span className="stat-card__meta">{meta}</span> : null}
    </article>
  );
}

function RecentTable({ applications }) {
  if (!applications.length) {
    return (
      <EmptyState
        title="لا توجد طلبات بعد"
        message="ستظهر أحدث طلبات التقديم هنا بمجرد وصولها."
        actionLabel="عرض جميع الطلبات"
        onAction={() => {
          window.location.href = '/admin/applications';
        }}
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>رقم الطلب</th>
            <th>المتقدم</th>
            <th>القسم</th>
            <th>الحالة</th>
            <th>تاريخ التقديم</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id}>
              <td className="cell-ref">{application.reference_number}</td>
              <td className="cell-strong">{application.full_name}</td>
              <td>{application.department_name}</td>
              <td>
                <StatusBadge status={application.status} />
              </td>
              <td className="cell-muted">{formatDateTime(application.submitted_at)}</td>
              <td className="cell-actions">
                <Link className="btn btn-outline btn-sm" to={`/applications/${application.id}`}>
                  <Icon name="eye" size={15} />
                  <span>عرض</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBreakdown({ apps }) {
  const rows = [
    { label: 'جديد', status: 'NEW', count: apps.new },
    { label: 'قيد المراجعة', status: 'UNDER_REVIEW', count: apps.under_review },
    { label: 'مقبول', status: 'ACCEPTED', count: apps.accepted },
    { label: 'مرفوض', status: 'REJECTED', count: apps.rejected },
  ];
  const total = apps.total || 1;

  return (
    <div className="detail-list">
      {rows.map((row) => (
        <div className="detail-row" key={row.status}>
          <dt>
            <StatusBadge status={row.status} />
          </dt>
          <dd>
            <div className="chip-row">
              <span className="chip">{`${formatNumber(row.count)} طلب`}</span>
              <span className="chip">{`${Math.round((row.count / total) * 100)}%`}</span>
            </div>
          </dd>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, loading, error, reload } = useAsync(
    () => api('/api/admin/dashboard/stats'),
    []
  );

  if (loading) return <PageSkeleton stats />;

  if (error) {
    return (
      <>
        <PageHead title="ملخص المدرسة" />
        <div className="panel">
          <div className="panel__body">
            <Alert type="error" message={error.message || 'تعذّر تحميل الإحصاءات.'} />
            <button className="btn btn-primary mt-2" type="button" onClick={reload}>
              إعادة المحاولة
            </button>
          </div>
        </div>
      </>
    );
  }

  const apps = stats.applications || {};
  const departments = stats.departments || {};
  const recent = Array.isArray(stats.recent_applications) ? stats.recent_applications : [];

  return (
    <>
      <PageHead
        title="ملخص المدرسة"
        description={`آخر تحديث: ${formatDateTime(
          stats.generated_at
        )} — تُحسب جميع الأرقام من قاعدة البيانات مباشرة.`}
        actions={[
          <button className="btn btn-outline" type="button" key="refresh" onClick={reload}>
            <Icon name="refresh" size={16} />
            <span>تحديث</span>
          </button>,
          <Link className="btn btn-primary" to="/applications" key="manage">
            <Icon name="inbox" size={16} />
            <span>إدارة الطلبات</span>
          </Link>,
        ]}
      />

      <div className="stat-grid">
        <StatCard
          label="إجمالي طلبات التقديم"
          value={apps.total}
          meta={`${formatNumber(apps.demo)} تجريبي • ${formatNumber(apps.real)} حقيقي`}
          accent
        />
        <StatCard label="طلبات جديدة" value={apps.new} meta="بانتظار المراجعة" />
        <StatCard label="طلبات مقبولة" value={apps.accepted} meta="حسب حالة الطلب" />
        <StatCard
          label="أقسام منشورة"
          value={departments.published}
          meta={`${formatNumber(departments.drafts)} مسودة • ${formatNumber(
            departments.archived
          )} مؤرشف`}
        />
      </div>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>أحدث طلبات التقديم</h3>
              <p>آخر خمسة طلبات واردة بغض النظر عن الحالة.</p>
            </div>
            <Link className="btn btn-outline btn-sm" to="/applications">
              عرض الكل
            </Link>
          </div>
          <RecentTable applications={recent} />
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>توزيع حالات الطلبات</h3>
              <p>نسبة كل حالة من إجمالي الطلبات.</p>
            </div>
          </div>
          <div className="panel__body">
            <StatusBreakdown apps={apps} />
            <div className="notice mt-2">
              <Icon name="info" size={18} />
              <span>
                {`يوجد ${formatNumber(apps.demo)} طلبًا تجريبيًا و${formatNumber(
                  apps.real
                )} طلبًا حقيقيًا. حذف الطلبات الحقيقية غير مسموح من النظام.`}
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <h3>إجراءات سريعة</h3>
        </div>
        <div className="panel__body">
          <div className="chip-row">
            <Link className="btn btn-outline btn-sm" to="/departments/new">
              <Icon name="plus" size={15} />
              <span>قسم جديد</span>
            </Link>
            <Link className="btn btn-outline btn-sm" to="/content">
              <Icon name="file" size={15} />
              <span>تحرير المحتوى</span>
            </Link>
            <Link className="btn btn-outline btn-sm" to="/demo-data">
              <Icon name="database" size={15} />
              <span>البيانات التجريبية</span>
            </Link>
            <a
              className="btn btn-outline btn-sm"
              href="/"
              target="_blank"
              rel="noopener"
            >
              <Icon name="external" size={15} />
              <span>عرض الموقع</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
