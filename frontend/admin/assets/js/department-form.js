/**
 * Department create / edit form.
 * The same page serves `/admin/departments/new` and
 * `/admin/departments/:id/edit`. Validation is duplicated client-side for
 * convenience only — the API validates every field again on the server.
 */
import {
  boot,
  api,
  ApiError,
  qs,
  el,
  icon,
  pageHead,
  toast,
  setAlert,
  setButtonBusy,
  confirmDialog,
  departmentStateBadge,
  formatNumber,
} from './admin.js';

const content = qs('#admin-content');
const match = window.location.pathname.match(/^\/admin\/departments\/(\d+)\/edit$/);
const departmentId = match ? Number(match[1]) : null;
const isEdit = departmentId !== null;

const admin = await boot({
  active: 'departments',
  title: isEdit ? 'تحرير قسم' : 'قسم جديد',
  subtitle: isEdit ? 'تحديث بيانات القسم وحالة نشره' : 'إضافة قسم تعليمي جديد إلى الموقع',
});

const fields = new Map();

if (admin) {
  init();
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------
function createField({
  id,
  label,
  type = 'text',
  value = '',
  required = false,
  hint = '',
  placeholder = '',
  rows = 5,
  dir = '',
  maxlength = '',
  inputmode = '',
  full = false,
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  let input;

  if (type === 'textarea') {
    input = el('textarea', {
      className: 'textarea',
      attrs: {
        id,
        rows,
        placeholder,
        ...(dir ? { dir } : {}),
        ...(maxlength ? { maxlength } : {}),
        ...(required ? { 'aria-required': 'true' } : {}),
        'aria-describedby': hint ? hintId : null,
      },
    });
    input.value = value ?? '';
  } else {
    input = el('input', {
      className: 'input',
      attrs: {
        id,
        type,
        placeholder,
        autocomplete: 'off',
        ...(dir ? { dir } : {}),
        ...(maxlength ? { maxlength } : {}),
        ...(inputmode ? { inputmode } : {}),
        ...(required ? { 'aria-required': 'true' } : {}),
        'aria-describedby': hint ? hintId : null,
      },
    });
    input.value = value ?? '';
  }

  const labelNode = el('label', { attrs: { for: id } }, [
    el('span', { text: label }),
    required ? el('span', { className: 'req', text: ' *' }) : null,
  ]);

  const errorNode = el('p', { className: 'error-text', attrs: { id: errorId } });

  const node = el('div', { className: `field${full ? ' field--full' : ''}` }, [
    labelNode,
    input,
    hint ? el('p', { className: 'hint', attrs: { id: hintId }, text: hint }) : null,
    errorNode,
  ]);

  const field = {
    id,
    input,
    node,
    setError(message) {
      errorNode.textContent = message || '';
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    },
    clearError() {
      this.setError('');
    },
  };

  fields.set(id, field);
  return field;
}

function checkboxField({ id, label, hint = '', checked = false }) {
  const input = el('input', { attrs: { type: 'checkbox', id } });
  input.checked = Boolean(checked);

  const node = el('label', { className: 'checkbox', attrs: { for: id } }, [
    input,
    el('span', {}, [
      el('strong', { text: label }),
      hint ? el('span', { className: 'hint', text: hint }) : null,
    ]),
  ]);

  return { node, input };
}

function clearFieldErrors() {
  for (const field of fields.values()) field.clearError();
}

function applyServerErrors(errorFields) {
  if (!errorFields) return;
  for (const [key, message] of Object.entries(errorFields)) {
    const field = fields.get(key);
    if (field) field.setError(message);
  }
}

function section(title, description, children) {
  return el('section', { className: 'panel' }, [
    el('div', { className: 'panel__head' }, [
      el('div', {}, [
        el('h3', { text: title }),
        description ? el('p', { text: description }) : null,
      ]),
    ]),
    el('div', { className: 'panel__body' }, children),
  ]);
}

// ---------------------------------------------------------------------------
// Client-side slug generation (mirrors backend slugify for convenience)
// ---------------------------------------------------------------------------
function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 140);
}

