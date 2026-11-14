'use strict';

/**
 * Study subjects (المواد الدراسية): public grouping into theoretical and
 * practical sections, plus full administrative CRUD. Demo subjects are seeded
 * by the shared harness (4 theoretical + 4 practical), so assertions compare
 * against that baseline instead of absolute totals.
 */
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDatabase, anonymousAgent, adminAgent } = require('./helpers');

beforeEach(() => resetDatabase());

const DEMO_THEORETICAL = 4;
const DEMO_PRACTICAL = 4;

const validSubject = (overrides = {}) => ({
  name: 'مادة اختبارية',
  description: 'وصف مختصر لمادة اختبارية تُستخدم للتحقق من عمل واجهة المواد الدراسية.',
  type: 'theoretical',
  icon: 'book',
  sort_order: 10,
  is_published: true,
  ...overrides,
});

async function createSubject(agent, token, overrides = {}) {
  return agent
    .post('/api/admin/subjects')
    .set('x-csrf-token', token)
    .send(validSubject(overrides));
}

test('the public page receives subjects grouped by type', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent.get('/api/subjects');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data.theoretical));
  assert.ok(Array.isArray(res.body.data.practical));
  assert.equal(res.body.data.theoretical.length, DEMO_THEORETICAL);
  assert.equal(res.body.data.practical.length, DEMO_PRACTICAL);
  assert.ok(res.body.data.theoretical.every((item) => item.type === 'theoretical'));
  assert.ok(res.body.data.practical.every((item) => item.type === 'practical'));
  assert.equal(res.body.meta.total, DEMO_THEORETICAL + DEMO_PRACTICAL);
});

test('an administrator can create a published subject and it appears publicly', async () => {
  const { agent, token } = await adminAgent();
  const created = await createSubject(agent, token, {
    name: 'الكيمياء العضوية',
    type: 'theoretical',
    icon: 'flask',
  });

  assert.equal(created.status, 201);
  const subject = created.body.data;
  assert.equal(subject.name, 'الكيمياء العضوية');
  assert.equal(subject.type, 'theoretical');
  assert.equal(subject.type_singular, 'نظرية');
  assert.equal(subject.icon, 'flask');
  assert.equal(subject.is_published, true);
  assert.equal(subject.is_demo, false);

  const stored = db.get('SELECT * FROM subjects WHERE id = ?', [subject.id]);
  assert.ok(stored);
  assert.equal(stored.is_demo, 0);

  const { agent: visitor } = await anonymousAgent();
  const publicList = await visitor.get('/api/subjects');
  assert.equal(publicList.body.data.theoretical.length, DEMO_THEORETICAL + 1);
  assert.ok(publicList.body.data.theoretical.some((item) => item.id === subject.id));
});

test('draft subjects are hidden from the public page until published', async () => {
  const { agent, token } = await adminAgent();
  const created = await createSubject(agent, token, {
    name: 'مادة مسودة',
    type: 'practical',
    is_published: false,
  });
  assert.equal(created.status, 201);

  const { agent: visitor } = await anonymousAgent();
  let publicList = await visitor.get('/api/subjects');
  assert.equal(publicList.body.data.practical.length, DEMO_PRACTICAL);
  assert.ok(!publicList.body.data.practical.some((item) => item.id === created.body.data.id));

  const published = await agent
    .patch(`/api/admin/subjects/${created.body.data.id}`)
    .set('x-csrf-token', token)
    .send({ is_published: true });
  assert.equal(published.status, 200);
  assert.equal(published.body.data.is_published, true);

  publicList = await visitor.get('/api/subjects');
  assert.equal(publicList.body.data.practical.length, DEMO_PRACTICAL + 1);
});

test('updating the type moves the subject to the other public section', async () => {
  const { agent, token } = await adminAgent();
  const created = await createSubject(agent, token, { type: 'theoretical' });
  assert.equal(created.status, 201);

  const updated = await agent
    .patch(`/api/admin/subjects/${created.body.data.id}`)
    .set('x-csrf-token', token)
    .send({ type: 'practical' });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.type, 'practical');
  assert.equal(updated.body.data.type_singular, 'عملية');

  const { agent: visitor } = await anonymousAgent();
  const publicList = await visitor.get('/api/subjects');
  assert.ok(!publicList.body.data.theoretical.some((item) => item.id === created.body.data.id));
  assert.ok(publicList.body.data.practical.some((item) => item.id === created.body.data.id));
});

test('invalid subject types and icons are rejected', async () => {
  const { agent, token } = await adminAgent();

  const badType = await createSubject(agent, token, { type: 'optional' });
  assert.equal(badType.status, 400);
  assert.ok(badType.body.error.fields.type);

  const badIcon = await createSubject(agent, token, { icon: 'not-an-icon' });
  assert.equal(badIcon.status, 400);
  assert.ok(badIcon.body.error.fields.icon);

  const shortName = await createSubject(agent, token, { name: 'ا' });
  assert.equal(shortName.status, 400);
  assert.ok(shortName.body.error.fields.name);
});

