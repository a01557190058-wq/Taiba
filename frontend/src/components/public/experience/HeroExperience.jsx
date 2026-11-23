import { Component, lazy, Suspense, useEffect, useState } from 'react';
import HeroAtmosphere from './HeroAtmosphere.jsx';

const HeroScene3D = lazy(() => import('./HeroScene3D.jsx'));

/** If WebGL init or the lazy chunk fails, the original 2D field takes over. */
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    /* The fallback is already rendered; no logging needed in production. */
  }

  render() {
    if (this.state.failed) return <HeroAtmosphere />;
    return this.props.children;
  }
}

function supports3D() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.innerWidth < 980) return false;
  if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return false;
  try {
    const probe = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (probe.getContext('webgl2') || probe.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

/**
 * Progressive hero background: real WebGL where it is safe, original canvas
 * everywhere else. The 3D code is a separate chunk, so phones never download
 * Three.js at all.
 */
export default function HeroExperience() {
  const [enabled, setEnabled] = useState(() => supports3D());

  useEffect(() => {
    const onResize = () => setEnabled(supports3D());
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!enabled) return <HeroAtmosphere />;

  return (
    <div className="hero-experience">
      <SceneBoundary>
        <Suspense fallback={<HeroAtmosphere />}>
          <HeroScene3D />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
