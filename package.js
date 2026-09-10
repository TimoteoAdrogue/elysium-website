#!/usr/bin/env node
/* Package the site as one self-contained preview file.
   Fonts and images become data: URIs, CSS and JS are inlined, and the three
   language builds collapse into one page with a live switch. The deployed
   site keeps separate /fr/ and /de/ URLs — this is for review only. */
'use strict';
const fs = require('fs'), path = require('path');
const R = __dirname, read = f => fs.readFileSync(path.join(R, f));

const MIME = { '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const dataURI = f => `data:${MIME[path.extname(f)]};base64,${read(f).toString('base64')}`;

let css = read('styles.css').toString();
css = css.replace(/url\("([^"]+\.woff2)"\)/g, (m, f) => `url("${dataURI(f)}")`);

let html = read('index.html').toString();
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
const title = (html.match(/<title>([^<]+)<\/title>/) || [, 'Elysium'])[1];

let out = body
  .replace(/<script src="(?:main\.js|assets\/vendor\/[^"]+)" defer><\/script>\s*/g, '')
  .replace(/(src|href)="((?:assets|favicon)[^"]+)"/g, (m, a, f) => `${a}="${dataURI(f)}"`);

// preview chrome: fold the language switch into the header that already exists
out = out.replace('</nav>', `</nav>
    <div class="langsw" role="group" aria-label="Language">
      <button type="button" data-lang="en" aria-pressed="true">EN</button>
      <button type="button" data-lang="fr" aria-pressed="false">FR</button>
      <button type="button" data-lang="de" aria-pressed="false">DE</button>
    </div>`);

const dicts = { fr: JSON.parse(read('i18n/fr.json')), de: JSON.parse(read('i18n/de.json')) };

const page = `<meta charset="utf-8">
<title>${title}</title>
<style>
${css}
/* preview-only: the language switch, set in the header's own idiom */
.langsw{display:flex;gap:.1rem;margin-inline-start:clamp(.6rem,1.6vw,1.4rem);flex:0 0 auto}
.langsw button{background:none;border:0;cursor:pointer;padding:.35rem .42rem;
  font-family:"PlexMono",monospace;font-size:var(--fs-mono);letter-spacing:.08em;
  color:var(--ink-3);border-bottom:1px solid transparent;
  transition:color var(--t-tick) var(--e-settle),border-color var(--t-tick) var(--e-settle)}
.langsw button:hover{color:var(--ink)}
.langsw button[aria-pressed=true]{color:var(--ink);border-bottom-color:var(--red)}
@media (max-width:900px){.hdr nav a[data-opt]{display:none}}
</style>
${out}
<script>
${read('assets/vendor/motion.js')}
</script>
<script>
${read('assets/vendor/anime.js')}
</script>
<script>
${read('main.js')}
</script>
<script>
/* language switch — same dictionaries the static build uses */
(() => {
  const DICT = ${JSON.stringify(dicts)};
  const ATTRS = ['alt','title','aria-label','placeholder','data-lead','data-tail','data-m','data-b','data-under','data-over','data-saved','data-extra','data-month','data-never'];
  const nodes = [], attrs = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    const key = n.nodeValue.replace(/\\s+/g, ' ').trim();
    if (key && /[A-Za-z]{2}/.test(key)) nodes.push([n, n.nodeValue, key]);
  }
  for (const el of document.querySelectorAll('*'))
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && v.trim()) attrs.push([el, a, v, v.trim()]);
    }
  const LANGTAG = { en: 'en-GB', fr: 'fr-CH', de: 'de-CH' };
  function setLang(l) {
    const d = DICT[l];
    window.elysiumText && elysiumText.unsplit();   // headline word masks off
    for (const [n, orig, key] of nodes) {
      const to = d && d[key];
      n.nodeValue = to ? orig.replace(key, to) : orig;
    }
    for (const [el, a, orig, key] of attrs) {
      const to = d && d[key];
      el.setAttribute(a, to || orig);
    }
    document.documentElement.lang = LANGTAG[l];
    for (const b of document.querySelectorAll('.langsw button'))
      b.setAttribute('aria-pressed', String(b.dataset.lang === l));
    window.elysiumText && elysiumText.resplit();   // and back on, in the new text
    dispatchEvent(new Event('elysium:lang'));
  }
  for (const b of document.querySelectorAll('.langsw button'))
    b.addEventListener('click', () => setLang(b.dataset.lang));
})();
</script>`;

fs.writeFileSync(path.join(R, 'elysium-preview.html'), page);
console.log(`elysium-preview.html — ${(Buffer.byteLength(page) / 1024 / 1024).toFixed(2)} MB, self-contained`);
