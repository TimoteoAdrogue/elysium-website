#!/usr/bin/env node
/* Elysium — language build.
   index.html is the source of truth for structure. Translations are literal
   string maps, so a structural change is made once and picked up by every
   language. Run:  node build.js            → writes fr/ and de/
                   node build.js --extract  → prints untranslated strings
   No dependencies. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const LANGS = {
  fr: { tag: 'fr', locale: 'fr_CH', dir: 'fr' },
  de: { tag: 'de', locale: 'de_CH', dir: 'de' }
};

/* ---- collect every translatable string from the source ------------------ */
// text between tags, plus the attributes that reach a human
const skipTags = /<(script|style)[\s\S]*?<\/\1>/gi;
// attributes that reach a human: accessible names, meta text, and the strings main.js reads from data-*
const ATTRS = ['alt', 'title', 'aria-label', 'placeholder', 'content',
  'data-m', 'data-title', 'data-unit', 'data-source', 'data-where', 'data-topic',
  'data-of', 'data-source-label', 'data-bars', 'data-view-chart', 'data-view-table',
  'data-err-name', 'data-err-email', 'data-err-format', 'data-err-msg', 'data-not-sent',
  'data-measured', 'data-interp', 'data-a00', 'data-a15'];
const skipTags2 = /<(script|style)[\s\S]*?<\/\1>/gi;
function strings(html) {
  const out = new Set();
  const body = html.replace(skipTags, '');
  for (const m of body.matchAll(/>([^<>]+)</g)) {
    const s = m[1].replace(/\s+/g, ' ').trim();
    if (s && /[A-Za-z]{2}/.test(s) && !/^[\d\s.,%$/·—–-]+$/.test(s)) out.add(s);
  }
  for (const a of ATTRS)
    for (const m of body.matchAll(new RegExp(`\\s${a}="([^"]+)"`, 'g'))) {
      const s = m[1].trim();
      if (s && /[A-Za-z]{2}/.test(s) && !/^(https?:|width=|summary_large)/.test(s)) out.add(s);
    }
  return [...out];
}

if (process.argv.includes('--extract')) {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'fr.json'), 'utf8'));
  const missing = strings(SRC).filter(s => !(s in dict));
  console.log(JSON.stringify(Object.fromEntries(missing.map(s => [s, ''])), null, 1));
  console.error(`${missing.length} untranslated`);
  process.exit(0);
}

/* ---- render one language ------------------------------------------------ */
function render(lang, cfg) {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', `${lang}.json`), 'utf8'));
  let h = SRC;

  // Substitute inside text nodes and named attributes only. A bare
  // split/join would rewrite "Change" inside "Changes" and inside markup.
  let hit = 0, miss = [];
  // shield script/style bodies: JSON-LD is not translatable text
  const shelf = [];
  h = h.replace(skipTags2, m => { shelf.push(m); return `<!--SH${shelf.length - 1}-->`; });
  h = h.replace(/>([^<>]+)</g, (m, raw) => {
    const key = raw.replace(/\s+/g, ' ').trim();
    if (!key || !/[A-Za-z]{2}/.test(key)) return m;
    if (!(key in dict)) { miss.push(key); return m; }
    if (!dict[key]) return m;                       // deliberately kept in source language
    hit++;
    const lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0];
    return '>' + lead + dict[key] + tail + '<';
  });
  for (const a of ATTRS)
    h = h.replace(new RegExp(`(\\s${a}=")([^"]+)(")`, 'g'), (m, p, v, q) =>
      dict[v.trim()] ? p + dict[v.trim()] + q : m);

  h = h.replace(/<!--SH(\d+)-->/g, (m, i) => shelf[+i]);

  // one directory down: relative asset paths need a hop
  h = h.replace(/(src|href)="(?!https?:|\/|#|mailto:|tel:|data:)/g, '$1="../');
  h = h.replace(/srcset="([^"]+)"/g, (m, v) => 'srcset="' + v.split(',').map(x => x.trim()).map(x => /^(https?:|\/|data:)/.test(x) ? x : '../' + x).join(', ') + '"');
  // language switches
  h = h.replace('<html lang="en-GB">', `<html lang="${cfg.tag}-CH">`);
  h = h.replace('<meta property="og:locale" content="en_GB">',
                `<meta property="og:locale" content="${cfg.locale}">`);
  h = h.replace('<link rel="canonical" href="https://elysium.cc/">',
                `<link rel="canonical" href="https://elysium.cc/${cfg.dir}/">`);
  h = h.replace('<meta property="og:url" content="https://elysium.cc/">',
                `<meta property="og:url" content="https://elysium.cc/${cfg.dir}/">`);
  // footer language state
  h = h.split('hreflang="en" aria-current="true">').join('hreflang="en">');
  h = h.split(`hreflang="${cfg.tag}">`).join(`hreflang="${cfg.tag}" aria-current="true">`);

  const dir = path.join(ROOT, cfg.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), h);

  const unknown = [...new Set(miss)];
  console.log(`${lang}: ${cfg.dir}/index.html — ${hit} nodes translated, ${unknown.length} keys not in dictionary`);
  if (unknown.length) console.log('   missing: ' + unknown.slice(0, 12).map(s => JSON.stringify(s.slice(0, 48))).join(', '));
}

for (const [lang, cfg] of Object.entries(LANGS)) render(lang, cfg);

/* sitemap covers all three */
const urls = ['', 'fr/', 'de/'].map(u => `  <url><loc>https://elysium.cc/${u}</loc><lastmod>2026-10-03</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="https://elysium.cc/"/>
    <xhtml:link rel="alternate" hreflang="fr" href="https://elysium.cc/fr/"/>
    <xhtml:link rel="alternate" hreflang="de" href="https://elysium.cc/de/"/>
  </url>`).join('\n');
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`);
console.log('sitemap.xml: 3 locales');
