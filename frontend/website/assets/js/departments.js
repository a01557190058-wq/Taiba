/**
 * Departments listing page.
 * Loads published departments from the API, renders cards and filters them
 * locally by name, short description or skill (Arabic-aware matching).
 */
import { api } from './api.js';
import { qs, el, departmentCard, skeletonGrid, stateBox, revealNow } from './ui.js';

const grid = qs('#departments-grid');
const countNode = qs('#departments-count');
const searchInput = qs('#department-search');

let departments = [];

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function matches(department, query) {
  if (!query) return true;
  const haystack = normalize(
    [department.name, department.short_description, ...(department.skills || [])].join(' ')
  );
  return query.split(' ').every((word) => haystack.includes(word));
}

function updateCount(shown, total) {
  if (!countNode) return;
  if (!total) {
    countNode.textContent = 'لا توجد أقسام منشورة';
    return;
  }
  countNode.replaceChildren(
    el('strong', { text: new Intl.NumberFormat('ar-EG').format(shown) }),
    document.createTextNode(` من ${new Intl.NumberFormat('ar-EG').format(total)} قسم`)
  );
}

function render() {
  const query = normalize(searchInput ? searchInput.value : '');
  const visible = departments.filter((department) => matches(department, query));

  updateCount(visible.length, departments.length);

  if (!departments.length) {
    grid.replaceChildren(
      stateBox({
        title: 'لا توجد أقسام منشورة حاليًا',
        message: 'تقوم إدارة المدرسة بتحديث الأقسام. يمكنك العودة لاحقًا أو التواصل معنا للاستفسار.',
        actionLabel: 'إعادة المحاولة',
        onAction: load,
        iconName: 'book',
      })
    );
    return;
  }

  if (!visible.length) {
    grid.replaceChildren(
      stateBox({
        title: 'لا توجد نتائج مطابقة',
        message: 'جرّب كلمة بحث أخرى، أو امسح البحث لعرض جميع الأقسام.',
        actionLabel: 'مسح البحث',
        onAction: () => {
          if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
          }
          render();
        },
        iconName: 'search',
      })
    );
    return;
  }

  grid.replaceChildren(...visible.map(departmentCard));
  revealNow(grid);
}

async function load() {
  skeletonGrid(grid, 6);
  if (countNode) countNode.textContent = 'جارٍ تحميل الأقسام…';

  try {
    const items = await api('/api/departments');
    departments = Array.isArray(items) ? items : [];
    render();
  } catch (error) {
    departments = [];
    if (countNode) countNode.textContent = 'تعذّر تحميل الأقسام';
    grid.replaceChildren(
      stateBox({
        title: 'تعذّر تحميل الأقسام',
        message: error.message || 'حدث خطأ أثناء الاتصال بالخادم. تحقق من اتصالك ثم حاول مرة أخرى.',
        actionLabel: 'إعادة المحاولة',
        onAction: load,
        iconName: 'alert',
      })
    );
  }
}

if (searchInput) {
  let timer = null;
  searchInput.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(render, 120);
  });
}

load();
