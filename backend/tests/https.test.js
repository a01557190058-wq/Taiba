'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config');
const { forceHttps } = require('../src/middleware/https');

function makeReq({ secure = false, path = '/admin/login', originalUrl = '/admin/login?next=%2Fadmin%2Fdashboard', headers = {} } = {}) {
  return {
    secure,
    path,
    originalUrl,
    get(name) {
      return headers[String(name).toLowerCase()];
    },
  };
}

function makeRes() {
  const state = { headers: {}, redirect: null };
  return {
    state,
    setHeader(name, value) {
      state.headers[String(name).toLowerCase()] = value;
    },
    redirect(status, location) {
      state.redirect = { status, location };
    },
  };
}

test('forceHttps lets an already secure request through', () => {
  let nextCalled = false;
  forceHttps(makeReq({ secure: true }), makeRes(), () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('forceHttps trusts a proxy that reports https in X-Forwarded-Proto', () => {
  let nextCalled = false;
  forceHttps(
    makeReq({ headers: { 'x-forwarded-proto': 'https, http' } }),
    makeRes(),
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
});

test('forceHttps keeps the health endpoint reachable over http', () => {
  let nextCalled = false;
  forceHttps(makeReq({ path: '/api/health', originalUrl: '/api/health' }), makeRes(), () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('forceHttps redirects insecure requests to https and preserves the path', () => {
  const res = makeRes();
  let nextCalled = false;
  forceHttps(makeReq({ headers: { host: 'taiba.example.com' } }), res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.deepEqual(res.state.redirect, {
    status: 308,
    location: 'https://taiba.example.com/admin/login?next=%2Fadmin%2Fdashboard',
  });
  assert.equal(res.state.headers['cache-control'], 'no-store');
});

test('forceHttps prefers a configured https origin over the Host header', () => {
  const original = config.appOrigin;
  config.appOrigin = 'https://canonical.example';
  try {
    const res = makeRes();
    forceHttps(makeReq({ headers: { host: 'spoofed.example' } }), res, () => {
      throw new Error('should not call next');
    });
    assert.equal(res.state.redirect.location, 'https://canonical.example/admin/login?next=%2Fadmin%2Fdashboard');
  } finally {
    config.appOrigin = original;
  }
});

test('forceHttps ignores an invalid Host header instead of redirecting to it', () => {
  let nextCalled = false;
  forceHttps(makeReq({ headers: { host: 'evil.example/..' } }), makeRes(), () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});
