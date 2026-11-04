/**
 * Public news listing page.
 * Server-side search and category filtering, with a "load more" control.
 * Every value from the API is rendered with textContent (never innerHTML).
 */
import './common.js';
import { request, ApiError } from './api.js';
import { qs, el, newsCard, skeletonGrid, stateBox, revealNow } from './ui.js';

const grid = qs('#news-grid');
const countNode = qs('#news-count');
const searchInput = qs('#news-search');
const categoriesNode = qs('#news-categories');
const moreNode = qs('#news-more');

const state = {
  q: '',
  category: '',
  page: 1,
  limit: 9,
  total: 0,
  loaded: 0,
};

let categories = [];
let requestToken = 0;

function debounce(fn, delay = 280) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function readFromUrl() {
  const params = new URLSearchParams(window.location.search);
  state.q = (params.get('q') || '').trim();
  state.category = (params.get('category') || '').trim();
  if (searchInput) searchInput.value = state.q;
}

function updateCount() {
  if (!countNode) return;
  if (!state.total) {
    countNode.textContent = state.q || state.category ? 'لا توجد أخبار مطابقة' : 'لا توجد أخبار منشورة';
    return;
  }
  countNode.textContent = `${state.total} ${state.total === 1 ? 'خبر' : 'أخبار'} متاحة`;
}

function renderCategories() {
  if (!categoriesNode) return;
  categoriesNode.replaceChildren();

  const makeButton = (label, value) => {
    const isActive = state.category === value;
    const button = el('button', {
      className: `news-filter${isActive ? ' is-active' : ''}`,
      attrs: {
        type: 'button',
        'aria-pressed': String(isActive),
        'data-category': value,
      },
      text: label,
    });
    button.addEventListener('click', () => {
      if (state.category === value) return;
      state.category = value;
      renderCategories();
      load({ reset: true });
    });
    return button;
  };

  categoriesNode.append(makeButton('الكل', ''));
  categories.forEach((category) => {
    categoriesNode.append(makeButton(`${category.name} (${category.count})`, category.name));
  });
}

function renderMore(hasNext) {
  if (!moreNode) return;
  moreNode.replaceChildren();
  if (!hasNext) return;
  const button = el('button', {
    className: 'btn btn-outline btn-lg',
    attrs: { type: 'button' },
    text: 'تحميل المزيد من الأخبار',
  });
  button.addEventListener('click', () => {
    state.page += 1;
    load();
  });
  moreNode.append(button);
}

function renderEmpty() {
  grid.replaceChildren(
    stateBox({
      title: 'لا توجد أخبار مطابقة',
      message:
        'جرّب تعديل كلمة البحث أو اختيار تصنيف آخر. تُدار الأخبار من لوحة التحكم وتظهر هنا بعد نشرها فقط.',
      actionLabel: 'إعادة تعيين الفلاتر',
      onAction: () => {
        state.q = '';
        state.category = '';
        state.page = 1;
        if (searchInput) searchInput.value = '';
        renderCategories();
        load({ reset: true });
      },
      iconName: 'inbox',
    })
  );
}

function renderError(error) {
  grid.replaceChildren(
    stateBox({
      title: 'تعذّر تحميل الأخبار',
      message: error.message || 'تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.',
      actionLabel: 'إعادة المحاولة',
      onAction: () => load({ reset: true }),
      iconName: 'alert',
    })
  );
  if (countNode) countNode.textContent = 'تعذّر تحميل الأخبار';
}

async function load({ reset = false } = {}) {
  const token = ++requestToken;
  if (reset) {
    state.page = 1;
    state.loaded = 0;
    skeletonGrid(grid, 3);
  }

  const params = new URLSearchParams({
    page: String(state.page),
    limit: String(state.limit),
  });
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);

  try {
    const payload = await request(`/api/news?${params.toString()}`);
    if (token !== requestToken) return;

    const items = Array.isArray(payload.data) ? payload.data : [];
    const meta = payload.meta || {};

    if (Array.isArray(meta.categories)) {
      categories = meta.categories;
      renderCategories();
    }

    state.total = Number.isFinite(meta.total) ? meta.total : items.length;

    if (reset) grid.replaceChildren();

    if (!items.length && !state.loaded) {
      renderEmpty();
    } else if (items.length) {
      grid.append(...items.map((article, index) => newsCard(article, state.loaded + index)));
      state.loaded += items.length;
      revealNow(grid);
    }

    updateCount();
    renderMore(Boolean(meta.hasNext));
  } catch (error) {
    if (token !== requestToken) return;
    if (error instanceof ApiError || error instanceof Error) {
      renderError(error);
    }
  }
}

if (grid) {
  readFromUrl();
  load({ reset: true });

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce(() => {
        state.q = searchInput.value.trim();
        load({ reset: true });
      })
    );
  }
}
