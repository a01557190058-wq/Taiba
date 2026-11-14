'use strict';

/**
 * Shared test harness.
 * - Uses an isolated temporary SQLite database per test file/process.
 * - Raises rate limits so functional tests are not throttled.
 * - Provides helpers for CSRF, admin login and DB resets.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(
  os.tmpdir(),
  `taiba-test-${process.pid}-${crypto.randomBytes(4).toString('hex')}.sqlite`
);

// Uploaded news images are written outside the project during tests.
const UPLOADS_DIR = path.join(
  os.tmpdir(),
  `taiba-test-uploads-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
);

// Gallery photos use a separate folder, also outside the project.
const GALLERY_UPLOADS_DIR = path.join(
  os.tmpdir(),
  `taiba-test-gallery-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
);

// Department covers/photos use their own folder as well.
const DEPARTMENT_UPLOADS_DIR = path.join(
  os.tmpdir(),
  `taiba-test-departments-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
);

// Admission documents are private, so tests keep them in a separate temp dir.
const APPLICATION_UPLOADS_DIR = path.join(
  os.tmpdir(),
  `taiba-test-applications-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
);

process.env.NODE_ENV = 'test';
process.env.DB_PATH = DB_PATH;
process.env.NEWS_UPLOADS_DIR = UPLOADS_DIR;
process.env.GALLERY_UPLOADS_DIR = GALLERY_UPLOADS_DIR;
process.env.DEPARTMENT_UPLOADS_DIR = DEPARTMENT_UPLOADS_DIR;
process.env.APPLICATION_UPLOADS_DIR = APPLICATION_UPLOADS_DIR;
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough-0123456789';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
process.env.APPLICATION_RATE_LIMIT_MAX = '1000';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_EMAIL = 'admin@test.demo';
process.env.ADMIN_PASSWORD = 'TestPass!123';

const request = require('supertest');
const config = require('../src/config');
const db = require('../src/db');
const { migrate } = require('../src/db/migrate');
const { seedDemoData } = require('../src/services/demo.service');
const { createApp } = require('../src/app');

const ADMIN = {
  username: 'admin',
  email: 'admin@test.demo',
  password: 'TestPass!123',
};

function removeDatabaseFiles() {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const file = `${DB_PATH}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }
}

function removeUploadsDir() {
  fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
  fs.rmSync(GALLERY_UPLOADS_DIR, { recursive: true, force: true });
  fs.rmSync(DEPARTMENT_UPLOADS_DIR, { recursive: true, force: true });
  fs.rmSync(APPLICATION_UPLOADS_DIR, { recursive: true, force: true });
}

function insertAdmin() {
  db.run('DELETE FROM admins');
  db.run(
    'INSERT INTO admins (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [ADMIN.username, ADMIN.email, bcrypt.hashSync(ADMIN.password, 4), 'مدير الاختبار']
  );
}

/** Wipe and re-seed the database for a deterministic test. */
function resetDatabase({ seed = true } = {}) {
  db.closeDatabase();
  removeDatabaseFiles();
  removeUploadsDir();
  migrate({ silent: true });
  if (seed) seedDemoData();
  insertAdmin();
}

resetDatabase();
const app = createApp();

/** Read the CSRF cookie issued by the server. */
async function getCsrf(agent) {
  const res = await agent.get('/api/health');
  const cookies = res.headers['set-cookie'] || [];
  const cookie = cookies.find((value) => value.startsWith(`${config.csrf.cookieName}=`));
  if (!cookie) throw new Error('CSRF cookie was not issued');
  return decodeURIComponent(cookie.split(';')[0].split('=')[1]);
}

/** Anonymous agent with a valid CSRF token ready to use. */
async function anonymousAgent() {
  const agent = request.agent(app);
  const token = await getCsrf(agent);
  return { agent, token };
}

/** Logged-in administrator agent. */
async function adminAgent() {
  const { agent, token } = await anonymousAgent();
  const res = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ identifier: ADMIN.email, password: ADMIN.password });
  if (res.status !== 200) {
    throw new Error(`Admin login failed in test setup: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, token, admin: res.body.data.admin };
}

/**
 * Tiny but structurally valid upload fixtures. Only the leading signature
 * bytes are sniffed by the server, so these are enough to exercise the real
 * multipart + content-checking path.
 */
const DOCUMENT_FIXTURES = {
  pdf: {
    buffer: Buffer.concat([
      Buffer.from('%PDF-1.4\n', 'latin1'),
      Buffer.from('1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1'),
    ]),
    filename: 'success-form.pdf',
    contentType: 'application/pdf',
  },
  png: {
    buffer: Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
    ]),
    filename: 'birth-certificate.png',
    contentType: 'image/png',
  },
  jpeg: {
    buffer: Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from([0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]),
    ]),
    filename: 'personal-photo.jpg',
    contentType: 'image/jpeg',
  },
};

const DEFAULT_DOCUMENTS = {
  success_form: DOCUMENT_FIXTURES.pdf,
  birth_certificate: DOCUMENT_FIXTURES.png,
  personal_photo: DOCUMENT_FIXTURES.jpeg,
};

let guardianPhoneCounter = 0;

/** A unique guardian phone per submission so unrelated tests never collide. */
function nextGuardianPhone() {
  guardianPhoneCounter += 1;
  return `0100000${String(guardianPhoneCounter).padStart(4, '0')}`;
}

/**
 * Submit an application as a public visitor using the real multipart endpoint.
 *
 * `overrides.documents` maps a document kind to a fixture (or `null` to omit
 * it). By default all three required documents are attached.
 */
async function submitApplication(agent, token, overrides = {}) {
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 AND is_active = 1 LIMIT 1');
  const { documents = DEFAULT_DOCUMENTS, ...fields } = overrides;

  const payload = {
    full_name: 'طالب اختبار',
    date_of_birth: '2009-01-15',
    gender: 'male',
    national_id: '30901150100099',
    governorate: 'القاهرة',
    educational_administration: 'إدارة اختبارية',
    guardian_name: 'ولي أمر اختباري',
    guardian_relation: 'father',
    guardian_phone: nextGuardianPhone(),
    phone: '01122334455',
    email: 'student@example.com',
    address_governorate: 'القاهرة',
    address_center: 'مركز اختباري',
    address_city: 'مدينة اختبارية',
    department_id: department.id,
    preparatory_score: '280',
    previous_education: 'الثانوية العامة',
    additional_notes: 'ملاحظة اختبارية',
    consent: true,
    ...fields,
  };

  let requestBuilder = agent.post('/api/applications').set('x-csrf-token', token);
  for (const [name, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    requestBuilder = requestBuilder.field(name, String(value));
  }
  for (const [kind, fixture] of Object.entries(documents)) {
    if (!fixture) continue;
    requestBuilder = requestBuilder.attach(kind, fixture.buffer, {
      filename: fixture.filename,
      contentType: fixture.contentType,
    });
  }
  return requestBuilder;
}

module.exports = {
  app,
  request,
  db,
  config,
  ADMIN,
  DB_PATH,
  UPLOADS_DIR,
  GALLERY_UPLOADS_DIR,
  DEPARTMENT_UPLOADS_DIR,
  APPLICATION_UPLOADS_DIR,
  DOCUMENT_FIXTURES,
  DEFAULT_DOCUMENTS,
  resetDatabase,
  getCsrf,
  anonymousAgent,
  adminAgent,
  submitApplication,
  removeDatabaseFiles,
  removeUploadsDir,
};
