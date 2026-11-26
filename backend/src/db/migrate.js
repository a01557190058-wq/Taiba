'use strict';

/**
 * Applies database/schema.sql. The schema is written with `IF NOT EXISTS`
 * guards so this is safe to run repeatedly; applied versions are recorded in
 * `schema_migrations` to leave room for future incremental migrations.
 *
 * SQLite cannot add columns through `CREATE TABLE IF NOT EXISTS`, so the
 * admission-form columns introduced after the first release are added here for
 * databases created by an older version. Fresh databases already contain them
 * in schema.sql and the checks below simply do nothing.
 */
const fs = require('node:fs');
const config = require('../config');
const db = require('./index');

const INITIAL_VERSION = '001_initial';
const APPLICATION_DETAILS_VERSION = '002_application_details';
const SUBJECT_GRADE_DEPARTMENT_VERSION = '003_subject_grade_department';
const SUBJECT_WEEKLY_PERIODS_VERSION = '004_subject_weekly_periods';
const DEPARTMENT_STUDENTS_VERSION = '005_department_students';
const CONTENT_REFRESH_VERSION = '006_school_content_refresh';
const GALLERY_CATEGORIES_VERSION = '007_gallery_categories';

// Text introduced after the first release. Existing databases keep any value
// an administrator has customised; only the old seeded wording is replaced.
const LEGACY_CONTENT = {
  vision:
    'أن يكون مجمع تقني نموذجية في التعليم التطبيقي، يُخرّج كوادر قادرة على حل المشكلات التقنية والعمل ضمن فرق متعددة التخصصات.',
  mission:
    'تقديم تعليم تقني متوازن يجمع بين المعرفة النظرية والتدريب العملي، وبناء بيئة تعليمية آمنة ومحفزة، وتنمية مهارات التواصل والعمل الجماعي والمسؤولية المهنية لدى الطلاب.',
};

// Columns added to `applications` after the initial schema. They are all
// nullable text with an empty-string default so existing rows stay valid.
const APPLICATION_COLUMNS = [
  ['date_of_birth', "TEXT NOT NULL DEFAULT ''"],
  ['gender', "TEXT NOT NULL DEFAULT ''"],
  ['national_id', "TEXT NOT NULL DEFAULT ''"],
  ['governorate', "TEXT NOT NULL DEFAULT ''"],
  ['educational_administration', "TEXT NOT NULL DEFAULT ''"],
  ['guardian_name', "TEXT NOT NULL DEFAULT ''"],
  ['guardian_relation', "TEXT NOT NULL DEFAULT ''"],
  ['guardian_phone', "TEXT NOT NULL DEFAULT ''"],
  ['address_governorate', "TEXT NOT NULL DEFAULT ''"],
  ['address_center', "TEXT NOT NULL DEFAULT ''"],
  ['address_city', "TEXT NOT NULL DEFAULT ''"],
  ['preparatory_score', "TEXT NOT NULL DEFAULT ''"],
];

function tableColumns(table) {
  return new Set(db.all(`PRAGMA table_info(${table})`).map((row) => row.name));
}

function tableExists(table) {
  return Boolean(
    db.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", [table])
  );
}

function addMissingApplicationColumns() {
  const existing = tableColumns('applications');
  for (const [name, definition] of APPLICATION_COLUMNS) {
    if (existing.has(name)) continue;
    // The table and column names come from the constant list above, never
    // from user input.
    db.exec(`ALTER TABLE applications ADD COLUMN ${name} ${definition};`);
  }
}

// Columns added to `subjects` after the first release: the school grade and
// the optional department link. A NULL department means "general subject".
const SUBJECT_COLUMNS = [
  ['grade', "TEXT NOT NULL DEFAULT 'first'"],
  ['department_id', 'INTEGER REFERENCES departments(id) ON DELETE SET NULL ON UPDATE CASCADE'],
  ['weekly_periods', 'INTEGER NOT NULL DEFAULT 0'],
];

function addMissingSubjectColumns() {
  const existing = tableColumns('subjects');
  for (const [name, definition] of SUBJECT_COLUMNS) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE subjects ADD COLUMN ${name} ${definition};`);
  }
}

// Admin-managed headcount added after the first release. The total is derived
// from these two columns instead of being stored, so it cannot drift.
const DEPARTMENT_STUDENT_COLUMNS = [
  ['students_male', 'INTEGER NOT NULL DEFAULT 0 CHECK (students_male >= 0)'],
  ['students_female', 'INTEGER NOT NULL DEFAULT 0 CHECK (students_female >= 0)'],
];

function addMissingDepartmentStudentColumns() {
  const existing = tableColumns('departments');
  for (const [name, definition] of DEPARTMENT_STUDENT_COLUMNS) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE departments ADD COLUMN ${name} ${definition};`);
  }
}

/**
 * Refreshes school text on databases seeded by an older release. Values that
 * differ from the old seed are treated as administrator edits and preserved.
 */
