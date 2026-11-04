/**
 * Admin news list: search, publish/feature filters, pagination and quick
 * actions (publish, feature, edit, delete). Deletion is permanent and requires
 * typing the news title to confirm, even for demo records.
 */
import {
  boot,
  api,
  request,
  qs,
  el,
  icon,
  formatNumber,
  formatDate,
  newsStateBadge,
  pageHead,
  paginationBar,
  emptyState,
  confirmDialog,
  toast,
  debounce,
} from './admin.js';

const content = qs('#admin-content');
const admin = await boot({
  active: 'news',
  title: 'الأخبار',
  subtitle: 'إنشاء الأخبار وتحريرها ونشرها على الموقع',
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
  filters.state = ['all', 'published', 'draft', 'featured'].includes(params.get('state'))
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
  window.history.replaceState(null, '', `/admin/news${query ? `?${query}` : ''}`);
}

function demoBadge(item) {
  return item.is_demo
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
      placeholder: 'ابحث بالعنوان أو المعرّف…',
      autocomplete: 'off',
    },
  });

  const stateSelect = el('select', { className: 'select', attrs: { id: 'filter-state' } }, [
    el('option', { text: 'الكل', attrs: { value: 'all' } }),
    el('option', { text: 'منشور', attrs: { value: 'published' } }),
    el('option', { text: 'مسودة', attrs: { value: 'draft' } }),
    el('option', { text: 'مميز', attrs: { value: 'featured' } }),
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

async function patchNews(item, payload, successMessage) {
  try {
    await api(`/api/admin/news/${item.id}`, { method: 'PATCH', body: payload });
    toast(successMessage);
    load();
  } catch (error) {
    toast(error.message || 'تعذّر تحديث الخبر.', 'error');
  }
}

async function deleteNews(item) {
  const confirmed = await confirmDialog({
    title: 'حذف الخبر نهائيًا',
    message: `سيتم حذف «${item.title}» نهائيًا من قاعدة البيانات وإخفاؤه من الموقع. لا يمكن التراجع.`,
    confirmLabel: 'حذف نهائي',
    danger: true,
    requireText: item.title,
  });
  if (!confirmed) return;

  try {
    await api(`/api/admin/news/${item.id}`, { method: 'DELETE' });
    toast('تم حذف الخبر.');
    if (filters.page > 1) filters.page -= 1;
    writeToUrl();
    load();
  } catch (error) {
    toast(error.message || 'تعذّر حذف الخبر.', 'error');
  }
}

function buildRow(item) {
  const actions = el('div', { className: 'row-actions' });

  actions.append(
    el('a', {
      className: 'btn btn-outline btn-sm',
      attrs: { href: `/admin/news/${item.id}/edit`, title: 'تحرير' },
    }, [icon('edit', 15), el('span', { text: 'تحرير' })])
  );

  const publishToggle = el('button', {
    className: 'btn btn-outline btn-sm',
    attrs: { type: 'button' },
  }, [
    icon('check', 15),
    el('span', { text: item.is_published ? 'إلغاء النشر' : 'نشر' }),
  ]);
  publishToggle.addEventListener('click', () =>
    patchNews(
      item,
      { is_published: !item.is_published },
      item.is_published ? 'تم إلغاء نشر الخبر.' : 'تم نشر الخبر.'
    )
  );
  actions.append(publishToggle);

  const featureToggle = el('button', {
    className: 'btn btn-outline btn-sm',
    attrs: { type: 'button' },
  }, [
    icon('news', 15),
    el('span', { text: item.is_featured ? 'إلغاء التمييز' : 'تمييز' }),
  ]);
  featureToggle.addEventListener('click', () =>
    patchNews(
      item,
      { is_featured: !item.is_featured },
      item.is_featured ? 'تم إلغاء تمييز الخبر.' : 'تم تمييز الخبر.'
    )
  );
  actions.append(featureToggle);

  if (item.is_published) {
    actions.append(
      el('a', {
        className: 'btn btn-ghost btn-sm',
        attrs: {
          href: `/news/${encodeURIComponent(item.slug)}`,
          target: '_blank',
          rel: 'noopener',
          title: 'عرض في الموقع',
        },
      }, [icon('external', 15), el('span', { text: 'عرض' })])
    );
  }

  const remove = el('button', {
    className: 'btn btn-danger-outline btn-sm',
    attrs: { type: 'button', title: 'حذف' },
  }, [icon('trash', 15), el('span', { text: 'حذف' })]);
  remove.addEventListener('click', () => deleteNews(item));
  actions.append(remove);

  return el('tr', {}, [
    el('td', {}, [
      el('div', { className: 'cell-strong', text: item.title }),
      el('div', { className: 'cell-muted', attrs: { dir: 'ltr' }, text: item.slug }),
    ]),
    el('td', { text: item.category || '—' }),
    el('td', {}, [newsStateBadge(item)]),
    el('td', {}, [
      item.is_featured
        ? el('span', { className: 'badge badge--published', text: 'مميز' })
        : el('span', { className: 'badge badge--draft', text: 'عادي' }),
    ]),
    el('td', {}, [demoBadge(item)]),
    el('td', { className: 'cell-muted', text: formatDate(item.published_at) }),
    el('td', { className: 'cell-actions' }, [actions]),
  ]);
}

function render(items, meta) {
  const head = pageHead({
    title: 'إدارة الأخبار',
    description: 'أضف أخبار المدرسة وحرّرها، وتحكم في نشرها وتمييزها. تُحذف الأخبار نهائيًا بعد تأكيد كتابي.',
    actions: [
      el('a', { className: 'btn btn-outline', attrs: { href: '/news', target: '_blank', rel: 'noopener' } }, [
        icon('external', 16),
        el('span', { text: 'عرض الصفحة' }),
      ]),
      el('a', { className: 'btn btn-primary', attrs: { href: '/admin/news/new' } }, [
        icon('plus', 16),
        el('span', { text: 'خبر جديد' }),
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
                el('th', { text: 'الخبر' }),
                el('th', { text: 'التصنيف' }),
                el('th', { text: 'النشر' }),
                el('th', { text: 'التمييز' }),
                el('th', { text: 'البيانات' }),
                el('th', { text: 'تاريخ النشر' }),
                el('th', { text: 'الإجراءات' }),
              ]),
            ]),
            el('tbody', {}, items.map(buildRow)),
          ]),
        ])
      : emptyState({
          title:
            filters.q || filters.state !== 'all' || filters.demo !== 'all'
              ? 'لا توجد أخبار مطابقة'
              : 'لا توجد أخبار بعد',
          message:
            filters.q || filters.state !== 'all' || filters.demo !== 'all'
              ? 'جرّب تعديل كلمات البحث أو الفلاتر لعرض نتائج أخرى.'
              : 'ابدأ بإنشاء أول خبر ليظهر في صفحة الأخبار بالموقع.',
          actionLabel: 'إضافة خبر',
          onAction: () => {
            window.location.href = '/admin/news/new';
          },
          iconName: 'news',
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
    const { data: items, meta } = await request(`/api/admin/news?${params.toString()}`);
    render(items, meta);
  } catch (error) {
    content.replaceChildren(
      pageHead({ title: 'إدارة الأخبار' }),
      el('div', { className: 'panel' }, [
        el('div', { className: 'panel__body' }, [
          el('div', { className: 'alert alert--error' }, [
            icon('alert', 18),
            el('div', { text: error.message || 'تعذّر تحميل الأخبار.' }),
          ]),
        ]),
      ])
    );
  }
}
