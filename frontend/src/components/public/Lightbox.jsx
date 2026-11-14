import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';

/**
 * Accessible full-screen image viewer shared by the public gallery and the
 * department pages.
 *
 * Each image is expected to provide `full` (the large source), `alt` and an
 * optional `caption`. `sectionTitle` is shown as a small label above the
 * caption, and `id` is used as a React key when the image changes.
 */
export default function Lightbox({ images, index, onClose, onStep, label = 'معرض الصور' }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const restoreRef = useRef(null);
  const touchRef = useRef(null);
  const current = images[index];

  // Lock the page, move focus into the dialog, and restore it on close.
  useEffect(() => {
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();
    document.body.classList.add('lightbox-open');
    return () => {
      document.body.classList.remove('lightbox-open');
      if (restoreRef.current && typeof restoreRef.current.focus === 'function') {
        restoreRef.current.focus();
      }
    };
  }, []);

  // Keyboard controls: Escape closes, arrows move, Tab stays inside.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onStep(1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onStep(-1);
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll('button')).filter(
        (element) => !element.disabled
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, onStep]);

  // Warm the neighbouring full-size images so navigation feels instant.
  useEffect(() => {
    const neighbours = [
      images[(index + 1) % images.length],
      images[(index - 1 + images.length) % images.length],
    ];
    neighbours.forEach((image) => {
      const preload = new Image();
      preload.src = image.full;
    });
  }, [images, index]);

  const onTouchStart = (event) => {
    touchRef.current = event.changedTouches[0].clientX;
  };

  const onTouchEnd = (event) => {
    if (touchRef.current === null) return;
    const delta = event.changedTouches[0].clientX - touchRef.current;
    touchRef.current = null;
    if (Math.abs(delta) < 45) return;
    onStep(delta < 0 ? 1 : -1);
  };

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${label}: صورة ${formatNumber(index + 1)} من ${formatNumber(
        images.length
      )}`}
      ref={dialogRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        className="lightbox__close"
        type="button"
        ref={closeRef}
        onClick={onClose}
        aria-label="إغلاق المعرض"
      >
        <Icon name="close" size={22} />
      </button>

      <button
        className="lightbox__nav lightbox__nav--prev"
        type="button"
        onClick={() => onStep(-1)}
        aria-label="الصورة السابقة"
      >
        <Icon name="arrowLeft" size={24} />
      </button>

      <figure
        className="lightbox__figure"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          className="lightbox__image"
          key={current.id}
          src={current.full}
          alt={current.alt}
          width="1600"
          height="1200"
          decoding="async"
        />
        <figcaption className="lightbox__caption">
          {current.sectionTitle ? (
            <span className="lightbox__section">{current.sectionTitle}</span>
          ) : null}
          <strong>{current.caption}</strong>
        </figcaption>
      </figure>

      <button
        className="lightbox__nav lightbox__nav--next"
        type="button"
        onClick={() => onStep(1)}
        aria-label="الصورة التالية"
      >
        <Icon name="arrowLeft" size={24} />
      </button>

      <p className="lightbox__counter" aria-live="polite">
        {formatNumber(index + 1)} / {formatNumber(images.length)}
      </p>
    </div>,
    document.body
  );
}
