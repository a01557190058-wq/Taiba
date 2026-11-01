/**
 * Demo data management: idempotent seeding, explicit reset and cleanup.
 * Every destructive action requires the confirmation token expected by the
 * API, and real records are never touched.
 */
import {
  boot,
  api,
  qs,
  el,
  icon,
  formatNumber,
  formatDateTime,
  statusBadge,
  pageHead,
  toast,
  setAlert,
  setButtonBusy,
  confirmDialog,
  departmentStateBadge,
  emptyState,
} from './admin.js';

const content = qs('#admin-content');
const admin = await boot({
  active: 'demo',
  title: 'البيانات التجريبية',
  subtitle: 'إدارة سجلات العرض التجريبية دون المساس بالبيانات الحقيقية',
});

if (admin) {
  load();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function statCard({ label, value, meta, accent = false }) {
  return el('article', { className: `stat-card${accent ? ' stat-card--accent' : ''}` }, [
    el('span', { className: 'stat-card__label', text: label }),
    el('strong', { className: 'stat-card__value', text: formatNumber(value) }),
    meta ? el('span', { className: 'stat-card__meta', text: meta }) : null,
  ]);
}

function actionPanel({ title, description, notice, noticeType = '', buttonLabel, buttonClass, onAction }) {
  const button = el('button', {
    className: `btn ${buttonClass}`,
    attrs: { type: 'button' },
  }, [icon(buttonClass.includes('danger') ? 'trash' : 'database', 16), el('span', { text: buttonLabel })]);

  button.addEventListener('click', () => onAction(button));

  return el('section', { className: 'panel' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: title }),
        el('p', { text: description }),
      ]),
    ]),
    el('div', { className: 'panel__body' }, [
      notice
        ? el('div', { className: `notice${noticeType ? ` notice--${noticeType}` : ''}` }, [
            icon('info', 18),
            el('span', { text: notice }),
          ])
        : null,
      el('div', { className: 'form-actions' }, [button]),
    ]),
  ]);
}

