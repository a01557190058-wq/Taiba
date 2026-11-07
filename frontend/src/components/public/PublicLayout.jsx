import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import { Icon } from '../../lib/icons.jsx';

/** Floating "back to top" control, revealed after scrolling down. */
function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      className={`to-top${visible ? ' is-visible' : ''}`}
      aria-label="العودة إلى أعلى الصفحة"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <Icon name="arrowUp" size={20} />
    </button>
  );
}

export default function PublicLayout() {
  const location = useLocation();

  return (
    <>
      <a className="skip-link" href="#main">
        تخطَّ إلى المحتوى الرئيسي
      </a>
      <SiteHeader />
      <main id="main" key={location.pathname} className="route-view">
        <Outlet />
      </main>
      <SiteFooter />
      <BackToTop />
    </>
  );
}
