#!/usr/bin/env node
/* Elysium — GitHub Pages deploy.
   The site is written for elysium.cc, where it is mounted at the root: the
   language switcher, the security.txt and the 404's stylesheet are all
   root-absolute. A GitHub Pages project site is mounted at /<repo>/ instead,
   so those links would resolve one level too high and break.

   Rather than make production markup relative (which would be wrong for
   elysium.cc), this writes a copy into docs/ with every root-absolute path
   prefixed. Production markup is never touched.

   It also marks the copy noindex — the staging mirror must not compete with
   the real domain in search. Remove that on launch, not here.

   Run:  node deploy.js            → docs/ for https://<user>.github.io/<repo>/
         BASE= node deploy.js      → docs/ mounted at the root instead
*/
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'docs');
const BASE = process.env.BASE === undefined ? '/elysium-website' : process.env.BASE;
// where the staging copy is served; link previews (og:image, og:url) must resolve there, not on elysium.cc
const ORIGIN = process.env.ORIGIN || 'https://timoteoadrogue.github.io';

// what ships. Anything not listed here stays out of the public mirror.
const COPY = ['index.html', 'styles.css', 'main.js', 'film3d.js', '404.html', 'favicon.svg',
              'sitemap.xml', 'assets', 'fr', 'de', '.well-known'];

const NOINDEX = '<meta name="robots" content="noindex,nofollow">';

// a version stamp on the page's stylesheet and script: Pages lets browsers keep files for 10 minutes, and a page from one
// publish with a script from another breaks. main.js passes its stamp on to film3d.js and the hero's data.
const OG = require('crypto').createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'assets/og.png'))).digest('hex').slice(0, 8);
const STAMP = require('crypto').createHash('sha1')
  .update(['main.js', 'film3d.js', 'styles.css', 'assets/hero3d/meta.json', 'assets/hero3d/terrain.png', 'assets/hero3d/city.bin']
    .map(f => fs.readFileSync(path.join(ROOT, f))).reduce((a, b) => Buffer.concat([a, b])))
  .digest('hex').slice(0, 10);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const item of COPY) {
  const src = path.join(ROOT, item);
  if (!fs.existsSync(src)) { console.warn(`  skipped (missing): ${item}`); continue; }
  fs.cpSync(src, path.join(OUT, item), { recursive: true });
}

/* Prefix root-absolute src/href. The negative lookahead leaves protocol-relative
   //host and anything already prefixed alone. */
let touched = 0, files = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.html$/.test(e.name)) continue;
    let h = fs.readFileSync(p, 'utf8');
    const before = h;

    if (BASE) h = h.replace(/\b(src|href)="\/(?!\/)/g, (m, a) => { touched++; return `${a}="${BASE}/`; });
    h = h.replace(/(property="og:(?:image|url)" content=")https:\/\/elysium\.cc\//g, `$1${ORIGIN}${BASE}/`);
    h = h.replace(/\b(src|href)="([^"?]*?(?:main\.js|styles\.css))"/g, `$1="$2?v=${STAMP}"`);
    // the share image is versioned by its own content, so apps that cached an older link preview fetch the new one
    h = h.replace(/(property="og:image" content="[^"]*?og\.png)"/g, `$1?v=${OG}"`);
    if (!h.includes('name="robots"'))
      h = h.replace('<meta name="viewport"', `${NOINDEX}\n<meta name="viewport"`);

    if (h !== before) { fs.writeFileSync(p, h); files++; }
  }
})(OUT);

// a staging mirror asks not to be indexed, and Pages must not run Jekyll over
// .well-known and other dot-paths
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const size = cp.execSync(`du -sh "${OUT}"`).toString().split('\t')[0];
console.log(`docs/ — ${files} html rewritten, ${touched} paths prefixed with "${BASE || '(root)'}", ${size.trim()}`);
console.log('robots.txt: Disallow /   ·   noindex on every page — remove both at launch');
