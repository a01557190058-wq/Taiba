'use strict';

const config = require('../config');

/**
 * Same-origin by default. Extra origins can be explicitly allow-listed with
 * ALLOWED_ORIGINS (comma separated). Credentials are only echoed for those
 * known origins - never `*`.
 */
function cors(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();

  const isSameOrigin = (() => {
    try {
      return new URL(origin).origin === new URL(config.appOrigin).origin;
    } catch {
      return false;
    }
  })();

  const allowed = config.allowedOrigins.includes(origin) || isSameOrigin;

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-CSRF-Token, Accept'
    );
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if (req.method === 'OPTIONS') {
    return res.status(allowed ? 204 : 403).end();
  }

  return next();
}

module.exports = { cors };
