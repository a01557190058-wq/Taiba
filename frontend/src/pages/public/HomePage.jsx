import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { contentText, emailHref, phoneHref, useSchoolContent } from '../../lib/content.jsx';
import { useAsync } from '../../lib/hooks.js';
import { Icon } from '../../lib/icons.jsx';
import { Counter, useHeroParallax, usePageMeta } from '../../lib/motion.jsx';
import {
  DepartmentCard,
  NewsCard,
  SectionHead,
  SkeletonGrid,
  StateBox,
} from '../../components/public/ui.jsx';

const ORDINALS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];

const FEATURES = [
  {
    icon: 'layers',
    title: 'تعلّم قائم على المشروعات',
    text: 'ينتقل الطالب من التمرين إلى مشروع متكامل، فيفهم كيف تُطبَّق المعرفة في سياق حقيقي.',
  },
  {
    icon: 'flask',
    title: 'مختبرات وورش تطبيقية',
    text: 'تدريبات معملية منظمة داخل بيئة تعليمية آمنة، مع أدوات ومعدات مناسبة لكل مسار.',
  },
  {
    icon: 'chart',
    title: 'متابعة أكاديمية مستمرة',
    text: 'تقييم دوري لملفات الإنجاز والمشروعات، وملاحظات واضحة تساعد الطالب على التطور.',
  },
  {
    icon: 'briefcase',
    title: 'مهارات جاهزة لسوق العمل',
    text: 'تدريب على العمل الجماعي والتواصل المهني وتوثيق الأعمال، إلى جانب المهارة التقنية.',
  },
  {
    icon: 'shield',
    title: 'بيئة تعليمية آمنة',
    text: 'إجراءات سلامة واضحة داخل المختبرات، واحترام كامل لخصوصية بيانات المتقدمين.',
  },
  {
    icon: 'grid',
    title: 'مسارات تقنية متنوعة',
    text: 'أقسام تغطي البرمجة والذكاء الاصطناعي والهندسة والتقنيات الصناعية والطاقة.',
  },
];

const PROJECTS = [
  {
    tag: 'مشروعات',
    title: 'تطبيق عملي لكل وحدة دراسية',
    text: 'ينتقل الطالب من المفهوم النظري إلى نموذج عملي يعرضه ويناقشه مع المدرّس والزملاء.',
    meta: ['عمل جماعي', 'عرض وتقييم'],
  },
  {
    tag: 'أندية',
    title: 'أندية تقنية ومساحات ابتكار',
    text: 'لقاءات دورية لاستكشاف التقنيات الجديدة وبناء مشروعات صغيرة خارج المنهج الأساسي.',
    meta: ['تعلّم بالأقران', 'مبادرات طلابية'],
  },
  {
    tag: 'حياة مدرسية',
    title: 'يوم دراسي متوازن',
    text: 'فصول ومختبرات ووقت للأنشطة، مع متابعة مستمرة للحضور والتقدّم الأكاديمي.',
    meta: ['مختبرات', 'أنشطة'],
  },
];

const QUOTES = [
  {
    avatar: 'أ',
    text: 'بدأت بدون أي خلفية برمجية، ومع المشروعات الأسبوعية صرت قادرًا على بناء تطبيق كامل وعرضه على زملائي بثقة.',
    name: 'طالب — قسم البرمجة',
  },
  {
    avatar: 'س',
    text: 'أكثر ما أفادني هو التدريب العملي في المختبر. نفهم الفكرة على السبورة، ثم نطبقها مباشرة على أجهزة حقيقية في نفس الأسبوع.',
    name: 'طالبة — قسم الإلكترونيات',
  },
  {
    avatar: 'م',
    text: 'المتابعة الفردية ساعدتني على تنظيم وقتي بين الدراسة والمشروع. الملاحظات على كل تسليم كانت واضحة وقابلة للتطبيق.',
    name: 'طالب — قسم الطاقة المتجددة',
  },
];

const FALLBACK_OBJECTIVES = [
  'ربط المناهج التقنية باحتياجات سوق العمل والمشروعات الواقعية.',
  'تنمية مهارات التفكير التحليلي وحل المشكلات.',
  'توفير تدريب عملي منتظم داخل المختبرات والورش.',
  'تعزيز العمل الجماعي والمسؤولية المهنية.',
];

