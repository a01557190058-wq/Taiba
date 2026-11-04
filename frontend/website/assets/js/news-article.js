/**
 * Public news article page.
 * Reads the slug from /news/:slug, renders the article and related items.
 * Unknown or unpublished slugs show a friendly not-found state.
 */
import './common.js';
import { api, ApiError } from './api.js';
import { qs, el, icon, newsCard, stateBox, formatDate, revealNow } from './ui.js';

const body = qs('#article-body');
const titleNode = qs('#article-title');
const summaryNode = qs('#article-summary');
const categoryNode = qs('#article-category');
const metaNode = qs('#article-meta');
const breadcrumbNode = qs('#breadcrumb-current');
const asideNode = qs('#article-aside');
const relatedSection = qs('#related-section');
const relatedGrid = qs('#related-grid');

function getSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function paragraphs(value) {
  return String(value || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function setMetaDescription(text) {
  const meta = document.querySelector('meta[name="description"]');
  if (meta && text) meta.setAttribute('content', text.slice(0, 300));
}

function renderNotFound(message) {
  document.title = 'الخبر غير موجود | مدرسة طيبة تكنولوجي';
  if (titleNode) titleNode.textContent = 'الخبر غير موجود';
  if (summaryNode) summaryNode.textContent = 'قد يكون الخبر غير منشور حاليًا أو تم تغيير رابطه.';
  if (breadcrumbNode) breadcrumbNode.textContent = 'خبر غير متوفر';
  if (categoryNode) categoryNode.hidden = true;
  if (metaNode) metaNode.replaceChildren();

  body.replaceChildren(
    el('div', { className: 'card p-2' }, [
      stateBox({
        title: 'لم نعثر على هذا الخبر',
        message: message || 'الخبر غير متوفر أو غير منشور حاليًا. يمكنك تصفح بقية الأخبار المتاحة.',
        actionLabel: 'العودة إلى الأخبار',
        onAction: () => {
          window.location.href = '/news';
        },
        iconName: 'inbox',
      }),
    ])
  );
}

function renderMeta(article) {
  if (!metaNode) return;
  const items = [];
  if (article.category) {
    items.push(el('span', { className: 'article-meta__pill', text: article.category }));
  }
  if (article.published_at) {
    items.push(
      el('span', { className: 'article-meta__item' }, [
        icon('clock', 16),
        el('time', { attrs: { datetime: article.published_at }, text: formatDate(article.published_at) }),
      ])
    );
  }
  if (article.is_featured) {
    items.push(el('span', { className: 'article-meta__pill article-meta__pill--gold', text: 'خبر مميز' }));
  }
  metaNode.replaceChildren(...items);
}

function renderAside(article) {
  if (!asideNode) return;
  asideNode.hidden = false;

  const backButton = el('a', {
    className: 'btn btn-primary',
    attrs: { href: '/news' },
    text: 'العودة إلى جميع الأخبار',
  });

  const rows = [['التصنيف', article.category || 'غير مصنّف']];
  if (article.published_at) rows.push(['تاريخ النشر', formatDate(article.published_at)]);

  asideNode.replaceChildren(
    el('h2', { className: 'article-aside__title', text: 'عن هذا الخبر' }),
    el('p', {
      text: 'يُعرض نص الخبر كما نُشر من لوحة التحكم. تُحدَّث الأخبار وتُنشر وتُحذف بالكامل من هناك.',
    }),
    backButton,
    el(
      'dl',
      { className: 'meta-list' },
      rows.map(([label, value]) =>
        el('div', { className: 'meta-list__row' }, [
          el('dt', { text: label }),
          el('dd', { text: value }),
        ])
      )
    ),
    el('div', { className: 'callout article-aside__note' }, [
      el('h3', { text: 'ملاحظة' }),
      el('p', {
        text: 'جميع الأخبار والمواعيد والأسماء المعروضة في هذه النسخة تجريبية لأغراض العرض فقط، ولا تمثل إعلانات رسمية.',
      }),
    ])
  );
}

function renderArticle(article) {
  document.title = `${article.title} | مدرسة طيبة تكنولوجي`;
  if (titleNode) titleNode.textContent = article.title;
  if (summaryNode) summaryNode.textContent = article.summary || '';
  if (breadcrumbNode) breadcrumbNode.textContent = article.title;
  if (categoryNode) {
    categoryNode.textContent = article.category || 'خبر';
    categoryNode.hidden = !article.category;
  }
  setMetaDescription(article.summary);
  renderMeta(article);
  renderAside(article);

  const media = el('div', { className: 'article-media' }, [
    el('img', {
      attrs: {
        src: article.image_url || '/assets/img/departments/default.svg',
        alt: `رسم توضيحي لخبر ${article.title}`,
        width: '960',
        height: '540',
      },
    }),
  ]);
  media.querySelector('img').addEventListener('error', (event) => {
    const image = event.currentTarget;
    if (!image.src.endsWith('/default.svg')) image.src = '/assets/img/departments/default.svg';
  });

  const content = paragraphs(article.body);
  const prose = el(
    'div',
    { className: 'prose article-prose' },
    content.length
      ? content.map((text) => el('p', { text }))
      : [el('p', { text: 'لم يُضف نص تفصيلي لهذا الخبر بعد.' })]
  );

  body.replaceChildren(media, prose);

  const related = Array.isArray(article.related) ? article.related : [];
  if (related.length && relatedSection && relatedGrid) {
    relatedSection.hidden = false;
    relatedGrid.replaceChildren(...related.map((item, index) => newsCard(item, index)));
    revealNow(relatedSection);
  }
}

async function load() {
  const slug = getSlug();
  if (!slug) {
    renderNotFound('لم يتم تحديد خبر في الرابط.');
    return;
  }

  try {
    const article = await api(`/api/news/${encodeURIComponent(slug)}`);
    renderArticle(article);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      renderNotFound(error.message);
      return;
    }
    if (titleNode) titleNode.textContent = 'تعذّر تحميل الخبر';
    if (summaryNode) summaryNode.textContent = 'حدث خطأ أثناء الاتصال بالخادم.';
    body.replaceChildren(
      el('div', { className: 'card p-2' }, [
        stateBox({
          title: 'تعذّر تحميل الخبر',
          message: error.message || 'تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.',
          actionLabel: 'إعادة المحاولة',
          onAction: load,
          iconName: 'alert',
        }),
      ])
    );
  }
}

load();
