/**
 * Shared admin shell: session guard, sidebar/topbar rendering, toasts,
 * confirm dialog and small DOM helpers. All dynamic text is rendered with
 * textContent — never innerHTML.
 */
import { api, request, ApiError } from './api.js';

export { api, request, ApiError };

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== null && value !== undefined && value !== false) {
        node.setAttribute(name, value === true ? '' : String(value));
      }
    }
  }
  for (const child of [].concat(children)) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}

const ICONS = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  layers:
    '<path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="m3 12 9 4.5L21 12"/><path d="m3 16.5 9 4.5 9-4.5"/>',
  inbox:
    '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 5h14l2 8v6H3v-6l2-8Z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  news:
    '<path d="M4 5h13v14H4z"/><path d="M17 9h3v7a2 2 0 0 1-2 2h-1"/><path d="M7 8h7M7 12h7M7 16h4"/>',
  database:
    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  external:
    '<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
  trash:
    '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert:
    '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  arrow: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 5.5v15"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  refresh:
    '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
};

export function icon(name, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] || ICONS.info;
  return svg;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export function formatNumber(value) {
  return new Intl.NumberFormat('ar-EG').format(Number(value) || 0);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export const STATUS_LABELS = {
  NEW: 'جديد',
  UNDER_REVIEW: 'قيد المراجعة',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
};

export function statusBadge(status) {
  return el('span', {
    className: `badge badge--${String(status || '').toLowerCase()}`,
    text: STATUS_LABELS[status] || status || '—',
  });
}

export function departmentStateBadge(department) {
  if (!department.is_active) {
    return el('span', { className: 'badge badge--archived', text: 'مؤرشف' });
  }
  if (department.is_published) {
    return el('span', { className: 'badge badge--published', text: 'منشور' });
  }
  return el('span', { className: 'badge badge--draft', text: 'مسودة' });
}

export function newsStateBadge(item) {
  if (item.is_published) {
    return el('span', { className: 'badge badge--published', text: 'منشور' });
  }
  return el('span', { className: 'badge badge--draft', text: 'مسودة' });
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------
export function toast(message, type = 'success') {
  let stack = qs('#toast-stack');
  if (!stack) {
    stack = el('div', { className: 'toast-stack', attrs: { id: 'toast-stack', 'aria-live': 'polite' } });
    document.body.append(stack);
  }

  const node = el('div', { className: `toast${type === 'success' ? '' : ` toast--${type}`}` }, [
    icon(type === 'error' ? 'alert' : type === 'warning' ? 'alert' : 'check', 18),
    el('span', { text: message }),
  ]);
  stack.append(node);

  window.setTimeout(() => {
    node.classList.add('is-hiding');
    window.setTimeout(() => node.remove(), 220);
  }, 4200);
}

export function setAlert(container, { type = 'error', message } = {}) {
  if (!container) return;
  if (!message) {
    container.replaceChildren();
    container.hidden = true;
    return;
  }
  container.className = `alert alert--${type}`;
  container.hidden = false;
  container.replaceChildren(
    icon(type === 'success' ? 'check' : type === 'info' ? 'info' : 'alert', 18),
    el('div', { text: message })
  );
}

export function setButtonBusy(button, busy, busyLabel = 'جارٍ الحفظ…') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.replaceChildren(el('span', { className: 'spinner', attrs: { 'aria-hidden': 'true' } }), el('span', { text: busyLabel }));
  } else {
    button.disabled = false;
    button.textContent = button.dataset.label || button.textContent;
    delete button.dataset.label;
  }
}

