'use strict';

/**
 * Seeds the demonstration dataset. Idempotent: running it again only inserts
 * records that are missing. It is NEVER called automatically by the server.
 *
 * Usage: npm run db:seed
 */
const { migrate } = require('../src/db/migrate');
const { seedDemoData } = require('../src/services/demo.service');
const db = require('../src/db');

migrate({ silent: true });
const summary = seedDemoData();

/* eslint-disable no-console */
console.log('[seed] inserted:');
console.log(`  - departments:  ${summary.departments_inserted}`);
console.log(`  - applications: ${summary.applications_inserted}`);
console.log(`  - faqs:         ${summary.faqs_inserted}`);
console.log(`  - content keys: ${summary.content_inserted}`);

const counts = db.get(
  `SELECT
     (SELECT COUNT(*) FROM departments) AS departments,
     (SELECT COUNT(*) FROM applications) AS applications`
);
console.log(`[seed] database now has ${counts.departments} departments and ${counts.applications} applications.`);
console.log('[seed] All seeded departments/applications are flagged is_demo = 1.');
/* eslint-enable no-console */
