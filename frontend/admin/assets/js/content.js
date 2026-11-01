/**
 * School content + FAQ management.
 * Content keys are driven by the server-side definitions whitelist, and all
 * values are stored/rendered as plain text (never HTML).
 */
import {
  boot,
  api,
  qs,
  el,
  icon,
  pageHead,
  toast,
  setAlert,
  setButtonBusy,
  confirmDialog,
  emptyState,
  formatNumber,
} from './admin.js';

const contentRoot = qs('#admin-content');
const admin = await boot({
  active: 'content',
  title: 'المحتوى والأسئلة',
  subtitle: 'تحرير نصوص الموقع والأسئلة الشائعة',
});

let state = { content: {}, faqs: [], definitions: [] };
let editingFaqId = null;
let faqEditorNode = null;
let faqListNode = null;
let contentFields = new Map();

if (admin) {
  load();
}

// ---------------------------------------------------------------------------
// Shared field builder
// ---------------------------------------------------------------------------
function createInputField({ id, label, type = 'text', value = '', maxlength = 0, rows = 4, hint = '', full = false }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  let input;

  if (type === 'textarea') {
    input = el('textarea', {
      className: 'textarea',
      attrs: {
        id,
        rows,
        ...(maxlength ? { maxlength } : {}),
        ...(hint ? { 'aria-describedby': hintId } : {}),
      },
    });
    input.value = value ?? '';
  } else {
    input = el('input', {
      className: 'input',
      attrs: {
        id,
        type,
        autocomplete: 'off',
        ...(maxlength ? { maxlength } : {}),
        ...(hint ? { 'aria-describedby': hintId } : {}),
      },
    });
    input.value = value ?? '';
  }

  const errorNode = el('p', { className: 'error-text', attrs: { id: errorId } });

  const node = el('div', { className: `field${full ? ' field--full' : ''}` }, [
    el('label', { attrs: { for: id }, text: label }),
    input,
    hint ? el('p', { className: 'hint', attrs: { id: hintId }, text: hint }) : null,
    errorNode,
  ]);

  return {
    input,
    node,
    setError(message) {
      errorNode.textContent = message || '';
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    },
  };
}

