'use strict';

const db = require('../db');
const HttpError = require('../lib/http-error');

/** Attaches the current administrator (if any) to the request. */
function attachAdmin(req, res, next) {
  req.admin = null;
  const adminId = req.session && req.session.adminId;
  if (adminId) {
    const admin = db.get(
      'SELECT id, username, email, display_name, created_at FROM admins WHERE id = ?',
      [adminId]
    );
    if (admin) {
      req.admin = admin;
    } else {
      // Stale session pointing to a deleted administrator.
      delete req.session.adminId;
    }
  }
  next();
}

/** Server-side authorization for every protected administrative route. */
function requireAdmin(req, res, next) {
  if (!req.admin) {
    return next(HttpError.unauthorized('يجب تسجيل الدخول بحساب إداري للوصول إلى هذا المورد.'));
  }
  return next();
}

module.exports = { attachAdmin, requireAdmin };
