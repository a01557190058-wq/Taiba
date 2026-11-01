'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const HttpError = require('../lib/http-error');
const { validate } = require('../middleware/validate');
const { loginSchema } = require('../validators/schemas');
const { requireCsrf } = require('../middleware/csrf');
const { loginLimiter } = require('../middleware/rate-limit');

const router = express.Router();

// Compared against when the account does not exist so response timing does not
// reveal whether a username/email is registered.
const DUMMY_HASH = bcrypt.hashSync('taiba-invalid-password-placeholder', 10);

function publicAdmin(admin) {
  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    display_name: admin.display_name,
    created_at: admin.created_at,
  };
}

router.post('/login', loginLimiter, requireCsrf, validate(loginSchema), (req, res, next) => {
  try {
    const { identifier, password } = req.validated;
    const needle = identifier.toLowerCase();

    const admin = db.get(
      'SELECT * FROM admins WHERE lower(email) = ? OR lower(username) = ? LIMIT 1',
      [needle, needle]
    );

    const hash = admin ? admin.password_hash : DUMMY_HASH;
    const passwordMatches = bcrypt.compareSync(password, hash);

    if (!admin || !passwordMatches) {
      throw HttpError.unauthorized('بيانات الدخول غير صحيحة.');
    }

    // Prevent session fixation: issue a brand-new session on login.
    return req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.adminId = admin.id;
      req.session.authenticatedAt = new Date().toISOString();
      return req.session.save((saveError) => {
        if (saveError) return next(saveError);
        return res.json({ data: { admin: publicAdmin(admin) } });
      });
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', requireCsrf, (req, res, next) => {
  if (!req.session) return res.json({ data: { loggedOut: true } });

  return req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie(config.session.name, { path: '/' });
    return res.json({ data: { loggedOut: true } });
  });
});

router.get('/me', (req, res, next) => {
  if (!req.admin) return next(HttpError.unauthorized('لا توجد جلسة إدارية نشطة.'));
  return res.json({ data: { admin: publicAdmin(req.admin) } });
});

module.exports = router;