export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------
export function confirmDialog({
  title = 'تأكيد العملية',
  message = '',
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  danger = false,
  requireText = '',
} = {}) {
  return new Promise((resolve) => {
    const input = requireText
      ? el('input', {
          className: 'input',
          attrs: { type: 'text', placeholder: requireText, autocomplete: 'off', dir: 'ltr' },
        })
      : null;

    const confirmBtn = el('button', {
      className: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
      attrs: { type: 'button' },
      text: confirmLabel,
    });
    if (input) confirmBtn.disabled = true;

    const cancelBtn = el('button', {
      className: 'btn btn-outline',
      attrs: { type: 'button' },
      text: cancelLabel,
    });

    const dialog = el('div', { className: 'modal__dialog', attrs: { role: 'dialog', 'aria-modal': 'true' } }, [
      el('div', { className: 'modal__head' }, [
        el('h2', { text: title }),
        el('button', { className: 'btn btn-ghost btn-icon', attrs: { type: 'button', 'aria-label': 'إغلاق' } }, [icon('close', 18)]),
      ]),
      el('div', { className: 'modal__body' }, [
        el('p', { text: message }),
        input
          ? el('div', { className: 'field mt-2' }, [
              el('label', { text: `اكتب «${requireText}» للتأكيد` }),
              input,
            ])
          : null,
      ]),
      el('div', { className: 'modal__foot' }, [cancelBtn, confirmBtn]),
    ]);

    const overlay = el('div', { className: 'modal' }, [dialog]);

    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') close(false);
    };

    cancelBtn.addEventListener('click', () => close(false));
    qs('.modal__head .btn', dialog).addEventListener('click', () => close(false));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });
    confirmBtn.addEventListener('click', () => close(true));
    if (input) {
      input.addEventListener('input', () => {
        confirmBtn.disabled = input.value.trim() !== requireText;
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !confirmBtn.disabled) close(true);
      });
    }

    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    (input || confirmBtn).focus();
  });
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { key: 'dashboard', href: '/admin/dashboard', label: 'نظرة عامة', icon: 'dashboard' },
  { key: 'departments', href: '/admin/departments', label: 'الأقسام', icon: 'layers' },
  { key: 'applications', href: '/admin/applications', label: 'طلبات التقديم', icon: 'inbox' },
  { key: 'news', href: '/admin/news', label: 'الأخبار', icon: 'news' },
  { key: 'content', href: '/admin/content', label: 'المحتوى والأسئلة', icon: 'file' },
  { key: 'demo', href: '/admin/demo-data', label: 'البيانات التجريبية', icon: 'database' },
];

function renderSidebar(active) {
  const sidebar = qs('#admin-sidebar');
  if (!sidebar) return;

  const brand = el('a', { className: 'admin-brand', attrs: { href: '/admin/dashboard' } }, [
    el('img', { attrs: { src: '/assets/img/logo.svg', alt: '', width: '42', height: '42' } }),
    el('span', {}, [
      el('strong', { text: 'مدرسة طيبة تكنولوجي' }),
      el('span', { text: 'لوحة التحكم' }),
    ]),
  ]);

  const nav = el('nav', { className: 'admin-nav', attrs: { 'aria-label': 'التنقل الإداري' } }, [
    el('span', { className: 'admin-nav__label', text: 'الإدارة' }),
    ...NAV_ITEMS.map((item) => {
      const link = el('a', {
        className: 'admin-nav__link',
        attrs: {
          href: item.href,
          ...(item.key === active ? { 'aria-current': 'page' } : {}),
        },
      });
      link.append(icon(item.icon, 18), el('span', { text: item.label }));
      return link;
    }),
  ]);

  const foot = el('div', { className: 'admin-sidebar__foot' }, [
    el('a', { className: 'btn btn-ghost', attrs: { href: '/', target: '_blank', rel: 'noopener' } }, [
      icon('external', 18),
      el('span', { text: 'زيارة الموقع' }),
    ]),
    el('button', { className: 'btn btn-ghost', attrs: { type: 'button', id: 'logout-button' } }, [
      icon('logout', 18),
      el('span', { text: 'تسجيل الخروج' }),
    ]),
  ]);

  sidebar.replaceChildren(brand, nav, foot);
}

function renderTopbar(admin, { title, subtitle }) {
  const topbar = qs('#admin-topbar');
  if (!topbar) return;

  const toggle = el('button', {
    className: 'sidebar-toggle',
    attrs: { type: 'button', 'aria-label': 'فتح القائمة', 'aria-expanded': 'false' },
  }, [icon('menu', 20)]);

  const titleWrap = el('div', { className: 'admin-topbar__title' }, [
    el('h1', { text: title || 'لوحة التحكم' }),
    el('p', { text: subtitle || 'إدارة محتوى الموقع وطلبات التقديم' }),
  ]);

  const name = admin.display_name || admin.username || 'مدير';
  const actions = el('div', { className: 'admin-topbar__actions' }, [
    el('a', {
      className: 'btn btn-outline btn-sm',
      attrs: { href: '/', target: '_blank', rel: 'noopener' },
    }, [icon('external', 16), el('span', { text: 'الموقع' })]),
    el('div', { className: 'admin-user' }, [
      el('span', { className: 'admin-user__avatar', text: name.slice(0, 1) }),
      el('span', { className: 'admin-user__name', text: name }),
    ]),
  ]);

  topbar.replaceChildren(toggle, titleWrap, actions);

  // Mobile drawer
  const backdrop = qs('#sidebar-backdrop') || el('button', {
    className: 'sidebar-backdrop',
    attrs: { type: 'button', id: 'sidebar-backdrop', 'aria-label': 'إغلاق القائمة' },
  });
  if (!backdrop.isConnected) document.body.append(backdrop);

  const sidebar = qs('#admin-sidebar');
  const closeDrawer = () => {
    if (sidebar) sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const open = !(sidebar && sidebar.classList.contains('is-open'));
    if (sidebar) sidebar.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  backdrop.addEventListener('click', closeDrawer);
  if (sidebar) {
    sidebar.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeDrawer();
    });
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore: the session may already be gone. Always leave the dashboard.
  }
  window.location.replace('/admin/login');
}

