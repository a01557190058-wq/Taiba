import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import { PageHero } from '../../components/public/ui.jsx';
import Lightbox from '../../components/public/Lightbox.jsx';
import { galleryCredits, gallerySections } from '../../data/gallery.js';

/**
 * Static content is kept as a fallback for the (rare) case where the API is
 * unreachable, so the page never renders empty. The dashboard is the source of
 * truth: whenever `/api/gallery` responds, its content replaces this data.
 */
const FALLBACK = {
  settings: {
    eyebrow: 'معرض الصور',
    title: 'الحياة في مدرسة طيبة',
    lead: 'لقطات من الفصول والمعامل والورش توثّق رحلة الطلاب بين النظرية والتطبيق، وتُظهر جانبًا من يومهم الدراسي داخل المدرسة.',
    credits_note:
      'الصور الحالية توضيحية من أنشطة تعليمية عامة، ويمكن استبدالها بصور المدرسة الفعلية دون تغيير في تصميم الصفحة.',
    show_credits: true,
  },
  sections: gallerySections.map((section) => ({
    id: section.id,
    icon: section.icon,
    eyebrow: section.eyebrow,
    title: section.title,
    description: section.description,
    images: section.images.map((image) => ({
      id: image.id,
      src: image.src,
      full: image.full,
      alt: image.alt,
      caption: image.caption,
      credit: '',
      credit_url: '',
    })),
  })),
  credits: galleryCredits.map((credit) => ({
    id: credit.id,
    label: credit.label,
    text: `© ${credit.author} — ${credit.license}`,
    url: credit.source,
  })),
};

/** Turns the API payload into the shape the gallery components render. */
function fromApi(data) {
  const source = data && typeof data === 'object' ? data : {};
  const settings = source.settings || {};
  const sections = (Array.isArray(source.sections) ? source.sections : []).map((section) => ({
    id: section.slug,
    icon: section.icon || 'image',
    eyebrow: section.eyebrow || '',
    title: section.title || '',
    description: section.description || '',
    images: (Array.isArray(section.images) ? section.images : []).map((image) => ({
      id: image.id,
      src: image.thumb_url || image.url,
      full: image.url,
      alt: image.alt || image.caption || '',
      caption: image.caption || '',
      credit: image.credit || '',
      credit_url: image.credit_url || '',
    })),
  }));

  // Credits are derived from the visible photos, so the list always matches
  // what is actually shown on the page.
  const credits = [];
  sections.forEach((section) => {
    section.images.forEach((image) => {
      if (!image.credit) return;
      credits.push({
        id: `${section.id}-${image.id}`,
        label: image.caption || section.title,
        text: image.credit,
        url: image.credit_url,
      });
    });
  });

  return {
    settings: {
      eyebrow: settings.eyebrow || FALLBACK.settings.eyebrow,
      title: settings.title || FALLBACK.settings.title,
      lead: settings.lead || FALLBACK.settings.lead,
      credits_note: settings.credits_note || '',
      show_credits: settings.show_credits !== false,
    },
    sections,
    credits,
  };
}

/** Loads the gallery from the API, keeping the static fallback on failure. */
function useGallery() {
  const [gallery, setGallery] = useState(FALLBACK);

  useEffect(() => {
    let active = true;
    api('/api/gallery')
      .then((data) => {
        if (active && data) setGallery(fromApi(data));
      })
      .catch(() => {
        /* keep the static fallback */
      });
    return () => {
      active = false;
    };
  }, []);

  return gallery;
}


function GalleryTile({ image, index, onOpen }) {
  return (
    <button
      className="gallery-tile reveal"
      type="button"
      data-delay={String(index % 3)}
      onClick={() => onOpen(image)}
      aria-label={`عرض الصورة بحجم أكبر: ${image.caption}`}
    >
      <img
        src={image.src}
        alt={image.alt}
        width="800"
        height="600"
        loading="lazy"
        decoding="async"
      />
      <span className="gallery-tile__overlay" aria-hidden="true">
        <span className="gallery-tile__zoom">
          <Icon name="search" size={18} />
        </span>
        <span className="gallery-tile__caption">{image.caption}</span>
      </span>
    </button>
  );
}

