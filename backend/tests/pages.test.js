'use strict';

/**
 * SPA page routing.
 *
 * The site and the dashboard are React applications built into
 * `frontend/dist`. Express only serves the matching HTML shell for every
 * route (deep links included); the visible content is rendered client-side,
 * so these tests assert the shell, the HTTP status and the CSP-safe markup
 * rather than server-rendered headings.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { app, request } = require('./helpers');

const PUBLIC_PAGES = [
  '/',
  '/about',
  '/departments',
  '/departments/programming',
  '/subjects',
  '/admission',
  '/apply',
  '/news',
  '/news/some-article',
  '/gallery',
  '/contact',
];

const ADMIN_PAGES = [
  '/admin',
  '/admin/',
  '/admin/login',
  '/admin/dashboard',
  '/admin/departments',
  '/admin/departments/new',
  '/admin/departments/1/edit',
  '/admin/subjects',
  '/admin/subjects/new',
  '/admin/subjects/1/edit',
  '/admin/applications',
  '/admin/applications/1',
  '/admin/news',
  '/admin/news/new',
  '/admin/news/1/edit',
  '/admin/content',
  '/admin/demo-data',
];

function assertPublicShell(res, label) {
  assert.equal(res.status, 200, `${label} should return 200`);
  assert.match(res.headers['content-type'], /text\/html/, `${label} should be HTML`);
  assert.match(res.text, /<div id="root"><\/div>/, `${label} should expose the React root`);
  assert.match(res.text, /data-app="public"/, `${label} should use the public shell`);
  // Strict CSP: no inline scripts may be emitted by the build.
  assert.doesNotMatch(res.text, /<script(?![^>]*\bsrc=)[^>]*>/i, `${label} must not inline scripts`);
}

test('public routes are served the public React shell', async () => {
  for (const route of PUBLIC_PAGES) {
    const res = await request(app).get(route);
    assertPublicShell(res, route);
  }
});

test('admin routes are served the admin React shell', async () => {
  for (const route of ADMIN_PAGES) {
    const res = await request(app).get(route);
    assert.equal(res.status, 200, `${route} should return 200`);
    assert.match(res.headers['content-type'], /text\/html/, `${route} should be HTML`);
    assert.match(res.text, /<div id="root"><\/div>/, `${route} should expose the React root`);
    assert.match(res.text, /data-app="admin"/, `${route} should use the admin shell`);
    assert.doesNotMatch(
      res.text,
      /<script(?![^>]*\bsrc=)[^>]*>/i,
      `${route} must not inline scripts`
    );
  }
});

test('the public shell loads hashed external assets', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /<script[^>]+src="\/assets\/js\/[^"]+\.js"/, 'expected a bundled module script');
  assert.match(res.text, /<link[^>]+href="\/assets\/css\/[^"]+\.css"/, 'expected a bundled stylesheet');
});

test('unknown public routes return the shell with a 404 status', async () => {
  const res = await request(app).get('/this-page-does-not-exist');
  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.text, /<div id="root"><\/div>/);
  assert.match(res.text, /data-app="public"/);
});

test('robots.txt disallows the admin dashboard', async () => {
  const res = await request(app).get('/robots.txt');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/plain/);
  assert.match(res.text, /Disallow: \/admin/);
});
