'use strict';

/**
 * Regenerates assets/js/subjects-data.js from the real backend subject plan.
 * Run from anywhere: `node static-version/tools/generate-subjects.cjs`.
 * The generated file is plain JS loaded with a <script> tag, so the static
 * website itself never needs Node or a server.
 */
const fs = require('node:fs');
const path = require('node:path');

const staticRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(staticRoot, '..');
const { REAL_SUBJECTS } = require(path.join(
  projectRoot,
  'backend/src/db/real-subjects-data.js'
));

const body =
  '(function () {\n' +
  "  'use strict';\n" +
  '  // Generated from backend/src/db/real-subjects-data.js. Do not edit by hand.\n' +
  '  window.TAIBA_SUBJECTS = ' +
  JSON.stringify(REAL_SUBJECTS, null, 2) +
  ';\n' +
  '})();\n';

fs.writeFileSync(path.join(staticRoot, 'assets/js/subjects-data.js'), body, 'utf8');
console.log(`records: ${REAL_SUBJECTS.length}`);
