'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const HttpError = require('../lib/http-error');
const { validate } = require('../middleware/validate');
const { loginSchema, changePasswordSchema } = require('../validators/schemas');
const { requireCsrf } = require('../middleware/csrf');
const { requireAdmin } = require('../middleware/auth');
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

router.patch(
  '/password',
  loginLimiter,
  requireAdmin,
  requireCsrf,
  validate(changePasswordSchema),
  (req, res, next) => {
    try {
      const { current_password, new_password } = req.validated;
      const admin = db.get('SELECT * FROM admins WHERE id = ?', [req.admin.id]);

      if (!admin || !bcrypt.compareSync(current_password, admin.password_hash)) {
        throw HttpError.badRequest('كلمة المرور الحالية غير صحيحة.', {
          current_password: 'كلمة المرور الحالية غير صحيحة.',
        });
      }

      const passwordHash = bcrypt.hashSync(new_password, 10);
      db.run(
        `UPDATE admins
            SET password_hash = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?`,
        [passwordHash, admin.id]
      );

      // A password change invalidates every other session for this account so a
      // leaked session cannot outlive the old credentials. Keep the session
      // that performed the change, otherwise the administrator is logged out
      // immediately.
      const otherSessions = db.all('SELECT sid, sess FROM sessions WHERE sid <> ?', [
        req.sessionID,
      ]);
      for (const row of otherSessions) {
        try {
          const data = JSON.parse(row.sess);
          if (Number(data.adminId) === Number(admin.id)) {
            db.run('DELETE FROM sessions WHERE sid = ?', [row.sid]);
          }
        } catch {
          /* ignore malformed session rows */
        }
      }

      return res.json({ data: { updated: true } });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
