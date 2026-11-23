'use strict';

/**
 * Seeds the real study plan (subjects by grade and department).
 * Idempotent: running it again only inserts missing records and re-hides the
 * old demo subjects. It is NEVER called automatically by the server.
 *
 * Usage: npm run db:seed:subjects
 */
const { migrate } = require('../src/db/migrate');
const { seedRealDepartments } = require('../src/services/real-departments.service');
const { seedRealSubjects } = require('../src/services/real-subjects.service');
const db = require('../src/db');

migrate({ silent: true });
seedRealDepartments();
const summary = seedRealSubjects();

/* eslint-disable no-console */
console.log('[seed:subjects] result:');
console.log(`  - subjects inserted:        ${summary.subjects_inserted}`);
console.log(`  - demo subjects promoted:   ${summary.subjects_promoted}`);
console.log(`  - demo subjects hidden:     ${summary.demo_subjects_hidden}`);
console.log(`  - study-plan note updated:  ${summary.content_note_updated}`);

const counts = db.get(
  `SELECT
     (SELECT COUNT(*) FROM subjects WHERE is_demo = 0 AND is_published = 1) AS real_public,
     (SELECT COUNT(*) FROM subjects WHERE is_demo = 1 AND is_published = 1) AS demo_public,
     (SELECT COUNT(*) FROM subjects) AS total`
);
console.log(
  `[seed:subjects] public subjects: ${counts.real_public} real, ${counts.demo_public} demo (${counts.total} total in database).`
);
/* eslint-enable no-console */
