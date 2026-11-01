/**
 * Admin departments list: search, state/demo filters, pagination and
 * publish/archive/delete actions. Deleting a department with applications is
 * rejected by the API (archive instead) — the UI surfaces that message.
 */
import {
  boot,
  api,
  request,
  ApiError,
  qs,
  el,
  icon,
  formatNumber,
  formatDate,
  departmentStateBadge,
  pageHead,
  paginationBar,
  emptyState,
  confirmDialog,
  toast,
  debounce,
} from './admin.js';

const content = qs('#admin-content');
const admin = await boot({
  active: 'departments',
  title: 'الأقسام',
  subtitle: 'إنشاء وتحرير ونشر الأقسام التعليمية',
});

const filters = {
  q: '',
  state: 'all',
  demo: 'all',
  page: 1,
};

if (admin) {
  readFromUrl();
  load();
}

function readFromUrl() {
  const params = new URLSearchParams(window.location.search);
  filters.q = params.get('q') || '';
  filters.state = ['all', 'published', 'draft', 'archived'].includes(params.get('state'))
    ? params.get('state')
    : 'all';
  filters.demo = ['all', 'true', 'false'].includes(params.get('is_demo'))
    ? params.get('is_demo')
    : 'all';
  filters.page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
}

function writeToUrl() {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.state !== 'all') params.set('state', filters.state);
  if (filters.demo !== 'all') params.set('is_demo', filters.demo);
  if (filters.page > 1) params.set('page', String(filters.page));
  const query = params.toString();
  window.history.replaceState(null, '', `/admin/departments${query ? `?${query}` : ''}`);
}

function demoBadge(department) {
  return department.is_demo
    ? el('span', { className: 'badge badge--demo', text: 'تجريبي' })
    : el('span', { className: 'badge badge--real', text: 'حقيقي' });
}

function buildFilters() {
  const searchInput = el('input', {
    className: 'input',
    attrs: {
      type: 'search',
      id: 'filter-q',
      value: filters.q,
      placeholder: 'ابحث بالاسم أو المعرّف…',
      autocomplete: 'off',
    },
  });

  const stateSelect = el('select', { className: 'select', attrs: { id: 'filter-state' } }, [
    el('option', { text: 'الكل', attrs: { value: 'all' } }),
    el('option', { text: 'منشور', attrs: { value: 'published' } }),
    el('option', { text: 'مسودة', attrs: { value: 'draft' } }),
    el('option', { text: 'مؤرشف', attrs: { value: 'archived' } }),
  ]);
  stateSelect.value = filters.state;

  const demoSelect = el('select', { className: 'select', attrs: { id: 'filter-demo' } }, [
    el('option', { text: 'الكل', attrs: { value: 'all' } }),
    el('option', { text: 'بيانات تجريبية', attrs: { value: 'true' } }),
    el('option', { text: 'بيانات حقيقية', attrs: { value: 'false' } }),
  ]);
  demoSelect.value = filters.demo;

  const applyFilters = () => {
    filters.q = searchInput.value.trim();
    filters.state = stateSelect.value;
    filters.demo = demoSelect.value;
    filters.page = 1;
    writeToUrl();
    load();
  };

  const form = el('form', { className: 'filters', attrs: { role: 'search' } }, [
    el('div', { className: 'filter filter--grow' }, [
      el('label', { attrs: { for: 'filter-q' }, text: 'بحث' }),
      searchInput,
    ]),
    el('div', { className: 'filter' }, [
      el('label', { attrs: { for: 'filter-state' }, text: 'حالة النشر' }),
      stateSelect,
    ]),
    el('div', { className: 'filter' }, [
      el('label', { attrs: { for: 'filter-demo' }, text: 'نوع البيانات' }),
      demoSelect,
    ]),
    el('div', { className: 'filter-actions' }, [
      el('button', { className: 'btn btn-primary', attrs: { type: 'submit' } }, [
        icon('search', 16),
        el('span', { text: 'تطبيق' }),
      ]),
      el('button', { className: 'btn btn-ghost', attrs: { type: 'button' }, text: 'مسح' }),
    ]),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters();
  });
  stateSelect.addEventListener('change', applyFilters);
  demoSelect.addEventListener('change', applyFilters);
  searchInput.addEventListener('input', debounce(applyFilters, 420));
  qs('.btn-ghost', form).addEventListener('click', () => {
    searchInput.value = '';
    stateSelect.value = 'all';
    demoSelect.value = 'all';
    applyFilters();
  });

  return form;
}

