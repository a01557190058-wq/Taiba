'use strict';

/** Creates the schema (idempotent). Usage: npm run db:init */
const config = require('../src/config');
const { migrate } = require('../src/db/migrate');
const db = require('../src/db');

const result = migrate();
const tables = db
  .all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .map((row) => row.name);

// eslint-disable-next-line no-console
console.log(`[db] tables: ${tables.join(', ')}`);
// eslint-disable-next-line no-console
console.log(`[db] database file: ${result.path}`);
// eslint-disable-next-line no-console
console.log('[db] done. Next: npm run admin:init && npm run db:seed');
