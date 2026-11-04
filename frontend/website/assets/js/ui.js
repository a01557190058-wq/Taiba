/** DOM helpers shared by all public pages. All dynamic text uses textContent. */

// Enables the scroll-reveal hidden state only when scripts actually run.
document.documentElement.classList.add('js');

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
    if (child) node.append(child);
  }
  return node;
}

const ICONS = {
  arrow: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert:
    '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone:
    '<path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  inbox:
    '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 5h14l2 8v6H3v-6l2-8Z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 5.5v15"/>',
  sparkles:
    '<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z"/><path d="M18.5 15.5 19.4 18l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9Z"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
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

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** Department card built safely from API data. */
export function departmentCard(department, index = 0) {
  const image = el('img', {
    attrs: {
      src: department.image_url || '/assets/img/departments/default.svg',
      alt: `رسم توضيحي لقسم ${department.name}`,
      loading: 'lazy',
      width: '640',
      height: '420',
    },
  });
  image.addEventListener('error', () => {
    if (!image.src.endsWith('/default.svg')) image.src = '/assets/img/departments/default.svg';
  });

  const chips = el('div', { className: 'chips' });
  (department.skills || []).slice(0, 3).forEach((skill) => {
    chips.append(el('span', { className: 'chip', text: skill }));
  });

  const link = el('a', {
    className: 'card-link',
    attrs: { href: `/departments/${encodeURIComponent(department.slug)}` },
    text: 'تفاصيل القسم',
  });

  const arrow = el('span', { className: 'department-card__arrow', attrs: { 'aria-hidden': 'true' } }, [
    icon('arrowLeft', 16),
  ]);

  const media = el('div', { className: 'department-card__media' }, [
    image,
    el('span', { className: 'department-card__badge', text: 'مسار تقني' }),
  ]);

  const body = el('div', { className: 'department-card__body' }, [
    el('h3', { className: 'department-card__title', text: department.name }),
    el('p', { className: 'department-card__desc', text: department.short_description }),
    chips,
    el('div', { className: 'department-card__footer' }, [link, arrow]),
  ]);

  return el(
    'article',
    {
      className: 'department-card reveal',
      attrs: { 'data-delay': String(index % 3) },
    },
    [media, body]
  );
}

/** News card built safely from API data. */
export function newsCard(article, index = 0) {
  const image = el('img', {
    attrs: {
      src: article.image_url || '/assets/img/departments/default.svg',
      alt: `رسم توضيحي لخبر ${article.title}`,
      loading: 'lazy',
      width: '640',
      height: '400',
    },
  });
  image.addEventListener('error', () => {
    if (!image.src.endsWith('/default.svg')) image.src = '/assets/img/departments/default.svg';
  });

  const href = `/news/${encodeURIComponent(article.slug)}`;

  return el(
    'article',
    {
      className: 'news-card reveal',
      attrs: { 'data-delay': String(index % 3) },
    },
    [
      el('a', { className: 'news-card__media', attrs: { href, tabindex: '-1', 'aria-hidden': 'true' } }, [
        image,
        article.is_featured
          ? el('span', { className: 'news-card__badge', text: 'خبر مميز' })
          : null,
      ]),
      el('div', { className: 'news-card__body' }, [
        el('div', { className: 'news-card__meta' }, [
          article.category
            ? el('span', { className: 'news-card__category', text: article.category })
            : null,
          el('time', {
            className: 'news-card__date',
            attrs: { datetime: article.published_at || '' },
            text: formatDate(article.published_at),
          }),
        ]),
        el('h3', { className: 'news-card__title' }, [
          el('a', { attrs: { href }, text: article.title }),
        ]),
        el('p', { className: 'news-card__summary', text: article.summary }),
        el('a', { className: 'card-link', attrs: { href }, text: 'اقرأ الخبر' }),
      ]),
    ]
  );
}

export function stateBox({ title, message, actionLabel, onAction, iconName = 'inbox' }) {
  const box = el('div', { className: 'state-box' }, [
    el('div', { className: 'state-box__icon' }, [icon(iconName, 28)]),
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

export function skeletonGrid(container, count = 6) {
  container.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    container.append(el('div', { className: 'skeleton-card', attrs: { 'aria-hidden': 'true' } }));
  }
}

export function setAlert(container, { type = 'error', message, iconName } = {}) {
  if (!container) return;
  if (!message) {
    container.replaceChildren();
    container.hidden = true;
    return;
  }
  const names = { error: 'alert', success: 'check', warning: 'alert', info: 'info' };
  container.className = `alert alert--${type}`;
  container.hidden = false;
  container.replaceChildren(icon(iconName || names[type] || 'info', 18), el('div', { text: message }));
}

export function initNav() {
  const toggle = qs('[data-nav-toggle]');
  const nav = qs('[data-site-nav]');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

export function setYear() {
  qsa('[data-current-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}

/* --------------------------------------------------------------------------
   Motion helpers
   -------------------------------------------------------------------------- */
const REDUCED_MOTION = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let revealObserver = null;

/** Fade/slide elements marked with `.reveal` into view once. */
export function initReveal() {
  const nodes = qsa('.reveal');
  if (REDUCED_MOTION() || !('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('is-visible'));
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
  );

  nodes.forEach((node) => revealObserver.observe(node));
}

/** Register elements added after the initial page render. */
export function revealNow(root = document) {
  qsa('.reveal', root).forEach((node) => {
    if (node.classList.contains('is-visible')) return;
    if (revealObserver) revealObserver.observe(node);
    else node.classList.add('is-visible');
  });
}

const arabicNumber = new Intl.NumberFormat('ar-EG');

/** Animate a numeric value from zero, respecting reduced-motion. */
export function setCounter(node, value, duration = 1100) {
  if (!node) return;
  const target = Number(value) || 0;

  if (REDUCED_MOTION() || typeof requestAnimationFrame !== 'function') {
    node.textContent = arabicNumber.format(target);
    return;
  }

  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = arabicNumber.format(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function initStaticCounters() {
  const nodes = qsa('[data-counter-value]');
  if (!nodes.length) return;

  const run = (node) => {
    setCounter(node, node.dataset.counterValue);
    node.removeAttribute('data-counter-value');
  };

  if (REDUCED_MOTION() || !('IntersectionObserver' in window)) {
    nodes.forEach(run);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        run(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.4 }
  );
  nodes.forEach((node) => observer.observe(node));
}

/** Pointer-driven hero parallax. Desktop pointers only, disabled with reduced motion. */
function initHeroParallax() {
  const hero = qs('.hero');
  if (!hero) return;
  if (REDUCED_MOTION()) return;
  if (typeof window.matchMedia !== 'function') return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let frame = 0;
  let nextX = 0;
  let nextY = 0;

  const apply = () => {
    frame = 0;
    hero.style.setProperty('--px', nextX.toFixed(3));
    hero.style.setProperty('--py', nextY.toFixed(3));
  };

  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    nextX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    nextY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    if (!frame) frame = requestAnimationFrame(apply);
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    nextX = 0;
    nextY = 0;
    hero.style.setProperty('--px', '0');
    hero.style.setProperty('--py', '0');
  });
}

/** Header elevation, back-to-top button and counters shared by all pages. */
export function initMotion() {
  initReveal();
  initStaticCounters();
  initHeroParallax();

  const header = qs('.site-header');
  if (header) {
    const sync = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    sync();
    window.addEventListener('scroll', sync, { passive: true });
  }

  const button = el('button', {
    className: 'to-top',
    attrs: { type: 'button', 'aria-label': 'العودة إلى أعلى الصفحة' },
  }, [icon('arrowUp', 18)]);
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: REDUCED_MOTION() ? 'auto' : 'smooth' });
  });
  document.body.append(button);

  const syncTop = () => button.classList.toggle('is-visible', window.scrollY > 480);
  syncTop();
  window.addEventListener('scroll', syncTop, { passive: true });
}
