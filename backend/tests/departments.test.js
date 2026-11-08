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

const validDepartment = (overrides = {}) => ({
  name: 'قسم الروبوتات',
  short_description: 'مسار تجريبي لتعلم بناء وبرمجة الروبوتات التعليمية.',
  description:
    'قسم تجريبي يقدم أساسيات بناء الروبوتات وبرمجة المتحكمات الدقيقة، مع مشروعات عملية جماعية وتمارين معملية منتظمة.',
  educational_focus: 'المتحكمات الدقيقة، الحساسات، الميكانيكا التطبيقية.',
  skills: 'تجميع الروبوت\nبرمجة المتحكمات\nقراءة الحساسات',
  admission_info: 'لا يشترط خبرة سابقة.',
  image_url: '/assets/img/departments/programming.svg',
  is_published: true,
  sort_order: 11,
  ...overrides,
});

test('an administrator can create a department', async () => {
  const { agent, token } = await adminAgent();
  const res = await agent
    .post('/api/admin/departments')
    .set('x-csrf-token', token)
    .send(validDepartment());

  assert.equal(res.status, 201);
  const department = res.body.data;
  assert.equal(department.name, 'قسم الروبوتات');
  assert.equal(department.slug, 'قسم-الروبوتات');
  assert.equal(department.is_published, true);
  assert.equal(department.is_active, true);
  assert.equal(department.is_demo, false);
  assert.deepEqual(department.skills, [
    'تجميع الروبوت',
    'برمجة المتحكمات',
    'قراءة الحساسات',
  ]);
  assert.ok(department.created_at);
  assert.ok(department.updated_at);
});

test('created published departments appear on the public website', async () => {
  const { agent, token } = await adminAgent();
  const created = await agent
    .post('/api/admin/departments')
    .set('x-csrf-token', token)
    .send(validDepartment({ name: 'قسم الشبكات الذكية', slug: 'smart-networks' }));
  assert.equal(created.status, 201);

  const { agent: visitor } = await anonymousAgent();
  const list = await visitor.get('/api/departments');
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((item) => item.slug === 'smart-networks'));

  const detail = await visitor.get('/api/departments/smart-networks');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.name, 'قسم الشبكات الذكية');
  assert.ok(detail.body.data.description.length > 30);
});

test('drafts and archived departments are hidden from the public API', async () => {
  const { agent, token } = await adminAgent();
  const created = await agent
    .post('/api/admin/departments')
    .set('x-csrf-token', token)
    .send(validDepartment({ slug: 'hidden-department', is_published: false }));
  assert.equal(created.status, 201);
  const id = created.body.data.id;

  const { agent: visitor } = await anonymousAgent();
  let list = await visitor.get('/api/departments');
  assert.equal(list.body.data.some((item) => item.slug === 'hidden-department'), false);
  assert.equal((await visitor.get('/api/departments/hidden-department')).status, 404);

  // Publish it.
  const published = await agent
    .patch(`/api/admin/departments/${id}`)
    .set('x-csrf-token', token)
    .send({ is_published: true });
  assert.equal(published.status, 200);
  list = await visitor.get('/api/departments');
  assert.ok(list.body.data.some((item) => item.slug === 'hidden-department'));

  // Unpublish it again.
  await agent
    .patch(`/api/admin/departments/${id}`)
    .set('x-csrf-token', token)
    .send({ is_published: false });
  list = await visitor.get('/api/departments');
  assert.equal(list.body.data.some((item) => item.slug === 'hidden-department'), false);

  // Archive it.
  await agent
    .patch(`/api/admin/departments/${id}`)
    .set('x-csrf-token', token)
    .send({ is_published: true, is_active: false });
  list = await visitor.get('/api/departments');
  assert.equal(list.body.data.some((item) => item.slug === 'hidden-department'), false);
});

test('department updates are validated server-side', async () => {
  const { agent, token } = await adminAgent();
  const created = await agent
    .post('/api/admin/departments')
    .set('x-csrf-token', token)
    .send(validDepartment({ slug: 'validation-target' }));
  const id = created.body.data.id;

  const shortDescription = await agent
    .patch(`/api/admin/departments/${id}`)
    .set('x-csrf-token', token)
    .send({ short_description: 'قصير' });
  assert.equal(shortDescription.status, 400);
  assert.ok(shortDescription.body.error.fields.short_description);

  const badImage = await agent
    .patch(`/api/admin/departments/${id}`)
    .set('x-csrf-token', token)
    .send({ image_url: 'javascript:alert(1)' });
  assert.equal(badImage.status, 400);
  assert.ok(badImage.body.error.fields.image_url);

  const badSlug = await agent
    .patch(`/api/admin/departments/${id}`)
    .set('x-csrf-token', token)
    .send({ slug: '!!' });
  assert.equal(badSlug.status, 400);
  assert.ok(badSlug.body.error.fields.slug);

  const normalisedSlug = await agent
    .patch(`/api/admin/departments/${id}`)
    .set('x-csrf-token', token)
    .send({ slug: '  Smart   Robotics  ' });
  assert.equal(normalisedSlug.status, 200);
  assert.equal(normalisedSlug.body.data.slug, 'smart-robotics');

  const empty = await agent
    .patch(`/api/admin/departments/${id}`)
    .set('x-csrf-token', token)
    .send({});
  assert.equal(empty.status, 400);

  const missing = await agent
    .patch('/api/admin/departments/999999')
    .set('x-csrf-token', token)
    .send({ name: 'قسم غير موجود' });
  assert.equal(missing.status, 404);
});