function summaryTables(data) {
  const departmentRows = data.departments.map((department) =>
    el('tr', {}, [
      el('td', {}, [
        el('div', { className: 'cell-strong', text: department.name }),
        el('div', { className: 'cell-muted', attrs: { dir: 'ltr' }, text: department.slug }),
      ]),
      el('td', {}, [departmentStateBadge(department)]),
      el('td', { className: 'cell-muted', text: formatDateTime(department.updated_at) }),
      el('td', { className: 'cell-actions' }, [
        el('a', {
          className: 'btn btn-outline btn-sm',
          attrs: { href: `/admin/departments/${department.id}/edit` },
        }, [icon('edit', 15), el('span', { text: 'تحرير' })]),
      ]),
    ])
  );

  const applicationRows = data.applications.map((application) =>
    el('tr', {}, [
      el('td', { className: 'cell-ref', text: application.reference_number }),
      el('td', { className: 'cell-strong', text: application.full_name }),
      el('td', { text: application.department_name_snapshot }),
      el('td', {}, [statusBadge(application.status)]),
      el('td', { className: 'cell-muted', text: formatDateTime(application.submitted_at) }),
      el('td', { className: 'cell-actions' }, [
        el('a', {
          className: 'btn btn-outline btn-sm',
          attrs: { href: `/admin/applications/${application.id}` },
        }, [icon('eye', 15), el('span', { text: 'عرض' })]),
      ]),
    ])
  );

  return el('div', { className: 'detail-grid mt-2' }, [
    el('section', { className: 'panel' }, [
      el('div', { className: 'panel__head' }, [
        el('div', {}, [
          el('h3', { text: 'الأقسام التجريبية' }),
          el('p', { text: `${formatNumber(data.departments.length)} قسمًا موسومًا كبيانات تجريبية.` }),
        ]),
      ]),
      data.departments.length
        ? el('div', { className: 'table-wrap' }, [
            el('table', { className: 'data-table' }, [
              el('thead', {}, [
                el('tr', {}, [
                  el('th', { text: 'القسم' }),
                  el('th', { text: 'الحالة' }),
                  el('th', { text: 'آخر تحديث' }),
                  el('th', { text: '' }),
                ]),
              ]),
              el('tbody', {}, departmentRows),
            ]),
          ])
        : emptyState({
            title: 'لا توجد أقسام تجريبية',
            message: 'استخدم زر إضافة البيانات التجريبية لإنشاء مجموعة العرض.',
            iconName: 'layers',
          }),
    ]),
    el('section', { className: 'panel' }, [
      el('div', { className: 'panel__head' }, [
        el('div', {}, [
          el('h3', { text: 'الطلبات التجريبية' }),
          el('p', { text: `${formatNumber(data.applications.length)} طلبًا موسومًا كبيانات تجريبية.` }),
        ]),
      ]),
      data.applications.length
        ? el('div', { className: 'table-wrap' }, [
            el('table', { className: 'data-table' }, [
              el('thead', {}, [
                el('tr', {}, [
                  el('th', { text: 'الطلب' }),
                  el('th', { text: 'المتقدم' }),
                  el('th', { text: 'القسم' }),
                  el('th', { text: 'الحالة' }),
                  el('th', { text: 'التقديم' }),
                  el('th', { text: '' }),
                ]),
              ]),
              el('tbody', {}, applicationRows),
            ]),
          ])
        : emptyState({
            title: 'لا توجد طلبات تجريبية',
            message: 'استخدم زر إضافة البيانات التجريبية لإنشاء طلبات العرض.',
            iconName: 'inbox',
          }),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function runSeed(button) {
  setButtonBusy(button, true, 'جارٍ الإضافة…');
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
    await load();
  } catch (error) {
    toast(error.message || 'تعذّرت إضافة البيانات التجريبية.', 'error');
    setButtonBusy(button, false);
  }
}

async function runReset(button) {
  const confirmed = await confirmDialog({
    title: 'إعادة تهيئة البيانات التجريبية',
    message:
      'سيتم حذف جميع الطلبات والأقسام الموسومة كبيانات تجريبية، ثم إعادة إنشاء مجموعة العرض من جديد. لن تُحذف أو تُعدّل أي بيانات حقيقية. اكتب RESET_DEMO_DATA للتأكيد.',
    confirmLabel: 'إعادة التهيئة',
    danger: true,
    requireText: 'RESET_DEMO_DATA',
  });
  if (!confirmed) return;

  setButtonBusy(button, true, 'جارٍ إعادة التهيئة…');
  try {
    const result = await api('/api/admin/demo-data/reset', {
      method: 'POST',
      body: { confirm: 'RESET_DEMO_DATA' },
    });
    const cleanup = result.cleanup || {};
    const seed = result.seed || {};
    toast(
      `تمت إعادة التهيئة: حُذف ${formatNumber(cleanup.deleted_applications || 0)} طلبًا و${formatNumber(
        cleanup.deleted_departments || 0
      )} قسمًا، وأُضيف ${formatNumber(seed.applications_inserted || 0)} طلبًا و${formatNumber(
        seed.departments_inserted || 0
      )} قسمًا.`
    );
    await load();
  } catch (error) {
    toast(error.message || 'تعذّرت إعادة تهيئة البيانات التجريبية.', 'error');
    setButtonBusy(button, false);
  }
}

async function runCleanup(button) {
  const confirmed = await confirmDialog({
    title: 'حذف البيانات التجريبية فقط',
    message:
      'سيتم حذف جميع الطلبات والأقسام التجريبية دون إعادة إنشائها. تُحفظ البيانات الحقيقية بالكامل، وأي قسم تجريبي مرتبط بطلب حقيقي سيُؤرشف بدلًا من حذفه. اكتب DELETE_DEMO_DATA للتأكيد.',
    confirmLabel: 'حذف البيانات التجريبية',
    danger: true,
    requireText: 'DELETE_DEMO_DATA',
  });
  if (!confirmed) return;

  setButtonBusy(button, true, 'جارٍ الحذف…');
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
    await load();
  } catch (error) {
    toast(error.message || 'تعذّر حذف البيانات التجريبية.', 'error');
    setButtonBusy(button, false);
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render(data) {
  const counts = data.counts || {};

  const head = pageHead({
    title: 'البيانات التجريبية',
    description: 'سجلات العرض التجريبية موسومة في قاعدة البيانات ويمكن تمييزها عن البيانات الحقيقية.',
    actions: [
      el('button', { className: 'btn btn-outline', attrs: { type: 'button', id: 'refresh-button' } }, [
        icon('refresh', 16),
        el('span', { text: 'تحديث' }),
      ]),
    ],
  });

  const statsGrid = el('div', { className: 'stat-grid mt-2' }, [
    statCard({
      label: 'أقسام تجريبية',
      value: counts.demo_departments,
      meta: 'is_demo = 1',
      accent: true,
    }),
    statCard({ label: 'طلبات تجريبية', value: counts.demo_applications, meta: 'is_demo = 1' }),
    statCard({ label: 'أقسام حقيقية', value: counts.real_departments, meta: 'is_demo = 0 — محمية' }),
    statCard({ label: 'طلبات حقيقية', value: counts.real_applications, meta: 'is_demo = 0 — محمية' }),
  ]);

  const noticePanel = el('section', { className: 'panel mt-2' }, [
    el('div', { className: 'panel__body' }, [
      el('div', { className: 'notice notice--info' }, [
        icon('info', 18),
        el('span', {
          text: 'البيانات التجريبية لا تُعاد تلقائيًا عند تشغيل الخادم. استخدم الأزرار أدناه صراحةً لإضافتها أو إعادة تهيئتها أو حذفها.',
        }),
      ]),
      el('div', { className: 'notice mt-2' }, [
        icon('check', 18),
        el('span', {
          text: 'عمليات الحذف وإعادة التهيئة تستهدف السجلات الموسومة is_demo=1 فقط. لا يمكن حذف طلب حقيقي أو قسم مرتبط بطلبات حقيقية من هذه الصفحة.',
        }),
      ]),
    ]),
  ]);

  const actionsGrid = el('div', { className: 'mini-grid mt-2' }, [
    actionPanel({
      title: 'إضافة الناقص فقط',
      description: 'عملية آمنة وقابلة للتكرار: تُضاف السجلات التجريبية غير الموجودة دون تعديل الموجود.',
      notice: 'لا تُحذف أي بيانات. مثالية بعد التثبيت الأول أو بعد حذف بعض سجلات العرض.',
      buttonLabel: 'إضافة البيانات التجريبية',
      buttonClass: 'btn-primary',
      onAction: runSeed,
    }),
    actionPanel({
      title: 'إعادة التهيئة',
      description: 'حذف البيانات التجريبية الحالية ثم إعادة إنشاء مجموعة العرض الأصلية.',
      notice: 'تتطلب كتابة RESET_DEMO_DATA. البيانات الحقيقية لا تتأثر.',
      noticeType: 'danger',
      buttonLabel: 'إعادة تهيئة البيانات',
      buttonClass: 'btn-danger-outline',
      onAction: runReset,
    }),
    actionPanel({
      title: 'حذف البيانات التجريبية',
      description: 'إزالة كل سجلات العرض دون إعادة إنشائها، مع الحفاظ على البيانات الحقيقية.',
      notice: 'تتطلب كتابة DELETE_DEMO_DATA. الأقسام التجريبية المرتبطة بطلبات حقيقية تُؤرشف.',
      noticeType: 'danger',
      buttonLabel: 'حذف البيانات التجريبية',
      buttonClass: 'btn-danger-outline',
      onAction: runCleanup,
    }),
  ]);

  content.replaceChildren(head, statsGrid, noticePanel, actionsGrid, summaryTables(data));

  const refresh = qs('#refresh-button');
  if (refresh) refresh.addEventListener('click', load);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
async function load() {
  content.replaceChildren(
    el('div', { className: 'skel skel-line' }),
    el('div', { className: 'stat-grid' }, [
      el('div', { className: 'skel skel-block' }),
      el('div', { className: 'skel skel-block' }),
      el('div', { className: 'skel skel-block' }),
      el('div', { className: 'skel skel-block' }),
    ]),
    el('div', { className: 'skel skel-block' })
  );

  try {
    const data = await api('/api/admin/demo-data');
    render(data);
  } catch (error) {
    const alertBox = el('div');
    setAlert(alertBox, { type: 'error', message: error.message || 'تعذّر تحميل ملخص البيانات التجريبية.' });
    const retry = el('button', { className: 'btn btn-primary mt-2', attrs: { type: 'button' }, text: 'إعادة المحاولة' });
    retry.addEventListener('click', load);
    content.replaceChildren(
      pageHead({ title: 'البيانات التجريبية' }),
      el('div', { className: 'panel mt-2' }, [el('div', { className: 'panel__body' }, [alertBox, retry])])
    );
  }
}