async function patchDepartment(department, payload, successMessage) {
  try {
    await api(`/api/admin/departments/${department.id}`, { method: 'PATCH', body: payload });
    toast(successMessage);
    load();
  } catch (error) {
    toast(error.message || 'تعذّر تحديث القسم.', 'error');
  }
}

async function deleteDepartment(department) {
  const confirmed = await confirmDialog({
    title: 'حذف القسم نهائيًا',
    message: `سيتم حذف «${department.name}» نهائيًا. لا يمكن حذف قسم لديه طلبات تقديم؛ في هذه الحالة استخدم الأرشفة.\n\nهل تريد المتابعة؟`,
    confirmLabel: 'حذف نهائي',
    danger: true,
  });
  if (!confirmed) return;

  try {
    await api(`/api/admin/departments/${department.id}`, { method: 'DELETE' });
    toast('تم حذف القسم.');
    if (filters.page > 1) filters.page -= 1;
    writeToUrl();
    load();
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast(error.message, 'warning');
    } else {
      toast(error.message || 'تعذّر حذف القسم.', 'error');
    }
  }
}

function buildRow(department) {
  const actions = el('div', { className: 'row-actions' });

  actions.append(
    el('a', {
      className: 'btn btn-outline btn-sm',
      attrs: { href: `/admin/departments/${department.id}/edit`, title: 'تحرير' },
    }, [icon('edit', 15), el('span', { text: 'تحرير' })])
  );

  if (!department.is_active) {
    const restore = el('button', { className: 'btn btn-outline btn-sm', attrs: { type: 'button' } }, [
      icon('refresh', 15),
      el('span', { text: 'استعادة' }),
    ]);
    restore.addEventListener('click', () =>
      patchDepartment(department, { is_active: true }, 'تمت استعادة القسم كمسودة.')
    );
    actions.append(restore);
  } else {
    const toggle = el('button', { className: 'btn btn-outline btn-sm', attrs: { type: 'button' } }, [
      icon('check', 15),
      el('span', { text: department.is_published ? 'إلغاء النشر' : 'نشر' }),
    ]);
    toggle.addEventListener('click', () =>
      patchDepartment(
        department,
        { is_published: !department.is_published },
        department.is_published ? 'تم إلغاء نشر القسم.' : 'تم نشر القسم.'
      )
    );
    actions.append(toggle);

    const archive = el('button', { className: 'btn btn-outline btn-sm', attrs: { type: 'button' } }, [
      icon('book', 15),
      el('span', { text: 'أرشفة' }),
    ]);
    archive.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'أرشفة القسم',
        message: `سيتم إخفاء «${department.name}» من الموقع مع الحفاظ على جميع الطلبات المرتبطة به. يمكنك استعادته لاحقًا.`,
        confirmLabel: 'أرشفة',
      });
      if (confirmed) {
        patchDepartment(department, { is_active: false, is_published: false }, 'تمت أرشفة القسم.');
      }
    });
    actions.append(archive);
  }

  const remove = el('button', { className: 'btn btn-danger-outline btn-sm', attrs: { type: 'button', title: 'حذف' } }, [
    icon('trash', 15),
    el('span', { text: 'حذف' }),
  ]);
  remove.addEventListener('click', () => deleteDepartment(department));
  actions.append(remove);

  return el('tr', {}, [
    el('td', {}, [
      el('div', { className: 'cell-strong', text: department.name }),
      el('div', { className: 'cell-muted', attrs: { dir: 'ltr' }, text: department.slug }),
    ]),
    el('td', {}, [departmentStateBadge(department)]),
    el('td', {}, [demoBadge(department)]),
    el('td', {}, [
      el('a', {
        className: 'cell-strong',
        attrs: { href: `/admin/applications?department_id=${department.id}` },
        text: formatNumber(department.applications_count || 0),
      }),
    ]),
    el('td', { className: 'cell-muted', text: formatNumber(department.sort_order) }),
    el('td', { className: 'cell-muted', text: formatDate(department.updated_at) }),
    el('td', { className: 'cell-actions' }, [actions]),
  ]);
}

