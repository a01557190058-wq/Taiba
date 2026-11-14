import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { contentText, useSchoolContent } from '../../lib/content.jsx';
import { useAsync } from '../../lib/hooks.js';
import { Icon } from '../../lib/icons.jsx';
import { usePageMeta } from '../../lib/motion.jsx';
import {
  PageHero,
  SectionHead,
  SkeletonGrid,
  StateBox,
} from '../../components/public/ui.jsx';

const FALLBACK_INTRO =
  'تُقسَّم المواد الدراسية في مدرسة طيبة تكنولوجي إلى مواد نظرية تبني الأساس العلمي، ومواد عملية تُنمّي المهارات داخل المختبرات والورش.';

const FALLBACK_NOTE =
  'المواد المعروضة هنا تجريبية لأغراض العرض، وتُدار من لوحة التحكم. قد تختلف الخطة الدراسية الفعلية من فصل إلى آخر.';

const GRADES = [
  { value: 'first', label: 'الصف الأول الثانوي', short: 'الأول' },
  { value: 'second', label: 'الصف الثاني الثانوي', short: 'الثاني' },
  { value: 'third', label: 'الصف الثالث الثانوي', short: 'الثالث' },
];

const SECTIONS = [
  {
    type: 'theoretical',
    eyebrow: 'القسم النظري',
    title: 'المواد النظرية',
    lead: 'أساس علمي ولغوي يمنح الطالب فهمًا أعمق قبل الانتقال إلى التطبيق داخل المختبرات والورش.',
    icon: 'book',
  },
  {
    type: 'practical',
    eyebrow: 'القسم العملي',
    title: 'المواد العملية',
    lead: 'تدريبات معملية ومشروعات تطبيقية تحوّل المعرفة النظرية إلى مهارات قابلة للقياس والعرض.',
    icon: 'flask',
  },
];

function gradeLabel(value) {
  return GRADES.find((grade) => grade.value === value)?.label || '';
}

function SubjectCard({ subject, index = 0 }) {
  return (
    <article className="subject-card reveal" data-delay={String(index % 3)}>
      <span className="subject-card__icon" aria-hidden="true">
        <Icon name={subject.icon || 'book'} size={24} />
      </span>
      <div className="subject-card__body">
        <div className="subject-card__meta">
          <span className={`subject-card__type subject-card__type--${subject.type}`}>
            {subject.type_singular || (subject.type === 'practical' ? 'عملية' : 'نظرية')}
          </span>
          {subject.department_name ? (
            <span className="subject-card__department">{subject.department_name}</span>
          ) : (
            <span className="subject-card__department subject-card__department--general">
              عامة
            </span>
          )}
        </div>
        <h3 className="subject-card__title">{subject.name}</h3>
        {subject.description ? (
          <p className="subject-card__desc">{subject.description}</p>
        ) : null}
      </div>
    </article>
  );
}

function SubjectSection({ section, subjects, loading, error, onRetry }) {
  return (
    <section className={`section${section.type === 'practical' ? ' section--soft' : ''}`}>
      <div className="container">
        <SectionHead
          eyebrow={section.eyebrow}
          title={section.title}
          lead={section.lead}
          as="h2"
        />

        <div className="subject-grid" aria-live="polite">
          {loading ? <SkeletonGrid count={4} /> : null}
          {!loading && error ? (
            <StateBox
              title="تعذّر تحميل المواد الدراسية"
              message={
                error.message ||
                'حدث خطأ أثناء الاتصال بالخادم. تحقق من اتصالك ثم حاول مرة أخرى.'
              }
              actionLabel="إعادة المحاولة"
              onAction={onRetry}
              iconName="alert"
            />
          ) : null}
          {!loading && !error && !subjects.length ? (
            <StateBox
              title={`لا توجد ${section.title} لهذا الاختيار`}
              message="جرّب اختيار صف أو تخصص آخر، أو عد لاحقًا بعد تحديث المواد من إدارة المدرسة."
              actionLabel="عرض كل التخصصات"
              onAction={() => onRetry({ resetDepartment: true })}
              iconName={section.icon}
            />
          ) : null}
          {!loading && !error
            ? subjects.map((subject, index) => (
                <SubjectCard subject={subject} index={index} key={subject.id} />
              ))
            : null}
        </div>
      </div>
    </section>
  );
}

