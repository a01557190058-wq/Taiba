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
];

function addMissingSubjectColumns() {
  const existing = tableColumns('subjects');
  for (const [name, definition] of SUBJECT_COLUMNS) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE subjects ADD COLUMN ${name} ${definition};`);
  }
}

function migrate({ silent = false } = {}) {
  const sql = fs.readFileSync(config.paths.schema, 'utf8');

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

  db.exec(sql);

  // Fresh databases already include the columns in schema.sql; this is a
  // no-op there and a safety net for anything created in between.
  addMissingApplicationColumns();
  addMissingSubjectColumns();

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
};
