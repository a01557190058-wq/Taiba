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

test('demo records are explicitly identifiable', async () => {
  const { agent } = await adminAgent();
  const res = await agent.get('/api/admin/demo-data');
  assert.equal(res.status, 200);

  assert.equal(res.body.data.counts.demo_departments, 10);
  assert.equal(res.body.data.counts.demo_applications, 8);
  assert.equal(res.body.data.counts.demo_news, 6);
  assert.equal(res.body.data.counts.demo_subjects, 8);
  assert.equal(res.body.data.counts.real_departments, 0);
  assert.equal(res.body.data.counts.real_applications, 0);
  assert.equal(res.body.data.counts.real_news, 0);
  assert.equal(res.body.data.counts.real_subjects, 0);
  assert.equal(res.body.data.departments.length, 10);
  assert.equal(res.body.data.applications.length, 8);
  assert.equal(res.body.data.news.length, 6);
  assert.equal(res.body.data.subjects.length, 8);
  assert.ok(res.body.data.applications.every((row) => row.reference_number.startsWith('DEMO-')));
  assert.ok(res.body.data.news.every((row) => row.slug.startsWith('demo-')));
  assert.ok(res.body.data.subjects.every((row) => ['theoretical', 'practical'].includes(row.type)));
});

test('seeding is idempotent and never duplicates demo records', async () => {
  const { agent, token } = await adminAgent();

  const first = await agent.post('/api/admin/demo-data/seed').set('x-csrf-token', token);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.summary.departments_inserted, 0);
  assert.equal(first.body.data.summary.applications_inserted, 0);
  assert.equal(first.body.data.summary.news_inserted, 0);

  const second = await agent.post('/api/admin/demo-data/seed').set('x-csrf-token', token);
  assert.equal(second.body.data.overview.counts.demo_departments, 10);
  assert.equal(second.body.data.overview.counts.demo_applications, 8);
  assert.equal(second.body.data.overview.counts.demo_news, 6);

  assert.equal(db.get('SELECT COUNT(*) AS count FROM departments').count, 10);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM applications').count, 8);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM news').count, 6);
});

test('demo cleanup removes only demo records and preserves real records', async () => {
  // Create a genuine department + genuine application through the public API.
  const { agent: visitor, token: visitorToken } = await anonymousAgent();
  const realDepartment = db.get("SELECT id FROM departments WHERE slug = 'programming'");
  const submission = await submitApplication(visitor, visitorToken, {
    phone: '01033334444',
    department_id: realDepartment.id,
    full_name: 'متقدم حقيقي',
  });
  assert.equal(submission.status, 201);

  const realDepartmentId = realDepartment.id;
  const realApplicationId = db.get('SELECT id FROM applications WHERE is_demo = 0').id;

  const { agent, token } = await adminAgent();
  const realNews = await agent
    .post('/api/admin/news')
    .set('x-csrf-token', token)
    .send({
      title: 'خبر حقيقي يجب ألا يُحذف مع البيانات التجريبية',
      slug: 'real-news-preserved',
      summary: 'ملخص خبر حقيقي أُنشئ أثناء اختبار تنظيف البيانات التجريبية.',
      body: 'نص خبر حقيقي أُنشئ أثناء الاختبار للتأكد من أن تنظيف البيانات التجريبية لا يمس السجلات الحقيقية إطلاقًا.',
      category: 'إعلانات',
      is_published: true,
    });
  assert.equal(realNews.status, 201);

  const res = await agent
    .post('/api/admin/demo-data/cleanup')
    .set('x-csrf-token', token)
    .send({ confirm: 'DELETE_DEMO_DATA' });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.deleted_applications, 8);
  assert.equal(res.body.data.deleted_news, 6);
  assert.equal(res.body.data.deleted_subjects, 8);
  assert.equal(res.body.data.deleted_departments, 9, 'departments without real applications are deleted');
  assert.equal(res.body.data.archived_departments, 1, 'demo department with a real application is archived');

  // Real records are intact, including news.
  assert.ok(db.get('SELECT id FROM applications WHERE id = ?', [realApplicationId]));
  assert.ok(db.get('SELECT id FROM news WHERE id = ?', [realNews.body.data.id]));
  assert.equal(db.get('SELECT COUNT(*) AS count FROM news WHERE is_demo = 1').count, 0);
  const department = db.get('SELECT * FROM departments WHERE id = ?', [realDepartmentId]);
  assert.ok(department, 'department referenced by a real application must not be deleted');
  assert.equal(department.is_published, 0);
  assert.equal(department.is_active, 0);

  // The application is still visible to administrators with its snapshot name.
  const adminList = await agent.get('/api/admin/applications?is_demo=false');
  assert.equal(adminList.body.meta.total, 1);
  assert.equal(adminList.body.data[0].full_name, 'متقدم حقيقي');

  // Public listing no longer offers the archived demo department.
  const { agent: publicAgent } = await anonymousAgent();
  const publicList = await publicAgent.get('/api/departments');
  assert.equal(publicList.body.data.some((item) => item.slug === 'programming'), false);
});

