'use strict';

/**
 * Public photo gallery: the website payload and the dashboard management API
 * (settings, sections, photos, ordering, visibility and uploads).
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  db,
  resetDatabase,
  anonymousAgent,
  adminAgent,
  GALLERY_UPLOADS_DIR,
} = require('./helpers');

beforeEach(() => resetDatabase());

const settings = (overrides = {}) => ({
  eyebrow: 'معرض الصور',
  title: 'الحياة في مدرسة طيبة',
  lead: 'لقطات من الفصول والمعامل والورش توثّق رحلة الطلاب بين النظرية والتطبيق.',
  credits_note: 'صور توضيحية من أنشطة تعليمية عامة.',
  show_credits: true,
  ...overrides,
});

const image = (overrides = {}) => ({
  url: '/assets/img/gallery/theoretical/theoretical-teacher.jpg',
  thumb_url: '/assets/img/gallery/theoretical/theoretical-teacher-thumb.jpg',
  alt: 'معلّم يشرح الدرس',
  caption: 'شرح داخل قاعة الدرس',
  credit: 'Harrison Keely — CC BY 4.0',
  credit_url: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
  is_published: true,
  ...overrides,
});

const section = (overrides = {}) => ({
  slug: 'theoretical',
  eyebrow: 'داخل الفصول',
  title: 'صور النظري',
  description: 'جولة داخل الفصول الدراسية.',
  icon: 'book',
  is_published: true,
  images: [image()],
  ...overrides,
});

// A 1x1 transparent PNG, enough for the real content sniffing check.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

function uploadPhotos(agent, token, files = [{}]) {
  const request = agent.post('/api/admin/gallery/uploads').set('x-csrf-token', token);
  for (const file of files) {
    request.attach('images', file.buffer || PNG, {
      filename: file.filename || 'photo.png',
      contentType: file.contentType || 'image/png',
    });
  }
  return request;
}

function uploadedPath(url) {
  return path.join(GALLERY_UPLOADS_DIR, path.basename(url));
}

// ---------------------------------------------------------------------------
// Public payload
// ---------------------------------------------------------------------------
test('the public gallery exposes the seeded settings, sections and photos', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent.get('/api/gallery');

  assert.equal(res.status, 200);
  const { settings: page, sections } = res.body.data;

  assert.equal(page.title, 'الحياة في مدرسة طيبة');
  assert.equal(page.show_credits, true);
  assert.equal(sections.length, 2);
  assert.deepEqual(
    sections.map((item) => item.slug),
    ['theoretical', 'practical']
  );
  assert.equal(sections[0].images.length, 6);
  assert.equal(sections[1].images.length, 6);
  assert.ok(sections[0].images[0].url.startsWith('/assets/img/gallery/'));
});

test('unpublished sections and photos never reach the public gallery', async () => {
  const { agent, token } = await adminAgent();
  const saved = await agent
    .put('/api/admin/gallery')
    .set('x-csrf-token', token)
    .send({
      settings: settings(),
      sections: [
        section({
          slug: 'hidden',
          title: 'قسم مخفي',
          is_published: false,
          images: [image()],
        }),
        section({
          slug: 'visible',
          title: 'قسم ظاهر',
          images: [image({ caption: 'ظاهرة' }), image({ is_published: false })],
        }),
      ],
    });
  assert.equal(saved.status, 200);

  const { agent: visitor } = await anonymousAgent();
  const res = await visitor.get('/api/gallery');
  const { sections } = res.body.data;

  assert.equal(sections.length, 1);
  assert.equal(sections[0].slug, 'visible');
  assert.equal(sections[0].images.length, 1);
});

// ---------------------------------------------------------------------------
// Admin access
// ---------------------------------------------------------------------------
test('the gallery dashboard API requires an administrator session', async () => {
  const { agent } = await anonymousAgent();
  const res = await agent.get('/api/admin/gallery');
  assert.equal(res.status, 401);
});

test('the admin payload includes the icon whitelist and limits', async () => {
  const { agent } = await adminAgent();
  const res = await agent.get('/api/admin/gallery');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data.icons));
  assert.ok(res.body.data.icons.includes('book'));
  assert.equal(res.body.data.limits.sections, 8);
  assert.equal(res.body.data.limits.imagesPerSection, 40);
});

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------
test('saving replaces sections and photos in the submitted order', async () => {
  const { agent, token } = await adminAgent();
  const res = await agent
    .put('/api/admin/gallery')
    .set('x-csrf-token', token)
    .send({
      settings: settings({ title: 'معرض جديد', show_credits: false }),
      sections: [
        section({
          slug: 'second',
          title: 'القسم الثاني',
          images: [image({ caption: 'أولاً' }), image({ caption: 'ثانيًا' })],
        }),
        section({ slug: 'first', title: 'القسم الأول', images: [image()] }),
      ],
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.settings.title, 'معرض جديد');
  assert.equal(res.body.data.settings.show_credits, false);
  assert.deepEqual(
    res.body.data.sections.map((item) => item.slug),
    ['second', 'first']
  );
  assert.deepEqual(
    res.body.data.sections[0].images.map((item) => item.caption),
    ['أولاً', 'ثانيًا']
  );

  const stored = db.get('SELECT COUNT(*) AS count FROM gallery_images');
  assert.equal(stored.count, 3);
});

test('duplicate section slugs are made unique instead of failing the save', async () => {
  const { agent, token } = await adminAgent();
  const res = await agent
    .put('/api/admin/gallery')
    .set('x-csrf-token', token)
    .send({
      settings: settings(),
      sections: [
        section({ slug: 'same', title: 'الأول' }),
        section({ slug: 'same', title: 'الثاني' }),
        section({ slug: 'same', title: 'الثالث' }),
      ],
    });

  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.data.sections.map((item) => item.slug),
    ['same', 'same-2', 'same-3']
  );
});

test('invalid gallery payloads are rejected with field errors', async () => {
  const { agent, token } = await adminAgent();
  const res = await agent
    .put('/api/admin/gallery')
    .set('x-csrf-token', token)
    .send({
      settings: settings({ title: 'ا' }),
      sections: [section({ title: '' })],
    });

  assert.equal(res.status, 400);
  assert.ok(res.body.error.fields['settings.title']);
  assert.ok(res.body.error.fields['sections.0.title']);
});

test('a gallery with no sections is allowed and hides everything publicly', async () => {
  const { agent, token } = await adminAgent();
  const saved = await agent
    .put('/api/admin/gallery')
    .set('x-csrf-token', token)
    .send({ settings: settings(), sections: [] });
  assert.equal(saved.status, 200);

  const { agent: visitor } = await anonymousAgent();
  const res = await visitor.get('/api/gallery');
  assert.deepEqual(res.body.data.sections, []);
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
test('an administrator can upload photos and receive public URLs', async () => {
  const { agent, token } = await adminAgent();
  const res = await uploadPhotos(agent, token, [{}, { filename: 'two.png' }]);

  assert.equal(res.status, 201);
  assert.equal(res.body.data.files.length, 2);
  for (const file of res.body.data.files) {
    assert.ok(file.url.startsWith('/assets/uploads/gallery/'));
    assert.ok(fs.existsSync(uploadedPath(file.url)));
  }
});

test('a file whose bytes are not an image is rejected and removed', async () => {
  const { agent, token } = await adminAgent();
  const res = await uploadPhotos(agent, token, [
    {
      buffer: Buffer.from('<html><script>alert(1)</script></html>'),
      filename: 'evil.png',
      contentType: 'image/png',
    },
  ]);

  assert.equal(res.status, 400);
  assert.ok(res.body.error.fields.image);
  assert.equal(fs.existsSync(GALLERY_UPLOADS_DIR), true);
  assert.deepEqual(fs.readdirSync(GALLERY_UPLOADS_DIR), []);
});

test('removing an uploaded photo from the gallery deletes its file', async () => {
  const { agent, token } = await adminAgent();
  const uploaded = await uploadPhotos(agent, token);
  const url = uploaded.body.data.files[0].url;
  assert.ok(fs.existsSync(uploadedPath(url)));

  const saved = await agent
    .put('/api/admin/gallery')
    .set('x-csrf-token', token)
    .send({
      settings: settings(),
      sections: [section({ images: [image({ url, thumb_url: '' })] })],
    });
  assert.equal(saved.status, 200);
  assert.ok(fs.existsSync(uploadedPath(url)));

  const cleared = await agent
    .put('/api/admin/gallery')
    .set('x-csrf-token', token)
    .send({ settings: settings(), sections: [] });
  assert.equal(cleared.status, 200);
  assert.equal(fs.existsSync(uploadedPath(url)), false);
});
