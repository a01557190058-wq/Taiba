'use strict';

const config = require('./config');
const { migrate } = require('./db/migrate');
const db = require('./db');
const { seedDemoData } = require('./services/demo.service');
const { createApp } = require('./app');

// The schema is applied idempotently at boot. Demo data is NEVER seeded
// automatically - that is an explicit administrator/CLI action. The only
// exception is the opt-in SEED_DEMO_ON_EMPTY flag, used on hosts whose
// filesystem is recreated on every restart.
migrate();

if (config.seedDemoOnEmpty) {
  seedIfDatabaseIsEmpty();
}

function seedIfDatabaseIsEmpty() {
  const counts = db.get(
    `SELECT
       (SELECT COUNT(*) FROM departments)  AS departments,
       (SELECT COUNT(*) FROM applications) AS applications,
       (SELECT COUNT(*) FROM faqs)         AS faqs`
  );

  if (counts.departments || counts.applications || counts.faqs) return;

  const summary = seedDemoData();
  /* eslint-disable no-console */
  console.log(
    `[seed] قاعدة بيانات فارغة - تمت إضافة البيانات التجريبية ` +
      `(${summary.departments_inserted} قسم، ${summary.applications_inserted} طلب).`
  );
  /* eslint-enable no-console */
}

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