test('duplicate slugs are rejected', async () => {
  const { agent, token } = await adminAgent();
  const first = await agent
    .post('/api/admin/departments')
    .set('x-csrf-token', token)
    .send(validDepartment({ slug: 'unique-slug' }));
  assert.equal(first.status, 201);

  const second = await agent
    .post('/api/admin/departments')
    .set('x-csrf-token', token)
    .send(validDepartment({ slug: 'unique-slug', name: 'قسم آخر' }));
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'SLUG_TAKEN');
  assert.ok(second.body.error.fields.slug);
});

test('administrators can search and filter departments', async () => {
  const { agent } = await adminAgent();

  const search = await agent.get('/api/admin/departments?q=' + encodeURIComponent('البرمجة'));
  assert.equal(search.status, 200);
  assert.equal(search.body.meta.total, 1);
  assert.equal(search.body.data[0].slug, 'programming');
  assert.ok(search.body.data[0].applications_count >= 1, 'application count is exposed to admins');

  const searchBySlug = await agent.get(
    '/api/admin/departments?q=' + encodeURIComponent('programming')
  );
  assert.equal(searchBySlug.body.meta.total, 0, 'search matches the department name only');

  const published = await agent.get('/api/admin/departments?state=published');
  assert.equal(published.body.meta.total, 10);

  db.run("UPDATE departments SET is_published = 0 WHERE slug = 'programming'");
  const drafts = await agent.get('/api/admin/departments?state=draft');
  assert.equal(drafts.body.meta.total, 1);

  const demoOnly = await agent.get('/api/admin/departments?is_demo=true');
  assert.equal(demoOnly.body.meta.total, 10);

  const page = await agent.get('/api/admin/departments?limit=3&page=2');
  assert.equal(page.body.data.length, 3);
  assert.equal(page.body.meta.page, 2);
});

test('a department without applications can be deleted', async () => {
  const { agent, token } = await adminAgent();
  const created = await agent
    .post('/api/admin/departments')
    .set('x-csrf-token', token)
    .send(validDepartment({ slug: 'deletable' }));
  const id = created.body.data.id;

  const res = await agent.delete(`/api/admin/departments/${id}`).set('x-csrf-token', token);
  assert.equal(res.status, 200);
  assert.equal(db.get('SELECT id FROM departments WHERE id = ?', [id]), undefined);

  const detail = await agent.get(`/api/admin/departments/${id}`);
  assert.equal(detail.status, 404);
});

test('deleting a department with applications is blocked without an explicit force', async () => {
  const department = db.get("SELECT * FROM departments WHERE slug = 'programming'");
  const applicationCount = db.get(
    'SELECT COUNT(*) AS count FROM applications WHERE department_id = ?',
    [department.id]
  ).count;
  assert.ok(applicationCount > 0);

  const { agent, token } = await adminAgent();
  const res = await agent
    .delete(`/api/admin/departments/${department.id}`)
    .set('x-csrf-token', token);

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'DEPARTMENT_HAS_APPLICATIONS');
  assert.ok(db.get('SELECT id FROM departments WHERE id = ?', [department.id]));
  assert.equal(
    db.get('SELECT COUNT(*) AS count FROM applications WHERE department_id = ?', [department.id]).count,
    applicationCount
  );

  // Archiving is still available as a non-destructive alternative.
  const archived = await agent
    .patch(`/api/admin/departments/${department.id}`)
    .set('x-csrf-token', token)
    .send({ is_active: false });
  assert.equal(archived.status, 200);
  assert.equal(archived.body.data.is_active, false);

  // Applications remain accessible to administrators after archiving.
  const apps = await agent.get(`/api/admin/applications?department_id=${department.id}`);
  assert.ok(apps.body.meta.total >= 1);
});

test('force deleting a department removes it together with its applications', async () => {
  const department = db.get("SELECT * FROM departments WHERE slug = 'programming'");
  const applicationCount = db.get(
    'SELECT COUNT(*) AS count FROM applications WHERE department_id = ?',
    [department.id]
  ).count;
  const totalApplications = db.get('SELECT COUNT(*) AS count FROM applications').count;
  assert.ok(applicationCount > 0);

  const { agent, token } = await adminAgent();
  const res = await agent
    .delete(`/api/admin/departments/${department.id}?force=true`)
    .set('x-csrf-token', token);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, department.id);
  assert.equal(res.body.data.deleted_applications, applicationCount);
  assert.equal(db.get('SELECT id FROM departments WHERE id = ?', [department.id]), undefined);
  assert.equal(
    db.get('SELECT COUNT(*) AS count FROM applications WHERE department_id = ?', [department.id]).count,
    0
  );
  assert.equal(
    db.get('SELECT COUNT(*) AS count FROM applications').count,
    totalApplications - applicationCount,
    'only the deleted department applications are removed'
  );
});

test('department writes require authentication and CSRF', async () => {
  const { agent: visitor, token } = await anonymousAgent();
  const unauthorized = await visitor
    .post('/api/admin/departments')
    .set('x-csrf-token', token)
    .send(validDepartment());
  assert.equal(unauthorized.status, 401);

  const { agent } = await adminAgent();
  const noCsrf = await agent.post('/api/admin/departments').send(validDepartment());
  assert.equal(noCsrf.status, 403);
});

test('public department list is ordered by sort_order', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent.get('/api/departments');
  const orders = res.body.data.map((item) => item.sort_order);
  const sorted = [...orders].sort((a, b) => a - b);
  assert.deepEqual(orders, sorted);
});

test('unknown public department slug returns a clean 404', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent.get('/api/departments/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

after(() => db.closeDatabase());