function SubjectsPicker({ grade, department, departments, disabled, onGrade, onDepartment }) {
  return (
    <section className="section section--tight subjects-picker-section">
      <div className="container">
        <div className="subjects-picker">
          <div className="subjects-picker__group" role="group" aria-label="اختيار الصف الدراسي">
            <span className="subjects-picker__label">
              <Icon name="graduation" size={16} />
              الصف الدراسي
            </span>
            <div className="picker-pills">
              {GRADES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`picker-pill${grade === item.value ? ' is-active' : ''}`}
                  aria-pressed={grade === item.value}
                  onClick={() => onGrade(item.value)}
                >
                  <span className="picker-pill__long">{item.label}</span>
                  <span className="picker-pill__short">{item.short}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="subjects-picker__group" role="group" aria-label="اختيار التخصص">
            <span className="subjects-picker__label">
              <Icon name="layers" size={16} />
              التخصص
            </span>
            <div className="picker-pills">
              <button
                type="button"
                className={`picker-pill${department === 'all' ? ' is-active' : ''}`}
                aria-pressed={department === 'all'}
                onClick={() => onDepartment('all')}
              >
                كل التخصصات
              </button>
              {departments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`picker-pill${String(department) === String(item.id) ? ' is-active' : ''}`}
                  aria-pressed={String(department) === String(item.id)}
                  disabled={disabled}
                  onClick={() => onDepartment(String(item.id))}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <p className="subjects-picker__hint">
            <Icon name="info" size={15} />
            المواد العامة تظهر مع كل تخصصات الصف المختار.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function SubjectsPage() {
  usePageMeta(
    'المواد الدراسية | مدرسة طيبة تكنولوجي',
    'المواد الدراسية في مدرسة طيبة تكنولوجي مقسمة إلى مواد نظرية تبني الأساس العلمي ومواد عملية تُنمّي المهارات داخل المختبرات والورش، مع اختيار الصف والتخصص.'
  );

  const { content } = useSchoolContent();
  const [grade, setGrade] = useState(GRADES[0].value);
  const [department, setDepartment] = useState('all');

  const { data, loading, error, reload } = useAsync(() => {
    const query = new URLSearchParams({ grade });
    if (department !== 'all') query.set('department', department);
    return api(`/api/subjects?${query.toString()}`);
  }, [grade, department]);

  const theoretical = data && Array.isArray(data.theoretical) ? data.theoretical : [];
  const practical = data && Array.isArray(data.practical) ? data.practical : [];
  const departments = data && Array.isArray(data.departments) ? data.departments : [];

  const intro = contentText(content, 'subjects_intro', FALLBACK_INTRO);
  const note = contentText(content, 'subjects_note', FALLBACK_NOTE);

  const subjectsFor = { theoretical, practical };

  const chooseGrade = (value) => {
    if (value === grade) return;
    setGrade(value);
    setDepartment('all');
  };

  const retry = ({ resetDepartment = false } = {}) => {
    if (resetDepartment) setDepartment('all');
    else reload();
  };

  return (
    <>
      <PageHero
        title="المواد الدراسية"
        lead={intro}
        eyebrow="الخطة الدراسية"
        breadcrumb={[{ label: 'الرئيسية', href: '/' }, { label: 'المواد الدراسية' }]}
      />

      <SubjectsPicker
        grade={grade}
        department={department}
        departments={departments}
        disabled={loading}
        onGrade={chooseGrade}
        onDepartment={setDepartment}
      />

      <div className="container">
        <p className="subjects-current reveal">
          <Icon name="book" size={16} />
          {`عرض مواد ${gradeLabel(grade)}${
            department === 'all'
              ? ' — كل التخصصات'
              : ` — ${departments.find((item) => String(item.id) === String(department))?.name || 'التخصص المختار'}`
          }`}
        </p>
      </div>

      {SECTIONS.map((section) => (
        <SubjectSection
          key={section.type}
          section={section}
          subjects={subjectsFor[section.type]}
          loading={loading}
          error={error}
          onRetry={retry}
        />
      ))}

      <section className="section section--tight">
        <div className="container">
          <div className="callout subjects-note reveal">
            <h2>ملاحظة عن الخطة الدراسية</h2>
            <p>{note}</p>
          </div>

          <div className="subjects-cta reveal">
            <div>
              <span className="eyebrow">الخطوة التالية</span>
              <h2 className="section-title mt-1">اطّلع على التخصصات وطريقة التقديم</h2>
              <p className="text-muted">
                المواد الدراسية تُدرَّس داخل التخصصات التقنية. يمكنك استعراض التخصصات المتاحة ثم
                قراءة خطوات القبول قبل إرسال طلبك.
              </p>
            </div>
            <div className="hero__actions">
              <Link className="btn btn-primary" to="/departments">
                التخصصات التقنية
              </Link>
              <Link className="btn btn-outline" to="/admission">
                معلومات القبول
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