/**
 * Guard + shell bootstrap. Returns the admin object, or null when the page is
 * redirecting to the login screen.
 */
export async function boot({ active = '', title = '', subtitle = '' } = {}) {
  let admin = null;
  try {
    const data = await api('/api/auth/me');
    admin = data.admin;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const next = window.location.pathname + window.location.search;
      window.location.replace(`/admin/login?next=${encodeURIComponent(next)}`);
      return null;
    }
    // Network/server failure: show a blocking message rather than a broken UI.
    document.body.replaceChildren(
      el('div', { className: 'login-main' }, [
        el('div', { className: 'login-card' }, [
          el('div', { className: 'alert alert--error' }, [
            icon('alert', 18),
            el('div', { text: error.message || 'تعذّر الاتصال بالخادم. أعد تحميل الصفحة.' }),
          ]),
          el('button', { className: 'btn btn-primary', attrs: { type: 'button' }, text: 'إعادة المحاولة' }),
        ]),
      ])
    );
    const retry = qs('.login-card .btn');
    if (retry) retry.addEventListener('click', () => window.location.reload());
    return null;
  }

  renderSidebar(active);
  renderTopbar(admin, { title, subtitle });

  const logoutButton = qs('#logout-button');
  if (logoutButton) logoutButton.addEventListener('click', logout);

  document.body.classList.add('admin-ready');
  return admin;
}

export function pageHead({ title, description, actions = [] }) {
  return el('div', { className: 'page-head' }, [
    el('div', {}, [
      el('h2', { text: title }),
      description ? el('p', { text: description }) : null,
    ]),
    actions.length ? el('div', { className: 'page-head__actions' }, actions) : null,
  ]);
}

export function emptyState({ title, message, actionLabel, onAction, iconName = 'inbox' }) {
  const box = el('div', { className: 'empty-state' }, [
    el('div', { className: 'empty-state__icon' }, [icon(iconName, 26)]),
    el('h3', { text: title }),
    el('p', { text: message }),
  ]);
  if (actionLabel && onAction) {
    const button = el('button', { className: 'btn btn-outline btn-sm', attrs: { type: 'button' }, text: actionLabel });
    button.addEventListener('click', onAction);
    box.append(button);
  }
  return box;
}

/**
 * Pagination bar driven by the API `meta` object
 * ({ total, page, limit, totalPages, hasNext, hasPrev }).
 */
export function paginationBar({ meta, onPage }) {
  const total = Number(meta.total) || 0;
  const page = Number(meta.page) || 1;
  const limit = Number(meta.limit) || 20;
  const totalPages = Number(meta.totalPages) || 1;

  const from = total ? (page - 1) * limit + 1 : 0;
  const to = total ? Math.min(page * limit, total) : 0;

  const makeButton = (label, targetPage, { disabled = false, current = false, ariaLabel = '' } = {}) => {
    const button = el('button', {
      className: 'page-btn',
      attrs: {
        type: 'button',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        ...(current ? { 'aria-current': 'page' } : {}),
      },
      text: label,
    });
    button.disabled = disabled;
    if (!disabled && !current) button.addEventListener('click', () => onPage(targetPage));
    return button;
  };

  const pages = el('div', { className: 'pagination__pages' }, [
    makeButton('السابق', page - 1, { disabled: page <= 1, ariaLabel: 'الصفحة السابقة' }),
  ]);

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  if (start > 1) {
    pages.append(makeButton('1', 1, { current: page === 1 }));
    if (start > 2) pages.append(el('span', { className: 'text-muted', text: '…' }));
  }
  for (let index = start; index <= end; index += 1) {
    pages.append(makeButton(String(index), index, { current: index === page }));
  }
  if (end < totalPages) {
    if (end < totalPages - 1) pages.append(el('span', { className: 'text-muted', text: '…' }));
    pages.append(makeButton(String(totalPages), totalPages, { current: page === totalPages }));
  }

  pages.append(
    makeButton('التالي', page + 1, { disabled: page >= totalPages, ariaLabel: 'الصفحة التالية' })
  );

  return el('div', { className: 'pagination' }, [
    el('span', {
      text: total
        ? `عرض ${formatNumber(from)}–${formatNumber(to)} من ${formatNumber(total)}`
        : 'لا توجد نتائج',
    }),
    pages,
  ]);
}
