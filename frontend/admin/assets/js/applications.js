/**
 * Admin applications list: server-side search, filters, sorting, pagination
 * and CSV export of the current filter selection.
 */
import {
  boot,
  request,
  qs,
  el,
  icon,
  formatNumber,
  formatDateTime,
  statusBadge,
  pageHead,
  paginationBar,
  emptyState,
  debounce,
} from './admin.js';

const content = qs('#admin-content');
const admin = await boot({
  active: 'applications',
  title: 'طلبات التقديم',
  subtitle: 'مراجعة الطلبات الواردة وتحديث حالتها',
});

const filters = {
  q: '',
  status: 'all',
  departmentId: '',
  demo: 'all',
  sort: 'newest',
  page: 1,
};

let departments = [];

if (admin) {
  readFromUrl();
  init();
}

function readFromUrl() {
  const params = new URLSearchParams(window.location.search);
  filters.q = params.get('q') || '';
  filters.status = ['NEW', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].includes(params.get('status'))
    ? params.get('status')
    : 'all';
  const departmentId = Number.parseInt(params.get('department_id'), 10);
  filters.departmentId = Number.isInteger(departmentId) && departmentId > 0 ? String(departmentId) : '';
  filters.demo = ['all', 'true', 'false'].includes(params.get('is_demo'))
    ? params.get('is_demo')
    : 'all';
  filters.sort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';
  filters.page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
}

function writeToUrl() {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.departmentId) params.set('department_id', filters.departmentId);
  if (filters.demo !== 'all') params.set('is_demo', filters.demo);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  const query = params.toString();
  window.history.replaceState(null, '', `/admin/applications${query ? `?${query}` : ''}`);
}

function exportQuery() {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.departmentId) params.set('department_id', filters.departmentId);
  if (filters.demo !== 'all') params.set('is_demo', filters.demo);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  const query = params.toString();
  return `/api/admin/applications/export.csv${query ? `?${query}` : ''}`;
}

