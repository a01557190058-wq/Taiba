import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import { Icon } from '../../lib/icons.jsx';
import ScrollProgress from './experience/ScrollProgress.jsx';
import IntroSplash from './experience/IntroSplash.jsx';
import CinematicCursor from './experience/CinematicCursor.jsx';
import { installCinematicInteractions, installCinematicReveals } from '../../lib/cinematic.js';

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

/** Short brand sweep played whenever a new route mounts. */
function RouteCurtain() {
  const location = useLocation();
  return (
    <div className="route-curtain" key={location.key} aria-hidden="true">
      <span className="route-curtain__veil" />
      <span className="route-curtain__line" />
    </div>
  );
}

export default function PublicLayout() {
  const location = useLocation();

  useEffect(() => {
    const stopPointer = installCinematicInteractions();
    const stopReveals = installCinematicReveals();
    return () => {
      stopPointer();
      stopReveals();
    };
  }, []);

  return (
    <>
      <IntroSplash />
      <ScrollProgress />
      <CinematicCursor />
      <RouteCurtain />
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