test('an administrator can list, filter and delete subjects', async () => {
  const { agent, token } = await adminAgent();

  const list = await agent.get('/api/admin/subjects?type=practical&limit=50');
  assert.equal(list.status, 200);
  assert.equal(list.body.meta.total, DEMO_PRACTICAL);
  assert.ok(list.body.data.every((item) => item.type === 'practical'));

  const created = await createSubject(agent, token, { name: 'مادة للحذف' });
  assert.equal(created.status, 201);

  const removed = await agent
    .delete(`/api/admin/subjects/${created.body.data.id}`)
    .set('x-csrf-token', token);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.id, created.body.data.id);
  assert.equal(db.get('SELECT id FROM subjects WHERE id = ?', [created.body.data.id]), undefined);

  const missing = await agent
    .delete(`/api/admin/subjects/${created.body.data.id}`)
    .set('x-csrf-token', token);
  assert.equal(missing.status, 404);
});

test('the public page can filter by grade and department', async () => {
  const { agent } = await anonymousAgent();

  const first = await agent.get('/api/subjects?grade=first');
  assert.equal(first.status, 200);
  assert.equal(first.body.meta.grade, 'first');
  assert.equal(first.body.data.theoretical.length, 2);
  assert.equal(first.body.data.practical.length, 1);
  assert.ok(first.body.data.theoretical.every((item) => item.grade === 'first'));
  assert.ok(first.body.data.practical.every((item) => item.grade === 'first'));

  const second = await agent.get('/api/subjects?grade=second');
  assert.equal(second.body.data.theoretical.length, 1);
  assert.equal(second.body.data.practical.length, 1);
  assert.ok(second.body.data.theoretical.every((item) => item.grade === 'second'));

  // The mechanical department of the first grade contains the drawing subject
  // plus the general (department-less) subjects of that grade.
  const mechanical = db.get("SELECT id FROM departments WHERE slug = 'mechanical'");
  const filtered = await agent.get(`/api/subjects?grade=first&department=${mechanical.id}`);
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.meta.department, mechanical.id);
  assert.equal(filtered.body.data.theoretical.length, 2, 'general subjects are included');
  assert.equal(filtered.body.data.practical.length, 1);
  assert.ok(
    filtered.body.data.practical.every(
      (item) => item.department_id === mechanical.id || item.department_id === null
    )
  );
  assert.ok(
    filtered.body.data.theoretical.every((item) => item.department_id === null),
    'the first grade has no department-specific theoretical subjects'
  );

  // The department picker lists every published, active department — including
  // ones with no subjects in the selected grade — so the visitor sees all
  // specializations instead of only those with matching subjects.
  const programming = db.get("SELECT id FROM departments WHERE slug = 'programming'");
  const publishedDepartments = db.get(
    'SELECT COUNT(*) AS count FROM departments WHERE is_published = 1 AND is_active = 1'
  );
  assert.equal(filtered.body.data.departments.length, publishedDepartments.count);
  assert.ok(filtered.body.data.departments.some((item) => item.id === mechanical.id));
  assert.ok(
    filtered.body.data.departments.some((item) => item.id === programming.id),
    'departments without first-grade subjects are still offered'
  );
  const mechanicalEntry = filtered.body.data.departments.find(
    (item) => item.id === mechanical.id
  );
  assert.equal(mechanicalEntry.subject_count, 1);
  const programmingEntry = filtered.body.data.departments.find(
    (item) => item.id === programming.id
  );
  assert.equal(programmingEntry.subject_count, 0);
  assert.ok(filtered.body.data.departments.every((item) => item.id !== undefined));
});

test('subjects validate their grade and department', async () => {
  const { agent, token } = await adminAgent();

  const badGrade = await createSubject(agent, token, { grade: 'fourth' });
  assert.equal(badGrade.status, 400);
  assert.ok(badGrade.body.error.fields.grade);

  const badDepartment = await createSubject(agent, token, { department_id: 999999 });
  assert.equal(badDepartment.status, 400);
  assert.ok(badDepartment.body.error.fields.department_id);

  const mechanical = db.get("SELECT id FROM departments WHERE slug = 'mechanical'");
  const created = await createSubject(agent, token, {
    name: 'مادة تخصصية',
    type: 'practical',
    grade: 'second',
    department_id: mechanical.id,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.grade, 'second');
  assert.equal(created.body.data.department_id, mechanical.id);
  assert.equal(created.body.data.department_name, 'الميكانيكا');

  // Sending null makes the subject general again.
  const cleared = await agent
    .patch(`/api/admin/subjects/${created.body.data.id}`)
    .set('x-csrf-token', token)
    .send({ department_id: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.data.department_id, null);
  assert.equal(cleared.body.data.department_name, '');
});

test('subjects administration requires an administrator session', async () => {
  const { agent, token } = await anonymousAgent();

  assert.equal((await agent.get('/api/admin/subjects')).status, 401);
  assert.equal(
    (
      await agent
        .post('/api/admin/subjects')
        .set('x-csrf-token', token)
        .send(validSubject())
    ).status,
    401
  );
  assert.equal(
    (
      await agent
        .delete('/api/admin/subjects/1')
        .set('x-csrf-token', token)
    ).status,
    401
  );
});

after(() => db.closeDatabase());
