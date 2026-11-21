'use strict';

/**
 * Creates or updates the initial administrator account.
 *
 * Usage:
 *   npm run admin:init                     -> uses ADMIN_* from backend/.env
 *   node scripts/create-admin.js --force   -> overwrite an existing password
 *
 * If ADMIN_PASSWORD is empty a strong password is generated and printed ONCE.
 * No password is ever stored in the repository.
 */
const crypto = require('node:crypto');
const config = require('../src/config');
const { migrate } = require('../src/db/migrate');
const db = require('../src/db');
const {
  MAX_PASSWORD_BYTES,
  hashPassword,
  passwordByteLength,
  normalizePasswordInput,
  verifyPassword,
} = require('../src/lib/passwords');

migrate({ silent: true });

const force = process.argv.includes('--force');
const username = (process.env.ADMIN_USERNAME || config.admin.username || 'admin').trim();
const email = (process.env.ADMIN_EMAIL || config.admin.email || '').trim().toLowerCase();
let password = process.env.ADMIN_PASSWORD || '';

const errors = [];
if (username.length < 3) errors.push('ADMIN_USERNAME يجب أن يكون 3 أحرف على الأقل.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('ADMIN_EMAIL يجب أن يكون بريدًا إلكترونيًا صالحًا.');
if (password && password.length < 10) errors.push('ADMIN_PASSWORD يجب أن يكون 10 أحرف على الأقل.');
if (password && passwordByteLength(normalizePasswordInput(password)) > MAX_PASSWORD_BYTES) {
  errors.push(`ADMIN_PASSWORD يجب ألا يتجاوز ${MAX_PASSWORD_BYTES} بايت.`);
}

if (errors.length) {
  console.error('[admin] ' + errors.join('\n[admin] '));
  process.exit(1);
}

let generated = false;
if (!password) {
  password = crypto.randomBytes(12).toString('base64url');
  generated = true;
}

const existing = db.get(
  'SELECT id FROM admins WHERE lower(username) = ? OR lower(email) = ? LIMIT 1',
  [username.toLowerCase(), email]
);

const passwordHash = hashPassword(password);

if (existing) {
  if (!force) {
    console.log(
      `[admin] يوجد حساب إداري بالفعل (id=${existing.id}). لإعادة تعيين كلمة المرور استخدم: node scripts/create-admin.js --force`
    );
    db.closeDatabase();
    process.exit(0);
  }
  db.run(
    `UPDATE admins
        SET username = ?, email = ?, password_hash = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?`,
    [username, email, passwordHash, existing.id]
  );
  console.log(`[admin] تم تحديث الحساب الإداري: ${username} <${email}>`);
} else {
  db.run('INSERT INTO admins (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)', [
    username,
    email,
    passwordHash,
    'مدير المجمع',
  ]);
  console.log(`[admin] تم إنشاء الحساب الإداري: ${username} <${email}>`);
}

// Fail loudly if the stored hash cannot verify the password that was written.
const saved = db.get('SELECT password_hash FROM admins WHERE lower(username) = ? LIMIT 1', [
  username.toLowerCase(),
]);
if (!saved || !verifyPassword(password, saved.password_hash)) {
  console.error('[admin] فشل التحقق من كلمة المرور بعد حفظها. لم يتم تأكيد العملية.');
  db.closeDatabase();
  process.exit(1);
}

if (generated) {
  console.log('');
  console.log('  ============================================================');
  console.log('   كلمة المرور التي تم توليدها (تُعرض مرة واحدة فقط):');
  console.log(`   ${password}`);
  console.log('   احفظها في مكان آمن. يمكنك تغييرها لاحقًا بـ --force');
  console.log('  ============================================================');
  console.log('');
} else {
  console.log('[admin] تم استخدام كلمة المرور المحددة في متغيرات البيئة.');
}

db.closeDatabase();
