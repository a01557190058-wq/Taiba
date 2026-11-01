'use strict';

const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  db,
  resetDatabase,
  anonymousAgent,
  adminAgent,
  submitApplication,
} = require('./helpers');

beforeEach(() => resetDatabase());

test('dashboard statistics reflect the database', async () => {
  const { agent } = await adminAgent();
  const res = await agent.get('/api/admin/dashboard/stats');
  assert.equal(res.status, 200);

  const stats = res.body.data;
  assert.equal(stats.applications.total, 8);
  assert.equal(stats.applications.new, 3);
  assert.equal(stats.applications.under_review, 2);
  assert.equal(stats.applications.accepted, 2);
  assert.equal(stats.applications.rejected, 1);
  assert.equal(stats.applications.demo, 8);
  assert.equal(stats.applications.real, 0);
  assert.equal(stats.departments.total, 10);
  assert.equal(stats.departments.published, 10);
  assert.equal(stats.departments.demo, 10);
  assert.equal(stats.recent_applications.length, 5);
  assert.ok(stats.generated_at);
});

test('statistics change after a new application and a status update', async () => {
  const { agent: visitor, token } = await anonymousAgent();
  const created = await submitApplication(visitor, token, { phone: '01077778888' });
  assert.equal(created.status, 201);

  const { agent, token: adminToken } = await adminAgent();
  let stats = await agent.get('/api/admin/dashboard/stats');
  assert.equal(stats.body.data.applications.total, 9);
  assert.equal(stats.body.data.applications.new, 4);
  assert.equal(stats.body.data.applications.real, 1);

  const applicationId = db.get('SELECT id FROM applications WHERE is_demo = 0').id;
  const updated = await agent
    .patch(`/api/admin/applications/${applicationId}/status`)
    .set('x-csrf-token', adminToken)
    .send({ status: 'ACCEPTED' });
  assert.equal(updated.status, 200);

  stats = await agent.get('/api/admin/dashboard/stats');
  assert.equal(stats.body.data.applications.new, 3);
  assert.equal(stats.body.data.applications.accepted, 3);
  assert.equal(stats.body.data.applications.total, 9);
});

test('published department count follows publication state', async () => {
  const { agent, token } = await adminAgent();
  const department = db.get("SELECT id FROM departments WHERE slug = 'programming'");

  await agent
    .patch(`/api/admin/departments/${department.id}`)
    .set('x-csrf-token', token)
    .send({ is_published: false });

  const stats = await agent.get('/api/admin/dashboard/stats');
  assert.equal(stats.body.data.departments.published, 9);
  assert.equal(stats.body.data.departments.drafts, 1);
});

test('dashboard stats require authentication', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent.get('/api/admin/dashboard/stats');
  assert.equal(res.status, 401);
});

test('public endpoints do not expose student records', async () => {
  const { agent } = await anonymousAgent();
  const endpoints = [
    '/api/departments',
    '/api/school-content',
    '/api/health',
  ];
  for (const endpoint of endpoints) {
    const res = await agent.get(endpoint);
    const body = JSON.stringify(res.body);
    assert.equal(body.includes('DEMO-2026-0001'), false, `${endpoint} must not leak applications`);
    assert.equal(body.includes('01000000001'), false, `${endpoint} must not leak phone numbers`);
  }
});

after(() => db.closeDatabase());