const FALLBACK_STEPS = [
  'اختيار القسم: اطّلع على وصف الأقسام ومهاراتها واختر المسار الأنسب.',
  'تعبئة النموذج: أدخل الاسم ورقم الهاتف وبيانات التواصل الأساسية.',
  'إرسال الطلب: راجع البيانات ووافق على معالجة المعلومات ثم أرسل.',
  'متابعة الحالة: احتفظ برقم الطلب لمتابعة المراجعة مع إدارة المدرسة.',
];

function SkeletonLines({ count = 2 }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-line" aria-hidden="true" key={index} />
      ))}
    </>
  );
}

export default function HomePage() {
  usePageMeta(
    'مدرسة طيبة تكنولوجي | تعليم تقني تطبيقي',
    'مدرسة طيبة تكنولوجي — بيئة تعليمية تقنية تجريبية تجمع بين الأساس النظري والتطبيق العملي في البرمجة والهندسة والتقنيات الصناعية.'
  );

  const heroRef = useRef(null);
  useHeroParallax(heroRef);

  const { content, faqs, objectives, admissionSteps, loading } = useSchoolContent();
  const departments = useAsync(() => api('/api/departments'), []);
  const news = useAsync(() => api('/api/news?limit=3'), []);

  const departmentList = Array.isArray(departments.data) ? departments.data : [];
  const articleList = Array.isArray(news.data) ? news.data : [];
  const objectiveList = objectives.length ? objectives.slice(0, 5) : FALLBACK_OBJECTIVES;
  const stepList = admissionSteps.length ? admissionSteps.slice(0, 6) : FALLBACK_STEPS;

  const phone = contentText(content, 'contact_phone', '—');
  const email = contentText(content, 'contact_email', '—');
  const address = contentText(content, 'contact_address', '—');
  const hours = contentText(content, 'contact_hours', '—');

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="hero" ref={heroRef}>
        <div className="hero__bg" aria-hidden="true">
          <span className="hero__orb hero__orb--1" />
          <span className="hero__orb hero__orb--2" />
          <span className="hero__orb hero__orb--3" />
        </div>
        <div className="container hero__inner">
          <div className="hero__content">
            <span className="hero__badge">
              {contentText(content, 'hero_badge', 'بيانات تجريبية — مدرسة تقنية')}
            </span>
            <h1 className="hero__title">
              مدرسة طيبة <span className="accent">تكنولوجي</span>
              <br />
              حيث يتحوّل الشغف التقني إلى مهارة
            </h1>
            <p className="hero__subtitle">
              {contentText(
                content,
                'hero_subtitle',
                'بيئة تعليمية تجمع بين الأساس النظري والتطبيق العملي في مجالات التقنية والهندسة، لإعداد طلاب قادرين على مواكبة سوق العمل الرقمي.'
              )}
            </p>

            <div className="hero__actions">
              <Link className="btn btn-primary btn-lg" to="/apply">
                قدّم الآن
                <Icon name="arrowLeft" size={18} />
              </Link>
              <Link className="btn btn-outline btn-lg" to="/departments">
                استكشف الأقسام
              </Link>
            </div>

            <ul className="hero__trust">
              <li>
                <Icon name="check" size={18} /> تقديم إلكتروني في دقائق
              </li>
              <li>
                <Icon name="check" size={18} /> رقم طلب لمتابعة الحالة
              </li>
              <li>
                <Icon name="check" size={18} /> بياناتك محفوظة بسرية
              </li>
            </ul>

            <p className="hero__note">
              <Icon name="alert" size={18} />
              <span>
                هذا موقع تجريبي لأغراض العرض. الأقسام والمواعيد وبيانات التواصل المعروضة غير رسمية.
              </span>
            </p>
          </div>

          <div className="hero__media">
            <div className="hero__media-frame">
              <img
                src="/assets/img/logo.jpg"
                alt="شعار مدرسة طيبة تكنولوجي"
                width="413"
                height="409"
              />
            </div>
            <div className="hero__float hero__float--1">
              <Icon name="chart" size={22} />
              <div>
                <strong>تعلّم بالمشروعات</strong>
                <span>تطبيق عملي لكل وحدة دراسية</span>
              </div>
            </div>
            <div className="hero__float hero__float--2">
              <Icon name="layers" size={22} />
              <div>
                <strong>مسارات متعددة</strong>
                <span>برمجة وهندسة وتقنيات صناعية</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS BAND ================= */}
      <section className="container" aria-label="أرقام سريعة عن المدرسة">
        <div className="stats-band reveal">
          <div className="stats-band__item">
            <Counter className="stats-band__value" value={departmentList.length} />
            <span className="stats-band__label">قسمًا تقنيًا منشورًا</span>
          </div>
          <div className="stats-band__item">
            <Counter className="stats-band__value" value={stepList.length || 5} />
            <span className="stats-band__label">خطوات للتقديم</span>
          </div>
          <div className="stats-band__item">
            <Counter className="stats-band__value" value={faqs.length} />
            <span className="stats-band__label">سؤالًا شائعًا</span>
          </div>
          <div className="stats-band__item">
            <span className="stats-band__value">
              100<em>%</em>
            </span>
            <span className="stats-band__label">تقديم إلكتروني بدون ورق</span>
          </div>
          <Link className="btn btn-primary stats-band__cta" to="/apply">
            ابدأ التقديم
          </Link>
        </div>
      </section>

      {/* ================= ADVANTAGES ================= */}
      <section className="section" id="why">
        <div className="container">
          <SectionHead
            center
            eyebrow="لماذا مدرسة طيبة تكنولوجي؟"
            title="تعليم تقني يبدأ من التطبيق ولا ينتهي عند النظرية"
            lead="نصمم التجربة التعليمية حول الطالب: أساس معرفي واضح، تدريب عملي منتظم، ومشروعات تُظهر ما تعلّمه الطالب بشكل ملموس."
          />

          <div className="grid grid--3">
            {FEATURES.map((feature, index) => (
              <article
                className="card feature reveal"
                data-delay={String(index % 3)}
                key={feature.title}
              >
                <span className="feature__icon">
                  <Icon name={feature.icon} size={26} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURED DEPARTMENTS ================= */}
      <section className="section section--soft" id="departments">
        <div className="container">
          <div className="section-head__row">
            <SectionHead
              flush
              eyebrow="المسارات التعليمية"
              title="أقسام تقنية تُبنى حول المهارة والتطبيق"
              lead="تعرض هذه القائمة الأقسام المنشورة والمتاحة للتقديم حاليًا من قاعدة بيانات المدرسة."
            />
            <Link className="btn btn-outline" to="/departments">
              عرض جميع الأقسام
            </Link>
          </div>

          <div className="department-grid reveal" aria-live="polite">
            {departments.loading ? <SkeletonGrid count={3} /> : null}
            {!departments.loading && departments.error ? (
              <StateBox
                title="تعذّر تحميل الأقسام"
                message={
                  departments.error.message ||
                  'حدث خطأ أثناء الاتصال بالخادم. تحقق من اتصالك ثم حاول مرة أخرى.'
                }
                actionLabel="إعادة المحاولة"
                onAction={departments.reload}
                iconName="alert"
              />
            ) : null}
            {!departments.loading && !departments.error && !departmentList.length ? (
              <StateBox
                title="لا توجد أقسام منشورة حاليًا"
                message="تقوم إدارة المدرسة بتحديث الأقسام. يمكنك العودة لاحقًا أو التواصل معنا للاستفسار."
                actionLabel="تحديث"
                onAction={departments.reload}
                iconName="book"
              />
            ) : null}
            {!departments.loading && !departments.error
              ? departmentList.slice(0, 6).map((department, index) => (
                  <DepartmentCard department={department} index={index} key={department.id} />
                ))
              : null}
          </div>
        </div>
      </section>

      {/* ================= LATEST NEWS ================= */}
      <section className="section" id="news">
        <div className="container">
          <div className="section-head__row">
            <SectionHead
              flush
              eyebrow="آخر المستجدات"
              title="أخبار وأنشطة من داخل المدرسة"
              lead="أحدث الأخبار المنشورة من لوحة التحكم: أنشطة الأقسام، الورش العملية، والمشروعات الطلابية."
            />
            <Link className="btn btn-outline" to="/news">
              كل الأخبار
            </Link>
          </div>

          <div className="news-grid" aria-live="polite">
            {news.loading ? <SkeletonGrid count={3} /> : null}
            {!news.loading && news.error ? (
              <StateBox
                title="تعذّر تحميل الأخبار"
                message={
                  news.error.message || 'حدث خطأ أثناء الاتصال بالخادم. تحقق من اتصالك ثم حاول مرة أخرى.'
                }
                actionLabel="إعادة المحاولة"
                onAction={news.reload}
                iconName="alert"
              />
            ) : null}
            {!news.loading && !news.error && !articleList.length ? (
              <StateBox
                title="لا توجد أخبار منشورة حاليًا"
                message="تُنشر الأخبار والأنشطة من لوحة التحكم وتظهر هنا مباشرة بعد نشرها."
                actionLabel="زيارة صفحة الأخبار"
                onAction={() => {
                  window.location.href = '/news';
                }}
                iconName="inbox"
              />
            ) : null}
            {!news.loading && !news.error
              ? articleList.map((article, index) => (
                  <NewsCard article={article} index={index} key={article.id} />
                ))
              : null}
          </div>
        </div>
      </section>

      {/* ================= STUDENT EXPERIENCE ================= */}
      <section className="section section--soft" id="student-experience">
        <div className="container">
          <SectionHead
            center
            eyebrow="تجربة الطالب"
            title="التعلّم يستمر خارج قاعة الدرس"
            lead="مساحات للعمل الجماعي، مشروعات فصلية، وأندية تقنية تُنمّي المهارات الشخصية إلى جانب الجانب الأكاديمي. الأنشطة المعروضة توضيحية لأغراض العرض."
          />

          <div className="project-grid reveal">
            {PROJECTS.map((project) => (
              <article className="project-card" key={project.title}>
                <span className="project-card__tag">{project.tag}</span>
                <h3>{project.title}</h3>
                <p>{project.text}</p>
                <div className="project-card__meta">
                  {project.meta.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ABOUT / OBJECTIVES ================= */}
      <section className="section" id="about">
        <div className="container split">
          <div className="prose reveal">
            <span className="eyebrow">عن المدرسة</span>
            <h2 className="section-title mt-1 mb-2">مدرسة تجمع الأساس النظري بالتجربة العملية</h2>
            <p>
              {contentText(
                content,
                'school_intro',
                'مدرسة طيبة تكنولوجي مدرسة تقنية تجريبية تهدف إلى تقديم تعليم تطبيقي في مجالات الحاسوب والهندسة والتقنيات الصناعية، مع التركيز على المشروعات العملية والمتابعة المستمرة.'
              )}
            </p>
            <p>
              {contentText(
                content,
                'learning_environment',
                'توفّر المدرسة بيئة تعليمية منظمة تجمع بين الفصول الدراسية والمختبرات التقنية ومساحات العمل الجماعي.'
              )}
            </p>
            <Link className="btn btn-outline mt-3" to="/about">
              تعرّف على المدرسة
            </Link>
          </div>

          <div className="card p-2 reveal" data-delay="1">
            <span className="eyebrow">أهدافنا التعليمية</span>
            <ul className="skill-list mt-2" aria-live="polite">
              {loading ? <SkeletonLines count={4} /> : null}
              {!loading
                ? objectiveList.map((objective) => <li key={objective}>{objective}</li>)
                : null}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= ADMISSION PROCESS ================= */}
      <section className="section section--soft" id="admission-process">
        <div className="container">
          <SectionHead
            center
            eyebrow="خطوات التقديم"
            title="من اختيار القسم إلى تسجيل الطلب"
            lead="عملية تقديم مبسطة، ويمكنك متابعة حالة الطلب برقم الطلب الذي يظهر بعد الإرسال."
          />
          <ol className="steps reveal" aria-live="polite">
            {stepList.map((step, index) => {
              const [head, ...rest] = String(step).split(':');
              const hasHeading = rest.length > 0;
              return (
                <li className="step" key={`${index}-${step}`}>
                  <h3>{hasHeading ? head.trim() : `الخطوة ${ORDINALS[index] || index + 1}`}</h3>
                  <p>{hasHeading ? rest.join(':').trim() : step}</p>
                </li>
              );
            })}
          </ol>
          <div className="text-center mt-4">
            <Link className="btn btn-primary" to="/apply">
              ابدأ التقديم الآن
            </Link>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="section" id="faq">
        <div className="container">
          <SectionHead
            center
            eyebrow="أسئلة شائعة"
            title="إجابات عن أكثر ما يسأل عنه المتقدمون"
          />
          <div className="faq-list reveal" aria-live="polite">
            {loading ? <SkeletonLines count={3} /> : null}
            {!loading && !faqs.length ? (
              <StateBox
                title="لا توجد أسئلة منشورة"
                message="سيتم عرض الأسئلة الشائعة هنا بمجرد إضافتها من لوحة التحكم."
                iconName="info"
              />
            ) : null}
            {!loading
              ? faqs.map((faq) => (
                  <details className="faq-item" key={faq.id || faq.question}>
                    <summary>{faq.question}</summary>
                    <div className="faq-item__answer">{faq.answer}</div>
                  </details>
                ))
              : null}
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIALS ================= */}
      <section className="section section--soft" id="voices">
        <div className="container">
          <SectionHead
            center
            eyebrow="تجارب الطلاب"
            title="كيف يصف الطلاب تجربة التعلّم داخل المدرسة؟"
            lead="نماذج توضيحية لآراء طلاب، مكتوبة لأغراض العرض ولا تمثل شهادات حقيقية."
          />

          <div className="quote-grid reveal">
            {QUOTES.map((quote) => (
              <figure className="quote-card" key={quote.name}>
                <blockquote className="quote-card__text">{quote.text}</blockquote>
                <figcaption className="quote-card__person">
                  <span className="quote-card__avatar" aria-hidden="true">
                    {quote.avatar}
                  </span>
                  <span>
                    <span className="quote-card__name">{quote.name}</span>
                    <span className="quote-card__role">نموذج توضيحي</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="section section--tight">
        <div className="container">
          <div className="cta-band reveal">
            <div>
              <h2>جاهز تبدأ رحلتك التقنية معنا؟</h2>
              <p>
                اختر القسم المناسب، أرسل طلبك في دقائق، واحتفظ برقم الطلب لمتابعة حالة المراجعة مع
                إدارة المدرسة.
              </p>
            </div>
            <div className="cta-band__actions">
              <Link className="btn btn-primary btn-lg" to="/apply">
                قدّم الآن
              </Link>
              <Link className="btn btn-outline btn-lg" to="/departments">
                تصفّح الأقسام
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section className="section section--soft" id="contact">
        <div className="container">
          <div className="contact-card reveal">
            <div className="contact-card__main">
              <span className="eyebrow">تواصل معنا</span>
              <h2 className="section-title mt-1 mb-2">هل لديك سؤال قبل التقديم؟</h2>
              <p className="text-muted">
                بيانات التواصل التالية تجريبية لأغراض العرض ولا تمثل معلومات رسمية للمدرسة.
              </p>

              <ul className="contact-list">
                <li className="contact-item">
                  <span className="contact-item__icon">
                    <Icon name="phone" size={22} />
                  </span>
                  <div>
                    <div className="contact-item__label">الهاتف</div>
                    <a className="contact-item__value" href={phoneHref(phone) || undefined}>
                      {phone}
                    </a>
                  </div>
                </li>
                <li className="contact-item">
                  <span className="contact-item__icon">
                    <Icon name="mail" size={22} />
                  </span>
                  <div>
                    <div className="contact-item__label">البريد الإلكتروني</div>
                    <a className="contact-item__value" href={emailHref(email) || undefined}>
                      {email}
                    </a>
                  </div>
                </li>
                <li className="contact-item">
                  <span className="contact-item__icon">
                    <Icon name="pin" size={22} />
                  </span>
                  <div>
                    <div className="contact-item__label">العنوان</div>
                    <div className="contact-item__value">{address}</div>
                  </div>
                </li>
                <li className="contact-item">
                  <span className="contact-item__icon">
                    <Icon name="clock" size={22} />
                  </span>
                  <div>
                    <div className="contact-item__label">ساعات التواصل</div>
                    <div className="contact-item__value">{hours}</div>
                  </div>
                </li>
              </ul>

              <Link className="btn btn-outline mt-3" to="/contact">
                صفحة التواصل الكاملة
              </Link>
            </div>

            <div className="contact-card__aside">
              <div>
                <h3>جاهز لبدء رحلتك التقنية؟</h3>
                <p>
                  اختر القسم المناسب وأرسل طلبك خلال دقائق. إرسال الطلب لا يعني القبول النهائي، بل
                  يبدأ مراجعة إدارة المدرسة لبياناتك.
                </p>
              </div>
              <div>
                <Link className="btn btn-primary w-full" to="/apply">
                  قدّم الآن
                </Link>
                <p className="note-xs">تُستخدم البيانات المقدمة لمراجعة الطلب فقط.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
