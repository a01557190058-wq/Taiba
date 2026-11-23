import { useEffect, useState } from 'react';
import { Icon } from '../../../lib/icons.jsx';

const SEEN_KEY = 'taiba.intro.seen';

/**
 * First-visit splash. It runs one CSS lifecycle animation (reveal → hold →
 * exit) and removes itself when that animation ends. No inline styles, so the
 * strict CSP remains intact, and no timers are needed for the normal path.
 */
export default function IntroSplash() {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      return window.sessionStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const dismiss = () => {
    document.documentElement.classList.remove('intro-active');
    setActive(false);
    try {
      window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* Storage may be blocked; the splash still finishes normally. */
    }
  };

  useEffect(() => {
    if (!active) return undefined;
    document.documentElement.classList.add('intro-active');
    // Safety net: never leave the page locked if the animation never fires.
    const safety = window.setTimeout(dismiss, 5000);
    const onKey = (event) => {
      if (event.key === 'Escape' || event.key === 'Enter') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(safety);
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('intro-active');
    };
  }, [active]);

  const finish = (event) => {
    if (event.target === event.currentTarget) dismiss();
  };

  if (!active) return null;

  return (
    <div
      className="intro-splash"
      onAnimationEnd={finish}
      role="dialog"
      aria-label="افتتاحية مجمع طيبة تكنولوجي"
    >
      <span className="intro-splash__aura" />
      <span className="intro-splash__rings" aria-hidden="true">
        <span />
        <span />
      </span>

      <div className="intro-splash__core">
        <div className="intro-splash__mark">
          <img src="/assets/img/logo.jpg" alt="" width="86" height="86" />
        </div>
        <strong className="intro-splash__name">مجمع طيبة تكنولوجي</strong>
        <span className="intro-splash__tag">Taiba Technology Complex</span>
        <span className="intro-splash__bars">
          <span />
          <span />
          <span />
        </span>
        <span className="intro-splash__hint">نبني المستقبل التقني...</span>
        <button className="intro-splash__skip" type="button" onClick={dismiss}>
          تخطي الافتتاحية
          <Icon name="arrowLeft" size={14} />
        </button>
      </div>
    </div>
  );
}
