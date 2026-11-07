import { Link } from 'react-router-dom';
import { Icon } from '../../lib/icons.jsx';
import { contentText, emailHref, phoneHref, useSchoolContent } from '../../lib/content.jsx';

export default function SiteFooter({ note }) {
  const { content } = useSchoolContent();
  const phone = contentText(content, 'contact_phone', '—');
  const email = contentText(content, 'contact_email', '—');
  const address = contentText(content, 'contact_address', '—');
  const tel = phoneHref(phone);
  const mail = emailHref(email);
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link className="footer-brand" to="/">
              <img src="/assets/img/logo.svg" alt="" width="44" height="44" />
              <span>
                <strong>مدرسة طيبة تكنولوجي</strong>
                <span>Taiba Technology School</span>
              </span>
            </Link>
            <p>
              مدرسة تقنية تجريبية تقدم تعليمًا تطبيقيًا في مجالات التقنية والهندسة. جميع البيانات
              والأقسام والمواعيد المعروضة هنا لأغراض العرض فقط.
            </p>
          </div>

          <div>
            <h2 className="footer-title">روابط سريعة</h2>
            <ul className="footer-links">
              <li>
                <Link to="/about">عن المدرسة</Link>
              </li>
              <li>
                <Link to="/departments">الأقسام</Link>
              </li>
              <li>
                <Link to="/news">الأخبار</Link>
              </li>
              <li>
                <Link to="/admission">القبول والتقديم</Link>
              </li>
              <li>
                <Link to="/apply">نموذج التقديم</Link>
              </li>
              <li>
                <Link to="/contact">تواصل معنا</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="footer-title">معلومات</h2>
            <ul className="footer-links">
              <li>
                <Link to="/#faq">الأسئلة الشائعة</Link>
              </li>
              <li>
                <Link to="/admission#notice">تنبيه البيانات التجريبية</Link>
              </li>
              <li>
                <a href="/admin">دخول الإدارة</a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="footer-title">تواصل معنا</h2>
            <ul className="footer-contact">
              <li>
                <Icon name="phone" size={18} />
                <a href={tel || undefined}>{phone}</a>
              </li>
              <li>
                <Icon name="mail" size={18} />
                <a href={mail || undefined}>{email}</a>
              </li>
              <li>
                <Icon name="pin" size={18} />
                <span>{address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} مدرسة طيبة تكنولوجي — نسخة تجريبية.</span>
          <span className="demo-flag">{note || 'بيانات ومواعيد تجريبية لأغراض العرض'}</span>
        </div>
      </div>
    </footer>
  );
}
