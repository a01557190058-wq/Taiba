/**
 * Application detail: read-only applicant data, status workflow, internal
 * admin notes and full deletion (any application, after typed confirmation).
 */
import {
  boot,
  api,
  ApiError,
  qs,
  el,
  icon,
  formatDateTime,
  statusBadge,
  STATUS_LABELS,
  pageHead,
  toast,
  setAlert,
  setButtonBusy,
  confirmDialog,
} from './admin.js';

const content = qs('#admin-content');
const match = window.location.pathname.match(/^\/admin\/applications\/(\d+)$/);
const applicationId = match ? Number(match[1]) : null;

const admin = await boot({
  active: 'applications',
  title: 'تفاصيل الطلب',
  subtitle: 'مراجعة بيانات المتقدم وتحديث حالة الطلب',
});

let application = null;

if (admin) {
  if (!applicationId) {
    renderFatal('معرّف الطلب غير صالح.');
  } else {
    load();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function detailRow(label, value) {
  const dd = el('dd');
  if (value instanceof Node) dd.append(value);
  else dd.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
  return el('div', { className: 'detail-row' }, [el('dt', { text: label }), dd]);
}

function demoBadge(isDemo) {
  return isDemo
    ? el('span', { className: 'badge badge--demo', text: 'بيانات تجريبية' })
    : el('span', { className: 'badge badge--real', text: 'بيانات حقيقية' });
}

function renderFatal(message) {
  const alertBox = el('div');
  setAlert(alertBox, { type: 'error', message });
  content.replaceChildren(
    pageHead({
      title: 'تعذّر عرض الطلب',
      actions: [
        el('a', { className: 'btn btn-outline', attrs: { href: '/admin/applications' } }, [
          icon('arrowLeft', 16),
          el('span', { text: 'رجوع للطلبات' }),
        ]),
      ],
    }),
    el('div', { className: 'panel mt-2' }, [el('div', { className: 'panel__body' }, [alertBox])])
  );
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render() {
  const head = pageHead({
    title: `طلب ${application.reference_number}`,
    description: `تاريخ التقديم: ${formatDateTime(application.submitted_at)} — آخر تحديث: ${formatDateTime(
      application.updated_at
    )}`,
    actions: [
      el('a', { className: 'btn btn-outline', attrs: { href: '/admin/applications' } }, [
        icon('arrowLeft', 16),
        el('span', { text: 'رجوع للطلبات' }),
      ]),
    ],
  });

  const alertBox = el('div', { className: 'alert alert--error', attrs: { id: 'page-alert', hidden: true } });

  // --- Applicant data ------------------------------------------------------
  const phone = el('a', { attrs: { href: `tel:${application.phone}`, dir: 'ltr' }, text: application.phone });
  const email = application.email
    ? el('a', { attrs: { href: `mailto:${application.email}`, dir: 'ltr' }, text: application.email })
    : null;

  const department = application.department_id
    ? el('a', {
        attrs: { href: `/admin/departments/${application.department_id}/edit` },
        text: application.department_name || '—',
      })
    : application.department_name || '—';

  const applicantPanel = el('section', { className: 'panel' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: 'بيانات المتقدم' }),
        el('p', { text: 'البيانات المسجلة عند إرسال الطلب من الموقع.' }),
      ]),
      demoBadge(application.is_demo),
    ]),
    el('div', { className: 'panel__body' }, [
      el('dl', { className: 'detail-list' }, [
        detailRow('رقم الطلب', el('span', { className: 'cell-ref', text: application.reference_number })),
        detailRow('الاسم الكامل', application.full_name),
        detailRow('رقم الهاتف', phone),
        detailRow('البريد الإلكتروني', email),
        detailRow('القسم', department),
        detailRow('المؤهل / المرحلة السابقة', application.previous_education),
        detailRow('ملاحظات المتقدم', el('div', { className: 'note-block', text: application.additional_notes || '' })),
        detailRow('تاريخ التقديم', formatDateTime(application.submitted_at)),
        detailRow('آخر تحديث', formatDateTime(application.updated_at)),
      ]),
    ]),
  ]);

  // --- Status --------------------------------------------------------------
  const statusWrap = el('div', { className: 'chip-row' }, [statusBadge(application.status)]);

  const statusSelect = el('select', { className: 'select', attrs: { id: 'status-select' } }, [
    ...Object.entries(STATUS_LABELS).map(([value, label]) =>
      el('option', { text: label, attrs: { value } })
    ),
  ]);
  statusSelect.value = application.status;

  const statusButton = el('button', {
    className: 'btn btn-primary btn-sm',
    attrs: { type: 'button', id: 'save-status' },
  }, [icon('save', 15), el('span', { text: 'حفظ الحالة' })]);

  statusButton.addEventListener('click', async () => {
    const nextStatus = statusSelect.value;
    if (nextStatus === application.status) {
      toast('الحالة محدّثة بالفعل.', 'warning');
      return;
    }

    setButtonBusy(statusButton, true, 'جارٍ الحفظ…');
    try {
      const updated = await api(`/api/admin/applications/${application.id}/status`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      application = { ...application, ...updated };
      statusWrap.replaceChildren(statusBadge(application.status));
      statusSelect.value = application.status;
      toast('تم تحديث حالة الطلب.');
    } catch (error) {
      setAlert(alertBox, {
        type: 'error',
        message: error.message || 'تعذّر تحديث حالة الطلب.',
      });
      statusSelect.value = application.status;
    } finally {
      setButtonBusy(statusButton, false);
    }
  });

  const statusPanel = el('section', { className: 'panel' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: 'حالة الطلب' }),
        el('p', { text: 'تظهر الحالة هنا فقط؛ لا تُرسل إشعارات تلقائية للمتقدم.' }),
      ]),
    ]),
    el('div', { className: 'panel__body' }, [
      statusWrap,
      el('div', { className: 'field mt-2' }, [
        el('label', { attrs: { for: 'status-select' }, text: 'تغيير الحالة' }),
        statusSelect,
      ]),
      el('div', { className: 'form-actions' }, [statusButton]),
    ]),
  ]);

  // --- Admin notes ---------------------------------------------------------
  const notesInput = el('textarea', {
    className: 'textarea',
    attrs: { id: 'admin-notes', rows: 6, maxlength: 2000, placeholder: 'ملاحظات داخلية لفريق الإدارة…' },
  });
  notesInput.value = application.admin_notes || '';

  const notesButton = el('button', {
    className: 'btn btn-primary btn-sm',
    attrs: { type: 'button', id: 'save-notes' },
  }, [icon('save', 15), el('span', { text: 'حفظ الملاحظات' })]);

  notesButton.addEventListener('click', async () => {
    setButtonBusy(notesButton, true, 'جارٍ الحفظ…');
    try {
      const updated = await api(`/api/admin/applications/${application.id}/notes`, {
        method: 'PATCH',
        body: { admin_notes: notesInput.value },
      });
      application = { ...application, ...updated };
      notesInput.value = application.admin_notes || '';
      toast('تم حفظ الملاحظات الإدارية.');
    } catch (error) {
      setAlert(alertBox, {
        type: 'error',
        message: error.message || 'تعذّر حفظ الملاحظات.',
      });
    } finally {
      setButtonBusy(notesButton, false);
    }
  });

  const notesPanel = el('section', { className: 'panel mt-2' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: 'ملاحظات إدارية داخلية' }),
        el('p', { text: 'لا تظهر أبدًا في الموقع العام أو لملف المتقدم.' }),
      ]),
    ]),
    el('div', { className: 'panel__body' }, [
      el('div', { className: 'field' }, [
        el('label', { attrs: { for: 'admin-notes' }, text: 'الملاحظات' }),
        notesInput,
        el('p', { className: 'hint', text: '2000 حرف كحد أقصى. تُحفظ كنص عادي.' }),
      ]),
      el('div', { className: 'form-actions' }, [notesButton]),
    ]),
  ]);

  // --- Danger zone ---------------------------------------------------------
  const deleteButton = el('button', {
    className: 'btn btn-danger-outline',
    attrs: { type: 'button', id: 'delete-application' },
  }, [icon('trash', 15), el('span', { text: 'حذف الطلب نهائيًا' })]);

  deleteButton.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: application.is_demo ? 'حذف طلب تجريبي' : 'حذف طلب حقيقي',
      message: application.is_demo
        ? `سيتم حذف الطلب ${application.reference_number} نهائيًا. اكتب رقم الطلب للتأكيد.`
        : `هذا طلب حقيقي (${application.reference_number}). سيتم حذفه نهائيًا من قاعدة البيانات ولا يمكن التراجع. اكتب رقم الطلب للتأكيد.`,
      confirmLabel: 'حذف نهائي',
      danger: true,
      requireText: application.reference_number,
    });
    if (!confirmed) return;

    setButtonBusy(deleteButton, true, 'جارٍ الحذف…');
    try {
      await api(`/api/admin/applications/${application.id}`, { method: 'DELETE' });
      toast(application.is_demo ? 'تم حذف الطلب التجريبي.' : 'تم حذف الطلب.');
      window.setTimeout(() => {
        window.location.href = '/admin/applications';
      }, 550);
    } catch (error) {
      setAlert(alertBox, {
        type: 'error',
        message: error.message || 'تعذّر حذف الطلب.',
      });
      setButtonBusy(deleteButton, false);
    }
  });

  const dangerBody = [
    el('div', { className: application.is_demo ? 'notice notice--danger' : 'notice notice--danger' }, [
      icon('alert', 18),
      el('span', {
        text: application.is_demo
          ? 'هذا طلب تجريبي (is_demo). حذفه نهائي ولن يؤثر على الطلبات الحقيقية.'
          : 'هذا طلب حقيقي. الحذف نهائي ويحذف السجل بالكامل؛ يمكنك بدلًا من ذلك تغيير حالته أو إضافة ملاحظات.',
      }),
    ]),
    el('div', { className: 'form-actions' }, [deleteButton]),
  ];

  const dangerPanel = el('section', { className: 'panel mt-2' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: 'إجراءات حساسة' }),
        el('p', { text: 'الحذف النهائي متاح لجميع الطلبات بعد تأكيد كتابي.' }),
      ]),
    ]),
    el('div', { className: 'panel__body' }, dangerBody),
  ]);

  content.replaceChildren(
    head,
    el('div', { className: 'mt-2' }, [alertBox]),
    el('div', { className: 'detail-grid' }, [
      applicantPanel,
      el('div', {}, [statusPanel, notesPanel, dangerPanel]),
    ])
  );
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
async function load() {
  content.replaceChildren(
    el('div', { className: 'skel skel-line' }),
    el('div', { className: 'skel skel-block' })
  );

  try {
    application = await api(`/api/admin/applications/${applicationId}`);
    render();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      renderFatal('الطلب المطلوب غير موجود. ربما تم حذفه.');
    } else {
      renderFatal(error.message || 'تعذّر تحميل بيانات الطلب.');
    }
  }
}
