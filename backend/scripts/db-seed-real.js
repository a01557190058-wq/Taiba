'use strict';

/**
 * Seeds the real vocational specialisations of Taiba Technology Complex.
 * Idempotent: running it again only inserts missing records and re-hides the
 * old demo departments. It is NEVER called automatically by the server.
 *
 * Usage: npm run db:seed:real
 */
const { migrate } = require('../src/db/migrate');
const { seedRealDepartments } = require('../src/services/real-departments.service');
const db = require('../src/db');

migrate({ silent: true });
const summary = seedRealDepartments();

/* eslint-disable no-console */
console.log('[seed:real] result:');
console.log(`  - departments inserted:   ${summary.departments_inserted}`);
console.log(`  - demo departments converted: ${summary.departments_converted}`);
console.log(`  - placeholder covers replaced: ${summary.covers_updated}`);
console.log(`  - demo departments hidden:    ${summary.demo_departments_hidden}`);

const counts = db.get(
  `SELECT
     (SELECT COUNT(*) FROM departments WHERE is_demo = 0 AND is_published = 1 AND is_active = 1) AS real_public,
     (SELECT COUNT(*) FROM departments WHERE is_demo = 1 AND is_published = 1 AND is_active = 1) AS demo_public,
     (SELECT COUNT(*) FROM departments) AS total`
);
console.log(
  `[seed:real] public departments: ${counts.real_public} real, ${counts.demo_public} demo (${counts.total} total in database).`
);
/* eslint-enable no-console */
