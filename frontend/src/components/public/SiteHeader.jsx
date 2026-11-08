import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useScrolledHeader } from '../../lib/motion.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/about', label: 'عن المدرسة' },
  { to: '/departments', label: 'الأقسام' },
  { to: '/news', label: 'الأخبار' },
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
        <Link className="brand" to="/" aria-label="مدرسة طيبة تكنولوجي — الصفحة الرئيسية">
          <img className="brand__logo" src="/assets/img/logo.jpg" alt="" width="46" height="46" />
          <span className="brand__text">
            <span className="brand__name">مدرسة طيبة تكنولوجي</span>
            <span className="brand__tag">Taiba Technology School</span>
          </span>
        </Link>

        <nav
          className={`site-nav${open ? ' is-open' : ''}`}
          id="site-nav"
          aria-label="التنقل الرئيسي"
        >
          <ul className="site-nav__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink className="site-nav__link" to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <a className="admin-link" href="/admin">
            لوحة التحكم
          </a>
          <Link className="btn btn-primary btn-sm" to="/apply">
            قدّم الآن
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
