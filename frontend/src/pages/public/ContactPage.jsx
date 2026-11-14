import { Link } from 'react-router-dom';
import { contentText, emailHref, phoneHref, useSchoolContent } from '../../lib/content.jsx';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import { DemoBanner, PageHero, SectionHead } from '../../components/public/ui.jsx';

export default function ContactPage() {
  usePageMeta(
    'تواصل معنا | مدرسة طيبة تكنولوجي',
    'قنوات التواصل مع مدرسة طيبة تكنولوجي: الهاتف، البريد الإلكتروني، العنوان وساعات التواصل، مع رابط مباشر لنموذج التقديم.'
  );

  const { content } = useSchoolContent();
  const phone = contentText(content, 'contact_phone', '—');
  const email = contentText(content, 'contact_email', '—');
  const address = contentText(content, 'contact_address', '—');
  const hours = contentText(content, 'contact_hours', '—');

  const channels = [
    {
      icon: 'phone',
      title: 'الهاتف',
      text: 'للاستفسارات السريعة حول التخصصات والمواعيد، اتصل خلال ساعات العمل.',
      value: phone,
      href: phoneHref(phone),
      delay: 0,
    },
    {
      icon: 'mail',
      title: 'البريد الإلكتروني',
      text: 'أرسل تفاصيل استفسارك أو مرفقاتك، وسيصلك رد من الفريق المختص.',
      value: email,
      href: emailHref(email),
      delay: 1,
    },
    {
      icon: 'pin',
      title: 'العنوان',
      text: 'زيارة المدرسة متاحة بعد تنسيق مسبق مع الإدارة لتحديد الموعد المناسب.',
      value: address,
      href: '',
      delay: 2,
    },
    {
      icon: 'clock',
      title: 'ساعات التواصل',
      text: 'خارج ساعات العمل يمكنك إرسال بريد إلكتروني وسيتم الرد في أول يوم عمل.',
      value: hours,
      href: '',
      delay: 3,
    },
  ];

  return (
    <>
      <PageHero
        title="تواصل معنا"
        lead="فريق المدرسة جاهز للإجابة عن أسئلتك حول التخصصات، شروط القبول، ومتابعة طلبات التقديم. اختر القناة الأنسب لك، أو ابدأ طلبك مباشرة من نموذج التقديم."
        breadcrumb={[{ label: 'الرئيسية', href: '/' }, { label: 'تواصل معنا' }]}
      />

      <section className="section section--tight">
        <div className="container">
          <DemoBanner id="notice">
            بيانات التواصل والعنوان المعروضة هنا تجريبية لأغراض العرض، وليست معلومات رسمية للمدرسة.
          </DemoBanner>
        </div>
      </section>

      <section className="section section--tight" id="channels">
        <div className="container">
          <SectionHead
            eyebrow="قنوات التواصل"
            title="قنوات التواصل والمعلومات الأساسية"
            lead="نرد على الاستفسارات خلال ساعات العمل. للحالات المرتبطة بطلب مقدَّم، اذكر رقم الطلب في رسالتك ليصل استفسارك إلى المسؤول مباشرة."
          />

          <div className="grid grid--2">
            {channels.map((channel) => (
              <article
                className="card feature reveal"
                data-delay={String(channel.delay)}
                key={channel.title}
              >
                <span className="feature__icon">
                  <Icon name={channel.icon} size={26} />
                </span>
                <h3>{channel.title}</h3>
                <p>{channel.text}</p>
                {channel.href ? (
                  <a className="card-link mt-2" href={channel.href}>
                    {channel.value}
                  </a>
                ) : (
                  <div className="card-link mt-2">{channel.value}</div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div className="reveal">
            <span className="eyebrow">قبل أن تتواصل</span>
            <h2 className="section-title mt-1 mb-2">معلومات تسرّع الحصول على إجابة</h2>
            <p className="text-muted">
              كثير من الاستفسارات يمكن حلها مباشرة من صفحات الموقع. راجع هذه الصفحات أولًا، وإن لم
              تجد إجابتك فقنوات التواصل متاحة لك.
            </p>

            <ul className="skill-list mt-2">
              <li>
                <Link to="/departments">وصف التخصصات ومهارات كل مسار</Link> — لاختيار التخصص الأنسب.
              </li>
              <li>
                <Link to="/admission">شروط القبول والمواعيد التجريبية</Link> — قبل تجهيز المستندات.
              </li>
              <li>
                <Link to="/apply">نموذج التقديم</Link> — لإرسال طلب جديد والحصول على رقم متابعة.
              </li>
              <li>
                <Link to="/news">أخبار المدرسة</Link> — لآخر الإعلانات والمستجدات.
              </li>
            </ul>

            <div className="callout callout--warning mt-3">
              <h3>لا تُرسل بيانات حساسة</h3>
              <p>
                لا تشارك أرقامًا سرية أو بيانات دفع عبر البريد الإلكتروني. الموقع لا يطلب أي مدفوعات
                إلكترونية، وأي رسوم رسمية تُعلنها الإدارة عبر قنواتها المعتمدة فقط.
              </p>
            </div>
          </div>

          <div className="contact-card contact-card--stack reveal" data-delay="1">
            <div className="contact-card__main">
              <span className="eyebrow">متابعة طلب</span>
              <h2 className="section-title mt-1 mb-2">هل قدّمت طلبًا بالفعل؟</h2>
              <p className="text-muted">
                احتفظ برقم الطلب الذي ظهر بعد الإرسال. عند التواصل بخصوص الطلب، أرسل رقم الطلب
                والاسم الكامل حتى يتمكن الفريق من الوصول إلى سجلك بسرعة.
              </p>
              <div className="hero__actions">
                <Link className="btn btn-primary" to="/apply">
                  إرسال طلب جديد
                </Link>
                <Link className="btn btn-outline" to="/admission">
                  تفاصيل القبول
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="container">
          <div className="cta-band reveal">
            <div>
              <h2>جاهز تبدأ رحلتك التقنية معنا؟</h2>
              <p>
                اختر التخصص المناسب وأرسل طلبك في دقائق. سيبقى رقم الطلب معك لمتابعة حالة المراجعة مع
                إدارة المدرسة.
              </p>
            </div>
            <div className="cta-band__actions">
              <Link className="btn btn-primary btn-lg" to="/apply">
                قدّم الآن
              </Link>
              <Link className="btn btn-outline btn-lg" to="/departments">
                تصفّح التخصصات
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
