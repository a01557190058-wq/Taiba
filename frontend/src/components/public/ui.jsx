import { Link } from 'react-router-dom';
import { Icon } from '../../lib/icons.jsx';
import { formatDate, formatNumber } from '../../lib/format.js';
import { contentText, useSchoolContent } from '../../lib/content.jsx';

const DEFAULT_IMAGE = '/assets/img/departments/default.svg';

export const ACCREDITATION_FALLBACK =
  'مجمع طيبة تكنولوجي معتمد من وزارة الصناعة ومصلحة الكفاية الإنتاجية والتدريب المهني، ويطبّق برامجه التدريبية وفق معاييرهما المعتمدة.';

export function SmartImage({ src, alt, width, height, loading = 'lazy', className = '' }) {
  return (
    <img
      src={src || DEFAULT_IMAGE}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      className={className}
      onError={(event) => {
        const image = event.currentTarget;
        if (!image.src.endsWith('/default.svg')) image.src = DEFAULT_IMAGE;
      }}
    />
  );
}

/** Official-accreditation band shared by the home and about pages. */
export function AccreditationStrip({ compact = false }) {
  const { content } = useSchoolContent();
  const text = contentText(content, 'accreditation', ACCREDITATION_FALLBACK);

  return (
    <section
      className={`accreditation-strip${compact ? ' accreditation-strip--compact' : ''}`}
      aria-label="الاعتماد الرسمي"
      data-cinematic-reveal
    >
      <div className="container accreditation-strip__inner reveal">
        <div className="accreditation-strip__logos">
          <img
            src="/assets/img/accreditation/ministry-industry.svg"
            alt="شعار بديل لوزارة الصناعة"
            width="150"
            height="45"
          />
          <img
            src="/assets/img/accreditation/productivity-authority.svg"
            alt="شعار بديل لمصلحة الكفاية الإنتاجية والتدريب المهني"
            width="150"
            height="45"
          />
        </div>
        <div className="accreditation-strip__copy">
          <span className="eyebrow">اعتماد رسمي</span>
          <h2>تعليم معتمد وجودة موثوقة</h2>
          <p>{text}</p>
          <span className="accreditation-strip__note">
            الشعارات المعروضة بديلة مؤقتة إلى حين رفع الملفات الرسمية من المجمع.
          </span>
        </div>
        <span className="accreditation-strip__seal" aria-hidden="true">
          <Icon name="shield" size={30} />
        </span>
      </div>
    </section>
  );
}

export function DepartmentCard({ department, index = 0 }) {
  const href = `/departments/${encodeURIComponent(department.slug)}`;
  const skills = Array.isArray(department.skills) ? department.skills.slice(0, 3) : [];

  return (
    <article className="department-card reveal" data-delay={String(index % 3)}>
      {/* The whole card is one link: clicking anywhere opens the department. */}
      <Link className="department-card__link" to={href} aria-label={`فتح صفحة ${department.name}`}>
        <div className="department-card__media">
          <SmartImage
            src={department.image_url}
            alt={`رسم توضيحي لتخصص ${department.name}`}
            width="640"
            height="420"
          />
          <span className="department-card__badge">مسار تقني</span>
        </div>
        <div className="department-card__body">
          <span className="department-card__eyebrow">المهنة/التخصص</span>
          <h3 className="department-card__title">{department.name}</h3>
          <p className="department-card__desc">{department.short_description}</p>
          <span className="department-card__students">
            <Icon name="users" size={15} />
            <span>
              {`عدد الطلاب: ${formatNumber(
                department.students_total ??
                  Number(department.students_male || 0) + Number(department.students_female || 0)
              )}`}
            </span>
          </span>
          {skills.length ? (
            <div className="chips">
              {skills.map((skill) => (
                <span className="chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
          <div className="department-card__footer">
            <span className="card-link">عرض التفاصيل</span>
            <span className="department-card__arrow" aria-hidden="true">
              <Icon name="arrowLeft" size={16} />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function NewsCard({ article, index = 0 }) {
  const href = `/news/${encodeURIComponent(article.slug)}`;

  return (
    <article className="news-card reveal" data-delay={String(index % 3)}>
      <Link className="news-card__media" to={href} tabIndex={-1} aria-hidden="true">
        <SmartImage
          src={article.image_url}
          alt={`رسم توضيحي لخبر ${article.title}`}
          width="640"
          height="400"
        />
        {article.is_featured ? <span className="news-card__badge">خبر مميز</span> : null}
      </Link>
      <div className="news-card__body">
        <div className="news-card__meta">
          {article.category ? <span className="news-card__category">{article.category}</span> : null}
          <time className="news-card__date" dateTime={article.published_at || ''}>
            {formatDate(article.published_at)}
          </time>
        </div>
        <h3 className="news-card__title">
          <Link to={href}>{article.title}</Link>
        </h3>
        <p className="news-card__summary">{article.summary}</p>
        <Link className="card-link" to={href}>
          اقرأ الخبر
        </Link>
      </div>
    </article>
  );
}

export function StateBox({ title, message, actionLabel, onAction, iconName = 'inbox' }) {
  return (
    <div className="state-box">
      <div className="state-box__icon">
        <Icon name={iconName} size={28} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="btn btn-outline btn-sm" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" aria-hidden="true" key={index} />
      ))}
    </>
  );
}

export function Alert({ type = 'error', message, iconName }) {
  if (!message) return null;
  const names = { error: 'alert', success: 'check', warning: 'alert', info: 'info' };
  return (
    <div className={`alert alert--${type}`} role="alert">
      <Icon name={iconName || names[type] || 'info'} size={18} />
      <div>{message}</div>
    </div>
  );
}

export function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb" aria-label="مسار التصفح">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? (
            <Link to={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHero({ title, lead, breadcrumb, eyebrow, className = '', children }) {
  return (
    <section className={`page-hero ${className}`.trim()}>
      <div className="container">
        {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
        <div className="page-hero__inner">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {lead ? <p>{lead}</p> : null}
          {children}
        </div>
      </div>
    </section>
  );
}

export function SectionHead({ eyebrow, title, lead, center = false, flush = false, as: Tag = 'h2' }) {
  return (
    <div
      className={`section-head${center ? ' section-head--center' : ''}${
        flush ? ' section-head--flush' : ''
      } reveal`}
    >
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <Tag className="section-title">{title}</Tag>
      {lead ? <p className="section-lead">{lead}</p> : null}
    </div>
  );
}

export function DemoBanner({ children, id }) {
  return (
    <div className="demo-banner" id={id}>
      <Icon name="alert" size={20} />
      <span>{children}</span>
    </div>
  );
}