// ---------------------------------------------------------------------------
// Content form
// ---------------------------------------------------------------------------
function buildContentForm() {
  contentFields = new Map();
  const groups = new Map();
  for (const definition of state.definitions) {
    if (!groups.has(definition.group)) groups.set(definition.group, []);
    groups.get(definition.group).push(definition);
  }

  const alertBox = el('div', { className: 'alert alert--error', attrs: { id: 'content-alert', hidden: true } });

  const panels = [];
  for (const [groupName, definitions] of groups.entries()) {
    const fields = definitions.map((definition) => {
      const isLong = definition.type === 'textarea';
      const field = createInputField({
        id: `content-${definition.key}`,
        label: definition.label,
        type: definition.type === 'textarea' ? 'textarea' : 'text',
        value: state.content[definition.key] ?? '',
        maxlength: definition.max,
        rows: isLong ? 5 : 4,
        full: isLong,
        hint:
          definition.key === 'objectives' || definition.key === 'admission_instructions'
            ? 'اكتب كل عنصر في سطر منفصل. يُعرض كل سطر كعنصر مستقل في الموقع.'
            : '',
      });
      contentFields.set(definition.key, { ...field, definition });
      return field.node;
    });

    panels.push(
      el('section', { className: 'panel mt-2' }, [
        el('div', { className: 'panel__head' }, [
          el('div', {}, [
            el('h3', { text: groupName }),
            el('p', { text: `${formatNumber(definitions.length)} حقول قابلة للتحرير.` }),
          ]),
        ]),
        el('div', { className: 'panel__body' }, [el('div', { className: 'form-grid' }, fields)]),
      ])
    );
  }

  const saveButton = el('button', {
    className: 'btn btn-primary',
    attrs: { type: 'submit', id: 'save-content' },
  }, [icon('save', 16), el('span', { text: 'حفظ المحتوى' })]);

  const form = el('form', { attrs: { id: 'content-form', novalidate: true } }, [
    alertBox,
    el('div', { className: 'notice mt-2' }, [
      icon('info', 18),
      el('span', {
        text: 'يُحفظ المحتوى ويُعرض كنص عادي فقط. لا يمكن استخدام وسوم HTML، ويظهر النص كما هو في صفحات الموقع.',
      }),
    ]),
    ...panels,
    el('div', { className: 'form-actions' }, [
      saveButton,
      el('a', {
        className: 'btn btn-outline',
        attrs: { href: '/', target: '_blank', rel: 'noopener' },
      }, [icon('external', 16), el('span', { text: 'معاينة الموقع' })]),
    ]),
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setAlert(alertBox, {});

    let ok = true;
    const payload = {};
    for (const [key, field] of contentFields.entries()) {
      const value = field.input.value;
      payload[key] = value;
      if (value.length > field.definition.max) {
        field.setError(`الحد الأقصى ${formatNumber(field.definition.max)} حرفًا.`);
        ok = false;
      } else {
        field.setError('');
      }
    }

    if (!ok) {
      setAlert(alertBox, { type: 'error', message: 'بعض الحقول تتجاوز الحد الأقصى المسموح.' });
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    setButtonBusy(saveButton, true, 'جارٍ الحفظ…');
    try {
      const updated = await api('/api/admin/school-content', { method: 'PATCH', body: payload });
      state = { ...state, ...updated };
      toast('تم حفظ محتوى الموقع.');
    } catch (error) {
      if (error.fields) {
        for (const [key, message] of Object.entries(error.fields)) {
          const field = contentFields.get(key);
          if (field) field.setError(message);
        }
      }
      setAlert(alertBox, {
        type: 'error',
        message: error.message || 'تعذّر حفظ المحتوى.',
      });
    } finally {
      setButtonBusy(saveButton, false);
    }
  });

  return form;
}

// ---------------------------------------------------------------------------
// FAQ editor
// ---------------------------------------------------------------------------
function buildFaqEditorPanel() {
  const editingFaq = editingFaqId ? state.faqs.find((faq) => faq.id === editingFaqId) : null;

  const alertBox = el('div', { className: 'alert alert--error', attrs: { id: 'faq-alert', hidden: true } });

  const questionField = createInputField({
    id: 'faq-question',
    label: 'السؤال',
    value: editingFaq?.question || '',
    maxlength: 300,
    hint: '5–300 حرف.',
  });

  const answerField = createInputField({
    id: 'faq-answer',
    label: 'الإجابة',
    type: 'textarea',
    value: editingFaq?.answer || '',
    maxlength: 2000,
    rows: 4,
    full: true,
    hint: '5–2000 حرف. تُعرض كنص عادي.',
  });

  const sortField = createInputField({
    id: 'faq-sort',
    label: 'ترتيب العرض',
    type: 'number',
    value: editingFaq?.sort_order ?? 0,
    hint: 'الأرقام الأصغر تظهر أولًا.',
  });

  const publishedInput = el('input', { attrs: { type: 'checkbox', id: 'faq-published' } });
  publishedInput.checked = editingFaq ? editingFaq.is_published : true;

  const publishedLabel = el('label', { className: 'checkbox', attrs: { for: 'faq-published' } }, [
    publishedInput,
    el('span', {}, [
      el('strong', { text: 'نشر السؤال في الموقع' }),
      el('span', { className: 'hint', text: 'الأسئلة غير المنشورة تبقى محفوظة لكنها لا تظهر للزوار.' }),
    ]),
  ]);

  const saveButton = el('button', {
    className: 'btn btn-primary',
    attrs: { type: 'submit' },
  }, [icon('save', 16), el('span', { text: editingFaq ? 'حفظ التعديلات' : 'إضافة السؤال' })]);

  const cancelButton = editingFaq
    ? el('button', { className: 'btn btn-outline', attrs: { type: 'button' }, text: 'إلغاء التحرير' })
    : null;

  const form = el('form', { attrs: { novalidate: true } }, [
    alertBox,
    el('div', { className: 'form-grid mt-2' }, [
      questionField.node,
      sortField.node,
      answerField.node,
      el('div', { className: 'field field--full' }, [publishedLabel]),
    ]),
    el('div', { className: 'form-actions' }, [saveButton, cancelButton]),
  ]);

  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      editingFaqId = null;
      replaceFaqNodes();
      toast('تم إلغاء التحرير.', 'warning');
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setAlert(alertBox, {});

    const question = questionField.input.value.trim();
    const answer = answerField.input.value.trim();
    const sortValue = sortField.input.value.trim();

    let ok = true;
    questionField.setError('');
    answerField.setError('');
    sortField.setError('');

    if (question.length < 5) {
      questionField.setError('السؤال مطلوب (5 أحرف على الأقل).');
      ok = false;
    } else if (question.length > 300) {
      questionField.setError('السؤال طويل جدًا (300 حرف كحد أقصى).');
      ok = false;
    }

    if (answer.length < 5) {
      answerField.setError('الإجابة مطلوبة (5 أحرف على الأقل).');
      ok = false;
    } else if (answer.length > 2000) {
      answerField.setError('الإجابة طويلة جدًا (2000 حرف كحد أقصى).');
      ok = false;
    }

    const sort = Number(sortValue);
    if (!Number.isInteger(sort) || sort < 0) {
      sortField.setError('ترتيب العرض يجب أن يكون عددًا صحيحًا غير سالب.');
      ok = false;
    } else if (sort > 9999) {
      sortField.setError('ترتيب العرض كبير جدًا.');
      ok = false;
    }

    if (!ok) {
      setAlert(alertBox, { type: 'error', message: 'يرجى تصحيح الحقول المميزة بالأحمر.' });
      return;
    }

    const payload = {
      question,
      answer,
      sort_order: sort,
      is_published: publishedInput.checked,
    };

    setButtonBusy(saveButton, true, 'جارٍ الحفظ…');
    try {
      if (editingFaq) {
        await api(`/api/admin/school-content/faqs/${editingFaq.id}`, { method: 'PATCH', body: payload });
        toast('تم تحديث السؤال.');
      } else {
        await api('/api/admin/school-content/faqs', { method: 'POST', body: payload });
        toast('تمت إضافة السؤال.');
      }
      editingFaqId = null;
      await refreshFaqs();
    } catch (error) {
      if (error.fields) {
        if (error.fields.question) questionField.setError(error.fields.question);
        if (error.fields.answer) answerField.setError(error.fields.answer);
        if (error.fields.sort_order) sortField.setError(error.fields.sort_order);
      }
      setAlert(alertBox, {
        type: 'error',
        message: error.message || 'تعذّر حفظ السؤال.',
      });
      setButtonBusy(saveButton, false);
    }
  });

  return el('section', { className: 'panel mt-2' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: editingFaq ? 'تحرير سؤال شائع' : 'إضافة سؤال شائع' }),
        el('p', {
          text: editingFaq
            ? `تعديل السؤال رقم ${formatNumber(editingFaq.id)}`
            : 'أضف سؤالًا جديدًا يظهر في قسم الأسئلة الشائعة بالصفحة الرئيسية.',
        }),
      ]),
    ]),
    el('div', { className: 'panel__body' }, [form]),
  ]);
}

