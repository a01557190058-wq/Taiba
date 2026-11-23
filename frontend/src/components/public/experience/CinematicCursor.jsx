import { useEffect, useState } from 'react';
import { cinematicDesktop } from '../../../lib/cinematic.js';

/** A soft trailing cursor glow for desktop pointers; native cursor stays. */
export default function CinematicCursor() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!cinematicDesktop()) return undefined;
    setEnabled(true);
    const root = document.documentElement;
    let frame = 0;
    let x = -100;
    let y = -100;

    const paint = () => {
      frame = 0;
      root.style.setProperty('--cursor-x', `${x.toFixed(1)}px`);
      root.style.setProperty('--cursor-y', `${y.toFixed(1)}px`);
    };

    const onMove = (event) => {
      x = event.clientX;
      y = event.clientY;
      const interactive = event.target instanceof Element &&
        event.target.closest('a, button, [role="button"], input, select, textarea, summary');
      root.dataset.cursorActive = interactive ? 'true' : 'false';
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const onLeave = () => {
      root.dataset.cursorActive = 'false';
      x = -100;
      y = -100;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      delete root.dataset.cursorActive;
    };
  }, []);

  if (!enabled) return null;

  return (
    <div className="cinematic-cursor" aria-hidden="true">
      <span className="cinematic-cursor__ring" />
      <span className="cinematic-cursor__dot" />
    </div>
  );
}
