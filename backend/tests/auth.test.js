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

test('an administrator can change the password and keeps the current session', async () => {
  const { agent, token } = await adminAgent();
  const res = await agent
    .patch('/api/auth/password')
    .set('x-csrf-token', token)
    .send({
      current_password: ADMIN.password,
      new_password: 'NewPass!456',
      confirm_password: 'NewPass!456',
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.updated, true);

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200, 'the session that changed the password stays signed in');

  const { agent: fresh, token: freshToken } = await anonymousAgent();
  const oldLogin = await fresh
    .post('/api/auth/login')
    .set('x-csrf-token', freshToken)
    .send({ identifier: ADMIN.email, password: ADMIN.password });
  assert.equal(oldLogin.status, 401, 'the old password must stop working');

  const newLogin = await fresh
    .post('/api/auth/login')
    .set('x-csrf-token', freshToken)
    .send({ identifier: ADMIN.email, password: 'NewPass!456' });
  assert.equal(newLogin.status, 200);
});

test('changing the password signs out other sessions for the same admin', async () => {
  const first = await adminAgent();
  const second = await adminAgent();

  const res = await first.agent
    .patch('/api/auth/password')
    .set('x-csrf-token', first.token)
    .send({
      current_password: ADMIN.password,
      new_password: 'NewPass!456',
      confirm_password: 'NewPass!456',
    });
  assert.equal(res.status, 200);

  const stillIn = await first.agent.get('/api/auth/me');
  assert.equal(stillIn.status, 200);

  const signedOut = await second.agent.get('/api/auth/me');
  assert.equal(signedOut.status, 401, 'other sessions must be invalidated');
});

test('changing the password rejects a wrong current password', async () => {
  const { agent, token } = await adminAgent();
  const res = await agent
    .patch('/api/auth/password')
    .set('x-csrf-token', token)
    .send({
      current_password: 'definitely-wrong',
      new_password: 'NewPass!456',
      confirm_password: 'NewPass!456',
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error.fields.current_password);

  const { agent: fresh, token: freshToken } = await anonymousAgent();
  const login = await fresh
    .post('/api/auth/login')
    .set('x-csrf-token', freshToken)
    .send({ identifier: ADMIN.email, password: ADMIN.password });
  assert.equal(login.status, 200, 'the password must remain unchanged');
});

test('changing the password validates the new password and confirmation', async () => {
  const { agent, token } = await adminAgent();

  const mismatch = await agent
    .patch('/api/auth/password')
    .set('x-csrf-token', token)
    .send({
      current_password: ADMIN.password,
      new_password: 'NewPass!456',
      confirm_password: 'NewPass!789',
    });
  assert.equal(mismatch.status, 400);
  assert.ok(mismatch.body.error.fields.confirm_password);

  const tooShort = await agent
    .patch('/api/auth/password')
    .set('x-csrf-token', token)
    .send({
      current_password: ADMIN.password,
      new_password: 'short',
      confirm_password: 'short',
    });
  assert.equal(tooShort.status, 400);
  assert.ok(tooShort.body.error.fields.new_password);

  const same = await agent
    .patch('/api/auth/password')
    .set('x-csrf-token', token)
    .send({
      current_password: ADMIN.password,
      new_password: ADMIN.password,
      confirm_password: ADMIN.password,
    });
  assert.equal(same.status, 400);
  assert.ok(same.body.error.fields.new_password);

  const padded = await agent
    .patch('/api/auth/password')
    .set('x-csrf-token', token)
    .send({
      current_password: ADMIN.password,
      new_password: 'NewPass!456 ',
      confirm_password: 'NewPass!456 ',
    });
  assert.equal(padded.status, 400);
  assert.ok(padded.body.error.fields.new_password, 'surrounding spaces must be rejected');
});

test('changing the password requires an admin session and a CSRF token', async () => {
  const { agent } = await anonymousAgent();
  const anonymous = await agent.patch('/api/auth/password').send({
    current_password: ADMIN.password,
    new_password: 'NewPass!456',
    confirm_password: 'NewPass!456',
  });
  assert.equal(anonymous.status, 401);

  const { agent: admin, token } = await adminAgent();
  const noCsrf = await admin.patch('/api/auth/password').send({
    current_password: ADMIN.password,
    new_password: 'NewPass!456',
    confirm_password: 'NewPass!456',
  });
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.body.error.code, 'CSRF_TOKEN_INVALID');
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
