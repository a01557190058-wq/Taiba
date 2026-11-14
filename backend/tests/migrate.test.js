'use strict';

/**
 * Regression test for upgrading a database created by an older release.
 *
 * `schema.sql` creates an index on `applications.guardian_phone`, so the new
 * columns must be added *before* the schema is executed. This test builds a
 * minimal "old" database (no admission columns), runs the real migration in a
 * child process and checks the result.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const DB_PATH = path.join(
  os.tmpdir(),
  `taiba-migrate-test-${process.pid}-${Date.now()}.sqlite`
);
const BACKEND_ROOT = path.join(__dirname, '..');

const CHILD_SCRIPT = `
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DB_PATH;
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  try { fs.rmSync(dbPath + suffix, { force: true }); } catch {}
}

const old = new DatabaseSync(dbPath);
old.exec(\`
  CREATE TABLE applications (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_number         TEXT NOT NULL UNIQUE,
    full_name                TEXT NOT NULL,
    phone                    TEXT NOT NULL DEFAULT '',
    email                    TEXT NOT NULL DEFAULT '',
    department_id            INTEGER NOT NULL,
    department_name_snapshot TEXT NOT NULL,
    previous_education       TEXT NOT NULL DEFAULT '',
    additional_notes         TEXT NOT NULL DEFAULT '',
    status                   TEXT NOT NULL DEFAULT 'NEW',
    admin_notes              TEXT NOT NULL DEFAULT '',
    is_demo                  INTEGER NOT NULL DEFAULT 0,
    submitted_at             TEXT NOT NULL DEFAULT '',
    updated_at               TEXT NOT NULL DEFAULT ''
  );
  INSERT INTO applications
    (reference_number, full_name, department_id, department_name_snapshot)
  VALUES ('OLD-1', 'طالب قديم', 1, 'تخصص قديم');
\`);
old.close();

const { migrate } = require('./src/db/migrate');
migrate({ silent: true });

const db = require('./src/db');
const columns = db.all('PRAGMA table_info(applications)').map((row) => row.name);
const row = db.get(
  'SELECT reference_number, guardian_phone, preparatory_score FROM applications WHERE reference_number = ?',
  ['OLD-1']
);
const hasDocuments = Boolean(
  db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'application_documents'")
);
const hasIndex = Boolean(
  db.get(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_applications_guardian_phone'"
  )
);
db.closeDatabase();
console.log(JSON.stringify({ columns, row, hasDocuments, hasIndex }));
`;

function removeDbFiles() {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
  }
}

test('migrating an old database adds the admission columns before schema indexes', () => {
  removeDbFiles();
  const result = spawnSync(process.execPath, ['-e', CHILD_SCRIPT], {
    cwd: BACKEND_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_PATH,
      SESSION_SECRET: 'migration-test-secret-that-is-long-enough-0123456789',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `migration child failed:\n${result.stderr || result.stdout}`);

  const output = result.stdout.trim().split('\n').filter(Boolean).pop();
  const summary = JSON.parse(output);

  for (const column of [
    'date_of_birth',
    'gender',
    'national_id',
    'governorate',
    'educational_administration',
    'guardian_name',
    'guardian_relation',
    'guardian_phone',
    'address_governorate',
    'address_center',
    'address_city',
    'preparatory_score',
  ]) {
    assert.ok(summary.columns.includes(column), `missing migrated column: ${column}`);
  }

  assert.deepEqual(summary.row, {
    reference_number: 'OLD-1',
    guardian_phone: '',
    preparatory_score: '',
  });
  assert.equal(summary.hasDocuments, true);
  assert.equal(summary.hasIndex, true);
});

after(removeDbFiles);
