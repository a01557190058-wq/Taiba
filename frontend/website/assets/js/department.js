/**
 * Department detail page.
 * Reads the slug from the clean URL (/departments/:slug), fetches the
 * published department and renders it. Unknown/unpublished slugs show a
 * friendly not-found state instead of an empty page.
 */
import './common.js';
import { api, ApiError } from './api.js';
import { qs, el, icon, stateBox, formatDate } from './ui.js';

const body = qs('#department-body');
const titleNode = qs('#department-title');
const leadNode = qs('#department-lead');
const breadcrumbNode = qs('#breadcrumb-current');

function getSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function paragraphList(value) {
  return String(value || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderNotFound(message) {
  document.title = 'القسم غير موجود | مدرسة طيبة تكنولوجي';
  if (titleNode) titleNode.textContent = 'القسم غير موجود';
  if (leadNode) leadNode.textContent = 'قد يكون القسم غير منشور حاليًا أو تم تغيير رابطه.';
  if (breadcrumbNode) breadcrumbNode.textContent = 'قسم غير متوفر';

  body.replaceChildren(
    el('div', { className: 'card p-2' }, [
      stateBox({
        title: 'لم نعثر على هذا القسم',
        message: message || 'القسم غير متوفر أو غير منشور حاليًا. يمكنك تصفح بقية الأقسام المتاحة.',
        actionLabel: 'العودة إلى الأقسام',
        onAction: () => {
          window.location.href = '/departments';
        },
        iconName: 'book',
      }),
    ])
  );
}

function renderDepartment(department) {
  document.title = `${department.name} | مدرسة طيبة تكنولوجي`;
  if (titleNode) titleNode.textContent = department.name;
  if (leadNode) {
    leadNode.textContent =
      department.short_description || 'تعرّف على وصف القسم ومهاراته ومعلومات التقديم الخاصة به.';
  }
  if (breadcrumbNode) breadcrumbNode.textContent = department.name;

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta && department.short_description) {
    descriptionMeta.setAttribute('content', department.short_description);
  }

  const image = el('img', {
    attrs: {
      src: department.image_url || '/assets/img/departments/default.svg',
      alt: `رسم توضيحي لقسم ${department.name}`,
      width: '800',
      height: '500',
    },
  });
  image.addEventListener('error', () => {
    if (!image.src.endsWith('/default.svg')) image.src = '/assets/img/departments/default.svg';
  });

  const mainSections = [];

  const descriptionParagraphs = paragraphList(department.description);
  mainSections.push(
    el('section', { className: 'detail-section' }, [
      el('h2', { text: 'عن القسم' }),
      el(
        'div',
        { className: 'prose' },
        descriptionParagraphs.length
          ? descriptionParagraphs.map((text) => el('p', { text }))
          : [el('p', { text: 'لم يُضف وصف تفصيلي لهذا القسم بعد.' })]
      ),
    ])
  );

  if (department.educational_focus) {
    mainSections.push(
      el('section', { className: 'detail-section' }, [
        el('h2', { text: 'التركيز التعليمي' }),
        el(
          'div',
          { className: 'prose' },
          paragraphList(department.educational_focus).map((text) => el('p', { text }))
        ),
      ])
    );
  }

  if (Array.isArray(department.skills) && department.skills.length) {
    mainSections.push(
      el('section', { className: 'detail-section' }, [
        el('h2', { text: 'المهارات المستهدفة' }),
        el(
          'ul',
          { className: 'skill-list' },
          department.skills.map((skill) => el('li', { text: skill }))
        ),
      ])
    );
  }

  if (department.admission_info) {
    mainSections.push(
      el('section', { className: 'detail-section' }, [
        el('h2', { text: 'معلومات القبول' }),
        el(
          'div',
          { className: 'prose' },
          paragraphList(department.admission_info).map((text) => el('p', { text }))
        ),
      ])
    );
  }

  const applyButton = el('a', {
    className: 'btn btn-primary',
    attrs: { href: `/apply?department=${encodeURIComponent(department.slug)}` },
    text: 'التقديم على هذا القسم',
  });
  applyButton.append(icon('arrowLeft', 16));

  const metaRows = [
    ['القسم', department.name],
    ['حالة القبول', 'متاح للتقديم'],
  ];
  if (department.updated_at) metaRows.push(['آخر تحديث', formatDate(department.updated_at)]);

  const aside = el('aside', { className: 'sticky-card' }, [
    el('h3', { text: 'هل هذا القسم مناسب لك؟' }),
    el('p', {
      text:
        'يمكنك تسجيل طلبك مباشرة. إرسال الطلب لا يعني القبول النهائي، بل يبدأ مراجعة إدارة المدرسة لبياناتك.',
    }),
    applyButton,
    el('a', {
      className: 'btn btn-outline',
      attrs: { href: '/departments' },
      text: 'مقارنة مع الأقسام الأخرى',
    }),
    el(
      'dl',
      { className: 'meta-list' },
      metaRows.map(([label, value]) =>
        el('div', { className: 'meta-list__row' }, [
          el('dt', { text: label }),
          el('dd', { text: value }),
        ])
      )
    ),
  ]);

  const backLink = el('a', { className: 'detail-back', attrs: { href: '/departments' } }, [
    icon('arrowLeft', 16),
    el('span', { text: 'جميع الأقسام' }),
  ]);

  body.replaceChildren(
    backLink,
    el('div', { className: 'detail-layout' }, [
      el('div', {}, [
        el('div', { className: 'detail-media' }, [image]),
        ...mainSections,
        el('div', { className: 'callout mt-3' }, [
          el('h2', { text: 'ملاحظة عن البيانات' }),
          el('p', {
            text:
              'وصف هذا القسم ومهاراته ومعلومات القبول قابلة للتحديث من لوحة التحكم، وتُعرض هنا كنص عادي. تأكد من إدارة المدرسة قبل الاعتماد على أي تفاصيل.',
          }),
        ]),
      ]),
      aside,
    ])
  );
}

async function load() {
  const slug = getSlug();
  if (!slug) {
    renderNotFound('لم يتم تحديد قسم في الرابط.');
    return;
  }

  try {
    const department = await api(`/api/departments/${encodeURIComponent(slug)}`);
    renderDepartment(department);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      renderNotFound(error.message);
      return;
    }
    if (titleNode) titleNode.textContent = 'تعذّر تحميل القسم';
    if (leadNode) leadNode.textContent = 'حدث خطأ أثناء الاتصال بالخادم.';
    body.replaceChildren(
      el('div', { className: 'card p-2' }, [
        stateBox({
          title: 'تعذّر تحميل بيانات القسم',
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
