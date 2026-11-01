'use strict';

const config = require('./config');
const { migrate } = require('./db/migrate');
const db = require('./db');
const { createApp } = require('./app');

// The schema is applied idempotently at boot. Demo data is NEVER seeded
// automatically - that is an explicit administrator/CLI action.
migrate();

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  const base = `http://${config.host}:${config.port}`;
  /* eslint-disable no-console */
  console.log('');
  console.log('  مدرسة طيبة تكنولوجي - الخادم يعمل');
  console.log(`  الموقع:        ${base}`);
  console.log(`  لوحة التحكم:   ${base}/admin`);
  console.log(`  قاعدة البيانات: ${config.paths.db}`);
  console.log(`  البيئة:        ${config.env}`);

  const admins = db.get('SELECT COUNT(*) AS count FROM admins');
  if (!admins || admins.count === 0) {
    console.log('');
    console.log('  [!] لا يوجد حساب إداري بعد. شغّل: npm run admin:init');
  }
  console.log('');
  /* eslint-enable no-console */
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`المنفذ ${config.port} مستخدم بالفعل. غيّر PORT في ملف .env.`);
    process.exit(1);
  }
  throw error;
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n[server] ${signal} - إيقاف الخادم...`);
  server.close(() => {
    db.closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