test('demo cleanup requires an explicit confirmation token', async () => {
  const { agent, token } = await adminAgent();

  const missing = await agent.post('/api/admin/demo-data/cleanup').set('x-csrf-token', token).send({});
  assert.equal(missing.status, 400);
  assert.ok(missing.body.error.fields.confirm);

  const wrong = await agent
    .post('/api/admin/demo-data/cleanup')
    .set('x-csrf-token', token)
    .send({ confirm: 'yes' });
  assert.equal(wrong.status, 400);

  assert.equal(db.get('SELECT COUNT(*) AS count FROM applications WHERE is_demo = 1').count, 8);
});

test('demo reset deletes demo records then restores the dataset', async () => {
  const { agent, token } = await adminAgent();

  const cleanup = await agent
    .post('/api/admin/demo-data/cleanup')
    .set('x-csrf-token', token)
    .send({ confirm: 'DELETE_DEMO_DATA' });
  assert.equal(cleanup.status, 200);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM departments WHERE is_demo = 1').count, 0);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM news WHERE is_demo = 1').count, 0);

  const reset = await agent
    .post('/api/admin/demo-data/reset')
    .set('x-csrf-token', token)
    .send({ confirm: 'RESET_DEMO_DATA' });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.data.seed.departments_inserted, 10);
  assert.equal(reset.body.data.seed.applications_inserted, 8);
  assert.equal(reset.body.data.seed.news_inserted, 6);
  assert.equal(reset.body.data.seed.subjects_inserted, 8);
  assert.equal(reset.body.data.seed.faqs_inserted, 0, 'content is not duplicated on reset');
  assert.equal(reset.body.data.seed.content_inserted, 0);
  assert.equal(reset.body.data.overview.counts.demo_departments, 10);
  assert.equal(reset.body.data.overview.counts.demo_news, 6);
  assert.equal(reset.body.data.overview.counts.demo_subjects, 8);

  assert.equal(db.get('SELECT COUNT(*) AS count FROM departments').count, 10);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM applications').count, 8);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM news').count, 6);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM subjects').count, 8);

  // A second reset is still idempotent.
  const again = await agent
    .post('/api/admin/demo-data/reset')
    .set('x-csrf-token', token)
    .send({ confirm: 'RESET_DEMO_DATA' });
  assert.equal(again.body.data.seed.departments_inserted, 10);
  assert.equal(again.body.data.overview.counts.demo_departments, 10);
  assert.equal(again.body.data.overview.counts.demo_applications, 8);
});

test('demo reset republishes demo departments retained for real applications', async () => {
  const { agent: visitor, token: visitorToken } = await anonymousAgent();
  const programming = db.get("SELECT id FROM departments WHERE slug = 'programming'");
  const submission = await submitApplication(visitor, visitorToken, {
    phone: '01055556666',
    department_id: programming.id,
    full_name: 'متقدم حقيقي ثانٍ',
  });
  assert.equal(submission.status, 201);

  const { agent, token } = await adminAgent();
  const reset = await agent
    .post('/api/admin/demo-data/reset')
    .set('x-csrf-token', token)
    .send({ confirm: 'RESET_DEMO_DATA' });

  assert.equal(reset.status, 200);
  assert.equal(reset.body.data.cleanup.archived_departments, 1);
  assert.equal(reset.body.data.restored_departments, 1);

  const department = db.get('SELECT * FROM departments WHERE id = ?', [programming.id]);
  assert.equal(department.is_published, 1, 'retained demo department is published again');
  assert.equal(department.is_active, 1, 'retained demo department is active again');
  assert.equal(db.get('SELECT COUNT(*) AS count FROM applications WHERE is_demo = 0').count, 1);
  assert.equal(reset.body.data.overview.counts.demo_departments, 10);
  assert.equal(reset.body.data.overview.counts.demo_applications, 8);
});

test('demo-data endpoints are administrator-only', async () => {
  const { agent, token } = await anonymousAgent();

  assert.equal((await agent.get('/api/admin/demo-data')).status, 401);
  assert.equal(
    (await agent.post('/api/admin/demo-data/seed').set('x-csrf-token', token)).status,
    401
  );
  assert.equal(
    (
      await agent
        .post('/api/admin/demo-data/reset')
        .set('x-csrf-token', token)
        .send({ confirm: 'RESET_DEMO_DATA' })
    ).status,
    401
  );
  assert.equal(
    (
      await agent
        .post('/api/admin/demo-data/cleanup')
        .set('x-csrf-token', token)
        .send({ confirm: 'DELETE_DEMO_DATA' })
    ).status,
    401
  );
});

test('there is no public endpoint that can wipe the database', async () => {
  const { agent } = await anonymousAgent();
  const attempts = [
    agent.get('/api/demo-data'),
    agent.post('/api/demo-data/reset'),
    agent.post('/api/admin/demo-data/reset').send({ confirm: 'RESET_DEMO_DATA' }),
  ];
  const responses = await Promise.all(attempts);
  for (const res of responses) {
    assert.ok([401, 403, 404].includes(res.status), `unexpected status ${res.status}`);
  }
  assert.equal(db.get('SELECT COUNT(*) AS count FROM applications').count, 8);
});

after(() => db.closeDatabase());
