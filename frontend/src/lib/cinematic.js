/**
 * Cinematic interaction utilities.
 *
 * Everything is written through the CSSOM (`style.setProperty`) or through
 * data attributes — never through inline `style` markup — so the strict
 * `style-src 'self'` Content-Security-Policy stays intact.
 */

const INTERACTIVE =
  '.btn, .department-card, .news-card, .feature, .project-card, .stat-card, .site-nav__link, .card-link, .to-top, .faq-item';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Global magnetic/tilt pointer feedback plus scroll direction tracking.
 * One delegated listener serves the whole document, including async cards.
 */
export function installCinematicInteractions() {
  if (typeof window === 'undefined') return () => {};
  const root = document.documentElement;

  if (prefersReduced()) {
    root.dataset.cinematic = 'static';
    return () => {};
  }

  root.dataset.cinematic = 'active';

  let frame = 0;
  let active = null;
  let pending = null;
  let lastScroll = window.scrollY;
  let scrollFrame = 0;

  const reset = (node) => {
    if (!node) return;
    node.style.setProperty('--mag-x', '0');
    node.style.setProperty('--mag-y', '0');
    node.style.setProperty('--tilt-x', '0');
    node.style.setProperty('--tilt-y', '0');
    node.style.setProperty('--glow-x', '50%');
    node.style.setProperty('--glow-y', '50%');
  };

  const applyPointer = () => {
    frame = 0;
    if (!pending || !pending.node.isConnected) return;
    const { node, x, y } = pending;
    node.style.setProperty('--mag-x', x.toFixed(3));
    node.style.setProperty('--mag-y', y.toFixed(3));
    node.style.setProperty('--tilt-x', (y * -4).toFixed(2));
    node.style.setProperty('--tilt-y', (x * 4).toFixed(2));
    node.style.setProperty('--glow-x', `${((x + 1) * 50).toFixed(1)}%`);
    node.style.setProperty('--glow-y', `${((y + 1) * 50).toFixed(1)}%`);
  };

  const onPointerMove = (event) => {
    const node = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
    if (active && active !== node) {
      reset(active);
      active = null;
    }
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    active = node;
    pending = {
      node,
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    };
    if (!frame) frame = window.requestAnimationFrame(applyPointer);
  };

  const onPointerLeave = () => {
    if (active) reset(active);
    active = null;
    pending = null;
  };

  const onScroll = () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      const current = window.scrollY;
      const delta = current - lastScroll;
      if (Math.abs(delta) > 4) {
        root.dataset.scrollDirection = delta > 0 ? 'down' : 'up';
        lastScroll = current;
      }
      root.dataset.deepScroll = current > 720 ? 'true' : 'false';
    });
  };

  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('blur', onPointerLeave);
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('blur', onPointerLeave);
    window.removeEventListener('scroll', onScroll);
    reset(active);
    delete root.dataset.cinematic;
    delete root.dataset.scrollDirection;
    delete root.dataset.deepScroll;
  };
}

/**
 * Scroll-triggered cinematic reveals for elements marked with
 * `data-cinematic-reveal`. Works with async lists via a MutationObserver.
 */
export function installCinematicReveals() {
  if (typeof window === 'undefined') return () => {};

  const reveal = (node) => {
    if (!node || node.classList.contains('is-cinematic-visible')) return false;
    node.classList.add('is-cinematic-visible');
    return true;
  };

  if (prefersReduced() || !('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-cinematic-reveal]').forEach(reveal);
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
  );

  const observeTree = (node) => {
    if (!(node instanceof Element)) return;
    if (node.matches('[data-cinematic-reveal]:not(.is-cinematic-visible)')) observer.observe(node);
    node
      .querySelectorAll('[data-cinematic-reveal]:not(.is-cinematic-visible)')
      .forEach((child) => observer.observe(child));
  };

  observeTree(document.body);
  const mutations = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach(observeTree));
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  // Defensive fallback: some embedded browsers never deliver IntersectionObserver
  // callbacks, and others pause requestAnimationFrame. A cheap geometry sweep,
  // throttled with timers rather than rAF, guarantees no section stays hidden.
  let timer = 0;
  const sweep = () => {
    timer = 0;
    const limit = window.innerHeight * 0.94;
    document
      .querySelectorAll('[data-cinematic-reveal]:not(.is-cinematic-visible)')
      .forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.top < limit && rect.bottom > 0) {
          reveal(node);
          observer.unobserve(node);
        }
      });
  };
  const schedule = () => {
    if (!timer) timer = window.setTimeout(sweep, 60);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  const initial = window.setTimeout(schedule, 350);

  return () => {
    observer.disconnect();
    mutations.disconnect();
    window.clearTimeout(initial);
    window.clearTimeout(timer);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
  };
}

/** True when the visitor can benefit from desktop-only cinematic effects. */
export function cinematicDesktop() {
  if (typeof window === 'undefined' || prefersReduced()) return false;
  return Boolean(
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches &&
      window.innerWidth >= 900
  );
}