function demoBadge(application) {
  return application.is_demo
    ? el('span', { className: 'badge badge--demo', text: 'تجريبي' })
    : el('span', { className: 'badge badge--real', text: 'حقيقي' });
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
function buildFilters() {
  const searchInput = el('input', {
    className: 'input',
    attrs: {
      type: 'search',
      id: 'filter-q',
      placeholder: 'ابحث بالاسم أو رقم الطلب…',
      autocomplete: 'off',
    },
  });
  searchInput.value = filters.q;

  const statusSelect = el('select', { className: 'select', attrs: { id: 'filter-status' } }, [
    el('option', { text: 'كل الحالات', attrs: { value: 'all' } }),
    el('option', { text: 'جديد', attrs: { value: 'NEW' } }),
    el('option', { text: 'قيد المراجعة', attrs: { value: 'UNDER_REVIEW' } }),
    el('option', { text: 'مقبول', attrs: { value: 'ACCEPTED' } }),
    el('option', { text: 'مرفوض', attrs: { value: 'REJECTED' } }),
  ]);
  statusSelect.value = filters.status;

  const departmentSelect = el('select', { className: 'select', attrs: { id: 'filter-department' } }, [
    el('option', { text: 'كل الأقسام', attrs: { value: '' } }),
    ...departments.map((department) =>
      el('option', { text: department.name, attrs: { value: String(department.id) } })
    ),
  ]);
  departmentSelect.value = filters.departmentId;

  const demoSelect = el('select', { className: 'select', attrs: { id: 'filter-demo' } }, [
    el('option', { text: 'كل البيانات', attrs: { value: 'all' } }),
    el('option', { text: 'بيانات تجريبية', attrs: { value: 'true' } }),
    el('option', { text: 'بيانات حقيقية', attrs: { value: 'false' } }),
  ]);
  demoSelect.value = filters.demo;

  const sortSelect = el('select', { className: 'select', attrs: { id: 'filter-sort' } }, [
    el('option', { text: 'الأحدث أولًا', attrs: { value: 'newest' } }),
    el('option', { text: 'الأقدم أولًا', attrs: { value: 'oldest' } }),
  ]);
  sortSelect.value = filters.sort;

  const applyFilters = () => {
    filters.q = searchInput.value.trim();
    filters.status = statusSelect.value;
    filters.departmentId = departmentSelect.value;
    filters.demo = demoSelect.value;
    filters.sort = sortSelect.value;
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
      el('label', { attrs: { for: 'filter-status' }, text: 'الحالة' }),
      statusSelect,
    ]),
    el('div', { className: 'filter' }, [
      el('label', { attrs: { for: 'filter-department' }, text: 'القسم' }),
      departmentSelect,
    ]),
    el('div', { className: 'filter' }, [
      el('label', { attrs: { for: 'filter-demo' }, text: 'نوع البيانات' }),
      demoSelect,
    ]),
    el('div', { className: 'filter' }, [
      el('label', { attrs: { for: 'filter-sort' }, text: 'الترتيب' }),
      sortSelect,
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
  for (const select of [statusSelect, departmentSelect, demoSelect, sortSelect]) {
    select.addEventListener('change', applyFilters);
  }
  searchInput.addEventListener('input', debounce(applyFilters, 420));
  qs('.btn-ghost', form).addEventListener('click', () => {
    searchInput.value = '';
    statusSelect.value = 'all';
    departmentSelect.value = '';
    demoSelect.value = 'all';
    sortSelect.value = 'newest';
    applyFilters();
  });

  return form;
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------
function buildRow(application) {
  return el('tr', {}, [
    el('td', { className: 'cell-ref', text: application.reference_number }),
    el('td', {}, [
      el('div', { className: 'cell-strong', text: application.full_name }),
      el('div', { className: 'cell-muted', attrs: { dir: 'ltr' }, text: application.phone }),
    ]),
    el('td', { text: application.department_name || '—' }),
    el('td', {}, [statusBadge(application.status)]),
    el('td', {}, [demoBadge(application)]),
    el('td', { className: 'cell-muted', text: formatDateTime(application.submitted_at) }),
    el('td', { className: 'cell-actions' }, [
      el('div', { className: 'row-actions' }, [
        el('a', {
          className: 'btn btn-outline btn-sm',
          attrs: { href: `/admin/applications/${application.id}` },
        }, [icon('eye', 15), el('span', { text: 'عرض' })]),
      ]),
    ]),
  ]);
}

function render(items, meta) {
  const head = pageHead({
    title: 'طلبات التقديم',
    description: 'تُعرض الطلبات من قاعدة البيانات مباشرة. استخدم الفلاتر للوصول السريع ثم صدّر النتائج عند الحاجة.',
    actions: [
      el('a', {
        className: 'btn btn-outline',
        attrs: { href: exportQuery(), id: 'export-button' },
      }, [icon('download', 16), el('span', { text: 'تصدير CSV' })]),
      el('button', {
        className: 'btn btn-primary',
        attrs: { type: 'button', id: 'refresh-button' },
      }, [icon('refresh', 16), el('span', { text: 'تحديث' })]),
    ],
  });

  const panel = el('section', { className: 'panel' }, [
    buildFilters(),
    items.length
      ? el('div', { className: 'table-wrap' }, [
          el('table', { className: 'data-table' }, [
            el('thead', {}, [
              el('tr', {}, [
                el('th', { text: 'رقم الطلب' }),
                el('th', { text: 'المتقدم' }),
                el('th', { text: 'القسم' }),
                el('th', { text: 'الحالة' }),
                el('th', { text: 'البيانات' }),
                el('th', { text: 'تاريخ التقديم' }),
                el('th', { text: 'الإجراءات' }),
              ]),
            ]),
            el('tbody', {}, items.map(buildRow)),
          ]),
        ])
      : emptyState({
          title: hasActiveFilters() ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات بعد',
          message: hasActiveFilters()
            ? 'جرّب تعديل كلمات البحث أو الفلاتر لعرض نتائج أخرى.'
            : 'ستظهر طلبات التقديم هنا بمجرد إرسالها من الموقع.',
          actionLabel: hasActiveFilters() ? 'مسح الفلاتر' : '',
          onAction: hasActiveFilters()
            ? () => {
                window.location.href = '/admin/applications';
              }
            : null,
          iconName: 'inbox',
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

  const refresh = qs('#refresh-button');
  if (refresh) refresh.addEventListener('click', load);
}

function hasActiveFilters() {
  return Boolean(filters.q) || filters.status !== 'all' || Boolean(filters.departmentId) || filters.demo !== 'all';
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function loadDepartmentOptions() {
  try {
    const { data } = await request('/api/admin/departments?limit=200&state=all');
    departments = Array.isArray(data) ? data : [];
  } catch {
    departments = [];
  }
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
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.departmentId) params.set('department_id', filters.departmentId);
  if (filters.demo !== 'all') params.set('is_demo', filters.demo);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);

  try {
    const { data: items, meta } = await request(`/api/admin/applications?${params.toString()}`);
    render(items, meta);
  } catch (error) {
    content.replaceChildren(
      pageHead({ title: 'طلبات التقديم' }),
      el('div', { className: 'panel' }, [
        el('div', { className: 'panel__body' }, [
          el('div', { className: 'alert alert--error' }, [
            icon('alert', 18),
            el('div', { text: error.message || 'تعذّر تحميل الطلبات.' }),
          ]),
        ]),
      ])
    );
  }
}

async function init() {
  await loadDepartmentOptions();
  load();
}
