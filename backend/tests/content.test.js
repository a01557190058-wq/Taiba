'use strict';

const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDatabase, anonymousAgent, adminAgent } = require('./helpers');

beforeEach(() => resetDatabase());

test('public school content exposes editable text and published FAQs', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent.get('/api/school-content');
  assert.equal(res.status, 200);

  const { content, faqs, objectives, admission_steps } = res.body.data;
  assert.ok(content.school_intro.length > 50);
  assert.ok(content.vision.length > 10);
  assert.ok(content.mission.length > 10);
  assert.ok(content.contact_email.includes('@'));
  assert.ok(Array.isArray(objectives) && objectives.length >= 3);
  assert.ok(Array.isArray(admission_steps) && admission_steps.length >= 3);
  assert.ok(Array.isArray(faqs) && faqs.length >= 3);
  assert.equal(faqs[0].is_published, true);
});

test('administrators can read content definitions and update content', async () => {
  const { agent, token } = await adminAgent();

  const adminContent = await agent.get('/api/admin/school-content');
  assert.equal(adminContent.status, 200);
  assert.ok(adminContent.body.data.definitions.length >= 10);
  assert.ok(adminContent.body.data.content.school_intro);

  const update = await agent
    .patch('/api/admin/school-content')
    .set('x-csrf-token', token)
    .send({
      vision: 'رؤية محدثة للاختبار',
      contact_phone: '0100 111 2222',
    });
  assert.equal(update.status, 200);
  assert.equal(update.body.data.content.vision, 'رؤية محدثة للاختبار');

  const { agent: visitor } = await anonymousAgent();
  const publicContent = await visitor.get('/api/school-content');
  assert.equal(publicContent.body.data.content.vision, 'رؤية محدثة للاختبار');
  assert.equal(publicContent.body.data.content.contact_phone, '0100 111 2222');
});

test('content updates reject unknown keys and non-string values', async () => {
  const { agent, token } = await adminAgent();

  const unknown = await agent
    .patch('/api/admin/school-content')
    .set('x-csrf-token', token)
    .send({ not_a_real_key: 'value' });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.error.code, 'VALIDATION_ERROR');

  const nonString = await agent
    .patch('/api/admin/school-content')
    .set('x-csrf-token', token)
    .send({ vision: { nested: 'object' } });
  assert.equal(nonString.status, 400);

  const empty = await agent.patch('/api/admin/school-content').set('x-csrf-token', token).send({});
  assert.equal(empty.status, 400);
});

test('content is stored as plain text (no HTML execution path)', async () => {
  const { agent, token } = await adminAgent();
  const payload = '<script>alert("xss")</script> نص عادي';
  const update = await agent
    .patch('/api/admin/school-content')
    .set('x-csrf-token', token)
    .send({ learning_environment: payload });
  assert.equal(update.status, 200);
  // Stored verbatim as text; the frontends always render it via textContent.
  assert.equal(update.body.data.content.learning_environment, payload);

  const { agent: visitor } = await anonymousAgent();
  const publicContent = await visitor.get('/api/school-content');
  assert.equal(publicContent.body.data.content.learning_environment, payload);
  assert.equal(publicContent.headers['content-type'].includes('application/json'), true);
});

test('FAQ CRUD works and unpublished questions stay hidden', async () => {
  const { agent, token } = await adminAgent();

  const created = await agent
    .post('/api/admin/school-content/faqs')
    .set('x-csrf-token', token)
    .send({ question: 'هل يوجد اختبار قبول تجريبي؟', answer: 'هذا سؤال تجريبي للاختبار الآلي.', sort_order: 99 });
  assert.equal(created.status, 201);
  const faqId = created.body.data.id;
  assert.equal(created.body.data.is_published, true);

  const { agent: visitor } = await anonymousAgent();
  let publicFaqs = await visitor.get('/api/school-content');
  assert.ok(publicFaqs.body.data.faqs.some((faq) => faq.id === faqId));

  const updated = await agent
    .patch(`/api/admin/school-content/faqs/${faqId}`)
    .set('x-csrf-token', token)
    .send({ is_published: false, answer: 'إجابة محدثة تجريبية.' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.is_published, false);

  publicFaqs = await visitor.get('/api/school-content');
  assert.equal(publicFaqs.body.data.faqs.some((faq) => faq.id === faqId), false);

  const invalid = await agent
    .post('/api/admin/school-content/faqs')
    .set('x-csrf-token', token)
    .send({ question: 'س', answer: 'قصير' });
  assert.equal(invalid.status, 400);

  const removed = await agent
    .delete(`/api/admin/school-content/faqs/${faqId}`)
    .set('x-csrf-token', token);
  assert.equal(removed.status, 200);
  assert.equal(db.get('SELECT id FROM faqs WHERE id = ?', [faqId]), undefined);
});

test('content writes require an administrator session', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await agent
    .patch('/api/admin/school-content')
    .set('x-csrf-token', token)
    .send({ vision: 'محاولة غير مصرح بها' });
  assert.equal(res.status, 401);
  assert.equal(
    db.get("SELECT content_value FROM school_content WHERE content_key = 'vision'").content_value ===
      'محاولة غير مصرح بها',
    false
  );
});

after(() => db.closeDatabase());
