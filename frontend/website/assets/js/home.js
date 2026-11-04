import { schoolContentPromise } from './common.js';
import { api } from './api.js';
import { qs, el, departmentCard, newsCard, skeletonGrid, stateBox, setCounter, revealNow } from './ui.js';

const featured = qs('#featured-departments');
const latestNews = qs('#latest-news');
const faqList = qs('#faq-list');
const objectivesList = qs('#objectives-list');
const stepsList = qs('#admission-steps');

const ORDINALS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];

async function loadDepartments() {
  skeletonGrid(featured, 3);
  try {
    const departments = await api('/api/departments');
    setCounter(qs('#stat-departments'), departments.length);

    if (!departments.length) {
      featured.replaceChildren(
        stateBox({
          title: 'لا توجد أقسام منشورة حاليًا',
          message: 'تقوم إدارة المدرسة بتحديث الأقسام. يمكنك العودة لاحقًا أو التواصل معنا للاستفسار.',
          actionLabel: 'تحديث',
          onAction: loadDepartments,
          iconName: 'book',
        })
      );
      return;
    }

    featured.replaceChildren(...departments.slice(0, 6).map(departmentCard));
    revealNow(featured);
  } catch (error) {
    featured.replaceChildren(
      stateBox({
        title: 'تعذّر تحميل الأقسام',
        message: error.message || 'حدث خطأ أثناء الاتصال بالخادم. تحقق من اتصالك ثم حاول مرة أخرى.',
        actionLabel: 'إعادة المحاولة',
        onAction: loadDepartments,
        iconName: 'alert',
      })
    );
  }
}

async function loadNews() {
  if (!latestNews) return;
  skeletonGrid(latestNews, 3);
  try {
    const articles = await api('/api/news?limit=3');
    if (!Array.isArray(articles) || !articles.length) {
      latestNews.replaceChildren(
        stateBox({
          title: 'لا توجد أخبار منشورة حاليًا',
          message: 'تُنشر الأخبار والأنشطة من لوحة التحكم وتظهر هنا مباشرة بعد نشرها.',
          actionLabel: 'زيارة صفحة الأخبار',
          onAction: () => {
            window.location.href = '/news';
          },
          iconName: 'inbox',
        })
      );
      return;
    }
    latestNews.replaceChildren(...articles.map((article, index) => newsCard(article, index)));
    revealNow(latestNews);
  } catch (error) {
    latestNews.replaceChildren(
      stateBox({
        title: 'تعذّر تحميل الأخبار',
        message: error.message || 'حدث خطأ أثناء الاتصال بالخادم. تحقق من اتصالك ثم حاول مرة أخرى.',
        actionLabel: 'إعادة المحاولة',
        onAction: loadNews,
        iconName: 'alert',
      })
    );
  }
}

function renderFaqs(faqs) {
  if (!faqs || !faqs.length) {
    faqList.replaceChildren(
      stateBox({
        title: 'لا توجد أسئلة منشورة',
        message: 'سيتم عرض الأسئلة الشائعة هنا بمجرد إضافتها من لوحة التحكم.',
        iconName: 'info',
      })
    );
    return;
  }

  faqList.replaceChildren(
    ...faqs.map((faq) => {
      const details = el('details', { className: 'faq-item' });
      details.append(
        el('summary', { text: faq.question }),
        el('div', { className: 'faq-item__answer', text: faq.answer })
      );
      return details;
    })
  );
}

function renderContent(data) {
  if (!data) {
    faqList.replaceChildren(
      stateBox({
        title: 'تعذّر تحميل المحتوى',
        message: 'لم نتمكن من الاتصال بالخادم لعرض الأسئلة الشائعة.',
        actionLabel: 'إعادة المحاولة',
        onAction: () => window.location.reload(),
        iconName: 'alert',
      })
    );
    return;
  }

  const { content, faqs, objectives, admission_steps: steps } = data;

  if (Array.isArray(objectives) && objectives.length) {
    objectivesList.replaceChildren(
      ...objectives.slice(0, 5).map((item) => el('li', { text: item }))
    );
  }

  if (Array.isArray(steps) && steps.length) {
    stepsList.replaceChildren(
      ...steps.slice(0, 6).map((text, index) =>
        el('li', { className: 'step' }, [
          el('h3', { text: `الخطوة ${ORDINALS[index] || index + 1}` }),
          el('p', { text }),
        ])
      )
    );
  }

  renderFaqs(faqs);

  setCounter(qs('#stat-faqs'), Array.isArray(faqs) ? faqs.length : 0);
}

loadDepartments();
loadNews();
schoolContentPromise.then(renderContent);
