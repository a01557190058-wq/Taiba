import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/hooks.js';
import { formatNumber } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { useFeedback } from '../../components/admin/feedback.jsx';
import {
  Alert,
  DemoBadge,
  EmptyState,
  PageHead,
  PageSkeleton,
} from '../../components/admin/ui.jsx';
import { CheckboxField, FormSection } from '../../components/admin/form.jsx';

const FAQ_EMPTY = { question: '', answer: '', sort_order: '0', is_published: true };

function ContentInput({ id, label, type = 'text', value, onChange, maxLength, rows = 4, hint, error, full }) {
  return (
    <div className={`field${full ? ' field--full' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          id={id}
          className="textarea"
          rows={rows}
          value={value}
          maxLength={maxLength || undefined}
          onChange={onChange}
          aria-invalid={error ? 'true' : undefined}
        />
      ) : (
        <input
          id={id}
          className="input"
          type={type}
          value={value}
          maxLength={maxLength || undefined}
          autoComplete="off"
          onChange={onChange}
          aria-invalid={error ? 'true' : undefined}
        />
      )}
      {hint ? <p className="hint">{hint}</p> : null}
      <p className="error-text">{error || ''}</p>
    </div>
  );
}

export default function ContentPage() {
  const { toast, confirm } = useFeedback();

  const { data, loading, error } = useAsync(() => api('/api/admin/school-content'), []);

  const [state, setState] = useState({ content: {}, faqs: [], definitions: [] });
  const [contentValues, setContentValues] = useState({});
  const [contentErrors, setContentErrors] = useState({});
  const [contentAlert, setContentAlert] = useState(null);
  const [contentBusy, setContentBusy] = useState(false);
  const [initialised, setInitialised] = useState(false);

  const [editingFaqId, setEditingFaqId] = useState(null);
  const [faqValues, setFaqValues] = useState({ ...FAQ_EMPTY });
  const [faqErrors, setFaqErrors] = useState({});
  const [faqAlert, setFaqAlert] = useState(null);
  const [faqBusy, setFaqBusy] = useState(false);
  const questionRef = useRef(null);

  useEffect(() => {
    if (!data) return;
    setState({
      content: data.content || {},
      faqs: Array.isArray(data.faqs) ? data.faqs : [],
      definitions: Array.isArray(data.definitions) ? data.definitions : [],
    });
    setContentValues({ ...(data.content || {}) });
    setInitialised(true);
  }, [data]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const definition of state.definitions) {
      if (!map.has(definition.group)) map.set(definition.group, []);
      map.get(definition.group).push(definition);
    }
    return Array.from(map.entries());
  }, [state.definitions]);

  const refresh = async () => {
    const next = await api('/api/admin/school-content');
    setState({
      content: next.content || {},
      faqs: Array.isArray(next.faqs) ? next.faqs : [],
      definitions: Array.isArray(next.definitions) ? next.definitions : [],
    });
    setContentValues({ ...(next.content || {}) });
  };

  const setContentValue = (key) => (event) => {
    setContentValues((current) => ({ ...current, [key]: event.target.value }));
    if (contentErrors[key]) setContentErrors((current) => ({ ...current, [key]: '' }));
  };

  const onSubmitContent = async (event) => {
    event.preventDefault();
    setContentAlert(null);

    const nextErrors = {};
    for (const definition of state.definitions) {
      const value = contentValues[definition.key] ?? '';
      if (value.length > definition.max) {
        nextErrors[definition.key] = `الحد الأقصى ${formatNumber(definition.max)} حرفًا.`;
      }
    }
    setContentErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setContentAlert({ type: 'error', message: 'بعض الحقول تتجاوز الحد الأقصى المسموح.' });
      return;
    }

    setContentBusy(true);
    try {
      const updated = await api('/api/admin/school-content', {
        method: 'PATCH',
        body: contentValues,
      });
      setState((current) => ({
        ...current,
        content: updated.content || current.content,
        faqs: Array.isArray(updated.faqs) ? updated.faqs : current.faqs,
      }));
      setContentValues({ ...(updated.content || contentValues) });
      toast('تم حفظ محتوى الموقع.');
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.fields) {
        setContentErrors((current) => ({ ...current, ...saveError.fields }));
      }
      setContentAlert({ type: 'error', message: saveError.message || 'تعذّر حفظ المحتوى.' });
    } finally {
      setContentBusy(false);
    }
  };

  // --- FAQ editor ----------------------------------------------------------
  const startEditFaq = (faq) => {
    setEditingFaqId(faq.id);
    setFaqValues({
      question: faq.question || '',
      answer: faq.answer || '',
      sort_order: String(faq.sort_order ?? 0),
      is_published: Boolean(faq.is_published),
    });
    setFaqErrors({});
    setFaqAlert(null);
    window.setTimeout(() => {
      if (questionRef.current) {
        questionRef.current.focus();
        questionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  };

  const startNewFaq = () => {
    setEditingFaqId(null);
    setFaqValues({ ...FAQ_EMPTY });
    setFaqErrors({});
    setFaqAlert(null);
    window.setTimeout(() => {
      if (questionRef.current) {
        questionRef.current.focus();
        questionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  };

  const cancelEditFaq = () => {
    setEditingFaqId(null);
    setFaqValues({ ...FAQ_EMPTY });
    setFaqErrors({});
    setFaqAlert(null);
    toast('تم إلغاء التحرير.', 'warning');
  };

  const onSubmitFaq = async (event) => {
    event.preventDefault();
    setFaqAlert(null);

    const question = faqValues.question.trim();
    const answer = faqValues.answer.trim();
    const sort = Number(faqValues.sort_order);
    const nextErrors = {};

    if (question.length < 5) nextErrors.question = 'السؤال مطلوب (5 أحرف على الأقل).';
    else if (question.length > 300) nextErrors.question = 'السؤال طويل جدًا (300 حرف كحد أقصى).';

    if (answer.length < 5) nextErrors.answer = 'الإجابة مطلوبة (5 أحرف على الأقل).';
    else if (answer.length > 2000) nextErrors.answer = 'الإجابة طويلة جدًا (2000 حرف كحد أقصى).';

    if (!Number.isInteger(sort) || sort < 0) {
      nextErrors.sort_order = 'ترتيب العرض يجب أن يكون عددًا صحيحًا غير سالب.';
    } else if (sort > 9999) {
      nextErrors.sort_order = 'ترتيب العرض كبير جدًا.';
    }

    setFaqErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFaqAlert({ type: 'error', message: 'يرجى تصحيح الحقول المميزة بالأحمر.' });
      return;
    }

    const payload = {
      question,
      answer,
      sort_order: sort,
      is_published: faqValues.is_published,
    };

    setFaqBusy(true);
    try {
      if (editingFaqId) {
        await api(`/api/admin/school-content/faqs/${editingFaqId}`, {
          method: 'PATCH',
          body: payload,
        });
        toast('تم تحديث السؤال.');
      } else {
        await api('/api/admin/school-content/faqs', { method: 'POST', body: payload });
        toast('تمت إضافة السؤال.');
      }
      setEditingFaqId(null);
      setFaqValues({ ...FAQ_EMPTY });
      await refresh();
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.fields) {
        setFaqErrors((current) => ({ ...current, ...saveError.fields }));
      }
      setFaqAlert({ type: 'error', message: saveError.message || 'تعذّر حفظ السؤال.' });
    } finally {
      setFaqBusy(false);
    }
  };

  const toggleFaq = async (faq) => {
    try {
      await api(`/api/admin/school-content/faqs/${faq.id}`, {
        method: 'PATCH',
        body: { is_published: !faq.is_published },
      });
      toast(faq.is_published ? 'تم إلغاء نشر السؤال.' : 'تم نشر السؤال.');
      await refresh();
    } catch (toggleError) {
      toast(toggleError.message || 'تعذّر تحديث حالة السؤال.', 'error');
    }
  };

  const deleteFaq = async (faq) => {
    const confirmed = await confirm({
      title: 'حذف السؤال',
      message: `سيتم حذف السؤال «${faq.question}» نهائيًا. هل تريد المتابعة؟`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api(`/api/admin/school-content/faqs/${faq.id}`, { method: 'DELETE' });
      if (editingFaqId === faq.id) {
        setEditingFaqId(null);
        setFaqValues({ ...FAQ_EMPTY });
      }
      toast('تم حذف السؤال.');
      await refresh();
    } catch (deleteError) {
      toast(deleteError.message || 'تعذّر حذف السؤال.', 'error');
    }
  };

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <>
        <PageHead title="المحتوى والأسئلة" />
        <div className="panel">
          <div className="panel__body">
            <Alert type="error" message={error.message || 'تعذّر تحميل المحتوى.'} />
          </div>
        </div>
      </>
    );
  }

  if (!initialised) return <PageSkeleton />;

  const editingFaq = editingFaqId
    ? state.faqs.find((faq) => faq.id === editingFaqId) || null
    : null;
  const publishedCount = state.faqs.filter((faq) => faq.is_published).length;

  return (
    <>
      <PageHead
        title="المحتوى والأسئلة"
        description="حرّر نصوص الصفحات العامة وأدر الأسئلة الشائعة. تُحفظ جميع النصوص كنص عادي آمن."
        actions={[
          <a
            className="btn btn-outline"
            href="/"
            target="_blank"
            rel="noopener"
            key="site"
          >
            <Icon name="external" size={16} />
            <span>عرض الموقع</span>
          </a>,
        ]}
      />

      <form className="mt-2" onSubmit={onSubmitContent} noValidate>
        <Alert type={contentAlert?.type} message={contentAlert?.message} />

        <div className="notice mt-2">
          <Icon name="info" size={18} />
          <span>
            يُحفظ المحتوى ويُعرض كنص عادي فقط. لا يمكن استخدام وسوم HTML، ويظهر النص كما هو في
            صفحات الموقع.
          </span>
        </div>

        {groups.map(([groupName, definitions]) => (
          <div className="mt-2" key={groupName}>
            <FormSection
              title={groupName}
              description={`${formatNumber(definitions.length)} حقول قابلة للتحرير.`}
            >
              <div className="form-grid">
                {definitions.map((definition) => (
                  <ContentInput
                    key={definition.key}
                    id={`content-${definition.key}`}
                    label={definition.label}
                    type={definition.type === 'textarea' ? 'textarea' : 'text'}
                    value={contentValues[definition.key] ?? ''}
                    onChange={setContentValue(definition.key)}
                    maxLength={definition.max}
                    rows={5}
                    full={definition.type === 'textarea'}
                    hint={
                      definition.key === 'objectives' ||
                      definition.key === 'admission_instructions'
                        ? 'اكتب كل عنصر في سطر منفصل. يُعرض كل سطر كعنصر مستقل في الموقع.'
                        : ''
                    }
                    error={contentErrors[definition.key]}
                  />
                ))}
              </div>
            </FormSection>
          </div>
        ))}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={contentBusy}>
            <Icon name="save" size={16} />
            <span>{contentBusy ? 'جارٍ الحفظ…' : 'حفظ المحتوى'}</span>
          </button>
          <a className="btn btn-outline" href="/" target="_blank" rel="noopener">
            <Icon name="external" size={16} />
            <span>معاينة الموقع</span>
          </a>
        </div>
      </form>

      <section className="panel mt-2">
        <div className="panel__head">
          <div>
            <h3>{editingFaq ? 'تحرير سؤال شائع' : 'إضافة سؤال شائع'}</h3>
            <p>
              {editingFaq
                ? `تعديل السؤال رقم ${formatNumber(editingFaq.id)}`
                : 'أضف سؤالًا جديدًا يظهر في قسم الأسئلة الشائعة بالصفحة الرئيسية.'}
            </p>
          </div>
        </div>
        <div className="panel__body">
          <form onSubmit={onSubmitFaq} noValidate>
            <Alert type={faqAlert?.type} message={faqAlert?.message} />

            <div className="form-grid mt-2">
              <ContentInput
                id="faq-question"
                label="السؤال"
                value={faqValues.question}
                onChange={(event) => {
                  setFaqValues((current) => ({ ...current, question: event.target.value }));
                  if (faqErrors.question) setFaqErrors((current) => ({ ...current, question: '' }));
                }}
                maxLength={300}
                hint="5–300 حرف."
                error={faqErrors.question}
              />
              <ContentInput
                id="faq-sort"
                label="ترتيب العرض"
                type="number"
                value={faqValues.sort_order}
                onChange={(event) => {
                  setFaqValues((current) => ({ ...current, sort_order: event.target.value }));
                  if (faqErrors.sort_order) {
                    setFaqErrors((current) => ({ ...current, sort_order: '' }));
                  }
                }}
                hint="الأرقام الأصغر تظهر أولًا."
                error={faqErrors.sort_order}
              />
              <div className="field field--full">
                <label htmlFor="faq-answer">الإجابة</label>
                <textarea
                  id="faq-answer"
                  className="textarea"
                  rows={4}
                  maxLength={2000}
                  value={faqValues.answer}
                  aria-invalid={faqErrors.answer ? 'true' : undefined}
                  onChange={(event) => {
                    setFaqValues((current) => ({ ...current, answer: event.target.value }));
                    if (faqErrors.answer) setFaqErrors((current) => ({ ...current, answer: '' }));
                  }}
                />
                <p className="hint">5–2000 حرف. تُعرض كنص عادي.</p>
                <p className="error-text">{faqErrors.answer || ''}</p>
              </div>
              <div className="field field--full">
                <CheckboxField
                  id="faq-published"
                  label="نشر السؤال في الموقع"
                  hint="الأسئلة غير المنشورة تبقى محفوظة لكنها لا تظهر للزوار."
                  checked={faqValues.is_published}
                  onChange={(event) =>
                    setFaqValues((current) => ({ ...current, is_published: event.target.checked }))
                  }
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={faqBusy}>
                <Icon name="save" size={16} />
                <span>
                  {faqBusy ? 'جارٍ الحفظ…' : editingFaq ? 'حفظ التعديلات' : 'إضافة السؤال'}
                </span>
              </button>
              {editingFaq ? (
                <button className="btn btn-outline" type="button" onClick={cancelEditFaq}>
                  إلغاء التحرير
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      <section className="panel mt-2">
        <div className="panel__head">
          <div>
            <h3>الأسئلة الشائعة</h3>
            <p>
              {`${formatNumber(state.faqs.length)} سؤالًا — ${formatNumber(
                publishedCount
              )} منشور في الموقع.`}
            </p>
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={startNewFaq}>
            <Icon name="plus" size={15} />
            <span>سؤال جديد</span>
          </button>
        </div>

        {state.faqs.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>السؤال والإجابة</th>
                  <th>الترتيب</th>
                  <th>النشر</th>
                  <th>البيانات</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {state.faqs.map((faq) => (
                  <tr key={faq.id}>
                    <td>
                      <div className="cell-strong">{faq.question}</div>
                      <div className="cell-muted">
                        {faq.answer.length > 110 ? `${faq.answer.slice(0, 110)}…` : faq.answer}
                      </div>
                    </td>
                    <td className="cell-muted">{formatNumber(faq.sort_order)}</td>
                    <td>
                      {faq.is_published ? (
                        <span className="badge badge--published">منشور</span>
                      ) : (
                        <span className="badge badge--draft">مسودة</span>
                      )}
                    </td>
                    <td>
                      <DemoBadge isDemo={faq.is_demo} />
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          title="تحرير"
                          onClick={() => startEditFaq(faq)}
                        >
                          <Icon name="edit" size={15} />
                          <span>تحرير</span>
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => toggleFaq(faq)}
                        >
                          <Icon name="check" size={15} />
                          <span>{faq.is_published ? 'إلغاء النشر' : 'نشر'}</span>
                        </button>
                        <button
                          className="btn btn-danger-outline btn-sm"
                          type="button"
                          title="حذف"
                          onClick={() => deleteFaq(faq)}
                        >
                          <Icon name="trash" size={15} />
                          <span>حذف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="لا توجد أسئلة شائعة"
            message="أضف أول سؤال ليظهر في قسم الأسئلة الشائعة بالصفحة الرئيسية."
            actionLabel="سؤال جديد"
            onAction={startNewFaq}
            iconName="file"
          />
        )}
      </section>
    </>
  );
}
