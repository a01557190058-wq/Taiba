'use strict';

const db = require('../db');
const HttpError = require('../lib/http-error');
const { generateReferenceNumber } = require('../lib/reference');

const DUPLICATE_WINDOW_HOURS = 24;
const STATUS_LABELS = {
  NEW: 'جديد',
  UNDER_REVIEW: 'قيد المراجعة',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
};

function mapApplication(row, { includeAdminNotes = true } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    reference_number: row.reference_number,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    department_id: row.department_id,
    department_name: row.department_name_snapshot,
    department_slug: row.department_slug || null,
    previous_education: row.previous_education,
    additional_notes: row.additional_notes,
    status: row.status,
    status_label: STATUS_LABELS[row.status] || row.status,
    is_demo: Boolean(row.is_demo),
    submitted_at: row.submitted_at,
    updated_at: row.updated_at,
  };
  if (includeAdminNotes) {
    base.admin_notes = row.admin_notes;
    base.has_admin_notes = Boolean(row.admin_notes && row.admin_notes.trim());
  }
  return base;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Creates a public application after re-validating the department server-side.
 * Returns a *public* projection only: never internal notes.
 */
function create(payload) {
  const department = db.get(
    'SELECT id, name, slug, is_published, is_active FROM departments WHERE id = ?',
    [payload.department_id]
  );

  if (!department) {
    throw new HttpError(422, 'DEPARTMENT_UNAVAILABLE', 'القسم المختار غير موجود. اختر قسمًا آخر من القائمة.');
  }
  if (!department.is_published || !department.is_active) {
    throw new HttpError(
      422,
      'DEPARTMENT_NOT_ACCEPTING',
      'هذا القسم لا يستقبل طلبات جديدة حاليًا. اختر قسمًا آخر من القائمة.'
    );
  }

  // Basic duplicate protection: same phone + department within the window.
  const duplicate = db.get(
    `SELECT reference_number FROM applications
      WHERE phone = ? AND department_id = ?
        AND submitted_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)
      LIMIT 1`,
    [payload.phone, department.id, `-${DUPLICATE_WINDOW_HOURS} hours`]
  );

  if (duplicate) {
    throw HttpError.conflict(
      'DUPLICATE_APPLICATION',
      `يوجد طلب مسجل بنفس رقم الهاتف لهذا القسم خلال آخر ${DUPLICATE_WINDOW_HOURS} ساعة. رقم الطلب السابق: ${duplicate.reference_number}`
    );
  }

  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = generateReferenceNumber();
    try {
      const result = db.run(
        `INSERT INTO applications
           (reference_number, full_name, phone, email, department_id,
            department_name_snapshot, previous_education, additional_notes,
            status, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 0)`,
        [
          reference,
          payload.full_name,
          payload.phone,
          payload.email || '',
          department.id,
          department.name,
          payload.previous_education || '',
          payload.additional_notes || '',
        ]
      );
      const row = db.get('SELECT * FROM applications WHERE id = ?', [Number(result.lastInsertRowid)]);
      return { application: mapApplication(row), reference_number: reference };
    } catch (error) {
      lastError = error;
      if (!String(error.message).includes('UNIQUE')) throw error;
    }
  }
  throw new HttpError(500, 'REFERENCE_GENERATION_FAILED', 'تعذّر إنشاء رقم طلب. حاول مرة أخرى.');
}

