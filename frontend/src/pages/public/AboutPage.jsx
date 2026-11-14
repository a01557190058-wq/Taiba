import { Link } from 'react-router-dom';
import { contentText, useSchoolContent } from '../../lib/content.jsx';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import { PageHero, SectionHead } from '../../components/public/ui.jsx';

const FALLBACK_OBJECTIVES = [
  'ربط المناهج التقنية باحتياجات سوق العمل والمشروعات الواقعية.',
  'تنمية مهارات التفكير التحليلي وحل المشكلات لدى الطلاب.',
  'توفير تدريب عملي منتظم داخل مختبرات وورش المدرسة.',
  'تعزيز العمل الجماعي والتواصل المهني والمسؤولية الأخلاقية.',
];

const JOURNEY = [
  {
    title: 'التأسيس',
    text: 'مهارات رياضية ولغوية وأساسيات تقنية مشتركة بين جميع المسارات.',
  },
  {
    title: 'التخصص',
    text: 'اختيار التخصص ودراسة مواده الأساسية داخل الفصل والمختبر.',
  },
  {
    title: 'التطبيق',
    text: 'مشروعات متدرجة وورش عملية تُقيَّم عبر ملفات الإنجاز.',
  },
  {
    title: 'الإنجاز',
    text: 'مشروع ختامي وعرض أمام الزملاء والمشرفين مع ملاحظات مباشرة.',
  },
];

const VALUES = [
  {
    icon: 'star',
    title: 'الإتقان',
    text: 'جودة العمل قبل سرعة إنجازه، مع مراجعة لكل تسليم وملاحظات قابلة للتطبيق.',
  },
  {
    icon: 'users',
    title: 'العمل الجماعي',
    text: 'تقسيم أدوار واضح داخل الفرق، وتقدير مساهمة كل طالب في نتيجة المشروع.',
  },
  {
    icon: 'shield',
    title: 'المسؤولية',
    text: 'التزام بإجراءات السلامة، واحترام مواعيد التسليم، واستخدام أمين لأدوات المختبر.',
  },
];

export default function AboutPage() {
  usePageMeta(
    'عن المدرسة | مدرسة طيبة تكنولوجي',
    'تعرّف على مدرسة طيبة تكنولوجي: الرؤية والرسالة والأهداف التعليمية وبيئة التعلم والتعلّم العملي.'
  );

  const { content, objectives, loading } = useSchoolContent();
  const objectiveList = objectives.length ? objectives : FALLBACK_OBJECTIVES;

  return (
    <>
      <PageHero
        title="عن مدرسة طيبة تكنولوجي"
        lead="مدرسة تقنية تجريبية تضع التطبيق العملي في قلب التجربة التعليمية، وتبني مسارات متدرجة تربط المعرفة النظرية بالمهارات التي يحتاجها سوق العمل."
        breadcrumb={[{ label: 'الرئيسية', href: '/' }, { label: 'عن المدرسة' }]}
      />

      <section className="section">
        <div className="container split">
          <div className="prose reveal">
            <span className="eyebrow">نبذة عن المدرسة</span>
            <h2 className="section-title mt-1 mb-2">تعليم تقني يبدأ من السؤال وينتهي بمشروع</h2>
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
          </div>

          <div className="grid grid--2">
            <article className="card p-2 reveal">
              <span className="feature__icon">
                <Icon name="eye" size={26} />
              </span>
              <h3>رؤيتنا</h3>
              <p className="text-muted text-small">
                {contentText(
                  content,
                  'vision',
                  'أن نكون نموذجًا في التعليم التقني التطبيقي الذي يربط الطالب باحتياجات المجتمع وسوق العمل.'
                )}
              </p>
            </article>
            <article className="card p-2 reveal" data-delay="1">
              <span className="feature__icon">
                <Icon name="target" size={26} />
              </span>
              <h3>رسالتنا</h3>
              <p className="text-muted text-small">
                {contentText(
                  content,
                  'mission',
                  'تقديم تعليم تقني متوازن يجمع الأساس النظري والتدريب العملي، ويُنمّي مهارات التفكير والعمل الجماعي والمسؤولية المهنية.'
                )}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="container">
          <SectionHead
            eyebrow="الأهداف التعليمية"
            title="ما نسعى إلى تحقيقه مع كل طالب"
            lead="أهداف قابلة للمتابعة داخل الفصول والمختبرات، وليست شعارات عامة."
          />
          <div className="card p-2 reveal">
            <ul className="skill-list" aria-live="polite">
              {loading ? (
                <li className="text-muted">جارٍ تحميل الأهداف…</li>
              ) : (
                objectiveList.map((objective) => <li key={objective}>{objective}</li>)
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead
            center
            eyebrow="الرحلة التعليمية"
            title="أربع مراحل من الأساسيات إلى مشروع التخرج"
            lead="تدرّج واضح يمنح الطالب وقتًا للفهم قبل التخصص، ثم مساحة للتطبيق والعرض."
          />
          <ol className="steps reveal">
            {JOURNEY.map((stage) => (
              <li className="step" key={stage.title}>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--soft">
        <div className="container">
          <SectionHead center eyebrow="قيمنا" title="ثلاث قيم تحكم طريقة العمل داخل المدرسة" />
          <div className="grid grid--3">
            {VALUES.map((value, index) => (
              <article className="card feature reveal" data-delay={String(index)} key={value.title}>
                <span className="feature__icon">
                  <Icon name={value.icon} size={26} />
                </span>
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div className="card p-2 reveal">
            <span className="eyebrow">بيئة التعلّم</span>
            <h2 className="section-title mt-1 mb-2">مساحة منظمة تجمع الفصل والمختبر والعمل الجماعي</h2>
            <p className="prose">
              {contentText(
                content,
                'learning_environment',
                'توفّر المدرسة بيئة تعليمية منظمة تجمع بين الفصول الدراسية والمختبرات التقنية ومساحات العمل الجماعي.'
              )}
            </p>
          </div>
          <div className="card p-2 reveal" data-delay="1">
            <span className="eyebrow">التعلّم العملي</span>
            <h2 className="section-title mt-1 mb-2">التطبيق أولًا، ثم التقييم عبر ملفات الإنجاز</h2>
            <p className="prose">
              {contentText(
                content,
                'practical_learning',
                'يُقيَّم الطالب من خلال مشروعات عملية وملفات إنجاز توثّق تطوره، مع ملاحظات مباشرة من المدرّس.'
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="container">
          <div className="contact-card reveal">
            <div className="contact-card__main">
              <span className="eyebrow">خطوتك التالية</span>
              <h2 className="section-title mt-1 mb-2">اطّلع على التخصصات واختر مسارك</h2>
              <p className="text-muted">
                كل تخصص يعرض وصفه ومهاراته ومعلومات القبول الخاصة به. يمكنك التقديم مباشرة بعد
                اختيار التخصص.
              </p>
              <div className="hero__actions">
                <Link className="btn btn-primary" to="/departments">
                  استكشف التخصصات
                </Link>
                <Link className="btn btn-outline" to="/admission">
                  معلومات القبول
                </Link>
              </div>
            </div>
            <div className="contact-card__aside">
              <div>
                <h3>ملاحظة مهمة</h3>
                <p>
                  محتوى هذه الصفحة قابل للتحرير من لوحة التحكم، وجميع البيانات المعروضة تجريبية
                  لأغراض العرض.
                </p>
              </div>
              <Link className="btn btn-primary w-full" to="/apply">
                قدّم الآن
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
