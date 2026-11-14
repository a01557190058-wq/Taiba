'use strict';

/**
 * Shared subject constants. Kept in one place so the API validators, the
 * service, the demo seed and the admin UI all agree on the allowed values.
 */
const SUBJECT_TYPES = ['theoretical', 'practical'];

const SUBJECT_TYPE_LABELS = {
  theoretical: 'مواد نظرية',
  practical: 'مواد عملية',
};

const SUBJECT_TYPE_SINGULAR = {
  theoretical: 'نظرية',
  practical: 'عملية',
};

const SUBJECT_GRADES = [
  { value: 'first', label: 'الصف الأول الثانوي' },
  { value: 'second', label: 'الصف الثاني الثانوي' },
  { value: 'third', label: 'الصف الثالث الثانوي' },
];

const SUBJECT_GRADE_VALUES = SUBJECT_GRADES.map((grade) => grade.value);

const SUBJECT_GRADE_LABELS = Object.fromEntries(
  SUBJECT_GRADES.map((grade) => [grade.value, grade.label])
);

const DEFAULT_SUBJECT_GRADE = 'first';

const SUBJECT_ICONS = [
  'book',
  'flask',
  'target',
  'sparkles',
  'layers',
  'grid',
  'chart',
  'users',
  'graduation',
  'star',
  'shield',
  'briefcase',
  'calendar',
  'quote',
  'search',
  'file',
  'image',
  'video',
  'news',
  'database',
];

const DEFAULT_SUBJECT_ICON = 'book';

module.exports = {
  SUBJECT_TYPES,
  SUBJECT_TYPE_LABELS,
  SUBJECT_TYPE_SINGULAR,
  SUBJECT_GRADES,
  SUBJECT_GRADE_VALUES,
  SUBJECT_GRADE_LABELS,
  DEFAULT_SUBJECT_GRADE,
  SUBJECT_ICONS,
  DEFAULT_SUBJECT_ICON,
};
