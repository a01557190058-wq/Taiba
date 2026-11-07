import { Link } from 'react-router-dom';
import { contentText, emailHref, phoneHref, useSchoolContent } from '../../lib/content.jsx';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import { DemoBanner, PageHero, SectionHead } from '../../components/public/ui.jsx';

const ORDINALS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];

const FALLBACK_STEPS = [
  'اختر القسم المناسب من صفحة الأقسام واطّلع على وصفه ومهاراته.',
  'افتح نموذج التقديم وأدخل الاسم الكامل ورقم هاتف صحيحًا.',
  'اختر القسم المطلوب من القائمة، وأضف أي ملاحظات مفيدة.',
  'وافق على معالجة البيانات ثم أرسل الطلب.',
  'احتفظ برقم الطلب الظاهر بعد الإرسال لمتابعة الحالة.',
];

const FAQS = [
  {
    question: 'هل يمكنني تعديل الطلب بعد إرساله؟',
    answer:
      'لا يمكن تعديل الطلب من الموقع بعد الإرسال. تواصل مع إدارة المدرسة عبر بيانات الاتصال المعروضة، مع ذكر رقم الطلب، لأي تصحيح في البيانات.',
    open: true,
  },
  {
    question: 'هل أستطيع التقديم على أكثر من قسم؟',
    answer:
      'يمكنك إرسال طلب واحد لكل قسم ترغب فيه. سيتم التعامل مع كل طلب برقم مستقل، ويُفضّل اختيار القسم الأقرب لاهتمامك عند التأكيد النهائي.',
  },
  {
    question: 'كيف أعرف حالة طلبي؟',
    answer:
      'احتفظ برقم الطلب الظاهر بعد الإرسال. تتم مراجعة الطلبات من لوحة الإدارة، ويتم التواصل معك عبر رقم الهاتف أو البريد الإلكتروني المسجل.',
  },
  {
    question: 'هل يشترط خبرة سابقة في التقنية؟',
    answer:
      'لا. المسارات تبدأ من الأساسيات وتتدرج نحو التطبيق العملي، والاختبارات أو المقابلات — إن وُجدت — تُعلن مسبقًا من إدارة المدرسة.',
  },
];

