import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/hooks.js';
import { formatDateTime } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  DemoBadge,
  PageHead,
  PageSkeleton,
  STATUS_LABELS,
  StatusBadge,
} from '../../components/admin/ui.jsx';

function DetailRow({ label, children }) {
  const empty = children === null || children === undefined || children === '';
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{empty ? '—' : children}</dd>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const applicationId = Number(id);
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();

  const { data, loading, error } = useAsync(async () => {
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      throw new ApiError('معرّف الطلب غير صالح.', { status: 400 });
    }
    return api(`/api/admin/applications/${applicationId}`);
  }, [applicationId]);

  const [application, setApplication] = useState(null);
  const [statusValue, setStatusValue] = useState('NEW');
  const [statusBusy, setStatusBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (!data) return;
    setApplication(data);
    setStatusValue(data.status || 'NEW');
    setNotes(data.admin_notes || '');
  }, [data]);

  const backAction = (
    <Link className="btn btn-outline" to="/applications" key="back">
      <Icon name="arrowLeft" size={16} />
      <span>رجوع للطلبات</span>
    </Link>
  );

  if (loading) return <PageSkeleton />;

  if (error || !application) {
    return (
      <>
        <PageHead title="تعذّر عرض الطلب" actions={[backAction]} />
        <div className="panel mt-2">
          <div className="panel__body">
            <Alert
              type="error"
              message={
                error instanceof ApiError && error.status === 404
                  ? 'الطلب المطلوب غير موجود. ربما تم حذفه.'
                  : (error && error.message) || 'تعذّر تحميل بيانات الطلب.'
              }
            />
          </div>
        </div>
      </>
    );
  }

  const saveStatus = async () => {
    if (statusValue === application.status) {
      toast('الحالة محدّثة بالفعل.', 'warning');
      return;
    }
    setAlert(null);
    setStatusBusy(true);
    try {
      const updated = await api(`/api/admin/applications/${application.id}/status`, {
        method: 'PATCH',
        body: { status: statusValue },
      });
      setApplication((current) => ({ ...current, ...updated }));
      setStatusValue(updated.status || statusValue);
      toast('تم تحديث حالة الطلب.');
    } catch (statusError) {
      setAlert({ type: 'error', message: statusError.message || 'تعذّر تحديث حالة الطلب.' });
      setStatusValue(application.status);
    } finally {
      setStatusBusy(false);
    }
  };

  const saveNotes = async () => {
    setAlert(null);
    setNotesBusy(true);
    try {
      const updated = await api(`/api/admin/applications/${application.id}/notes`, {
        method: 'PATCH',
        body: { admin_notes: notes },
      });
      setApplication((current) => ({ ...current, ...updated }));
      setNotes(updated.admin_notes || '');
      toast('تم حفظ الملاحظات الإدارية.');
    } catch (notesError) {
      setAlert({ type: 'error', message: notesError.message || 'تعذّر حفظ الملاحظات.' });
    } finally {
      setNotesBusy(false);
    }
  };

  const onDelete = async () => {
    const confirmed = await confirm({
      title: application.is_demo ? 'حذف طلب تجريبي' : 'حذف طلب حقيقي',
      message: application.is_demo
        ? `سيتم حذف الطلب ${application.reference_number} نهائيًا. اكتب رقم الطلب للتأكيد.`
        : `هذا طلب حقيقي (${application.reference_number}). سيتم حذفه نهائيًا من قاعدة البيانات ولا يمكن التراجع. اكتب رقم الطلب للتأكيد.`,
      confirmLabel: 'حذف نهائي',
      danger: true,
      requireText: application.reference_number,
    });
    if (!confirmed) return;

    setAlert(null);
    try {
      await api(`/api/admin/applications/${application.id}`, { method: 'DELETE' });
      toast(application.is_demo ? 'تم حذف الطلب التجريبي.' : 'تم حذف الطلب.');
      window.setTimeout(() => navigate('/applications'), 500);
    } catch (deleteError) {
      setAlert({ type: 'error', message: deleteError.message || 'تعذّر حذف الطلب.' });
    }
  };

  return (
    <>
      <PageHead
        title={`طلب ${application.reference_number}`}
        description={`تاريخ التقديم: ${formatDateTime(
          application.submitted_at
        )} — آخر تحديث: ${formatDateTime(application.updated_at)}`}
        actions={[backAction]}
      />

      <div className="mt-2">
        <Alert type={alert?.type} message={alert?.message} />
      </div>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>بيانات المتقدم</h3>
              <p>البيانات المسجلة عند إرسال الطلب من الموقع.</p>
            </div>
            <DemoBadge
              isDemo={application.is_demo}
              demoLabel="بيانات تجريبية"
              realLabel="بيانات حقيقية"
            />
          </div>
          <div className="panel__body">
            <dl className="detail-list">
              <DetailRow label="رقم الطلب">
                <span className="cell-ref">{application.reference_number}</span>
              </DetailRow>
              <DetailRow label="الاسم الكامل">{application.full_name}</DetailRow>
              <DetailRow label="رقم الهاتف">
                <a href={`tel:${application.phone}`} dir="ltr">
                  {application.phone}
                </a>
              </DetailRow>
              <DetailRow label="البريد الإلكتروني">
                {application.email ? (
                  <a href={`mailto:${application.email}`} dir="ltr">
                    {application.email}
                  </a>
                ) : null}
              </DetailRow>
              <DetailRow label="القسم">
                {application.department_id ? (
                  <Link to={`/departments/${application.department_id}/edit`}>
                    {application.department_name || '—'}
                  </Link>
                ) : (
                  application.department_name || '—'
                )}
              </DetailRow>
              <DetailRow label="المؤهل / المرحلة السابقة">
                {application.previous_education}
              </DetailRow>
              <DetailRow label="ملاحظات المتقدم">
                <div className="note-block">{application.additional_notes || ''}</div>
              </DetailRow>
              <DetailRow label="تاريخ التقديم">
                {formatDateTime(application.submitted_at)}
              </DetailRow>
              <DetailRow label="آخر تحديث">{formatDateTime(application.updated_at)}</DetailRow>
            </dl>
          </div>
        </section>

        <div>
          <section className="panel">
            <div className="panel__head">
              <div>
                <h3>حالة الطلب</h3>
                <p>تظهر الحالة هنا فقط؛ لا تُرسل إشعارات تلقائية للمتقدم.</p>
              </div>
            </div>
            <div className="panel__body">
              <div className="chip-row">
                <StatusBadge status={application.status} />
              </div>
              <div className="field mt-2">
                <label htmlFor="status-select">تغيير الحالة</label>
                <select
                  className="select"
                  id="status-select"
                  value={statusValue}
                  onChange={(event) => setStatusValue(event.target.value)}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={statusBusy}
                  onClick={saveStatus}
                >
                  <Icon name="save" size={15} />
                  <span>{statusBusy ? 'جارٍ الحفظ…' : 'حفظ الحالة'}</span>
                </button>
              </div>
            </div>
          </section>

          <section className="panel mt-2">
            <div className="panel__head">
              <div>
                <h3>ملاحظات إدارية داخلية</h3>
                <p>لا تظهر أبدًا في الموقع العام أو لملف المتقدم.</p>
              </div>
            </div>
            <div className="panel__body">
              <div className="field">
                <label htmlFor="admin-notes">الملاحظات</label>
                <textarea
                  className="textarea"
                  id="admin-notes"
                  rows={6}
                  maxLength={2000}
                  placeholder="ملاحظات داخلية لفريق الإدارة…"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <p className="hint">2000 حرف كحد أقصى. تُحفظ كنص عادي.</p>
              </div>
              <div className="form-actions">
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={notesBusy}
                  onClick={saveNotes}
                >
                  <Icon name="save" size={15} />
                  <span>{notesBusy ? 'جارٍ الحفظ…' : 'حفظ الملاحظات'}</span>
                </button>
              </div>
            </div>
          </section>

          <section className="panel mt-2">
            <div className="panel__head">
              <div>
                <h3>إجراءات حساسة</h3>
                <p>الحذف النهائي متاح لجميع الطلبات بعد تأكيد كتابي.</p>
              </div>
            </div>
            <div className="panel__body">
              <div className="notice notice--danger">
                <Icon name="alert" size={18} />
                <span>
                  {application.is_demo
                    ? 'هذا طلب تجريبي (is_demo). حذفه نهائي ولن يؤثر على الطلبات الحقيقية.'
                    : 'هذا طلب حقيقي. الحذف نهائي ويحذف السجل بالكامل؛ يمكنك بدلًا من ذلك تغيير حالته أو إضافة ملاحظات.'}
                </span>
              </div>
              <div className="form-actions">
                <button className="btn btn-danger-outline" type="button" onClick={onDelete}>
                  <Icon name="trash" size={15} />
                  <span>حذف الطلب نهائيًا</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
