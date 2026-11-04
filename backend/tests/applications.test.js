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

test('a student can submit an application and receives a reference number', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, {
    full_name: 'ليلى محمود',
    phone: '01012345678',
    email: 'laila@example.com',
  });

  assert.equal(res.status, 201);
  const data = res.body.data;
  assert.match(data.reference_number, /^TBS-\d{4}-[A-Z2-9]{6}$/);
  assert.equal(data.status, 'NEW');
  assert.equal(data.status_label, 'جديد');
  assert.ok(data.department_name);
  assert.ok(data.message.includes('لا يعني القبول'));

  // Public response must never expose internal fields.
  assert.equal(data.admin_notes, undefined);
  assert.equal(data.id, undefined);
  assert.equal(data.is_demo, undefined);

  const row = db.get('SELECT * FROM applications WHERE reference_number = ?', [data.reference_number]);
  assert.ok(row, 'application must be persisted');
  assert.equal(row.is_demo, 0);
  assert.equal(row.status, 'NEW');
});

test('submitted applications appear in the admin dashboard listing', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, {
    full_name: 'ياسمين فؤاد',
    phone: '01098765432',
  });
  assert.equal(created.status, 201);
  const reference = created.body.data.reference_number;

  const { agent: admin } = await adminAgent();
  const list = await admin.get('/api/admin/applications?q=' + encodeURIComponent(reference));
  assert.equal(list.status, 200);
  assert.equal(list.body.meta.total, 1);
  assert.equal(list.body.data[0].reference_number, reference);
  assert.equal(list.body.data[0].admin_notes, undefined, 'notes are omitted from the list');

  const searchByName = await admin.get('/api/admin/applications?q=' + encodeURIComponent('ياسمين'));
  assert.equal(searchByName.body.meta.total, 1);

  const stats = await admin.get('/api/admin/dashboard/stats');
  assert.ok(stats.body.data.applications.total >= 1);
});

test('server-side validation rejects invalid payloads with Arabic field errors', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, {
    full_name: 'ا',
    phone: '12',
    email: 'not-an-email',
    consent: false,
    department_id: 0,
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  for (const field of ['full_name', 'phone', 'email', 'consent', 'department_id']) {
    assert.ok(res.body.error.fields[field], `expected an error for ${field}`);
  }
});

test('the consent checkbox is mandatory', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { consent: undefined });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.fields.consent);
});

test('phone numbers accept Arabic-Indic digits and are normalised', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { phone: '٠١٠١٢٣٤٥٦٧٨' });
  assert.equal(res.status, 201);
  const row = db.get('SELECT phone FROM applications WHERE reference_number = ?', [
    res.body.data.reference_number,
  ]);
  assert.equal(row.phone, '01012345678');
});

test('an unknown department is rejected', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { department_id: 999999 });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'DEPARTMENT_UNAVAILABLE');
});

test('an unpublished department cannot receive applications', async () => {
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 LIMIT 1');
  db.run('UPDATE departments SET is_published = 0 WHERE id = ?', [department.id]);

  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { department_id: department.id });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'DEPARTMENT_NOT_ACCEPTING');
});

test('an archived department cannot receive applications', async () => {
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 LIMIT 1');
  db.run('UPDATE departments SET is_active = 0 WHERE id = ?', [department.id]);

  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { department_id: department.id });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'DEPARTMENT_NOT_ACCEPTING');
});

test('obvious duplicate submissions are rejected', async () => {
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 LIMIT 1');
  const { agent, token } = await anonymousAgent();
  const payload = { phone: '01555555555', department_id: department.id };

  const first = await submitApplication(agent, token, payload);
  assert.equal(first.status, 201);

  const second = await submitApplication(agent, token, payload);
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'DUPLICATE_APPLICATION');
  assert.ok(second.body.error.message.includes(first.body.data.reference_number));
});

