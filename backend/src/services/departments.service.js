'use strict';

const db = require('../db');
const HttpError = require('../lib/http-error');
const { slugify } = require('../lib/text');

const PUBLIC_FILTER = 'd.is_published = 1 AND d.is_active = 1';

function mapDepartment(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    short_description: row.short_description,
    description: row.description,
    educational_focus: row.educational_focus,
    skills: row.skills ? row.skills.split('\n').filter(Boolean) : [],
    admission_info: row.admission_info,
    image_url: row.image_url,
    is_published: Boolean(row.is_published),
    is_active: Boolean(row.is_active),
    is_demo: Boolean(row.is_demo),
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(row.applications_count !== undefined
      ? { applications_count: Number(row.applications_count) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
function listPublic() {
  const rows = db.all(
    `SELECT d.* FROM departments d
      WHERE ${PUBLIC_FILTER}
      ORDER BY d.sort_order ASC, d.name ASC`
  );
  return rows.map(mapDepartment);
}

function getPublicBySlug(slug) {
  const row = db.get(
    `SELECT d.* FROM departments d WHERE d.slug = ? AND ${PUBLIC_FILTER}`,
    [slug]
  );
  if (!row) return null;
  return mapDepartment(row);
}

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------
function listAdmin({ q = '', state = 'all', isDemo = null, page = 1, limit = 20 } = {}) {
  const where = [];
  const params = [];

  if (q) {
    where.push('(d.name LIKE ? ESCAPE \'\\\' OR d.slug LIKE ? ESCAPE \'\\\')');
    const like = `%${q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    params.push(like, like);
  }

  if (state === 'published') where.push('d.is_published = 1 AND d.is_active = 1');
  else if (state === 'draft') where.push('d.is_published = 0 AND d.is_active = 1');
  else if (state === 'archived') where.push('d.is_active = 0');

  if (isDemo === true) where.push('d.is_demo = 1');
  else if (isDemo === false) where.push('d.is_demo = 0');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const totalRow = db.get(`SELECT COUNT(*) AS count FROM departments d ${whereSql}`, params);
  const rows = db.all(
    `SELECT d.*,
            (SELECT COUNT(*) FROM applications a WHERE a.department_id = d.id) AS applications_count
       FROM departments d
       ${whereSql}
      ORDER BY d.is_active DESC, d.sort_order ASC, d.id ASC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows.map(mapDepartment), total: totalRow.count };
}

function getById(id) {
  const row = db.get(
    `SELECT d.*,
            (SELECT COUNT(*) FROM applications a WHERE a.department_id = d.id) AS applications_count
       FROM departments d WHERE d.id = ?`,
    [id]
  );
  return mapDepartment(row);
}

function assertSlugAvailable(slug, excludeId = null) {
  const existing = db.get('SELECT id FROM departments WHERE slug = ?', [slug]);
  if (existing && existing.id !== excludeId) {
    throw HttpError.conflict('SLUG_TAKEN', 'المعرّف (slug) مستخدم بالفعل. اختر معرّفًا آخر.', {
      slug: 'هذا المعرّف مستخدم لقسم آخر.',
    });
  }
}

function create(payload) {
  const slug = payload.slug || slugify(payload.name);
  if (!slug) {
    throw HttpError.badRequest('تعذّر توليد معرّف للقسم. أدخل المعرّف يدويًا.', {
      slug: 'المعرّف مطلوب.',
    });
  }
  assertSlugAvailable(slug);

  const result = db.run(
    `INSERT INTO departments
       (name, slug, short_description, description, educational_focus, skills,
        admission_info, image_url, is_published, is_active, is_demo, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      payload.name,
      slug,
      payload.short_description,
      payload.description,
      payload.educational_focus || '',
      payload.skills || '',
      payload.admission_info || '',
      payload.image_url || '',
      payload.is_published ? 1 : 0,
      payload.is_active === false ? 0 : 1,
      payload.sort_order || 0,
    ]
  );

  return getById(Number(result.lastInsertRowid));
}

function update(id, payload) {
  const current = getById(id);
  if (!current) throw HttpError.notFound('القسم غير موجود.');

  const fields = [];
  const params = [];
  const assign = (column, value) => {
    fields.push(`${column} = ?`);
    params.push(value);
  };

  if (payload.name !== undefined) assign('name', payload.name);
  if (payload.slug !== undefined && payload.slug !== current.slug) {
    assertSlugAvailable(payload.slug, id);
    assign('slug', payload.slug);
  }
  if (payload.short_description !== undefined) assign('short_description', payload.short_description);
  if (payload.description !== undefined) assign('description', payload.description);
  if (payload.educational_focus !== undefined) assign('educational_focus', payload.educational_focus);
  if (payload.skills !== undefined) assign('skills', payload.skills);
  if (payload.admission_info !== undefined) assign('admission_info', payload.admission_info);
  if (payload.image_url !== undefined) assign('image_url', payload.image_url);
  if (payload.is_published !== undefined) assign('is_published', payload.is_published ? 1 : 0);
  if (payload.is_active !== undefined) assign('is_active', payload.is_active ? 1 : 0);
  if (payload.sort_order !== undefined) assign('sort_order', payload.sort_order);

  if (!fields.length) return current;

  fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  params.push(id);

  db.run(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, params);
  return getById(id);
}

/**
 * Hard delete is only allowed when no application references the department.
 * Otherwise the caller is told to archive it instead, preserving history.
 */
function remove(id) {
  const department = getById(id);
  if (!department) throw HttpError.notFound('القسم غير موجود.');

  if (department.applications_count > 0) {
    throw HttpError.conflict(
      'DEPARTMENT_HAS_APPLICATIONS',
      `لا يمكن حذف «${department.name}» لوجود ${department.applications_count} طلب/طلبات مرتبطة به. يمكنك أرشفته أو إلغاء نشره بدلًا من الحذف.`
    );
  }

  db.run('DELETE FROM departments WHERE id = ?', [id]);
  return { id };
}

function countPublished() {
  const row = db.get(`SELECT COUNT(*) AS count FROM departments d WHERE ${PUBLIC_FILTER}`);
  return row.count;
}

/** Departments that accept new applications (published + active). */
function listAvailableForApplications() {
  return db.all(
    `SELECT d.id, d.name, d.slug, d.short_description, d.admission_info
       FROM departments d
      WHERE ${PUBLIC_FILTER}
      ORDER BY d.sort_order ASC, d.name ASC`
  );
}

module.exports = {
  mapDepartment,
  listPublic,
  getPublicBySlug,
  listAdmin,
  getById,
  create,
  update,
  remove,
  countPublished,
  listAvailableForApplications,
};
