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

process.env.NODE_ENV = 'test';
process.env.DB_PATH = DB_PATH;
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

/** Submit an application as a public visitor. Returns the supertest response. */
async function submitApplication(agent, token, overrides = {}) {
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 AND is_active = 1 LIMIT 1');
  return agent
    .post('/api/applications')
    .set('x-csrf-token', token)
    .send({
      full_name: 'طالب اختبار',
      phone: '01122334455',
      email: 'student@example.com',
      department_id: department.id,
      previous_education: 'الثانوية العامة',
      additional_notes: 'ملاحظة اختبارية',
      consent: true,
      ...overrides,
    });
}

module.exports = {
  app,
  request,
  db,
  config,
  ADMIN,
  DB_PATH,
  resetDatabase,
  getCsrf,
  anonymousAgent,
  adminAgent,
  submitApplication,
  removeDatabaseFiles,
};
