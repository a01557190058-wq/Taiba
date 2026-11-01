'use strict';

const crypto = require('node:crypto');
const config = require('../config');
const HttpError = require('../lib/http-error');

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit-cookie CSRF protection.
 * A random token is stored in a readable cookie; state-changing requests must
 * echo it in the `x-csrf-token` header. Cross-origin attackers cannot read the
 * cookie, so they cannot forge the header. SameSite=Lax adds defence in depth.
 */
function issueCsrfToken(req, res, next) {
  let token = req.cookies ? req.cookies[config.csrf.cookieName] : null;

  if (!token || !TOKEN_PATTERN.test(token)) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(config.csrf.cookieName, token, {
      httpOnly: false, // must be readable by the same-origin frontend
      sameSite: 'lax',
      secure: config.isProduction,
      path: '/',
      maxAge: config.csrf.maxAgeHours * 60 * 60 * 1000,
    });
    if (req.cookies) req.cookies[config.csrf.cookieName] = token;
  }

  res.locals.csrfToken = token;
  next();
}

function requireCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies ? req.cookies[config.csrf.cookieName] : null;
  const headerToken = req.get(config.csrf.headerName);

  if (!cookieToken || !headerToken || !TOKEN_PATTERN.test(cookieToken) || !TOKEN_PATTERN.test(headerToken)) {
    return next(
      new HttpError(403, 'CSRF_TOKEN_INVALID', 'رمز حماية الطلب غير موجود أو غير صالح. أعد تحميل الصفحة وحاول مجددًا.')
    );
  }

  const a = Buffer.from(cookieToken, 'utf8');
  const b = Buffer.from(headerToken, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(
      new HttpError(403, 'CSRF_TOKEN_INVALID', 'رمز حماية الطلب غير صالح. أعد تحميل الصفحة وحاول مجددًا.')
    );
  }

  return next();
}

module.exports = { issueCsrfToken, requireCsrf };
