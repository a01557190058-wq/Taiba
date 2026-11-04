'use strict';

/**
 * School news: public listing/detail behaviour and full administrative CRUD.
 * Demo news is seeded by the shared harness (6 published items), so assertions
 * compare against the demo baseline instead of absolute totals.
 */
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDatabase, anonymousAgent, adminAgent } = require('./helpers');

beforeEach(() => resetDatabase());

const DEMO_NEWS_COUNT = 6;

const validNews = (overrides = {}) => ({
  title: 'خبر اختباري عن أنشطة المدرسة',
  slug: 'test-news-item',
  summary: 'ملخص تجريبي لخبر اختباري يوضح طريقة عرض الأخبار في الموقع.',
  body:
    'هذا نص تجريبي لخبر اختباري طويل بما يكفي لاجتياز التحقق، ويشرح تفاصيل النشاط داخل المدرسة دون أي بيانات رسمية.',
  category: 'أنشطة',
  image_url: '/assets/img/departments/programming.svg',
  is_published: true,
  is_featured: false,
  published_at: '2026-11-01T09:00:00.000Z',
  sort_order: 10,
  ...overrides,
});

async function createNews(agent, token, overrides = {}) {
  return agent
    .post('/api/admin/news')
    .set('x-csrf-token', token)
    .send(validNews(overrides));
}

test('an administrator can create a news item and it starts as real data', async () => {
  const { agent, token } = await adminAgent();
  const res = await createNews(agent, token);

  assert.equal(res.status, 201);
  const news = res.body.data;
  assert.equal(news.title, 'خبر اختباري عن أنشطة المدرسة');
  assert.equal(news.slug, 'test-news-item');
  assert.equal(news.category, 'أنشطة');
  assert.equal(news.is_published, true);
  assert.equal(news.is_featured, false);
  assert.equal(news.is_demo, false);
  assert.equal(news.published_at, '2026-11-01T09:00:00.000Z');
  assert.ok(news.created_at);
  assert.ok(news.updated_at);

  const stored = db.get('SELECT * FROM news WHERE id = ?', [news.id]);
  assert.ok(stored);
  assert.equal(stored.is_demo, 0);
});

test('the slug is generated from the title when omitted', async () => {
  const { agent, token } = await adminAgent();
  const res = await agent
    .post('/api/admin/news')
    .set('x-csrf-token', token)
    .send(validNews({ title: 'افتتاح معمل الحاسوب الجديد', slug: '' }));

  assert.equal(res.status, 201);
  assert.equal(res.body.data.slug, 'افتتاح-معمل-الحاسوب-الجديد');
});

test('a duplicate slug is rejected with a clear conflict', async () => {
  const { agent, token } = await adminAgent();
  const first = await createNews(agent, token);
  assert.equal(first.status, 201);

  const duplicate = await createNews(agent, token, { title: 'خبر آخر بنفس المعرّف' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'SLUG_TAKEN');
  assert.ok(duplicate.body.error.fields.slug);
});

test('published news appears on the public website with its detail page', async () => {
  const { agent, token } = await adminAgent();
  const created = await createNews(agent, token, {
    title: 'خبر منشور للعرض العام',
    slug: 'public-news-item',
    category: 'إعلانات',
  });
  assert.equal(created.status, 201);

  const { agent: visitor } = await anonymousAgent();
  const list = await visitor.get('/api/news?limit=30');
  assert.equal(list.status, 200);
  assert.ok(list.body.meta.total >= DEMO_NEWS_COUNT + 1);
  assert.ok(list.body.data.some((item) => item.slug === 'public-news-item'));

  const detail = await visitor.get('/api/news/public-news-item');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.title, 'خبر منشور للعرض العام');
  assert.ok(Array.isArray(detail.body.data.related));
  assert.ok(detail.body.data.related.length <= 3);
  assert.ok(detail.body.data.related.every((item) => item.slug !== 'public-news-item'));
});

test('draft news is hidden from the public but visible to administrators', async () => {
  const { agent, token } = await adminAgent();
  const created = await createNews(agent, token, {
    title: 'مسودة خبر غير منشورة',
    slug: 'draft-news-item',
    is_published: false,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.is_published, false);

  const { agent: visitor } = await anonymousAgent();
  const list = await visitor.get('/api/news?limit=30');
  assert.equal(list.body.data.some((item) => item.slug === 'draft-news-item'), false);

  const detail = await visitor.get('/api/news/draft-news-item');
  assert.equal(detail.status, 404);
  assert.equal(detail.body.error.code, 'NOT_FOUND');

  const adminList = await agent.get('/api/admin/news?state=draft&limit=50');
  assert.equal(adminList.status, 200);
  assert.ok(adminList.body.data.some((item) => item.slug === 'draft-news-item'));
});

test('an administrator can publish, feature and re-slug a news item', async () => {
  const { agent, token } = await adminAgent();
  const created = await createNews(agent, token, {
    title: 'خبر قابل للتحديث',
    slug: 'editable-news',
    is_published: false,
  });
  const id = created.body.data.id;

  const updated = await agent
    .patch(`/api/admin/news/${id}`)
    .set('x-csrf-token', token)
    .send({
      title: 'خبر منشور بعد التحديث',
      slug: 'updated-news',
      is_published: true,
      is_featured: true,
      category: 'إنجازات',
    });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.title, 'خبر منشور بعد التحديث');
  assert.equal(updated.body.data.slug, 'updated-news');
  assert.equal(updated.body.data.is_published, true);
  assert.equal(updated.body.data.is_featured, true);
  assert.equal(updated.body.data.category, 'إنجازات');

  const { agent: visitor } = await anonymousAgent();
  assert.equal((await visitor.get('/api/news/editable-news')).status, 404);
  assert.equal((await visitor.get('/api/news/updated-news')).status, 200);

  const featured = await visitor.get('/api/news?featured=true&limit=30');
  assert.equal(featured.status, 200);
  assert.ok(featured.body.data.every((item) => item.is_featured === true));
  assert.ok(featured.body.data.some((item) => item.slug === 'updated-news'));
});