// ---------------------------------------------------------------------------
// FAQ list
// ---------------------------------------------------------------------------
function faqActions(faq) {
  const actions = el('div', { className: 'row-actions' });

  const editButton = el('button', {
    className: 'btn btn-outline btn-sm',
    attrs: { type: 'button', title: 'تحرير' },
  }, [icon('edit', 15), el('span', { text: 'تحرير' })]);
  editButton.addEventListener('click', () => {
    editingFaqId = faq.id;
    replaceFaqNodes();
    const questionInput = qs('#faq-question');
    if (questionInput) {
      questionInput.focus();
      questionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  const toggleButton = el('button', {
    className: 'btn btn-outline btn-sm',
    attrs: { type: 'button' },
  }, [icon('check', 15), el('span', { text: faq.is_published ? 'إلغاء النشر' : 'نشر' })]);
  toggleButton.addEventListener('click', async () => {
    toggleButton.disabled = true;
    try {
      await api(`/api/admin/school-content/faqs/${faq.id}`, {
        method: 'PATCH',
        body: { is_published: !faq.is_published },
      });
      toast(faq.is_published ? 'تم إلغاء نشر السؤال.' : 'تم نشر السؤال.');
      await refreshFaqs();
    } catch (error) {
      toast(error.message || 'تعذّر تحديث حالة السؤال.', 'error');
      toggleButton.disabled = false;
    }
  });

  const deleteButton = el('button', {
    className: 'btn btn-danger-outline btn-sm',
    attrs: { type: 'button', title: 'حذف' },
  }, [icon('trash', 15), el('span', { text: 'حذف' })]);
  deleteButton.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'حذف السؤال',
      message: `سيتم حذف السؤال «${faq.question}» نهائيًا. هل تريد المتابعة؟`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!confirmed) return;

    deleteButton.disabled = true;
    try {
      await api(`/api/admin/school-content/faqs/${faq.id}`, { method: 'DELETE' });
      if (editingFaqId === faq.id) editingFaqId = null;
      toast('تم حذف السؤال.');
      await refreshFaqs();
    } catch (error) {
      toast(error.message || 'تعذّر حذف السؤال.', 'error');
      deleteButton.disabled = false;
    }
  });

  actions.append(editButton, toggleButton, deleteButton);
  return actions;
}

