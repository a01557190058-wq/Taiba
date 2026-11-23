import { useEffect, useRef } from 'react';

/**
 * Brand-coloured reading progress line.
 * The value is written as a `data-step` attribute (not an inline style), so it
 * works under the backend's strict CSP. Browsers with scroll timelines animate
 * the same element through CSS instead.
 */
export default function ScrollProgress() {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      node.dataset.step = String(Math.min(20, Math.max(0, Math.round(ratio * 20))));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className="scroll-progress" ref={ref} data-step="0" aria-hidden="true">
      <span className="scroll-progress__bar" />
    </div>
  );
}