function validate(values) {
  clearFieldErrors();
  let ok = true;

  const check = (id, condition, message) => {
    if (condition) return;
    const field = fields.get(id);
    if (field) field.setError(message);
    ok = false;
  };

  check('name', values.name.length >= 2, 'اسم القسم مطلوب (حرفان على الأقل).');
  check('name', values.name.length <= 120, 'اسم القسم طويل جدًا (120 حرفًا كحد أقصى).');
  check(
    'short_description',
    values.short_description.length >= 10,
    'الوصف المختصر مطلوب (10 أحرف على الأقل).'
  );
  check(
    'short_description',
    values.short_description.length <= 300,
    'الوصف المختصر طويل جدًا (300 حرف كحد أقصى).'
  );
  check(
    'description',
    values.description.length >= 30,
    'الوصف الكامل مطلوب (30 حرفًا على الأقل).'
  );
  check('description', values.description.length <= 6000, 'الوصف الكامل طويل جدًا (6000 حرف كحد أقصى).');
  check('educational_focus', values.educational_focus.length <= 2000, 'حقل التركيز التعليمي طويل جدًا.');
  check('skills', values.skills.length <= 2000, 'قائمة المهارات طويلة جدًا.');
  check('admission_info', values.admission_info.length <= 1000, 'معلومات القبول طويلة جدًا.');
  check('slug', values.slug.length <= 140, 'المعرّف طويل جدًا (140 حرفًا كحد أقصى).');
  check('image_url', values.image_url.length <= 500, 'رابط الصورة طويل جدًا.');

  if (values.image_url) {
    const valid = values.image_url.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(values.image_url);
    check('image_url', valid, 'رابط الصورة يجب أن يبدأ بـ / أو http(s)://');
  }

  const sort = Number(values.sort_order);
  check('sort_order', Number.isInteger(sort) && sort >= 0, 'ترتيب العرض يجب أن يكون عددًا صحيحًا غير سالب.');
  check('sort_order', sort <= 9999, 'ترتيب العرض كبير جدًا.');

  return ok;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderForm(department) {
  const editing = Boolean(department);

  const nameField = createField({
    id: 'name',
    label: 'اسم القسم',
    value: department?.name || '',
    required: true,
    maxlength: 120,
    placeholder: 'مثال: تكنولوجيا البرمجة',
  });

  const slugField = createField({
    id: 'slug',
    label: 'المعرّف في الرابط (slug)',
    value: department?.slug || '',
    dir: 'ltr',
    maxlength: 140,
    hint: 'يُستخدم في رابط صفحة القسم، مثل /departments/programming. اتركه فارغًا ليُولَّد تلقائيًا من الاسم.',
  });

  const shortField = createField({
    id: 'short_description',
    label: 'الوصف المختصر',
    type: 'textarea',
    value: department?.short_description || '',
    required: true,
    rows: 3,
    maxlength: 300,
    hint: 'يظهر في بطاقة القسم بصفحة الأقسام (10–300 حرف).',
  });

  const descriptionField = createField({
    id: 'description',
    label: 'الوصف الكامل',
    type: 'textarea',
    value: department?.description || '',
    required: true,
    rows: 7,
    maxlength: 6000,
    hint: 'يظهر في صفحة تفاصيل القسم (30 حرفًا على الأقل).',
  });

  const focusField = createField({
    id: 'educational_focus',
    label: 'التركيز التعليمي',
    type: 'textarea',
    value: department?.educational_focus || '',
    rows: 4,
    maxlength: 2000,
    hint: 'وصف مختصر لما يركز عليه القسم في التدريس والتدريب.',
  });

  const skillsField = createField({
    id: 'skills',
    label: 'المهارات المكتسبة',
    type: 'textarea',
    value: Array.isArray(department?.skills) ? department.skills.join('\n') : department?.skills || '',
    rows: 5,
    maxlength: 2000,
    hint: 'اكتب كل مهارة في سطر منفصل. تظهر كقائمة في صفحة القسم.',
  });

  const admissionField = createField({
    id: 'admission_info',
    label: 'معلومات القبول الخاصة بالقسم',
    type: 'textarea',
    value: department?.admission_info || '',
    rows: 3,
    maxlength: 1000,
    hint: 'اختياري — ملاحظات إضافية تظهر في صفحة القسم.',
  });

  const imageField = createField({
    id: 'image_url',
    label: 'رابط صورة القسم',
    value: department?.image_url || '',
    dir: 'ltr',
    maxlength: 500,
    hint: 'اختياري — يبدأ بـ / أو https://. اتركه فارغًا لاستخدام الرسم الافتراضي.',
  });

  const sortField = createField({
    id: 'sort_order',
    label: 'ترتيب العرض',
    type: 'number',
    value: department?.sort_order ?? 0,
    inputmode: 'numeric',
    hint: 'الأرقام الأصغر تظهر أولًا في الموقع.',
  });

  const published = checkboxField({
    id: 'is_published',
    label: 'نشر القسم في الموقع',
    hint: 'القسم المنشور يظهر للزوار في صفحة الأقسام.',
    checked: department ? department.is_published : false,
  });

  const active = checkboxField({
    id: 'is_active',
    label: 'القسم نشط (غير مؤرشف)',
    hint: 'أزل العلامة لأرشفة القسم وإخفائه مع الحفاظ على طلباته.',
    checked: department ? department.is_active : true,
  });

  // Keep the slug in sync with the name until the administrator edits it.
  let slugTouched = Boolean(department?.slug);
  slugField.input.addEventListener('input', () => {
    slugTouched = true;
  });
  if (!editing) {
    nameField.input.addEventListener('input', () => {
      if (!slugTouched) slugField.input.value = slugify(nameField.input.value);
    });
  }

  const alertBox = el('div', { className: 'alert alert--error', attrs: { id: 'form-alert', hidden: true } });

  const form = el('form', { attrs: { id: 'department-form', novalidate: true } }, [
    alertBox,
    el('div', { className: 'mt-2' }, [
      section('المعلومات الأساسية', 'البيانات التي تظهر في بطاقة القسم وصفحة التفاصيل.', [
        el('div', { className: 'form-grid' }, [
          nameField.node,
          slugField.node,
          shortField.node,
          descriptionField.node,
        ]),
      ]),
      el('div', { className: 'mt-2' }, [
        section('المحتوى التعليمي', 'تفاصيل إضافية تساعد الطالب على فهم طبيعة القسم.', [
          el('div', { className: 'form-grid' }, [
            focusField.node,
            skillsField.node,
            admissionField.node,
          ]),
        ]),
      ]),
      el('div', { className: 'mt-2' }, [
        section('العرض والنشر', 'تحكم في ظهور القسم وترتيبه بين الأقسام الأخرى.', [
          el('div', { className: 'form-grid' }, [
            imageField.node,
            sortField.node,
            el('div', { className: 'field' }, [published.node]),
            el('div', { className: 'field' }, [active.node]),
          ]),
        ]),
      ]),
    ]),
  ]);

  const saveButton = el('button', { className: 'btn btn-primary', attrs: { type: 'submit', id: 'save-button' } }, [
    icon('save', 16),
    el('span', { text: editing ? 'حفظ التعديلات' : 'إنشاء القسم' }),
  ]);

  const actions = el('div', { className: 'form-actions' }, [
    saveButton,
    el('a', { className: 'btn btn-outline', attrs: { href: '/admin/departments' }, text: 'إلغاء' }),
    el('span', { className: 'spacer' }),
    editing && department.is_published && department.is_active
      ? el('a', {
          className: 'btn btn-ghost',
          attrs: {
            href: `/departments/${department.slug}`,
            target: '_blank',
            rel: 'noopener',
          },
        }, [icon('external', 16), el('span', { text: 'عرض في الموقع' })])
      : null,
  ]);

  form.append(actions);

  // --- Submit --------------------------------------------------------------
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setAlert(alertBox, {});

    const values = {
      name: nameField.input.value.trim(),
      slug: slugField.input.value.trim(),
      short_description: shortField.input.value.trim(),
      description: descriptionField.input.value.trim(),
      educational_focus: focusField.input.value.trim(),
      skills: skillsField.input.value.trim(),
      admission_info: admissionField.input.value.trim(),
      image_url: imageField.input.value.trim(),
      sort_order: sortField.input.value.trim(),
    };

    if (!validate(values)) {
      setAlert(alertBox, { type: 'error', message: 'يرجى تصحيح الحقول المميزة بالأحمر قبل الحفظ.' });
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const payload = {
      name: values.name,
      short_description: values.short_description,
      description: values.description,
      educational_focus: values.educational_focus,
      skills: values.skills,
      admission_info: values.admission_info,
      image_url: values.image_url,
      sort_order: Number(values.sort_order),
      is_published: published.input.checked,
      is_active: active.input.checked,
    };
    if (values.slug) payload.slug = values.slug;

    setButtonBusy(saveButton, true, 'جارٍ الحفظ…');
    try {
      if (editing) {
        await api(`/api/admin/departments/${department.id}`, { method: 'PATCH', body: payload });
        toast('تم حفظ تعديلات القسم.');
      } else {
        await api('/api/admin/departments', { method: 'POST', body: payload });
        toast('تم إنشاء القسم بنجاح.');
      }
      window.setTimeout(() => {
        window.location.href = '/admin/departments';
      }, 550);
    } catch (error) {
      applyServerErrors(error.fields);
      setAlert(alertBox, {
        type: 'error',
        message: error.message || 'تعذّر حفظ القسم. تحقق من البيانات ثم حاول مرة أخرى.',
      });
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      else alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      setButtonBusy(saveButton, false);
    }
  });

  // --- Header --------------------------------------------------------------
  const headActions = [
    el('a', { className: 'btn btn-outline', attrs: { href: '/admin/departments' } }, [
      icon('arrowLeft', 16),
      el('span', { text: 'رجوع للأقسام' }),
    ]),
  ];

  const head = pageHead({
    title: editing ? department.name : 'إضافة قسم جديد',
    description: editing
      ? 'عدّل بيانات القسم ثم احفظ التغييرات. تُطبَّق التعديلات على الموقع مباشرة.'
      : 'أدخل بيانات القسم التعليمي. يمكنك حفظه كمسودة ونشره لاحقًا.',
    actions: headActions,
  });

  const nodes = [head];

  if (editing) {
    nodes.push(
      el('div', { className: 'panel' }, [
        el('div', { className: 'panel__body' }, [
          el('div', { className: 'chip-row' }, [
            departmentStateBadge(department),
            department.is_demo
              ? el('span', { className: 'badge badge--demo', text: 'بيانات تجريبية' })
              : el('span', { className: 'badge badge--real', text: 'بيانات حقيقية' }),
            el('span', {
              className: 'chip',
              text: `الطلبات المرتبطة: ${formatNumber(department.applications_count || 0)}`,
            }),
          ]),
        ]),
      ])
    );
  }

  nodes.push(el('div', { className: 'mt-2' }, [form]));

  if (editing) {
    const hasApplications = (department.applications_count || 0) > 0;
    const deleteButton = el('button', {
      className: 'btn btn-danger-outline',
      attrs: { type: 'button', id: 'delete-department' },
    }, [icon('trash', 16), el('span', { text: 'حذف القسم نهائيًا' })]);

    deleteButton.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'حذف القسم نهائيًا',
        message: hasApplications
          ? `سيتم حذف «${department.name}» و${formatNumber(
              department.applications_count
            )} طلب/طلبات مرتبطة به نهائيًا. لا يمكن التراجع عن هذه العملية.`
          : `سيتم حذف «${department.name}» نهائيًا ولا يمكن التراجع. هل تريد المتابعة؟`,
        confirmLabel: 'حذف نهائي',
        danger: true,
        requireText: hasApplications ? department.name : '',
      });
      if (!confirmed) return;

      setButtonBusy(deleteButton, true, 'جارٍ الحذف…');
      try {
        const suffix = hasApplications ? '?force=true' : '';
        await api(`/api/admin/departments/${department.id}${suffix}`, { method: 'DELETE' });
        toast(
          hasApplications
            ? 'تم حذف القسم والطلبات المرتبطة به.'
            : 'تم حذف القسم.'
        );
        window.setTimeout(() => {
          window.location.href = '/admin/departments';
        }, 550);
      } catch (error) {
        const message =
          error instanceof ApiError && error.status === 409
            ? error.message
            : error.message || 'تعذّر حذف القسم.';
        toast(message, error instanceof ApiError && error.status === 409 ? 'warning' : 'error');
        setButtonBusy(deleteButton, false);
      }
    });

    nodes.push(
      el('section', { className: 'panel mt-2' }, [
        el('div', { className: 'panel__head' }, [
          el('div', {}, [
            el('h3', { text: 'منطقة الخطر' }),
            el('p', {
              text: hasApplications
                ? 'حذف القسم سيحذف طلباته المرتبطة به أيضًا. راجع العدد قبل المتابعة.'
                : 'الحذف نهائي ولا يمكن التراجع عنه.',
            }),
          ]),
        ]),
        el('div', { className: 'panel__body' }, [
          hasApplications
            ? el('div', { className: 'notice notice--danger' }, [
                icon('alert', 18),
                el('span', {
                  text: `هذا القسم مرتبط بـ ${formatNumber(
                    department.applications_count
                  )} طلب/طلبات. الحذف الكامل سيحذف القسم وكل طلباته نهائيًا. إن أردت الاحتفاظ بسجل الطلبات، ألغِ نشره أو أرشِفه بدلًا من ذلك.`,
                }),
              ])
            : el('div', { className: 'notice' }, [
                icon('info', 18),
                el('span', { text: 'لا توجد طلبات مرتبطة بهذا القسم. الحذف نهائي ولا يمكن التراجع عنه.' }),
              ]),
          el('div', { className: 'form-actions' }, [deleteButton]),
        ]),
      ])
    );
  }

  content.replaceChildren(...nodes);
  nameField.input.focus();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function init() {
  if (!isEdit) {
    renderForm(null);
    return;
  }

  try {
    const department = await api(`/api/admin/departments/${departmentId}`);
    renderForm(department);
  } catch (error) {
    const head = pageHead({
      title: 'تعذّر تحميل القسم',
      actions: [
        el('a', { className: 'btn btn-outline', attrs: { href: '/admin/departments' } }, [
          icon('arrowLeft', 16),
          el('span', { text: 'رجوع للأقسام' }),
        ]),
      ],
    });
    const alertBox = el('div');
    setAlert(alertBox, {
      type: 'error',
      message:
        error instanceof ApiError && error.status === 404
          ? 'القسم المطلوب غير موجود. ربما تم حذفه.'
          : error.message || 'تعذّر تحميل بيانات القسم.',
    });
    content.replaceChildren(
      head,
      el('div', { className: 'panel mt-2' }, [el('div', { className: 'panel__body' }, [alertBox])])
    );
  }
}
