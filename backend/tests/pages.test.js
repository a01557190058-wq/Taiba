'use strict';

/**
 * Public page routing: every marketing page must be served as HTML.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { app, request } = require('./helpers');

const PUBLIC_PAGES = [
  ['/', 'مدرسة طيبة تكنولوجي'],
  ['/about', 'عن مدرسة طيبة تكنولوجي'],
  ['/departments', 'الأقسام التقنية'],
  ['/admission', 'القبول والتقديم'],
  ['/apply', 'نموذج التقديم'],
  ['/news', 'أخبار المدرسة'],
  ['/contact', 'تواصل معنا'],
];

test('public pages are served as HTML with their expected heading', async () => {
  for (const [route, expected] of PUBLIC_PAGES) {
    const res = await request(app).get(route);
    assert.equal(res.status, 200, `${route} should return 200`);
    assert.match(res.headers['content-type'], /text\/html/, `${route} should be HTML`);
    assert.ok(res.text.includes(expected), `${route} should contain "${expected}"`);
  }
});

test('the news page is linked from the home page navigation and footer', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  const links = res.text.match(/href="\/news"/g) || [];
  assert.ok(links.length >= 2, 'expected header and footer links to /news');
});

test('the contact page is linked from the home page navigation and footer', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  const links = res.text.match(/href="\/contact"/g) || [];
  assert.ok(links.length >= 2, 'expected header and footer links to /contact');
});

test('unknown public routes render the custom 404 page', async () => {
  const res = await request(app).get('/this-page-does-not-exist');
  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'], /text\/html/);
});
