#!/usr/bin/env node
/* Package the site as one self-contained preview file (review only; the deployed
   site keeps separate files and /fr/ /de/ URLs).
   Fonts and images become data: URIs, CSS and JS are inlined, and main.js's
   import of anime.js is pointed at a data: URL so the module runs from file://.
   <picture> sources are dropped and the JPEG fallback is inlined, which keeps the
   file to one image per slot. */
'use strict';
const fs = require('fs'), path = require('path');
const R = __dirname, read = f => fs.readFileSync(path.join(R, f));

const MIME = { '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript' };
const dataURI = f => `data:${MIME[path.extname(f)]};base64,${read(f).toString('base64')}`;

let css = read('styles.css').toString().replace(/url\("([^"]+\.woff2)"\)/g, (m, f) => `url("${dataURI(f)}")`);
const html = read('index.html').toString();
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'))
  .replace(/<link rel="(stylesheet|preload|icon)"[^>]*>\s*/g, '');
let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script[^>]*src="[^"]+"[^>]*><\/script>\s*/g, '')
  .replace(/<source [^>]*>/g, '')
  .replace(/\s(srcset|sizes)="[^"]*"/g, '')
  .replace(/(src|href)="((?:assets|favicon)[^"]+)"/g, (m, a, f) => `${a}="${dataURI(f)}"`);

const anime = dataURI('assets/vendor/anime.esm.min.js');
const main = read('main.js').toString().replace("'./assets/vendor/anime.esm.min.js'", `'${anime}'`);

const page = `<!doctype html>
<html lang="en-GB">
<head>${head}<style>
${css}
</style></head>
<body>${body}
<script>
${read('assets/vendor/lenis.min.js')}
</script>
<script type="module">
${main}
</script>
</body></html>`;

fs.writeFileSync(path.join(R, 'elysium-preview.html'), page);
console.log(`elysium-preview.html — ${(Buffer.byteLength(page) / 1024 / 1024).toFixed(2)} MB, self-contained`);
