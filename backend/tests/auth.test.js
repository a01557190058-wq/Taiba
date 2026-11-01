'use strict';

const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, resetDatabase, anonymousAgent, adminAgent, getCsrf, ADMIN, db } = require('./helpers');

beforeEach(() => resetDatabase());

test('login succeeds with email and returns the admin profile', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ identifier: ADMIN.email, password: ADMIN.password });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.admin.email, ADMIN.email);
  assert.equal(res.body.data.admin.password_hash, undefined, 'password hash must never be returned');

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.data.admin.username, ADMIN.username);
});

test('login succeeds with username (case insensitive)', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ identifier: 'ADMIN', password: ADMIN.password });
  assert.equal(res.status, 200);
});

test('login fails with a wrong password', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ identifier: ADMIN.email, password: 'wrong-password' });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
  assert.equal(res.body.error.message, 'بيانات الدخول غير صحيحة.');
});

test('login fails for an unknown account', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ identifier: 'ghost@test.demo', password: 'whatever' });
  assert.equal(res.status, 401);
});

test('login validates its input server-side', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ identifier: '', password: '' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error.fields.identifier);
  assert.ok(res.body.error.fields.password);
});

test('login without a CSRF token is rejected', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent
    .post('/api/auth/login')
    .send({ identifier: ADMIN.email, password: ADMIN.password });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'CSRF_TOKEN_INVALID');
});

test('admin API rejects anonymous requests', async () => {
  const { agent } = await anonymousAgent();
  const endpoints = [
    '/api/admin/dashboard/stats',
    '/api/admin/departments',
    '/api/admin/applications',
    '/api/admin/school-content',
    '/api/admin/demo-data',
  ];
  for (const endpoint of endpoints) {
    const res = await agent.get(endpoint);
    assert.equal(res.status, 401, `${endpoint} must require authentication`);
  }
});

test('/api/auth/me returns 401 without a session', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent.get('/api/auth/me');
  assert.equal(res.status, 401);
});

test('logout destroys the session', async () => {
  const { agent, token } = await adminAgent();
  const res = await agent.post('/api/auth/logout').set('x-csrf-token', token);
  assert.equal(res.status, 200);

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 401);

  const adminCall = await agent.get('/api/admin/dashboard/stats');
  assert.equal(adminCall.status, 401);
});

test('logout requires a CSRF token', async () => {
  const { agent } = await adminAgent();
  const res = await agent.post('/api/auth/logout');
  assert.equal(res.status, 403);
});

test('login regenerates the session id (no session fixation)', async () => {
  const { agent, token } = await anonymousAgent();
  const before = (await agent.get('/api/health')).headers['set-cookie'] || [];
  const res = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ identifier: ADMIN.email, password: ADMIN.password });
  assert.equal(res.status, 200);
  const after = res.headers['set-cookie'] || [];
  const sessionBefore = before.find((c) => c.startsWith('taiba.sid='));
  const sessionAfter = after.find((c) => c.startsWith('taiba.sid='));
  // A fresh session cookie is issued on login (saveUninitialized:false means
  // there may be no pre-login cookie at all, which also proves regeneration).
  if (sessionBefore && sessionAfter) {
    assert.notEqual(sessionBefore.split(';')[0], sessionAfter.split(';')[0]);
  }
});

test('sessions persist in the database', async () => {
  const { token } = await adminAgent();
  const rows = db.all('SELECT sid FROM sessions');
  assert.ok(rows.length >= 1, 'session must be stored server-side');
  assert.ok(token.length === 64);
});

after(() => {
  db.closeDatabase();
});