test('the same phone can apply to a different department', async () => {
  const departments = db.all('SELECT id FROM departments WHERE is_published = 1 LIMIT 2');
  const { agent, token } = await anonymousAgent();

  const first = await submitApplication(agent, token, {
    phone: '01555555556',
    department_id: departments[0].id,
  });
  const second = await submitApplication(agent, token, {
    phone: '01555555556',
    department_id: departments[1].id,
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
});

test('application submission without CSRF token is rejected', async () => {
  const { agent } = await anonymousAgent();
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 LIMIT 1');
  const res = await agent.post('/api/applications').send({
    full_name: 'طالب بلا رمز',
    phone: '01000000099',
    department_id: department.id,
    consent: true,
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'CSRF_TOKEN_INVALID');
});

test('administrators can change an application status', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, { phone: '01234567890' });
  const id = db.get('SELECT id FROM applications WHERE reference_number = ?', [
    created.body.data.reference_number,
  ]).id;

  const { agent: admin, token: adminToken } = await adminAgent();
  const res = await admin
    .patch(`/api/admin/applications/${id}/status`)
    .set('x-csrf-token', adminToken)
    .send({ status: 'UNDER_REVIEW' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'UNDER_REVIEW');
  assert.equal(res.body.data.status_label, 'قيد المراجعة');

  const detail = await admin.get(`/api/admin/applications/${id}`);
  assert.equal(detail.body.data.status, 'UNDER_REVIEW');

  const invalid = await admin
    .patch(`/api/admin/applications/${id}/status`)
    .set('x-csrf-token', adminToken)
    .send({ status: 'MAYBE' });
  assert.equal(invalid.status, 400);

  const missing = await admin
    .patch('/api/admin/applications/999999/status')
    .set('x-csrf-token', adminToken)
    .send({ status: 'ACCEPTED' });
  assert.equal(missing.status, 404);
});

test('internal administrative notes are private', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, { phone: '01234567891' });
  const id = db.get('SELECT id FROM applications WHERE reference_number = ?', [
    created.body.data.reference_number,
  ]).id;

  const { agent: admin, token: adminToken } = await adminAgent();
  const saved = await admin
    .patch(`/api/admin/applications/${id}/notes`)
    .set('x-csrf-token', adminToken)
    .send({ admin_notes: 'ملاحظة داخلية سرية' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.admin_notes, 'ملاحظة داخلية سرية');
  assert.equal(saved.body.data.has_admin_notes, true);

  // Public endpoints never expose application records at all.
  const publicList = await agent.get('/api/departments');
  assert.equal(JSON.stringify(publicList.body).includes('ملاحظة داخلية سرية'), false);
  const publicContent = await agent.get('/api/school-content');
  assert.equal(JSON.stringify(publicContent.body).includes('ملاحظة داخلية سرية'), false);

  // Anonymous callers cannot read the admin detail endpoint.
  const anonymousDetail = await agent.get(`/api/admin/applications/${id}`);
  assert.equal(anonymousDetail.status, 401);
});

test('applications can be filtered by status and department, and paginated', async () => {
  const departments = db.all('SELECT id FROM departments WHERE is_published = 1 LIMIT 2');
  const { agent, token } = await anonymousAgent();

  for (let index = 0; index < 3; index += 1) {
    const res = await submitApplication(agent, token, {
      phone: `0100000100${index}`,
      department_id: departments[0].id,
    });
    assert.equal(res.status, 201);
  }
  const other = await submitApplication(agent, token, {
    phone: '01000001009',
    department_id: departments[1].id,
  });
  assert.equal(other.status, 201);

  const { agent: admin } = await adminAgent();

  const page1 = await admin.get('/api/admin/applications?page=1&limit=2');
  assert.equal(page1.body.meta.limit, 2);
  assert.equal(page1.body.data.length, 2);
  assert.ok(page1.body.meta.total >= 4);
  assert.equal(page1.body.meta.hasNext, true);

  const page2 = await admin.get('/api/admin/applications?page=2&limit=2');
  assert.equal(page2.body.meta.page, 2);
  assert.notEqual(page1.body.data[0].id, page2.body.data[0].id);

  const byDepartment = await admin.get(
    `/api/admin/applications?department_id=${departments[1].id}`
  );
  assert.equal(byDepartment.body.meta.total, 1);
  assert.equal(byDepartment.body.data[0].department_id, departments[1].id);

  const byStatus = await admin.get('/api/admin/applications?status=NEW');
  assert.ok(byStatus.body.meta.total >= 4);
  assert.ok(byStatus.body.data.every((row) => row.status === 'NEW'));

  const sorted = await admin.get('/api/admin/applications?sort=oldest');
  assert.equal(sorted.status, 200);
});

test('administrators can delete any application, demo or real', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, { phone: '01234567892' });
  const realId = db.get('SELECT id FROM applications WHERE reference_number = ?', [
    created.body.data.reference_number,
  ]).id;
  const demo = db.get('SELECT id FROM applications WHERE is_demo = 1 LIMIT 1');

  const { agent: admin, token: adminToken } = await adminAgent();

  const realDelete = await admin.delete(`/api/admin/applications/${realId}`).set('x-csrf-token', adminToken);
  assert.equal(realDelete.status, 200);
  assert.equal(realDelete.body.data.id, realId);
  assert.equal(realDelete.body.data.was_demo, false);
  assert.equal(db.get('SELECT id FROM applications WHERE id = ?', [realId]), undefined);

  const demoDelete = await admin.delete(`/api/admin/applications/${demo.id}`).set('x-csrf-token', adminToken);
  assert.equal(demoDelete.status, 200);
  assert.equal(demoDelete.body.data.was_demo, true);
  assert.equal(db.get('SELECT id FROM applications WHERE id = ?', [demo.id]), undefined);
});

test('CSV export is protected and contains the application', async () => {
  const { agent: admin, token } = await adminAgent();
  const res = await admin.get('/api/admin/applications/export.csv');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.headers['content-disposition'], /attachment/);
  assert.ok(res.text.startsWith('\uFEFF'), 'CSV must start with a UTF-8 BOM for Excel');
  assert.ok(res.text.includes('DEMO-2026-0001'));

  const { agent: anonymous } = await anonymousAgent();
  const denied = await anonymous.get('/api/admin/applications/export.csv');
  assert.equal(denied.status, 401);
});

after(() => db.closeDatabase());
