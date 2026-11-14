'use strict';

const db = require('../db');
const HttpError = require('../lib/http-error');
const departmentMedia = require('../lib/department-media');
const { cleanText, slugify } = require('../lib/text');

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
    images: [],
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

function getImages(departmentId) {
  return db
    .all(
      `SELECT id, url, alt, sort_order FROM department_images
        WHERE department_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [departmentId]
    )
    .map((row) => ({ id: row.id, url: row.url, alt: row.alt }));
}

/** Attaches the ordered photo list to a single department row. */
function withImages(row) {
  const department = mapDepartment(row);
  if (department) department.images = getImages(department.id);
  return department;
}

/** Replaces a department's photos, keeping the order of the given array. */
function replaceImages(departmentId, images) {
  db.run('DELETE FROM department_images WHERE department_id = ?', [departmentId]);
  (Array.isArray(images) ? images : []).forEach((image, index) => {
    db.run(
      `INSERT INTO department_images (department_id, url, alt, sort_order)
       VALUES (?, ?, ?, ?)`,
      [departmentId, cleanText(image.url), cleanText(image.alt || ''), index]
    );
  });
}

/**
 * Deletes uploaded department files that are no longer referenced by any
 * department. External URLs are ignored. Never throws: a leftover file must
 * not break a successful database write.
 */
function cleanupUploadedFiles(candidates) {
  const checked = new Set();
  for (const url of candidates) {
    if (!url || checked.has(url) || !departmentMedia.isDepartmentUploadUrl(url)) continue;
    checked.add(url);
    const stillUsed =
      db.get('SELECT 1 AS found FROM departments WHERE image_url = ? LIMIT 1', [url]) ||
      db.get('SELECT 1 AS found FROM department_images WHERE url = ? LIMIT 1', [url]);
    if (!stillUsed) departmentMedia.removeUploadedFile(url);
  }
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
  return withImages(row);
}

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------
function listAdmin({ q = '', state = 'all', isDemo = null, page = 1, limit = 20 } = {}) {
  const where = [];
  const params = [];

  if (q) {
    where.push('d.name LIKE ? ESCAPE \'\\\'');
    const like = `%${q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    params.push(like);
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
  return withImages(row);
}

function assertSlugAvailable(slug, excludeId = null) {
  const existing = db.get('SELECT id FROM departments WHERE slug = ?', [slug]);
  if (existing && existing.id !== excludeId) {
    throw HttpError.conflict('SLUG_TAKEN', 'المعرّف (slug) مستخدم بالفعل. اختر معرّفًا آخر.', {
      slug: 'هذا المعرّف مستخدم لتخصص آخر.',
    });
  }
}

function create(payload) {
  const slug = payload.slug || slugify(payload.name);
  if (!slug) {
    throw HttpError.badRequest('تعذّر توليد معرّف للتخصص. أدخل المعرّف يدويًا.', {
      slug: 'المعرّف مطلوب.',
    });
  }
  assertSlugAvailable(slug);

  const id = db.transaction(() => {
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
    const newId = Number(result.lastInsertRowid);
    if (payload.images !== undefined) replaceImages(newId, payload.images);
    return newId;
  });

  return getById(id);
}

function update(id, payload) {
  const current = getById(id);
  if (!current) throw HttpError.notFound('التخصص غير موجود.');

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

  const imagesChanged = payload.images !== undefined;
  if (!fields.length && !imagesChanged) return current;

  const previousUploads = [
    current.image_url,
    ...current.images.map((image) => image.url),
  ];

  db.transaction(() => {
    if (fields.length) {
      fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
      params.push(id);
      db.run(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    if (imagesChanged) replaceImages(id, payload.images);
  });

  const updated = getById(id);
  const retainedUploads = new Set([
    updated.image_url,
    ...updated.images.map((image) => image.url),
  ]);
  cleanupUploadedFiles(previousUploads.filter((url) => !retainedUploads.has(url)));

  return updated;
}

/**
 * Full administrative control over departments.
 * - Without `force`, a department that still has applications is protected.
 * - With `force`, its applications are deleted first and then the department,
 *   inside a single transaction. The dashboard requires a typed confirmation
 *   before sending `force`.
 */
function remove(id, { force = false } = {}) {
  const department = getById(id);
  if (!department) throw HttpError.notFound('التخصص غير موجود.');

  if (department.applications_count > 0 && !force) {
    throw HttpError.conflict(
      'DEPARTMENT_HAS_APPLICATIONS',
      `يحتوي «${department.name}» على ${department.applications_count} طلب/طلبات مرتبطة به. يمكنك أرشفته، أو تأكيد الحذف الكامل لحذف التخصص وطلباته معًا.`
    );
  }

  const uploads = [
    department.image_url,
    ...department.images.map((image) => image.url),
  ];

  const result = db.transaction(() => {
    const deletedApplications = db.run('DELETE FROM applications WHERE department_id = ?', [id]);
    db.run('DELETE FROM departments WHERE id = ?', [id]);
    return {
      id,
      deleted_applications: Number(deletedApplications.changes),
    };
  });

  cleanupUploadedFiles(uploads);
  return result;
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
