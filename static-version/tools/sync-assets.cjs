'use strict';

/**
 * Keeps the static copy self-contained.
 *
 * 1. Mirrors frontend/public/assets into static-version/assets/public so the
 *    static site has no dependency on the React app folder at runtime.
 * 2. Rewrites legacy links that pointed at ../frontend/public/assets/* to
 *    paths relative to the static site. Safe to run repeatedly.
 *
 * Run from anywhere: `node static-version/tools/sync-assets.cjs`.
 */
const fs = require('node:fs');
const path = require('node:path');

const staticRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(staticRoot, '..');
const source = path.join(projectRoot, 'frontend/public/assets');
const target = path.join(staticRoot, 'assets/public');

fs.cpSync(source, target, { recursive: true, force: true });

function rewrite(file, pairs) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) text = text.split(from).join(to);
  fs.writeFileSync(file, text, 'utf8');
}

for (const name of fs.readdirSync(staticRoot).filter((n) => n.endsWith('.html'))) {
  rewrite(path.join(staticRoot, name), [
    ['../frontend/public/assets/', 'assets/public/'],
    ['/frontend/public/assets/', 'assets/public/'],
  ]);
}

for (const name of ['data.js', 'app.js']) {
  rewrite(path.join(staticRoot, 'assets/js', name), [
    ['../frontend/public/assets/', 'assets/public/'],
    ['/frontend/public/assets/', 'assets/public/'],
    ['../public/img/', 'assets/public/img/'],
  ]);
}

rewrite(path.join(staticRoot, 'assets/css/style.css'), [
  ['../../../frontend/public/assets/', '../public/'],
  ['/frontend/public/assets/', '../public/'],
]);

console.log(`assets mirrored: ${fs.readdirSync(target).length} top-level entries`);