function render(items, meta) {
  const head = pageHead({
    title: 'إدارة الأقسام',
    description: 'أنشئ الأقسام وحرّر محتواها، وتحكم في نشرها وأرشفتها. الأقسام المؤرشفة لا تظهر للزوار.',
    actions: [
      el('a', { className: 'btn btn-outline', attrs: { href: '/departments', target: '_blank', rel: 'noopener' } }, [
        icon('external', 16),
        el('span', { text: 'عرض الصفحة' }),
      ]),
      el('a', { className: 'btn btn-primary', attrs: { href: '/admin/departments/new' } }, [
        icon('plus', 16),
        el('span', { text: 'قسم جديد' }),
      ]),
    ],
  });

  const panel = el('section', { className: 'panel' }, [
    buildFilters(),
    items.length
      ? el('div', { className: 'table-wrap' }, [
          el('table', { className: 'data-table' }, [
            el('thead', {}, [
              el('tr', {}, [
                el('th', { text: 'القسم' }),
                el('th', { text: 'النشر' }),
                el('th', { text: 'البيانات' }),
                el('th', { text: 'الطلبات' }),
                el('th', { text: 'الترتيب' }),
                el('th', { text: 'آخر تحديث' }),
                el('th', { text: 'الإجراءات' }),
              ]),
            ]),
            el('tbody', {}, items.map(buildRow)),
          ]),
        ])
      : emptyState({
          title: filters.q || filters.state !== 'all' || filters.demo !== 'all'
            ? 'لا توجد أقسام مطابقة'
            : 'لا توجد أقسام بعد',
          message: filters.q || filters.state !== 'all' || filters.demo !== 'all'
            ? 'جرّب تعديل كلمات البحث أو الفلاتر لعرض نتائج أخرى.'
            : 'ابدأ بإنشاء أول قسم تعليمي ليظهر في الموقع.',
          actionLabel: 'إضافة قسم',
          onAction: () => {
            window.location.href = '/admin/departments/new';
          },
          iconName: 'layers',
        }),
    paginationBar({
      meta,
      onPage: (page) => {
        filters.page = page;
        writeToUrl();
        load();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    }),
  ]);

  content.replaceChildren(head, panel);
}

async function load() {
  if (!content.querySelector('.panel')) {
    content.replaceChildren(
      el('div', { className: 'skel skel-line' }),
      el('div', { className: 'skel skel-block' })
    );
  }

  const params = new URLSearchParams({
    page: String(filters.page),
    limit: '20',
  });
  if (filters.q) params.set('q', filters.q);
  if (filters.state !== 'all') params.set('state', filters.state);
  if (filters.demo !== 'all') params.set('is_demo', filters.demo);

  try {
    const { data: items, meta } = await request(`/api/admin/departments?${params.toString()}`);
    render(items, meta);
  } catch (error) {
    content.replaceChildren(
      pageHead({ title: 'إدارة الأقسام' }),
      el('div', { className: 'panel' }, [
        el('div', { className: 'panel__body' }, [
          el('div', { className: 'alert alert--error' }, [
            icon('alert', 18),
            el('div', { text: error.message || 'تعذّر تحميل الأقسام.' }),
          ]),
        ]),
      ])
    );
  }
}
