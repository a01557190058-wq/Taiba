'use strict';

const db = require('../db');
const HttpError = require('../lib/http-error');
const {
  SUBJECT_TYPE_LABELS,
  SUBJECT_TYPE_SINGULAR,
  SUBJECT_GRADE_LABELS,
  SUBJECT_GRADE_VALUES,
  DEFAULT_SUBJECT_ICON,
  DEFAULT_SUBJECT_GRADE,
} = require('../lib/subject-constants');

const PUBLIC_FILTER = 's.is_published = 1';

const SELECT_WITH_DEPARTMENT = `
  SELECT s.*, d.name AS department_name, d.slug AS department_slug
    FROM subjects s
    LEFT JOIN departments d ON d.id = s.department_id`;

function mapSubject(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    type_label: SUBJECT_TYPE_LABELS[row.type] || row.type,
    type_singular: SUBJECT_TYPE_SINGULAR[row.type] || row.type,
    grade: row.grade || DEFAULT_SUBJECT_GRADE,
    grade_label: SUBJECT_GRADE_LABELS[row.grade] || SUBJECT_GRADE_LABELS[DEFAULT_SUBJECT_GRADE],
    department_id: row.department_id === null ? null : row.department_id,
    department_name: row.department_name || '',
    department_slug: row.department_slug || '',
    icon: row.icon || DEFAULT_SUBJECT_ICON,
    is_published: Boolean(row.is_published),
    is_demo: Boolean(row.is_demo),
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isKnownGrade(grade) {
  return SUBJECT_GRADE_VALUES.includes(grade);
}

function normalizeDepartmentId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Published subjects grouped into the two sections of the public page.
 *
 * When `grade` is provided only that grade is returned. When `department` is
 * provided the result contains the subjects linked to that department plus the
 * general subjects (no department) of the same grade, so shared subjects such
 * as Arabic or Mathematics still appear for every specialization.
 */
function getPublicGrouped({ grade = null, department = null } = {}) {
  const where = [PUBLIC_FILTER];
  const params = [];

  if (isKnownGrade(grade)) {
    where.push('s.grade = ?');
    params.push(grade);
  }

  const departmentId = normalizeDepartmentId(department);
  if (departmentId !== null) {
    where.push('(s.department_id = ? OR s.department_id IS NULL)');
    params.push(departmentId);
  }

  const rows = db.all(
    `${SELECT_WITH_DEPARTMENT}
      WHERE ${where.join(' AND ')}
      ORDER BY s.sort_order ASC, s.name ASC, s.id ASC`,
    params
  );

  const groups = { theoretical: [], practical: [] };
  for (const row of rows) {
    const subject = mapSubject(row);
    if (groups[subject.type]) groups[subject.type].push(subject);
  }

  // Every published, active department is offered as a choice — even when it
  // has no subjects in the selected grade — so the visitor always sees the full
  // list of specializations instead of only the ones with matching subjects.
  const departmentParams = [];
  const joinGrade = isKnownGrade(grade) ? ' AND s.grade = ?' : '';
  if (isKnownGrade(grade)) departmentParams.push(grade);
  const departments = db.all(
    `SELECT d.id, d.slug, d.name, COUNT(s.id) AS subject_count
       FROM departments d
       LEFT JOIN subjects s
         ON s.department_id = d.id
        AND s.is_published = 1${joinGrade}
      WHERE d.is_published = 1 AND d.is_active = 1
      GROUP BY d.id, d.slug, d.name
      ORDER BY d.sort_order ASC, d.name ASC`,
    departmentParams
  );

  return {
    ...groups,
    departments: departments.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      subject_count: Number(row.subject_count),
    })),
    counts: {
      total: groups.theoretical.length + groups.practical.length,
      theoretical: groups.theoretical.length,
      practical: groups.practical.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------
function listAdmin({
  q = '',
  type = 'all',
  grade = 'all',
  departmentId = null,
  state = 'all',
  isDemo = null,
  page = 1,
  limit = 20,
} = {}) {
  const where = [];
  const params = [];

  if (q) {
    where.push("s.name LIKE ? ESCAPE '\\'");
    const like = `%${q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    params.push(like);
  }

  if (type === 'theoretical' || type === 'practical') {
    where.push('s.type = ?');
    params.push(type);
  }

  if (isKnownGrade(grade)) {
    where.push('s.grade = ?');
    params.push(grade);
  }

  const normalizedDepartment = normalizeDepartmentId(departmentId);
  if (normalizedDepartment !== null) {
    where.push('s.department_id = ?');
    params.push(normalizedDepartment);
  }

  if (state === 'published') where.push('s.is_published = 1');
  else if (state === 'draft') where.push('s.is_published = 0');

  if (isDemo === true) where.push('s.is_demo = 1');
  else if (isDemo === false) where.push('s.is_demo = 0');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const totalRow = db.get(`SELECT COUNT(*) AS count FROM subjects s ${whereSql}`, params);
  const rows = db.all(
    `${SELECT_WITH_DEPARTMENT}
      ${whereSql}
      ORDER BY s.grade ASC, s.type ASC, s.sort_order ASC, s.id ASC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows.map(mapSubject), total: totalRow.count };
}

function getById(id) {
  return mapSubject(db.get(`${SELECT_WITH_DEPARTMENT} WHERE s.id = ?`, [id]));
}

/** A subject may only reference an existing department (or none at all). */
function assertDepartment(departmentId) {
  if (departmentId === null || departmentId === undefined) return null;
  const department = db.get('SELECT id FROM departments WHERE id = ?', [departmentId]);
  if (!department) {
    throw HttpError.badRequest('التخصص المحدد غير موجود.', {
      department_id: 'التخصص المحدد غير موجود.',
    });
  }
  return departmentId;
}

function create(payload) {
  const departmentId = assertDepartment(
    payload.department_id === undefined ? null : payload.department_id
  );
  const result = db.run(
    `INSERT INTO subjects
       (name, description, type, grade, department_id, icon, is_published, is_demo, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      payload.name,
      payload.description || '',
      payload.type,
      payload.grade || DEFAULT_SUBJECT_GRADE,
      departmentId,
      payload.icon || DEFAULT_SUBJECT_ICON,
      payload.is_published ? 1 : 0,
      payload.sort_order || 0,
    ]
  );
  return getById(Number(result.lastInsertRowid));
}

function update(id, payload) {
  const current = getById(id);
  if (!current) throw HttpError.notFound('المادة الدراسية غير موجودة.');

  const fields = [];
  const params = [];
  const assign = (column, value) => {
    fields.push(`${column} = ?`);
    params.push(value);
  };

  if (payload.name !== undefined) assign('name', payload.name);
  if (payload.description !== undefined) assign('description', payload.description);
  if (payload.type !== undefined) assign('type', payload.type);
  if (payload.grade !== undefined) assign('grade', payload.grade);
  if (payload.department_id !== undefined) {
    assign('department_id', assertDepartment(payload.department_id));
  }
  if (payload.icon !== undefined) assign('icon', payload.icon);
  if (payload.is_published !== undefined) assign('is_published', payload.is_published ? 1 : 0);
  if (payload.sort_order !== undefined) assign('sort_order', payload.sort_order);

  if (!fields.length) return current;

  fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  params.push(id);
  db.run(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`, params);
  return getById(id);
}

function remove(id) {
  const current = db.get('SELECT id FROM subjects WHERE id = ?', [id]);
  if (!current) throw HttpError.notFound('المادة الدراسية غير موجودة.');
  db.run('DELETE FROM subjects WHERE id = ?', [id]);
  return { id };
}

function countPublished() {
  const row = db.get(`SELECT COUNT(*) AS count FROM subjects s WHERE ${PUBLIC_FILTER}`);
  return row.count;
}

module.exports = {
  mapSubject,
  getPublicGrouped,
  listAdmin,
  getById,
  create,
  update,
  remove,
  countPublished,
};