function buildFaqListPanel() {
  const faqs = state.faqs;
  const publishedCount = faqs.filter((faq) => faq.is_published).length;

  const head = el('div', { className: 'panel__head' }, [
    el('div', {}, [
      el('h3', { text: 'الأسئلة الشائعة' }),
      el('p', {
        text: `${formatNumber(faqs.length)} سؤالًا — ${formatNumber(publishedCount)} منشور في الموقع.`,
      }),
    ]),
    el('button', { className: 'btn btn-outline btn-sm', attrs: { type: 'button' } }, [
      icon('plus', 15),
      el('span', { text: 'سؤال جديد' }),
    ]),
  ]);

  qs('button', head).addEventListener('click', () => {
    editingFaqId = null;
    replaceFaqNodes();
    const questionInput = qs('#faq-question');
    if (questionInput) {
      questionInput.focus();
      questionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  let body;
  if (!faqs.length) {
    body = emptyState({
      title: 'لا توجد أسئلة شائعة',
      message: 'أضف أول سؤال ليظهر في قسم الأسئلة الشائعة بالصفحة الرئيسية.',
      iconName: 'file',
    });
  } else {
    body = el('div', { className: 'table-wrap' }, [
      el('table', { className: 'data-table' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: 'السؤال والإجابة' }),
            el('th', { text: 'الترتيب' }),
            el('th', { text: 'النشر' }),
            el('th', { text: 'البيانات' }),
            el('th', { text: 'الإجراءات' }),
          ]),
        ]),
        el('tbody', {}, faqs.map((faq) =>
          el('tr', {}, [
            el('td', {}, [
              el('div', { className: 'cell-strong', text: faq.question }),
              el('div', {
                className: 'cell-muted',
                text: faq.answer.length > 110 ? `${faq.answer.slice(0, 110)}…` : faq.answer,
              }),
            ]),
            el('td', { className: 'cell-muted', text: formatNumber(faq.sort_order) }),
            el('td', {}, [
              faq.is_published
                ? el('span', { className: 'badge badge--published', text: 'منشور' })
                : el('span', { className: 'badge badge--draft', text: 'مسودة' }),
            ]),
            el('td', {}, [
              faq.is_demo
                ? el('span', { className: 'badge badge--demo', text: 'تجريبي' })
                : el('span', { className: 'badge badge--real', text: 'حقيقي' }),
            ]),
            el('td', { className: 'cell-actions' }, [faqActions(faq)]),
          ])
        )),
      ]),
    ]);
  }

  return el('section', { className: 'panel mt-2' }, [head, body]);
}

// ---------------------------------------------------------------------------
// Refresh & render
// ---------------------------------------------------------------------------
async function refreshFaqs() {
  const data = await api('/api/admin/school-content');
  state = data;
  replaceFaqNodes();
}

function replaceFaqNodes() {
  const newEditor = buildFaqEditorPanel();
  const newList = buildFaqListPanel();
  if (faqEditorNode) faqEditorNode.replaceWith(newEditor);
  if (faqListNode) faqListNode.replaceWith(newList);
  faqEditorNode = newEditor;
  faqListNode = newList;
}

function renderPage() {
  const head = pageHead({
    title: 'المحتوى والأسئلة',
    description: 'حرّر نصوص الصفحات العامة وأدر الأسئلة الشائعة. تُحفظ جميع النصوص كنص عادي آمن.',
    actions: [
      el('a', {
        className: 'btn btn-outline',
        attrs: { href: '/', target: '_blank', rel: 'noopener' },
      }, [icon('external', 16), el('span', { text: 'عرض الموقع' })]),
    ],
  });

  faqEditorNode = buildFaqEditorPanel();
  faqListNode = buildFaqListPanel();

  contentRoot.replaceChildren(head, buildContentForm(), faqEditorNode, faqListNode);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
async function load() {
  contentRoot.replaceChildren(
    el('div', { className: 'skel skel-line' }),
    el('div', { className: 'skel skel-block' })
  );

  try {
    state = await api('/api/admin/school-content');
    renderPage();
  } catch (error) {
    contentRoot.replaceChildren(
      pageHead({ title: 'المحتوى والأسئلة' }),
      el('div', { className: 'panel' }, [
        el('div', { className: 'panel__body' }, [
          el('div', { className: 'alert alert--error' }, [
            icon('alert', 18),
            el('div', { text: error.message || 'تعذّر تحميل المحتوى.' }),
          ]),
        ]),
      ])
    );
  }
}