function refreshSchoolContent() {
  // Required lazily so the service sees the final schema and DB configuration.
  const { DEFAULT_CONTENT } = require('../services/content.service');

  for (const key of ['vision', 'mission']) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONTENT, key)) continue;
    const current = db.get('SELECT content_value FROM school_content WHERE content_key = ?', [key]);
    if (!current) {
      db.run(
        `INSERT INTO school_content (content_key, content_value, updated_at)
         VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        [key, DEFAULT_CONTENT[key]]
      );
    } else if (current.content_value === LEGACY_CONTENT[key]) {
      db.run(
        `UPDATE school_content SET content_value = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE content_key = ?`,
        [DEFAULT_CONTENT[key], key]
      );
    }
  }

  const accreditation = db.get(
    'SELECT content_value FROM school_content WHERE content_key = ?',
    ['accreditation']
  );
  if (!accreditation || !String(accreditation.content_value || '').trim()) {
    db.run(
      `INSERT INTO school_content (content_key, content_value, updated_at)
       VALUES ('accreditation', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT (content_key) DO UPDATE SET
         content_value = excluded.content_value,
         updated_at = excluded.updated_at`,
      [DEFAULT_CONTENT.accreditation]
    );
  }
}

function migrate({ silent = false } = {}) {
  const sql = fs.readFileSync(config.paths.schema, 'utf8');

  // Remember whether this was already an installed gallery before schema.sql
  // creates the tables. Fresh databases must let the normal demo seeder create
  // every section in one pass instead of introducing categories here.
  const hadGallery =
    tableExists('gallery_sections') &&
    Boolean(db.get('SELECT COUNT(*) AS count FROM gallery_sections')?.count);

  db.exec('PRAGMA foreign_keys = ON;');

  // Databases created by an older release already have an `applications`
  // table without the admission columns. Add them *before* running
  // schema.sql, because the schema creates indexes that reference those
  // columns and would otherwise fail on the old table.
  if (tableExists('applications')) {
    addMissingApplicationColumns();
  }
  if (tableExists('subjects')) {
    addMissingSubjectColumns();
  }
  if (tableExists('departments')) {
    addMissingDepartmentStudentColumns();
  }

  db.exec(sql);

  // Fresh databases already include the columns in schema.sql; this is a
  // no-op there and a safety net for anything created in between.
  addMissingApplicationColumns();
  addMissingSubjectColumns();
  addMissingDepartmentStudentColumns();

  const existing = db.get('SELECT version FROM schema_migrations WHERE version = ?', [INITIAL_VERSION]);
  if (!existing) {
    db.run('INSERT INTO schema_migrations (version) VALUES (?)', [INITIAL_VERSION]);
  }

  const details = db.get('SELECT version FROM schema_migrations WHERE version = ?', [
    APPLICATION_DETAILS_VERSION,
  ]);
  if (!details) {
    db.run('INSERT INTO schema_migrations (version) VALUES (?)', [APPLICATION_DETAILS_VERSION]);
  }

  const subjectDetails = db.get('SELECT version FROM schema_migrations WHERE version = ?', [
    SUBJECT_GRADE_DEPARTMENT_VERSION,
  ]);
  if (!subjectDetails) {
    db.run('INSERT INTO schema_migrations (version) VALUES (?)', [SUBJECT_GRADE_DEPARTMENT_VERSION]);
  }

  const weeklyPeriods = db.get('SELECT version FROM schema_migrations WHERE version = ?', [
    SUBJECT_WEEKLY_PERIODS_VERSION,
  ]);
  if (!weeklyPeriods) {
    db.run('INSERT INTO schema_migrations (version) VALUES (?)', [SUBJECT_WEEKLY_PERIODS_VERSION]);
  }

  const departmentStudents = db.get('SELECT version FROM schema_migrations WHERE version = ?', [
    DEPARTMENT_STUDENTS_VERSION,
  ]);
  if (!departmentStudents) {
    db.run('INSERT INTO schema_migrations (version) VALUES (?)', [DEPARTMENT_STUDENTS_VERSION]);
  }

  const contentRefresh = db.get('SELECT version FROM schema_migrations WHERE version = ?', [
    CONTENT_REFRESH_VERSION,
  ]);
  if (!contentRefresh) {
    refreshSchoolContent();
    db.run('INSERT INTO schema_migrations (version) VALUES (?)', [CONTENT_REFRESH_VERSION]);
  }

  const galleryCategories = db.get('SELECT version FROM schema_migrations WHERE version = ?', [
    GALLERY_CATEGORIES_VERSION,
  ]);
  if (!galleryCategories) {
    if (hadGallery) {
      const { seedMissingSections } = require('../services/gallery.service');
      seedMissingSections();
    }
    db.run('INSERT INTO schema_migrations (version) VALUES (?)', [GALLERY_CATEGORIES_VERSION]);
  }

  if (!silent) {
    // eslint-disable-next-line no-console
    console.log(`[db] schema ready (${config.paths.db})`);
  }
  return { path: config.paths.db };
}

module.exports = {
  migrate,
  INITIAL_VERSION,
  APPLICATION_DETAILS_VERSION,
  SUBJECT_GRADE_DEPARTMENT_VERSION,
  SUBJECT_WEEKLY_PERIODS_VERSION,
  DEPARTMENT_STUDENTS_VERSION,
  CONTENT_REFRESH_VERSION,
  GALLERY_CATEGORIES_VERSION,
};
