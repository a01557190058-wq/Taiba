import { useEffect, useRef, useState } from 'react';

const REDUCED_MOTION = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One global scroll-reveal observer for the whole public site. It watches for
 * `.reveal` nodes added later (async lists, route changes) via a
 * MutationObserver, so individual pages do not need to wire anything up.
 */
export function installRevealObserver() {
  if (typeof window === 'undefined') return () => {};
  document.documentElement.classList.add('js');

  if (REDUCED_MOTION() || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach((node) => node.classList.add('is-visible'));
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
  );

  const observeTree = (root) => {
    if (!root || root.nodeType !== 1) return;
    if (root.classList && root.classList.contains('reveal') && !root.classList.contains('is-visible')) {
      observer.observe(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll('.reveal:not(.is-visible)').forEach((node) => observer.observe(node));
    }
  };

  observeTree(document.body);

  const mutations = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => observeTree(node));
    });
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    mutations.disconnect();
  };
}

/** Smooth, hash-aware scroll restoration on client-side navigation. */
export function useScrollToTop(pathname, hash) {
  useEffect(() => {
    if (hash) {
      const target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: REDUCED_MOTION() ? 'auto' : 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);
}

/** Keeps the document title and meta description in sync with the route. */
export function usePageMeta(title, description) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description.slice(0, 300));
    }
  }, [title, description]);
}

/** Adds the elevated header style after a few pixels of scrolling. */
export function useScrolledHeader(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > threshold);
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, [threshold]);
  return scrolled;
}

/** Pointer-driven hero parallax (desktop pointers, reduced-motion aware). */
export function useHeroParallax(ref) {
  useEffect(() => {
    const hero = ref.current;
    if (!hero || REDUCED_MOTION()) return undefined;
    if (typeof window.matchMedia !== 'function') return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

    let frame = 0;
    let nextX = 0;
    let nextY = 0;

    const apply = () => {
      frame = 0;
      hero.style.setProperty('--px', nextX.toFixed(3));
      hero.style.setProperty('--py', nextY.toFixed(3));
    };

    const onMove = (event) => {
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      nextX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      nextY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      nextX = 0;
      nextY = 0;
      hero.style.setProperty('--px', '0');
      hero.style.setProperty('--py', '0');
    };

    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
    };
  }, [ref]);
}

/**
 * Counts up to `value` once the node scrolls into view. Uses the Web
 * Animations-free rAF loop so it works under the strict CSP.
 */
export function Counter({ value, className = '', suffix = null, duration = 1100 }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(() =>
    new Intl.NumberFormat('ar-EG').format(REDUCED_MOTION() ? Number(value) || 0 : 0)
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const target = Number(value) || 0;
    const formatter = new Intl.NumberFormat('ar-EG');

    if (REDUCED_MOTION() || typeof requestAnimationFrame !== 'function') {
      setDisplay(formatter.format(target));
      return undefined;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(formatter.format(Math.round(target * eased)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          frame = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}
