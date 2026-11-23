import { useEffect, useRef } from 'react';

const PALETTE = ['#1769AA', '#D62839', '#FFC928', '#FFFFFF'];

/**
 * A restrained particle constellation that gives the hero a living pulse.
 * It draws on <canvas> (no inline styles, no external scripts), pauses when the
 * tab is hidden and renders a single still frame for reduced-motion visitors.
 */
export default function HeroAtmosphere() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const stage = parent?.parentElement || parent;
    if (!canvas || !parent || !stage) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let width = 0;
    let height = 0;
    let frame = 0;
    let particles = [];
    let visible = !document.hidden;
    const pointer = { x: 0.5, y: 0.5, active: false };

    const build = () => {
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0);

      const count = Math.min(78, Math.max(30, Math.round((width * height) / 17000)));
      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.7 + Math.random() * 1.7,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        color: PALETTE[index % PALETTE.length],
        pulse: Math.random() * Math.PI * 2,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const next = [];

      for (const particle of particles) {
        if (!reduced && visible) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.pulse += 0.012;

          if (particle.x < -10) particle.x = width + 10;
          if (particle.x > width + 10) particle.x = -10;
          if (particle.y < -10) particle.y = height + 10;
          if (particle.y > height + 10) particle.y = -10;
        }

        if (pointer.active && !reduced) {
          const dx = pointer.x * width - particle.x;
          const dy = pointer.y * height - particle.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < 180) {
            const pull = (1 - distance / 180) * 0.012;
            particle.x += (dx / distance) * pull * 8;
            particle.y += (dy / distance) * pull * 8;
          }
        }

        const alpha = 0.28 + Math.sin(particle.pulse) * 0.12;
        context.globalAlpha = Math.max(0.1, alpha);
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
        next.push(particle);
      }
      particles = next;

      context.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 132) continue;
          context.globalAlpha = (1 - distance / 132) * 0.14;
          context.strokeStyle = a.color === '#FFFFFF' ? '#FFC928' : a.color;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
      context.globalAlpha = 1;
    };

    const loop = () => {
      draw();
      if (visible && !reduced) frame = window.requestAnimationFrame(loop);
    };

    const onPointerMove = (event) => {
      const rect = stage.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width;
      pointer.y = (event.clientY - rect.top) / rect.height;
      pointer.active = pointer.x >= 0 && pointer.x <= 1 && pointer.y >= 0 && pointer.y <= 1;
    };

    const onLeave = () => {
      pointer.active = false;
    };

    const onVisibility = () => {
      visible = !document.hidden;
      if (visible && !reduced) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(loop);
      } else {
        window.cancelAnimationFrame(frame);
      }
    };

    build();
    draw();
    if (!reduced) frame = window.requestAnimationFrame(loop);

    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(build) : null;
    if (resizeObserver) resizeObserver.observe(parent);
    else window.addEventListener('resize', build);

    stage.addEventListener('pointermove', onPointerMove, { passive: true });
    stage.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', build);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-atmosphere" aria-hidden="true" />;
}
