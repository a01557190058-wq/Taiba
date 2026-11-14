'use strict';

const db = require('../db');
const HttpError = require('../lib/http-error');
const { generateReferenceNumber } = require('../lib/reference');
const applicationDocuments = require('../lib/application-documents');

const DUPLICATE_WINDOW_HOURS = 24;
const STATUS_LABELS = {
  NEW: 'جديد',
  UNDER_REVIEW: 'قيد المراجعة',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
};
const GENDER_LABELS = { male: 'ذكر', female: 'أنثى' };
const GUARDIAN_RELATION_LABELS = { father: 'الأب', mother: 'الأم', other: 'أخرى' };
const DOCUMENT_KIND_LABELS = applicationDocuments.DOCUMENT_KINDS;

function mapDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    kind_label: DOCUMENT_KIND_LABELS[row.kind] || row.kind,
    original_name: row.original_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    download_url: `/api/admin/applications/${row.application_id}/documents/${row.id}`,
  };
}

function documentsFor(applicationId) {
  return db
    .all(
      `SELECT id, application_id, kind, original_name, mime_type, size_bytes, created_at
         FROM application_documents
        WHERE application_id = ?
        ORDER BY id ASC`,
      [applicationId]
    )
    .map(mapDocument);
}

function mapApplication(row, { includeAdminNotes = true, includeDocuments = false } = {}) {
  if (!row) return null;
  const addressParts = [row.address_governorate, row.address_center, row.address_city].filter(
    (part) => part && String(part).trim()
  );
  const base = {
    id: row.id,
    reference_number: row.reference_number,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    gender_label: GENDER_LABELS[row.gender] || '',
    national_id: row.national_id,
    governorate: row.governorate,
    educational_administration: row.educational_administration,
    guardian_name: row.guardian_name,
    guardian_relation: row.guardian_relation,
    guardian_relation_label: GUARDIAN_RELATION_LABELS[row.guardian_relation] || '',
    guardian_phone: row.guardian_phone,
    address_governorate: row.address_governorate,
    address_center: row.address_center,
    address_city: row.address_city,
    address_full: addressParts.join(' - '),
    department_id: row.department_id,
    department_name: row.department_name_snapshot,
    department_slug: row.department_slug || null,
    preparatory_score: row.preparatory_score,
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
  if (includeDocuments) {
    base.documents = documentsFor(row.id);
  }
  return base;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Creates a public application after re-validating the department server-side.
 * The uploaded documents are stored in the same transaction; the route is
 * responsible for deleting the temporary files if this function throws.
 * Returns a *public* projection only: never internal notes.
 */
function create(payload) {
  const department = db.get(
    'SELECT id, name, slug, is_published, is_active FROM departments WHERE id = ?',
    [payload.department_id]
  );

  if (!department) {
    throw new HttpError(422, 'DEPARTMENT_UNAVAILABLE', 'التخصص المختار غير موجود. اختر تخصصًا آخر من القائمة.');
  }
  if (!department.is_published || !department.is_active) {
    throw new HttpError(
      422,
      'DEPARTMENT_NOT_ACCEPTING',
      'هذا التخصص لا يستقبل طلبات جديدة حاليًا. اختر تخصصًا آخر من القائمة.'
    );
  }

  // Basic duplicate protection: same guardian phone + department within the
  // window. The guardian phone is the primary contact number.
  const duplicate = db.get(
    `SELECT reference_number FROM applications
      WHERE guardian_phone = ? AND department_id = ?
        AND submitted_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)
      LIMIT 1`,
    [payload.guardian_phone, department.id, `-${DUPLICATE_WINDOW_HOURS} hours`]
  );

  if (duplicate) {
    // Do not echo the previous reference number: it would let anyone who
    // knows a phone number confirm the existence of someone else's
    // application and learn its identifier.
    throw HttpError.conflict(
      'DUPLICATE_APPLICATION',
      `يوجد طلب مسجل بنفس رقم هاتف ولي الأمر لهذا التخصص خلال آخر ${DUPLICATE_WINDOW_HOURS} ساعة.`
    );
  }

  const documents = Array.isArray(payload.documents) ? payload.documents : [];

  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = generateReferenceNumber();
    try {
      const row = db.transaction(() => {
        const result = db.run(
          `INSERT INTO applications
             (reference_number, full_name, phone, email, department_id,
              department_name_snapshot, previous_education, additional_notes,
              date_of_birth, gender, national_id, governorate,
              educational_administration, guardian_name, guardian_relation,
              guardian_phone, address_governorate, address_center, address_city,
              preparatory_score, status, is_demo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 0)`,
          [
            reference,
            payload.full_name,
            payload.phone || '',
            payload.email || '',
            department.id,
            department.name,
            payload.previous_education || '',
            payload.additional_notes || '',
            payload.date_of_birth || '',
            payload.gender || '',
            payload.national_id || '',
            payload.governorate || '',
            payload.educational_administration || '',
            payload.guardian_name || '',
            payload.guardian_relation || '',
            payload.guardian_phone || '',
            payload.address_governorate || '',
            payload.address_center || '',
            payload.address_city || '',
            payload.preparatory_score || '',
          ]
        );
        const applicationId = Number(result.lastInsertRowid);

        for (const document of documents) {
          db.run(
            `INSERT INTO application_documents
               (application_id, kind, original_name, stored_name, mime_type, size_bytes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              applicationId,
              document.kind,
              document.original_name || '',
              document.stored_name,
              document.mime_type,
              Number(document.size_bytes) || 0,
            ]
          );
        }

        return db.get('SELECT * FROM applications WHERE id = ?', [applicationId]);
      });

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
    where.push(
      '(a.full_name LIKE ? ESCAPE \'\\\' OR a.reference_number LIKE ? ESCAPE \'\\\' OR a.guardian_name LIKE ? ESCAPE \'\\\' OR a.guardian_phone LIKE ? ESCAPE \'\\\')'
    );
    const like = `%${escapeLike(q)}%`;
    params.push(like, like, like, like);
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
  return mapApplication(row, { includeDocuments: true, ...options });
}

function getDocument(applicationId, documentId) {
  return db.get(
    `SELECT id, application_id, kind, original_name, stored_name, mime_type, size_bytes
       FROM application_documents
      WHERE id = ? AND application_id = ?`,
    [documentId, applicationId]
  );
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
 * explicit typed confirmation before calling this endpoint. Stored documents
 * are removed from disk as well.
 */
function remove(id) {
  const application = db.get('SELECT id, reference_number, is_demo FROM applications WHERE id = ?', [id]);
  if (!application) throw HttpError.notFound('الطلب غير موجود.');

  const documents = db.all(
    'SELECT stored_name FROM application_documents WHERE application_id = ?',
    [id]
  );

  db.run('DELETE FROM applications WHERE id = ?', [id]);
  for (const document of documents) {
    applicationDocuments.removeStoredFile(document.stored_name);
  }

  return {
    id,
    reference_number: application.reference_number,
    was_demo: Boolean(application.is_demo),
  };
}

/**
 * Escape a value for CSV (Excel-friendly, quotes doubled).
 *
 * Quoting alone does not stop spreadsheet formula injection: Excel/Sheets
 * still evaluate a cell whose text begins with =, +, -, @, tab or CR. Such
 * values are prefixed with an apostrophe so they are treated as literal text.
 */
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const header = [
    'رقم الطلب',
    'الاسم الكامل',
    'تاريخ الميلاد',
    'النوع',
    'الرقم القومي / الهوية',
    'المحافظة',
    'الإدارة التعليمية',
    'اسم ولي الأمر',
    'صلة القرابة',
    'هاتف ولي الأمر',
    'هاتف إضافي',
    'البريد الإلكتروني',
    'محافظة العنوان',
    'المركز',
    'المدينة / القرية',
    'التخصص',
    'المجموع / النسبة',
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
        row.date_of_birth,
        row.gender_label,
        row.national_id,
        row.governorate,
        row.educational_administration,
        row.guardian_name,
        row.guardian_relation_label,
        row.guardian_phone,
        row.phone,
        row.email,
        row.address_governorate,
        row.address_center,
        row.address_city,
        row.department_name,
        row.preparatory_score,
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
  GENDER_LABELS,
  GUARDIAN_RELATION_LABELS,
  DOCUMENT_KIND_LABELS,
  DUPLICATE_WINDOW_HOURS,
  create,
  listAdmin,
  getById,
  getDocument,
  updateStatus,
  updateNotes,
  remove,
  toCsv,
  listForExport,
  recent,
};
