/**
 * Dashboard overview: all numbers come from the database via
 * GET /api/admin/dashboard/stats.
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
  emptyState,
  setAlert,
} from './admin.js';

const content = qs('#admin-content');
const admin = await boot({
  active: 'dashboard',
  title: 'نظرة عامة',
  subtitle: 'ملخص مباشر من قاعدة بيانات المدرسة',
});

if (admin) {
  init();
}

function statCard({ label, value, meta, accent = false }) {
  return el('article', { className: `stat-card${accent ? ' stat-card--accent' : ''}` }, [
    el('span', { className: 'stat-card__label', text: label }),
    el('strong', { className: 'stat-card__value', text: formatNumber(value) }),
    meta ? el('span', { className: 'stat-card__meta', text: meta }) : null,
  ]);
}

function recentTable(applications) {
  if (!applications.length) {
    return emptyState({
      title: 'لا توجد طلبات بعد',
      message: 'ستظهر أحدث طلبات التقديم هنا بمجرد وصولها.',
      actionLabel: 'عرض جميع الطلبات',
      onAction: () => {
        window.location.href = '/admin/applications';
      },
    });
  }

  const tbody = el('tbody');
  for (const application of applications) {
    tbody.append(
      el('tr', {}, [
        el('td', { className: 'cell-ref', text: application.reference_number }),
        el('td', { className: 'cell-strong', text: application.full_name }),
        el('td', { text: application.department_name }),
        el('td', {}, [statusBadge(application.status)]),
        el('td', { className: 'cell-muted', text: formatDateTime(application.submitted_at) }),
        el(
          'td',
          { className: 'cell-actions' },
          [
            el('a', {
              className: 'btn btn-outline btn-sm',
              attrs: { href: `/admin/applications/${application.id}` },
            }, [icon('eye', 15), el('span', { text: 'عرض' })]),
          ]
        ),
      ])
    );
  }

  return el('div', { className: 'table-wrap' }, [
    el('table', { className: 'data-table' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'رقم الطلب' }),
          el('th', { text: 'المتقدم' }),
          el('th', { text: 'القسم' }),
          el('th', { text: 'الحالة' }),
          el('th', { text: 'تاريخ التقديم' }),
          el('th', { text: '' }),
        ]),
      ]),
      tbody,
    ]),
  ]);
}

function statusBreakdown(apps) {
  const rows = [
    { key: 'new', label: 'جديد', status: 'NEW', count: apps.new },
    { key: 'under_review', label: 'قيد المراجعة', status: 'UNDER_REVIEW', count: apps.under_review },
    { key: 'accepted', label: 'مقبول', status: 'ACCEPTED', count: apps.accepted },
    { key: 'rejected', label: 'مرفوض', status: 'REJECTED', count: apps.rejected },
  ];
  const total = apps.total || 1;

  return el(
    'div',
    { className: 'detail-list' },
    rows.map((row) =>
      el('div', { className: 'detail-row' }, [
        el('dt', {}, [statusBadge(row.status)]),
        el('dd', {}, [
          el('div', { className: 'chip-row' }, [
            el('span', { className: 'chip', text: `${formatNumber(row.count)} طلب` }),
            el('span', { className: 'chip', text: `${Math.round((row.count / total) * 100)}%` }),
          ]),
        ]),
      ])
    )
  );
}

function render(stats) {
  const apps = stats.applications || {};
  const departments = stats.departments || {};
  const recent = Array.isArray(stats.recent_applications) ? stats.recent_applications : [];

  const head = pageHead({
    title: 'ملخص المدرسة',
    description: `آخر تحديث: ${formatDateTime(stats.generated_at)} — تُحسب جميع الأرقام من قاعدة البيانات مباشرة.`,
    actions: [
      el('button', { className: 'btn btn-outline', attrs: { type: 'button', id: 'refresh-button' } }, [
        icon('refresh', 16),
        el('span', { text: 'تحديث' }),
      ]),
      el('a', { className: 'btn btn-primary', attrs: { href: '/admin/applications' } }, [
        icon('inbox', 16),
        el('span', { text: 'إدارة الطلبات' }),
      ]),
    ],
  });

  const statsGrid = el('div', { className: 'stat-grid' }, [
    statCard({
      label: 'إجمالي طلبات التقديم',
      value: apps.total,
      meta: `${formatNumber(apps.demo)} تجريبي • ${formatNumber(apps.real)} حقيقي`,
      accent: true,
    }),
    statCard({ label: 'طلبات جديدة', value: apps.new, meta: 'بانتظار المراجعة' }),
    statCard({ label: 'طلبات مقبولة', value: apps.accepted, meta: 'حسب حالة الطلب' }),
    statCard({
      label: 'أقسام منشورة',
      value: departments.published,
      meta: `${formatNumber(departments.drafts)} مسودة • ${formatNumber(departments.archived)} مؤرشف`,
    }),
  ]);

  const recentPanel = el('section', { className: 'panel' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: 'أحدث طلبات التقديم' }),
        el('p', { text: 'آخر خمسة طلبات واردة بغض النظر عن الحالة.' }),
      ]),
      el('a', { className: 'btn btn-outline btn-sm', attrs: { href: '/admin/applications' }, text: 'عرض الكل' }),
    ]),
    recentTable(recent),
  ]);

  const sidePanel = el('section', { className: 'panel' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: 'توزيع حالات الطلبات' }),
        el('p', { text: 'نسبة كل حالة من إجمالي الطلبات.' }),
      ]),
    ]),
    el('div', { className: 'panel__body' }, [
      statusBreakdown(apps),
      el('div', { className: 'notice mt-2' }, [
        icon('info', 18),
        el('span', {
          text: `يوجد ${formatNumber(apps.demo)} طلبًا تجريبيًا و${formatNumber(apps.real)} طلبًا حقيقيًا. حذف الطلبات الحقيقية غير مسموح من النظام.`,
        }),
      ]),
    ]),
  ]);

  const quickPanel = el('section', { className: 'panel' }, [
    el('div', { className: 'panel__head' }, [el('h3', { text: 'إجراءات سريعة' })]),
    el('div', { className: 'panel__body' }, [
      el('div', { className: 'chip-row' }, [
        el('a', { className: 'btn btn-outline btn-sm', attrs: { href: '/admin/departments/new' } }, [
          icon('plus', 15),
          el('span', { text: 'قسم جديد' }),
        ]),
        el('a', { className: 'btn btn-outline btn-sm', attrs: { href: '/admin/content' } }, [
          icon('file', 15),
          el('span', { text: 'تحرير المحتوى' }),
        ]),
        el('a', { className: 'btn btn-outline btn-sm', attrs: { href: '/admin/demo-data' } }, [
          icon('database', 15),
          el('span', { text: 'البيانات التجريبية' }),
        ]),
        el('a', { className: 'btn btn-outline btn-sm', attrs: { href: '/', target: '_blank', rel: 'noopener' } }, [
          icon('external', 15),
          el('span', { text: 'عرض الموقع' }),
        ]),
      ]),
    ]),
  ]);

  content.replaceChildren(
    head,
    statsGrid,
    el('div', { className: 'detail-grid' }, [recentPanel, sidePanel]),
    quickPanel
  );

  const refresh = qs('#refresh-button');
  if (refresh) refresh.addEventListener('click', load);
}

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
    const stats = await api('/api/admin/dashboard/stats');
    render(stats);
  } catch (error) {
    const alertNode = el('div');
    setAlert(alertNode, { type: 'error', message: error.message || 'تعذّر تحميل الإحصاءات.' });
    const retryButton = el('button', {
      className: 'btn btn-primary mt-2',
      attrs: { type: 'button' },
      text: 'إعادة المحاولة',
    });
    retryButton.addEventListener('click', load);

    content.replaceChildren(
      pageHead({ title: 'ملخص المدرسة' }),
      el('div', { className: 'panel' }, [
        el('div', { className: 'panel__body' }, [alertNode, retryButton]),
      ])
    );
  }
}

function init() {
  load();
}
