'use strict';

/**
 * Real study plan: 11 sections, three grades, weekly period counts, and the
 * deliberate replacement of the demo subjects on the public site.
 */
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDatabase, anonymousAgent } = require('./helpers');
const { seedRealDepartments } = require('../src/services/real-departments.service');
const { seedRealSubjects } = require('../src/services/real-subjects.service');

beforeEach(() => {
  resetDatabase();
  seedRealDepartments();
});

after(() => db.closeDatabase());

test('real study plan inserts 69 subjects and hides every demo subject publicly', async () => {
  const first = seedRealSubjects();
  assert.equal(first.subjects_inserted, 69);
  assert.equal(first.demo_subjects_hidden, 8);

  const stored = db.get(
    `SELECT
       (SELECT COUNT(*) FROM subjects WHERE is_demo = 0 AND is_published = 1) AS real_public,
       (SELECT COUNT(*) FROM subjects WHERE is_demo = 1 AND is_published = 1) AS demo_public,
       (SELECT COUNT(*) FROM subjects WHERE is_demo = 1) AS demo_total`
  );
  assert.equal(stored.real_public, 69);
  assert.equal(stored.demo_public, 0);
  assert.equal(stored.demo_total, 8);

  const { agent } = await anonymousAgent();
  const publicList = await agent.get('/api/subjects');
  assert.equal(publicList.status, 200);
  assert.equal(publicList.body.meta.total, 69);
  assert.ok(publicList.body.data.theoretical.every((item) => item.is_demo === false));
  assert.ok(publicList.body.data.practical.every((item) => item.is_demo === false));

  const second = seedRealSubjects();
  assert.equal(second.subjects_inserted, 0);
});

test('general subjects appear once per grade and carry weekly periods', async () => {
  seedRealSubjects();

  const general = db.all(
    'SELECT grade, name, weekly_periods FROM subjects WHERE department_id IS NULL AND is_demo = 0 ORDER BY grade, sort_order'
  );
  const byGrade = general.reduce((acc, row) => {
    acc[row.grade] = (acc[row.grade] || 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byGrade, { first: 6, second: 6, third: 3 });

  const arabicFirst = general.find((row) => row.grade === 'first' && row.name === 'عربي');
  assert.equal(arabicFirst.weekly_periods, 2);

  const technologyThird = general.find((row) => row.grade === 'third' && row.name === 'تكنولوجيا');
  assert.equal(technologyThird.weekly_periods, 3);
});

test('specialised subjects are linked to the chosen departments', async () => {
  seedRealSubjects();
  const { agent } = await anonymousAgent();

  const electrical = db.get("SELECT id FROM departments WHERE slug = 'electrical-technician'");
  const electricalFirst = await agent.get(
    `/api/subjects?grade=first&department=${electrical.id}`
  );
  const drawing = electricalFirst.body.data.practical.find((item) => item.name === 'رسم دوائر');
  assert.ok(drawing, 'رسم دوائر should appear for Electrical Technology');
  assert.equal(drawing.weekly_periods, 3);
  assert.equal(drawing.department_slug, 'electrical-technician');
  assert.equal(electricalFirst.body.data.theoretical.length, 5, 'Arabic, English, mechanics, IT and religion');

  const sharedSlugs = [
    'industrial-plumbing-technician',
    'refrigeration-hvac-technician',
    'aluminium-technician',
    'metal-welding-technician',
  ];
  for (const slug of sharedSlugs) {
    const department = db.get('SELECT id FROM departments WHERE slug = ?', [slug]);
    const result = await agent.get(`/api/subjects?grade=first&department=${department.id}`);
    const names = result.body.data.practical.map((item) => item.name);
    assert.ok(names.includes('رسم CAD+'), `${slug} should include رسم CAD+`);
    assert.ok(names.includes('هندسة كهربية') === false, 'هندسة كهربية is theoretical');
    const engineering = result.body.data.theoretical.find(
      (item) => item.name === 'هندسة كهربية'
    );
    assert.equal(engineering.weekly_periods, 2);
  }

  const chemical = db.get("SELECT id FROM departments WHERE slug = 'chemical-laboratory-technician'");
  const chemicalFirst = await agent.get(`/api/subjects?grade=first&department=${chemical.id}`);
  const chemistry = chemicalFirst.body.data.theoretical.find((item) => item.name === 'كيمياء');
  assert.equal(chemistry.weekly_periods, 2);
});