export default function AdmissionPage() {
  usePageMeta(
    'القبول والتقديم | مدرسة طيبة تكنولوجي',
    'معلومات القبول والتقديم في مدرسة طيبة تكنولوجي: خطوات التقديم، المواعيد التجريبية، والمستندات المطلوبة.'
  );

  const { content, admissionSteps, loading } = useSchoolContent();
  const steps = admissionSteps.length ? admissionSteps.slice(0, 8) : FALLBACK_STEPS;
  const phone = contentText(content, 'contact_phone', '—');
  const email = contentText(content, 'contact_email', '—');

  return (
    <>
      <PageHero
        title="القبول والتقديم"
        lead="كل ما تحتاجه لاختيار القسم وإرسال طلب التقديم: الخطوات، المواعيد التجريبية، والمعلومات التي يجب تجهيزها قبل تعبئة النموذج."
        breadcrumb={[{ label: 'الرئيسية', href: '/' }, { label: 'القبول والتقديم' }]}
      />

      <section className="section section--tight">
        <div className="container">
          <DemoBanner id="notice">
            {contentText(
              content,
              'admission_notice',
              'هذه الصفحة تعرض بيانات قبول تجريبية لأغراض العرض فقط.'
            )}
          </DemoBanner>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="info-grid reveal">
            <div className="info-tile">
              <span className="info-tile__label">مواعيد التقديم التجريبية</span>
              <p className="info-tile__value">
                {contentText(content, 'admission_dates', '—')}
              </p>
            </div>
            <div className="info-tile">
              <span className="info-tile__label">طريقة التقديم</span>
              <p className="info-tile__value">
                تعبئة النموذج الإلكتروني على الموقع، ثم الاحتفاظ برقم الطلب لمتابعة الحالة.
              </p>
            </div>
            <div className="info-tile">
              <span className="info-tile__label">للاستفسار</span>
              <p className="info-tile__value">
                <a href={phoneHref(phone) || undefined}>{phone}</a>
                <br />
                <a href={emailHref(email) || undefined}>{email}</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div className="reveal">
            <span className="eyebrow">خطوات التقديم</span>
            <h2 className="section-title mt-1 mb-2">
              خمس خطوات من اختيار القسم إلى تسجيل الطلب
            </h2>
            <ol className="steps" aria-live="polite">
              {loading ? (
                <li className="step">
                  <h3>جارٍ التحميل…</h3>
                  <p>يتم جلب خطوات التقديم من قاعدة بيانات المدرسة.</p>
                </li>
              ) : (
                steps.map((step, index) => (
                  <li className="step" key={`${index}-${step}`}>
                    <h3>{`الخطوة ${ORDINALS[index] || index + 1}`}</h3>
                    <p>{step}</p>
                  </li>
                ))
              )}
            </ol>
          </div>

          <div className="card p-2 reveal" data-delay="1">
            <span className="eyebrow">قبل أن تبدأ</span>
            <h2 className="section-title mt-1 mb-2">جهّز هذه المعلومات</h2>
            <ul className="skill-list mt-2">
              <li>الاسم الكامل كما ترغب في تسجيله.</li>
              <li>رقم هاتف فعّال يمكن التواصل عليه.</li>
              <li>بريد إلكتروني (اختياري) لمتابعة المراسلات.</li>
              <li>المؤهل أو المرحلة الدراسية السابقة (اختياري).</li>
              <li>ملاحظات مختصرة عن اهتمامك بالقسم (اختياري).</li>
            </ul>

            <div className="callout callout--warning mt-3">
              <h3>إرسال الطلب لا يعني القبول</h3>
              <p>
                بعد الإرسال تُسجَّل حالة الطلب كـ«جديد» وتتم مراجعته من إدارة المدرسة. لا تصدر أي
                نتيجة قبول تلقائية من الموقع، ويتم التواصل معك عبر بيانات الاتصال المسجلة.
              </p>
            </div>

            <Link className="btn btn-primary w-full mt-3" to="/apply">
              الانتقال إلى نموذج التقديم
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="container">
          <SectionHead
            center
            eyebrow="التجهيز للقبول"
            title="المستندات والرسوم: ما تحتاج معرفته مسبقًا"
            lead="المعلومات التالية توضيحية لأغراض العرض، وتُحدَّث فعليًا من إدارة المدرسة عند فتح باب القبول."
          />

          <div className="grid grid--2">
            <div className="card p-2 reveal">
              <span className="eyebrow">المستندات المطلوبة</span>
              <h3 className="mt-1 mb-2">جهّز نسخًا واضحة من:</h3>
              <ul className="skill-list">
                <li>صورة من شهادة أو بيان المرحلة الدراسية السابقة.</li>
                <li>صورة من بطاقة الرقم القومي أو وثيقة إثبات الهوية.</li>
                <li>صورة شخصية حديثة بخلفية واضحة.</li>
                <li>بيان بدرجات المواد الأساسية (إن وُجد).</li>
                <li>أي مستندات إضافية تطلبها إدارة المدرسة بعد المراجعة الأولية.</li>
              </ul>
              <p className="text-muted text-small mt-2">
                لا يُطلب رفع المستندات عبر الموقع في النسخة الحالية؛ يتم تسليمها لإدارة المدرسة بعد
                مراجعة الطلب والتواصل معك.
              </p>
            </div>

            <div className="card p-2 reveal" data-delay="1">
              <span className="eyebrow">الرسوم والالتزامات</span>
              <h3 className="mt-1 mb-2">شفافية قبل التسجيل</h3>
              <p className="text-muted">
                لا يعرض الموقع أي مبالغ رسوم في النسخة التجريبية. عند التقديم الرسمي تُعلن إدارة
                المدرسة قيمة الرسوم ومواعيد السداد ووسائل الدفع المتاحة بشكل واضح قبل تأكيد
                التسجيل.
              </p>
              <ul className="skill-list mt-2">
                <li>لا توجد أي مدفوعات إلكترونية عبر هذا الموقع.</li>
                <li>إرسال الطلب الإلكتروني مجاني ولا يعني القبول.</li>
                <li>أي رسوم تُسدَّد فقط عبر القنوات الرسمية التي تحددها الإدارة.</li>
              </ul>

              <div className="callout callout--warning mt-3">
                <h3>احذر من العروض غير الرسمية</h3>
                <p>
                  لا تتعامل مع أي جهة تطلب مبالغ مقابل «تأكيد القبول» باسم المدرسة. التواريخ وبيانات
                  التواصل الرسمية تُعلن من إدارة المدرسة فقط.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead
            center
            eyebrow="أسئلة القبول"
            title="أسئلة يسألها المتقدمون قبل إرسال الطلب"
          />

          <div className="faq-list reveal">
            {FAQS.map((faq) => (
              <details className="faq-item" open={faq.open} key={faq.question}>
                <summary>{faq.question}</summary>
                <div className="faq-item__answer">{faq.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="container">
          <div className="contact-card reveal">
            <div className="contact-card__main">
              <span className="eyebrow">جاهز للتقديم؟</span>
              <h2 className="section-title mt-1 mb-2">أرسل طلبك في دقائق</h2>
              <p className="text-muted">
                يستغرق النموذج أقل من خمس دقائق. يمكنك اختيار القسم من القائمة الديناميكية التي تعرض
                الأقسام المتاحة للتقديم فقط.
              </p>
              <div className="hero__actions">
                <Link className="btn btn-primary" to="/apply">
                  قدّم الآن
                </Link>
                <Link className="btn btn-outline" to="/departments">
                  استكشف الأقسام
                </Link>
              </div>
            </div>
            <div className="contact-card__aside">
              <div>
                <h3>هل لديك سؤال؟</h3>
                <p>تواصل مع إدارة المدرسة عبر الهاتف أو البريد الإلكتروني المعروض في الموقع.</p>
              </div>
              <Link className="btn btn-primary w-full" to="/contact">
                بيانات التواصل
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