// ---------------------------------------------------------------------------
// Admin listing
// ---------------------------------------------------------------------------
function listAdmin({
  q = '',
  status = '',
  departmentId = null,
  isDemo = null,
  sort = 'newest',
  page = 1,
  limit = 20,
  includeAdminNotes = false,
} = {}) {
  const where = [];
  const params = [];

  if (q) {
    where.push('(a.full_name LIKE ? ESCAPE \'\\\' OR a.reference_number LIKE ? ESCAPE \'\\\')');
    const like = `%${escapeLike(q)}%`;
    params.push(like, like);
  }
  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }
  if (departmentId) {
    where.push('a.department_id = ?');
    params.push(departmentId);
  }
  if (isDemo === true) where.push('a.is_demo = 1');
  else if (isDemo === false) where.push('a.is_demo = 0');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = sort === 'oldest' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const totalRow = db.get(`SELECT COUNT(*) AS count FROM applications a ${whereSql}`, params);
  const rows = db.all(
    `SELECT a.*, d.slug AS department_slug
       FROM applications a
       LEFT JOIN departments d ON d.id = a.department_id
       ${whereSql}
      ORDER BY a.submitted_at ${order}, a.id ${order}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    items: rows.map((row) => mapApplication(row, { includeAdminNotes })),
    total: totalRow.count,
  };
}

function getById(id, options = {}) {
  const row = db.get(
    `SELECT a.*, d.slug AS department_slug
       FROM applications a
       LEFT JOIN departments d ON d.id = a.department_id
      WHERE a.id = ?`,
    [id]
  );
  return mapApplication(row, options);
}

function updateStatus(id, status) {
  const current = db.get('SELECT id FROM applications WHERE id = ?', [id]);
  if (!current) throw HttpError.notFound('الطلب غير موجود.');

  db.run(
    `UPDATE applications
        SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?`,
    [status, id]
  );
  return getById(id);
}

function updateNotes(id, adminNotes) {
  const current = db.get('SELECT id FROM applications WHERE id = ?', [id]);
  if (!current) throw HttpError.notFound('الطلب غير موجود.');

  db.run(
    `UPDATE applications
        SET admin_notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?`,
    [adminNotes, id]
  );
  return getById(id);
}

/**
 * Full administrative control: any application can be deleted, whether it is
 * flagged as demo data or a genuine submission. The dashboard asks for an
 * explicit typed confirmation before calling this endpoint.
 */
function remove(id) {
  const application = db.get('SELECT id, reference_number, is_demo FROM applications WHERE id = ?', [id]);
  if (!application) throw HttpError.notFound('الطلب غير موجود.');
  db.run('DELETE FROM applications WHERE id = ?', [id]);
  return {
    id,
    reference_number: application.reference_number,
    was_demo: Boolean(application.is_demo),
  };
}

/** Escape a value for CSV (Excel-friendly, quotes doubled). */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const header = [
    'رقم الطلب',
    'الاسم الكامل',
    'الهاتف',
    'البريد الإلكتروني',
    'القسم',
    'المؤهل السابق',
    'الحالة',
    'ملاحظات إدارية',
    'ملاحظات المتقدم',
    'بيانات تجريبية',
    'تاريخ التقديم',
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.reference_number,
        row.full_name,
        row.phone,
        row.email,
        row.department_name,
        row.previous_education,
        row.status_label,
        row.admin_notes,
        row.additional_notes,
        row.is_demo ? 'نعم' : 'لا',
        row.submitted_at,
      ]
        .map(csvCell)
        .join(',')
    );
  }
  // UTF-8 BOM so Excel renders Arabic correctly.
  return `\uFEFF${lines.join('\r\n')}`;
}

function listForExport(filters = {}) {
  const { items } = listAdmin({ ...filters, page: 1, limit: 5000, includeAdminNotes: true });
  return items;
}

function recent(limit = 5) {
  const rows = db.all(
    `SELECT a.*, d.slug AS department_slug
       FROM applications a
       LEFT JOIN departments d ON d.id = a.department_id
      ORDER BY a.submitted_at DESC, a.id DESC
      LIMIT ?`,
    [limit]
  );
  return rows.map((row) => mapApplication(row, { includeAdminNotes: false }));
}

module.exports = {
  STATUS_LABELS,
  DUPLICATE_WINDOW_HOURS,
  create,
  listAdmin,
  getById,
  updateStatus,
  updateNotes,
  remove,
  toCsv,
  listForExport,
  recent,
};