export default function GalleryPage() {
  const gallery = useGallery();
  const { settings, sections, credits } = gallery;

  usePageMeta(
    `${settings.title} | مدرسة طيبة تكنولوجي`,
    settings.lead ||
      'معرض صور مدرسة طيبة تكنولوجي: صور النظري داخل الفصول، وصور العملي في المعامل والورش والمشروعات الطلابية.'
  );

  // All photos in reading order, so the lightbox can move between sections.
  const images = useMemo(
    () =>
      sections.flatMap((section) =>
        section.images.map((image) => ({ ...image, sectionTitle: section.title }))
      ),
    [sections]
  );

  const [activeIndex, setActiveIndex] = useState(null);

  const openImage = useCallback(
    (image) => {
      const index = images.findIndex((item) => item.id === image.id);
      if (index >= 0) setActiveIndex(index);
    },
    [images]
  );

  const closeLightbox = useCallback(() => setActiveIndex(null), []);

  const stepLightbox = useCallback(
    (delta) => {
      setActiveIndex((current) => {
        if (current === null || !images.length) return current;
        return (current + delta + images.length) % images.length;
      });
    },
    [images.length]
  );

  return (
    <>
      <PageHero
        eyebrow={settings.eyebrow}
        title={settings.title}
        lead={settings.lead}
        breadcrumb={[
          { label: 'الرئيسية', href: '/' },
          { label: 'معرض الصور' },
        ]}
      >
        {sections.length ? (
          <div className="gallery-jump">
            {sections.map((section) => (
              <a className="gallery-jump__link" href={`#${section.id}`} key={section.id}>
                <span className="gallery-jump__icon">
                  <Icon name={section.icon} size={20} />
                </span>
                <span className="gallery-jump__text">
                  <strong>{section.title}</strong>
                  <span>{formatNumber(section.images.length)} صور</span>
                </span>
                <Icon name="arrowLeft" size={17} />
              </a>
            ))}
          </div>
        ) : null}
      </PageHero>

      {sections.length === 0 ? (
        <section className="section">
          <div className="container">
            <div className="gallery-empty">
              <Icon name="image" size={28} />
              <p>لا توجد صور منشورة في المعرض حاليًا. عُد قريبًا لمشاهدة أحدث اللقطات.</p>
            </div>
          </div>
        </section>
      ) : null}

      {sections.map((section, sectionIndex) => (
        <section
          className={`section gallery-section${sectionIndex % 2 === 1 ? ' section--soft' : ''}`}
          id={section.id}
          key={section.id}
        >
          <div className="container">
            <div className="gallery-section__head reveal">
              <div>
                {section.eyebrow ? <span className="eyebrow">{section.eyebrow}</span> : null}
                <h2 className="section-title">{section.title}</h2>
                {section.description ? (
                  <p className="section-lead">{section.description}</p>
                ) : null}
              </div>
              <span className="gallery-section__count">
                <Icon name={section.icon} size={18} />
                {formatNumber(section.images.length)} صور
              </span>
            </div>

            <div className="gallery-grid">
              {section.images.map((image, index) => (
                <GalleryTile
                  image={image}
                  index={index}
                  key={image.id}
                  onOpen={openImage}
                />
              ))}
            </div>
          </div>
        </section>
      ))}

      {settings.show_credits && credits.length ? (
        <section className="section section--tight">
          <div className="container">
            <details className="gallery-credits">
              <summary>
                <Icon name="info" size={18} />
                مصادر الصور والتراخيص
              </summary>
              {settings.credits_note ? (
                <p className="gallery-credits__note">{settings.credits_note}</p>
              ) : null}
              <ul>
                {credits.map((credit) => (
                  <li key={credit.id}>
                    <span>{credit.label}</span>
                    <span>
                      {credit.text}
                      {credit.url ? (
                        <>
                          {' — '}
                          <a
                            href={credit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            المصدر
                          </a>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </section>
      ) : null}

      {activeIndex !== null && images[activeIndex] ? (
        <Lightbox
          images={images}
          index={activeIndex}
          onClose={closeLightbox}
          onStep={stepLightbox}
        />
      ) : null}
    </>
  );
}