test('public news can be searched and filtered by category', async () => {
  const { agent: visitor } = await anonymousAgent();

  const byCategory = await visitor.get('/api/news?category=%D8%A3%D9%86%D8%B4%D8%B7%D8%A9');
  assert.equal(byCategory.status, 200);
  assert.ok(byCategory.body.data.length >= 2);
  assert.ok(byCategory.body.data.every((item) => item.category === 'أنشطة'));

  const search = await visitor.get('/api/news?q=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%D8%A9');
  assert.equal(search.status, 200);
  assert.ok(search.body.data.some((item) => item.slug === 'demo-lab-safety-workshop'));

  const categories = byCategory.body.meta.categories;
  assert.ok(Array.isArray(categories));
  assert.ok(categories.some((entry) => entry.name === 'أنشطة' && entry.count >= 2));
});

test('public news is paginated and never exceeds the page size', async () => {
  const { agent: visitor } = await anonymousAgent();
  const res = await visitor.get('/api/news?page=1&limit=2');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  assert.equal(res.body.meta.page, 1);
  assert.equal(res.body.meta.limit, 2);
  assert.ok(res.body.meta.total >= DEMO_NEWS_COUNT);
  assert.equal(typeof res.body.meta.hasNext, 'boolean');
});

test('a news item can be deleted permanently, demo or real', async () => {
  const { agent, token } = await adminAgent();
  const created = await createNews(agent, token, {
    title: 'خبر سيتم حذفه نهائيًا',
    slug: 'deletable-news',
  });
  const id = created.body.data.id;
  const demo = db.get('SELECT id, slug FROM news WHERE is_demo = 1 LIMIT 1');

  const realDelete = await agent.delete(`/api/admin/news/${id}`).set('x-csrf-token', token);
  assert.equal(realDelete.status, 200);
  assert.equal(realDelete.body.data.id, id);
  assert.equal(realDelete.body.data.slug, 'deletable-news');
  assert.equal(db.get('SELECT id FROM news WHERE id = ?', [id]), undefined);

  const demoDelete = await agent.delete(`/api/admin/news/${demo.id}`).set('x-csrf-token', token);
  assert.equal(demoDelete.status, 200);
  assert.equal(demoDelete.body.data.slug, demo.slug);
  assert.equal(db.get('SELECT id FROM news WHERE id = ?', [demo.id]), undefined);

  const { agent: visitor } = await anonymousAgent();
  assert.equal((await visitor.get('/api/news/deletable-news')).status, 404);
});

test('deleting a missing news item returns a clean 404', async () => {
  const { agent, token } = await adminAgent();
  const res = await agent.delete('/api/admin/news/999999').set('x-csrf-token', token);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('news validation rejects incomplete or unsafe payloads', async () => {
  const { agent, token } = await adminAgent();

  const missing = await agent.post('/api/admin/news').set('x-csrf-token', token).send({});
  assert.equal(missing.status, 400);
  assert.ok(missing.body.error.fields.title);
  assert.ok(missing.body.error.fields.summary);
  assert.ok(missing.body.error.fields.body);

  const shortBody = await createNews(agent, token, { body: 'قصير' });
  assert.equal(shortBody.status, 400);
  assert.ok(shortBody.body.error.fields.body);

  const badImage = await createNews(agent, token, { image_url: 'javascript:alert(1)' });
  assert.equal(badImage.status, 400);
  assert.ok(badImage.body.error.fields.image_url);
});

test('news writes require authentication and a CSRF token', async () => {
  const { agent: visitor, token } = await anonymousAgent();
  const unauthorized = await createNews(visitor, token);
  assert.equal(unauthorized.status, 401);

  const { agent } = await adminAgent();
  const noCsrf = await agent.post('/api/admin/news').send(validNews());
  assert.equal(noCsrf.status, 403);
});

test('unknown public news slugs return a clean 404', async () => {
  const { agent: visitor } = await anonymousAgent();
  const res = await visitor.get('/api/news/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

after(() => db.closeDatabase());
