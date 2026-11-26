'use strict';

/**
 * Content and display controls requested by the school:
 * - per-department male/female headcount edited from the dashboard,
 * - derived public totals,
 * - editable accreditation plus the updated vision/mission text,
 * - the four additional gallery categories and their temporary placeholders.
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  db,
  resetDatabase,
  anonymousAgent,
  adminAgent,
} = require('./helpers');
const { seedMissingSections } = require('../src/services/gallery.service');

beforeEach(() => resetDatabase());

test('administrators can set male and female headcount through the department PATCH endpoint', async () => {
  const { agent, token } = await adminAgent();
  const existing = db.get(
    `SELECT id, slug FROM departments
      WHERE is_published = 1 AND is_active = 1
      ORDER BY sort_order, id LIMIT 1`
  );
  assert.ok(existing, 'the demo data should contain a published department');

  const updated = await agent
    .patch(`/api/admin/departments/${existing.id}`)
    .set('x-csrf-token', token)
    .send({ students_male: 24, students_female: 18 });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.students_male, 24);
  assert.equal(updated.body.data.students_female, 18);
  assert.equal(updated.body.data.students_total, 42);

  const detail = await agent.get(`/api/admin/departments/${existing.id}`);
  assert.equal(detail.body.data.students_total, 42);

  // Save only one side: the other value and the derived total stay consistent.
  const partial = await agent
    .patch(`/api/admin/departments/${existing.id}`)
    .set('x-csrf-token', token)
    .send({ students_female: 20 });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.data.students_male, 24);
  assert.equal(partial.body.data.students_female, 20);
  assert.equal(partial.body.data.students_total, 44);
});

test('public department payloads expose the admin-managed counts and derived total', async () => {
  const { agent, token } = await adminAgent();
  const created = await agent
    .post('/api/admin/departments')
    .set('x-csrf-token', token)
    .send({
      name: 'قسم العد التجريبي',
      slug: 'count-check',
      short_description: 'وصف مختصر لاختبار عرض أعداد الطلاب في التخصص.',
      description: 'وصف كافٍ لاختبار عرض أعداد الطلاب داخل صفحة التخصص، مع التأكد من ظهور العدد الكلي بشكل صحيح.',
      educational_focus: 'العد والقياس.',
      skills: 'العدد\nالقياس',
      admission_info: 'لا يشترط خبرة سابقة.',
      image_url: '/assets/img/departments/programming.svg',
      students_male: 31,
      students_female: 27,
      is_published: true,
      sort_order: 99,
    });
  assert.equal(created.status, 201);

  const { agent: visitor } = await anonymousAgent();
  const list = await visitor.get('/api/departments');
  const item = list.body.data.find((department) => department.slug === 'count-check');
  assert.ok(item);
  assert.equal(item.students_male, 31);
  assert.equal(item.students_female, 27);
  assert.equal(item.students_total, 58);

  const detail = await visitor.get('/api/departments/count-check');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.students_total, 58);
});

test('student counts are validated before they reach the database', async () => {
  const { agent, token } = await adminAgent();
  const department = db.get('SELECT id FROM departments LIMIT 1');
  const cases = [
    { students_male: -1 },
    { students_female: 100001 },
    { students_male: 2.5 },
    { students_female: 'غير رقم' },
  ];

  for (const payload of cases) {
    const res = await agent
      .patch(`/api/admin/departments/${department.id}`)
      .set('x-csrf-token', token)
      .send(payload);
    assert.equal(res.status, 400, JSON.stringify(payload));
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('accreditation and the revised vision/mission are editable school content', async () => {
  const { agent: visitor } = await anonymousAgent();
  const before = await visitor.get('/api/school-content');
  assert.equal(before.status, 200);

  const { content } = before.body.data;
  assert.match(content.vision, /صعيد مصر/);
  assert.match(content.mission, /سوق العمل/);
  assert.match(content.accreditation, /وزارة الصناعة/);
  assert.ok(content.accreditation.length > 20);

  const { agent, token } = await adminAgent();
  const definitions = await agent.get('/api/admin/school-content');
  assert.ok(definitions.body.data.definitions.some((item) => item.key === 'accreditation'));

  const updated = await agent
    .patch('/api/admin/school-content')
    .set('x-csrf-token', token)
    .send({ accreditation: 'اعتماد محدث للاختبار' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.content.accreditation, 'اعتماد محدث للاختبار');

  const after = await visitor.get('/api/school-content');
  assert.equal(after.body.data.content.accreditation, 'اعتماد محدث للاختبار');
});

test('the public gallery includes the four new categories with placeholder images', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent.get('/api/gallery');
  assert.equal(res.status, 200);

  const slugs = res.body.data.sections.map((section) => section.slug);
  for (const slug of ['departments', 'competitions', 'field-visits', 'activities']) {
    assert.ok(slugs.includes(slug), `${slug} should be present in the public gallery`);
    const section = res.body.data.sections.find((item) => item.slug === slug);
    assert.equal(section.images.length, 3);
    assert.ok(section.images.every((image) => image.url.endsWith('.svg')));
  }
});

test('seeding missing gallery categories preserves existing sections and edits', async () => {
  db.run("UPDATE gallery_sections SET title = 'عنوان مخصص' WHERE slug = 'theoretical'");
  db.run("DELETE FROM gallery_sections WHERE slug = 'competitions'");

  const result = seedMissingSections(['competitions']);
  assert.deepEqual(result, { inserted: true, sections: 1, images: 3 });

  const theoretical = db.get("SELECT title FROM gallery_sections WHERE slug = 'theoretical'");
  assert.equal(theoretical.title, 'عنوان مخصص');

  const competitions = db.get("SELECT id FROM gallery_sections WHERE slug = 'competitions'");
  assert.ok(competitions);
  assert.equal(
    db.get('SELECT COUNT(*) AS count FROM gallery_images WHERE section_id = ?', [competitions.id]).count,
    3
  );

  // Running it again is a no-op: no duplicate categories or photos.
  assert.deepEqual(seedMissingSections(['competitions']), {
    inserted: false,
    sections: 0,
    images: 0,
  });
});
