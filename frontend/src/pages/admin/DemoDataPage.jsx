import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAsync } from '../../lib/hooks.js';
import { formatDateTime, formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  DepartmentStateBadge,
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

function ActionPanel({ title, description, notice, noticeType = '', buttonLabel, danger = false, busy, onAction }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="panel__body">
        {notice ? (
          <div className={`notice${noticeType ? ` notice--${noticeType}` : ''}`}>
            <Icon name="info" size={18} />
            <span>{notice}</span>
          </div>
        ) : null}
        <div className="form-actions">
          <button
            className={`btn ${danger ? 'btn-danger-outline' : 'btn-primary'}`}
            type="button"
            disabled={busy}
            onClick={onAction}
          >
            <Icon name={danger ? 'trash' : 'database'} size={16} />
            <span>{busy ? 'جارٍ التنفيذ…' : buttonLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function SummaryTables({ data }) {
  const departments = Array.isArray(data.departments) ? data.departments : [];
  const applications = Array.isArray(data.applications) ? data.applications : [];

  return (
    <div className="detail-grid mt-2">
      <section className="panel">
        <div className="panel__head">
          <div>
            <h3>الأقسام التجريبية</h3>
            <p>{`${formatNumber(departments.length)} قسمًا موسومًا كبيانات تجريبية.`}</p>
          </div>
        </div>
        {departments.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>القسم</th>
                  <th>الحالة</th>
                  <th>آخر تحديث</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
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
                    <td className="cell-muted">{formatDateTime(department.updated_at)}</td>
                    <td className="cell-actions">
                      <Link
                        className="btn btn-outline btn-sm"
                        to={`/departments/${department.id}/edit`}
                      >
                        <Icon name="edit" size={15} />
                        <span>تحرير</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="لا توجد أقسام تجريبية"
            message="استخدم زر إضافة البيانات التجريبية لإنشاء مجموعة العرض."
            iconName="layers"
          />
        )}
      </section>

      <section className="panel">
        <div className="panel__head">
          <div>
            <h3>الطلبات التجريبية</h3>
            <p>{`${formatNumber(applications.length)} طلبًا موسومًا كبيانات تجريبية.`}</p>
          </div>
        </div>
        {applications.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الطلب</th>
                  <th>المتقدم</th>
                  <th>القسم</th>
                  <th>الحالة</th>
                  <th>التقديم</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td className="cell-ref">{application.reference_number}</td>
                    <td className="cell-strong">{application.full_name}</td>
                    <td>{application.department_name_snapshot}</td>
                    <td>
                      <StatusBadge status={application.status} />
                    </td>
                    <td className="cell-muted">{formatDateTime(application.submitted_at)}</td>
                    <td className="cell-actions">
                      <Link
                        className="btn btn-outline btn-sm"
                        to={`/applications/${application.id}`}
                      >
                        <Icon name="eye" size={15} />
                        <span>عرض</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="لا توجد طلبات تجريبية"
            message="استخدم زر إضافة البيانات التجريبية لإنشاء طلبات العرض."
            iconName="inbox"
          />
        )}
      </section>
    </div>
  );
}

export default function DemoDataPage() {
  const { toast, confirm } = useFeedback();
  const { data, loading, error, reload } = useAsync(() => api('/api/admin/demo-data'), []);
  const [busyAction, setBusyAction] = useState(null);

  const runSeed = async () => {
    setBusyAction('seed');
    try {
      const result = await api('/api/admin/demo-data/seed', { method: 'POST' });
      const summary = result.summary || {};
      const added =
        (summary.departments_inserted || 0) +
        (summary.applications_inserted || 0) +
        (summary.faqs_inserted || 0) +
        (summary.content_inserted || 0);
      toast(
        added > 0
          ? `تمت إضافة السجلات الناقصة (${formatNumber(added)} سجل).`
          : 'جميع البيانات التجريبية موجودة بالفعل؛ لم تتم إضافة شيء.'
      );
      reload();
    } catch (seedError) {
      toast(seedError.message || 'تعذّرت إضافة البيانات التجريبية.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const runReset = async () => {
    const confirmed = await confirm({
      title: 'إعادة تهيئة البيانات التجريبية',
      message:
        'سيتم حذف جميع الطلبات والأقسام الموسومة كبيانات تجريبية، ثم إعادة إنشاء مجموعة العرض من جديد. لن تُحذف أو تُعدّل أي بيانات حقيقية. اكتب RESET_DEMO_DATA للتأكيد.',
      confirmLabel: 'إعادة التهيئة',
      danger: true,
      requireText: 'RESET_DEMO_DATA',
    });
    if (!confirmed) return;

    setBusyAction('reset');
    try {
      const result = await api('/api/admin/demo-data/reset', {
        method: 'POST',
        body: { confirm: 'RESET_DEMO_DATA' },
      });
      const cleanup = result.cleanup || {};
      const seed = result.seed || {};
      toast(
        `تمت إعادة التهيئة: حُذف ${formatNumber(
          cleanup.deleted_applications || 0
        )} طلبًا و${formatNumber(cleanup.deleted_departments || 0)} قسمًا، وأُضيف ${formatNumber(
          seed.applications_inserted || 0
        )} طلبًا و${formatNumber(seed.departments_inserted || 0)} قسمًا.`
      );
      reload();
    } catch (resetError) {
      toast(resetError.message || 'تعذّرت إعادة تهيئة البيانات التجريبية.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const runCleanup = async () => {
    const confirmed = await confirm({
      title: 'حذف البيانات التجريبية فقط',
      message:
        'سيتم حذف جميع الطلبات والأقسام التجريبية دون إعادة إنشائها. تُحفظ البيانات الحقيقية بالكامل، وأي قسم تجريبي مرتبط بطلب حقيقي سيُؤرشف بدلًا من حذفه. اكتب DELETE_DEMO_DATA للتأكيد.',
      confirmLabel: 'حذف البيانات التجريبية',
      danger: true,
      requireText: 'DELETE_DEMO_DATA',
    });
    if (!confirmed) return;

    setBusyAction('cleanup');
    try {
      const result = await api('/api/admin/demo-data/cleanup', {
        method: 'POST',
        body: { confirm: 'DELETE_DEMO_DATA' },
      });
      toast(
        `تم حذف ${formatNumber(result.deleted_applications || 0)} طلبًا و${formatNumber(
          result.deleted_departments || 0
        )} قسمًا تجريبيًا${
          result.archived_departments
            ? `، وأُرشف ${formatNumber(result.archived_departments)} قسمًا مرتبطًا ببيانات حقيقية`
            : ''
        }.`
      );
      reload();
    } catch (cleanupError) {
      toast(cleanupError.message || 'تعذّر حذف البيانات التجريبية.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading && !data) return <PageSkeleton stats />;

  if (error) {
    return (
      <>
        <PageHead title="البيانات التجريبية" />
        <div className="panel mt-2">
          <div className="panel__body">
            <Alert
              type="error"
              message={error.message || 'تعذّر تحميل ملخص البيانات التجريبية.'}
            />
            <button className="btn btn-primary mt-2" type="button" onClick={reload}>
              إعادة المحاولة
            </button>
          </div>
        </div>
      </>
    );
  }

  const counts = data?.counts || {};

  return (
    <>
      <PageHead
        title="البيانات التجريبية"
        description="سجلات العرض التجريبية موسومة في قاعدة البيانات ويمكن تمييزها عن البيانات الحقيقية."
        actions={[
          <button className="btn btn-outline" type="button" key="refresh" onClick={reload}>
            <Icon name="refresh" size={16} />
            <span>تحديث</span>
          </button>,
        ]}
      />

      <div className="stat-grid mt-2">
        <StatCard
          label="أقسام تجريبية"
          value={counts.demo_departments}
          meta="is_demo = 1"
          accent
        />
        <StatCard label="طلبات تجريبية" value={counts.demo_applications} meta="is_demo = 1" />
        <StatCard
          label="أقسام حقيقية"
          value={counts.real_departments}
          meta="is_demo = 0 — محمية"
        />
        <StatCard
          label="طلبات حقيقية"
          value={counts.real_applications}
          meta="is_demo = 0 — محمية"
        />
      </div>

      <section className="panel mt-2">
        <div className="panel__body">
          <div className="notice notice--info">
            <Icon name="info" size={18} />
            <span>
              البيانات التجريبية لا تُعاد تلقائيًا عند تشغيل الخادم. استخدم الأزرار أدناه صراحةً
              لإضافتها أو إعادة تهيئتها أو حذفها.
            </span>
          </div>
          <div className="notice mt-2">
            <Icon name="check" size={18} />
            <span>
              عمليات الحذف وإعادة التهيئة تستهدف السجلات الموسومة is_demo=1 فقط. لا يمكن حذف طلب
              حقيقي أو قسم مرتبط بطلبات حقيقية من هذه الصفحة.
            </span>
          </div>
        </div>
      </section>

      <div className="mini-grid mt-2">
        <ActionPanel
          title="إضافة الناقص فقط"
          description="عملية آمنة وقابلة للتكرار: تُضاف السجلات التجريبية غير الموجودة دون تعديل الموجود."
          notice="لا تُحذف أي بيانات. مثالية بعد التثبيت الأول أو بعد حذف بعض سجلات العرض."
          buttonLabel="إضافة البيانات التجريبية"
          busy={busyAction === 'seed'}
          onAction={runSeed}
        />
        <ActionPanel
          title="إعادة التهيئة"
          description="حذف البيانات التجريبية الحالية ثم إعادة إنشاء مجموعة العرض الأصلية."
          notice="تتطلب كتابة RESET_DEMO_DATA. البيانات الحقيقية لا تتأثر."
          noticeType="danger"
          buttonLabel="إعادة تهيئة البيانات"
          danger
          busy={busyAction === 'reset'}
          onAction={runReset}
        />
        <ActionPanel
          title="حذف البيانات التجريبية"
          description="إزالة كل سجلات العرض دون إعادة إنشائها، مع الحفاظ على البيانات الحقيقية."
          notice="تتطلب كتابة DELETE_DEMO_DATA. الأقسام التجريبية المرتبطة بطلبات حقيقية تُؤرشف."
          noticeType="danger"
          buttonLabel="حذف البيانات التجريبية"
          danger
          busy={busyAction === 'cleanup'}
          onAction={runCleanup}
        />
      </div>

      {data ? <SummaryTables data={data} /> : null}
    </>
  );
}
