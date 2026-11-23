import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useScrolledHeader } from '../../lib/motion.jsx';
import { Icon } from '../../lib/icons.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/about', label: 'عن المجمع' },
  {
    to: '/departments',
    label: 'التخصصات',
    menu: [
      { to: '/departments', label: 'كل التخصصات', hint: 'استكشف المسارات التقنية' },
      { to: '/subjects', label: 'الخطة الدراسية', hint: 'المواد والحصص الأسبوعية' },
      { to: '/admission', label: 'خطوات القبول', hint: 'كيفية التقديم والشروط' },
    ],
  },
  { to: '/subjects', label: 'المواد الدراسية' },
  { to: '/news', label: 'الأخبار' },
  { to: '/gallery', label: 'معرض الصور' },
  { to: '/admission', label: 'القبول' },
  { to: '/contact', label: 'تواصل معنا' },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolledHeader();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container site-header__inner">
        <Link className="brand" to="/" aria-label="مجمع طيبة تكنولوجي — الصفحة الرئيسية">
          <span className="brand__mark">
            <img className="brand__logo" src="/assets/img/logo.jpg" alt="" width="46" height="46" />
          </span>
          <span className="brand__text">
            <span className="brand__name">مجمع طيبة تكنولوجي</span>
            <span className="brand__tag">Taiba Technology Complex</span>
          </span>
        </Link>

        <nav
          className={`site-nav${open ? ' is-open' : ''}`}
          id="site-nav"
          aria-label="التنقل الرئيسي"
        >
          <ul className="site-nav__list">
            {NAV_ITEMS.map((item) => (
              <li
                key={item.to}
                className={item.menu ? 'site-nav__item has-menu' : 'site-nav__item'}
              >
                <NavLink className="site-nav__link" to={item.to} end={item.end}>
                  {item.label}
                  {item.menu ? <Icon name="arrowDown" size={12} /> : null}
                </NavLink>
                {item.menu ? (
                  <div className="site-nav__menu">
                    {item.menu.map((entry) => (
                      <Link className="site-nav__menu-link" to={entry.to} key={entry.to}>
                        <strong>{entry.label}</strong>
                        <span>{entry.hint}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <a className="admin-link" href="/admin">
            <Icon name="dashboard" size={16} />
            لوحة التحكم
          </a>
          <Link className="btn btn-primary btn-sm" to="/apply">
            قدّم الآن
            <Icon name="arrowLeft" size={16} />
          </Link>
          <button
            className="nav-toggle"
            type="button"
            aria-expanded={open}
            aria-controls="site-nav"
            aria-label={open ? 'إغلاق قائمة التنقل' : 'فتح قائمة التنقل'}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="nav-toggle__bars" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
