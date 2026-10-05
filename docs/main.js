/* Elysium — motion.
   anime.js 4 and Lenis, advanced on one clock. Every word and every number is
   already in the HTML at its final value; this file only enhances. Each
   animation carries one line saying what it shows. */
import { animate, createTimeline, stagger, onScroll, spring, svg, utils, splitText, engine, cubicBezier, steps } from './assets/vendor/anime.esm.min.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
root.classList.add('js');
if (!reduce) root.classList.add('js-motion');

/* ---- tokens: read from the stylesheet, never restated ---- */
const css = getComputedStyle(root);
const tok = n => css.getPropertyValue(n).trim();
const nums = n => (tok(n).match(/-?\d*\.?\d+/g) || []).map(Number);
const T = {
  spring: Object.fromEntries(['snap', 'glide', 'float'].map(k => { const [stiffness, damping] = nums(`--spring-${k}`); return [k, { stiffness, damping }]; })),
  ease: { enter: cubicBezier(...nums('--ease-enter')), scrub: cubicBezier(...nums('--ease-scrub')), sync: t => t },
  t: Object.fromEntries(['tick', 'move', 'reveal', 'draw'].map(k => [k, parseFloat(tok(`--t-${k}`))])),
};
const sp = k => spring(T.spring[k]);
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* ---- one clock: Lenis, anime and the per-frame jobs advance in the same frame ---- */
let lenis = null;
const tickers = new Set();
if (!reduce && window.Lenis) {
  lenis = new Lenis({ autoRaf: false });
  engine.useDefaultMainLoop = false;
}
{
  let last = performance.now();
  requestAnimationFrame(function raf(t) {
    const dt = Math.min(64, t - last); last = t;
    if (lenis) { lenis.raf(t); engine.update(); }
    for (const f of tickers) f(dt);
    requestAnimationFrame(raf);
  });
}
const scrollTop = () => lenis ? lenis.scroll : scrollY;
const scrollFns = new Set();
const runScroll = () => { for (const f of scrollFns) f(); };
if (lenis) lenis.on('scroll', runScroll); else addEventListener('scroll', runScroll, { passive: true });

/* Layout is read only here — on load, on resize, when fonts land — never inside a scroll handler. */
const measures = new Set();
const remeasure = () => { for (const m of measures) m(); runScroll(); };
new ResizeObserver(remeasure).observe(document.body);
const docTop = el => el.getBoundingClientRect().top + scrollTop();
const belowFold = el => el.getBoundingClientRect().top > innerHeight;
const once = (target, enter, fn) => {
  let done = false;
  onScroll({ target, enter, onEnter: () => { if (!done) { done = true; fn(); } } });
};

/* ---- clocks: the time where each office is ---- */
{
  const fmts = new Map();
  const fmt = tz => fmts.get(tz) || fmts.set(tz, new Intl.DateTimeFormat('fr-CH', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).get(tz);
  (function tick() {
    const d = new Date();
    for (const el of $$('[data-clock]')) { el.textContent = fmt(el.dataset.tz || 'Europe/Zurich').format(d); el.dateTime = d.toISOString(); }
    setTimeout(tick, 60000 - d.getTime() % 60000 + 20);
  })();
}

/* ---- nav: steps aside while reading down, back on the first scroll up ---- */
const nav = $('#nav');
let navHoldUntil = 120;                 // the flag docks into the nav, so the nav stays put until it lands
if (!reduce) {
  let last = 0, hidden = false;
  scrollFns.add(() => {
    const y = scrollTop(), d = y - last;
    if (Math.abs(d) < 4) return;
    last = y;
    const hide = d > 0 && y > navHoldUntil && !nav.contains(document.activeElement);
    if (hide === hidden) return;
    hidden = hide;
    // the bar slides out of the reading area and returns when the reader turns back
    animate(nav, { y: hide ? '-100%' : '0%', duration: T.t.move, ease: T.ease.enter });
  });
}

/* ---- active section: one pill travels between the nav links ---- */
{
  const ul = $('.links'), pill = $('.links .pill'), links = $$('.links a');
  let current = null;
  const clipFor = a => {
    const u = ul.getBoundingClientRect(), r = a.getBoundingClientRect();
    return `inset(0px ${(u.right - r.right).toFixed(1)}px 0px ${(r.left - u.left).toFixed(1)}px round 999px)`;
  };
  const hide = 'inset(0px 100% 0px 0px round 999px)';
  const setActive = id => {
    const a = links.find(l => l.hash === '#' + id) || null;
    if (a === current) return;
    links.forEach(l => l === a ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current'));
    const was = current; current = a;
    if (!ul.offsetParent) return;
    if (!a) { utils.set(pill, { clipPath: hide }); return; }
    // the pill slides to the section being read (FLIP through clip-path, no width animation)
    if (!was || reduce) utils.set(pill, { clipPath: clipFor(a) });
    else animate(pill, { clipPath: clipFor(a), ease: sp('snap') });
  };
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -54% 0px' });
  $$('main > section[id]').forEach(s => io.observe(s));
  measures.add(() => { if (current && ul.offsetParent) utils.set(pill, { clipPath: clipFor(current) }); });
}

/* ---- ground: --raised fades in over 30vh as a raised section arrives, and out as it leaves ---- */
if (!reduce) {
  const ground = $('.ground'), secs = $$('[data-ground="raised"]');
  let spans = [];
  measures.add(() => { spans = secs.map(s => { const t = docTop(s); return [t, t + s.offsetHeight]; }); });
  scrollFns.add(() => {
    const vh = innerHeight, k = vh * .3, edge = scrollTop() + vh * .85;
    const p = v => clamp01((edge - v) / k);
    let o = 0;
    for (const [a, b] of spans) o = Math.max(o, p(a) - p(b));
    ground.style.opacity = o.toFixed(3);            // scroll-synced, linear, exactly reversible
  });
  root.classList.add('ground-live');
}

/* ---- hero film: Switzerland as a 3D scan of real elevation data, flown Zürich → Geneva by scroll.
   Its last frame is the page grid, so the film hands over to the template without a cut.
   Self-contained: remove this block, the .hf-* markup and the .hf-* styles to drop it. ---- */
const film = (() => {
  const sec = $('.hero-film');
  if (!sec || reduce || !lenis || navigator.connection?.saveData) return null;
  const name = matchMedia('(max-aspect-ratio: 1/1)').matches ? 'portrait' : 'landscape';
  const url = f => new URL(`./assets/hero/${f}`, import.meta.url).href;
  const stage = $('.hf-stage', sec), video = $('.hf-video', sec), kids = [...$('.hero', sec).children];
  const pins = $$('.hf-pin', sec), hud = $('.hf-hud', sec), cue = $('.hf-cue', sec), scrim = $('.hf-scrim', sec);
  const rd = $$('.hf-read b', sec), fr = $('.hf-frame b', sec), dot = $('.hf-route em', sec);
  const nf = new Intl.NumberFormat(root.lang), df = new Intl.NumberFormat(root.lang, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const sm = (a, b, v) => { v = clamp01((v - a) / (b - a)); return v * v * (3 - 2 * v); };
  const WIN = [[0, .1], [.19, .27], [.5, .57], [.6, .8]];         // when each pin may show: Zürich, Pilatus, the lake, Geneva
  const api = { mark: 1, onEnd: null };
  let meta = null, top = 0, span = 1, dy = 0, vw = 1, vh = 1, dur = 0, ended = false;
  root.classList.add('film-live');
  video.poster = url(`poster-${name}.webp`);

  // seeks are serialised: one in flight, the latest request waits and wins
  let busy = false, want = null;
  const seek = t => { if (busy) { want = t; return; } busy = true; try { video.currentTime = t; } catch { busy = false; } };
  video.addEventListener('seeked', () => { busy = false; if (want !== null) { const t = want; want = null; seek(t); } });
  // a src swap orphans the seek in flight, so the queue is reset with it
  const attach = src => {
    busy = false; want = null; video.src = src; video.load();
    video.addEventListener('loadeddata', () => { dur = video.duration; run(); }, { once: true });
    video.play().then(() => video.pause()).catch(() => {});        // iOS loads frames only after a play
  };
  const start = () => {
    const mp4 = url(`film-${name}.mp4`);
    video.preload = 'auto'; attach(mp4);                            // range requests: the film answers at once
    fetch(mp4).then(r => r.ok ? r.blob() : Promise.reject()).then(b => attach(URL.createObjectURL(b))).catch(() => {});  // then from memory: every seek immediate
  };
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  fetch(url(`film-${name}.json`)).then(r => r.json()).then(m => { meta = m; run(); }).catch(() => {});

  measures.add(() => {
    top = docTop(sec); span = Math.max(1, sec.offsetHeight - innerHeight);
    vw = stage.clientWidth; vh = stage.clientHeight;
    const h1 = kids[1], saved = h1.style.transform; h1.style.transform = 'none';
    dy = vh * .86 - (h1.getBoundingClientRect().bottom - stage.getBoundingClientRect().top);   // the slogan opens low over the film
    h1.style.transform = saved;
  });
  function run() {
    const p = clamp01((scrollTop() - top) / span), n = meta ? meta.f.length : 240, i = Math.round(p * (n - 1));
    if (dur) seek(Math.min(dur - .001, (i + .5) / (meta ? meta.fps : 30)));
    video.style.opacity = (1 - sm(.985, 1, p)).toFixed(3);            // the last frame is the grid underneath
    cue.style.opacity = (1 - sm(0, .03, p)).toFixed(3);
    hud.style.opacity = (sm(.06, .12, p) * (1 - sm(.8, .86, p))).toFixed(3);
    scrim.style.opacity = (1 - sm(.05, .12, p) * .45).toFixed(3);
    // eyebrow and slogan open the film and leave with the first metres; the whole hero lands on the grid at the end
    kids.forEach((k, j) => {
      let o, y;
      if (p < .5) { o = j < 2 ? 1 - sm(.02, .09, p) : 0; y = j < 2 ? dy - 60 * sm(0, .1, p) : 0; }
      else { o = sm(.85 + j * .015, .9 + j * .015, p); y = 24 * (1 - o); }
      k.style.opacity = o.toFixed(3); k.style.transform = `translateY(${y.toFixed(1)}px)`;
    });
    api.mark = 1 - sm(.8, .88, p);
    if (!ended && p > .9) { ended = true; api.onEnd?.(); }
    if (!meta) return;
    const f = meta.f[i];
    rd[0].textContent = `${df.format(Math.abs(f[0]))}° ${f[0] >= 0 ? 'N' : 'S'}`;
    rd[1].textContent = `${df.format(Math.abs(f[1]))}° ${f[1] >= 0 ? 'E' : 'W'}`;
    rd[2].textContent = `${nf.format(f[2])} m`;
    rd[3].textContent = `${f[3]}°`;
    fr.textContent = String(i + 1).padStart(3, '0');
    dot.style.left = `${(100 * Math.min(p / .74, 1)).toFixed(2)}%`;
    // pins follow their place in the frame (object-fit: cover)
    const s = Math.max(vw / meta.w, vh / meta.h), ox = (vw - meta.w * s) / 2, oy = (vh - meta.h * s) / 2;
    pins.forEach((el, k) => {
      const L = f[4 + k], w = WIN[k];
      let o = 0;
      if (L) {
        const X = ox + L[0] * s, Y = oy + L[1] * s;
        if (X > 40 && X < vw - 40 && Y > 110 && Y < vh - 90) o = sm(w[0], w[0] + .03, p) * (1 - sm(w[1] - .03, w[1], p));
        el.style.transform = `translate(${X.toFixed(1)}px,${Y.toFixed(1)}px)`;
        el.classList.toggle('flip', X > vw - 240);
      }
      el.style.opacity = o.toFixed(3);
    });
  }
  scrollFns.add(run);
  return api;
})();

/* ---- hero: the slogan rises out of its line box; the entrance resolves inside 1.1 s ---- */
if (!reduce) {
  // characters on wide screens; words on phones, where per-character boxes lose kerning and the slogan would wrap
  const sp1 = innerWidth >= 768 ? splitText($('.hero h1'), { chars: { wrap: 'clip' } }).chars : splitText($('.hero h1'), { words: { wrap: 'clip' } }).words;
  const chars = sp1;
  const tl = createTimeline()
    .add($('.hero .eyebrow'), { opacity: [0, 1], duration: T.t.move, ease: T.ease.enter }, 0)
    .add(chars, { y: ['105%', '0%'], duration: 700, ease: T.ease.enter, delay: stagger(16) }, 60);
  // with the film, the rest of the hero waits for the end of the flight
  if (!film) tl.add($$('.hero .lede, .hero .ctas, .hero .hero-new'), { opacity: [0, 1], y: [12, 0], duration: T.t.move, ease: T.ease.enter, delay: stagger(80) }, 560);
}

/* ---- the flag: built cell by cell, then docked into the nav as the hero leaves ---- */
{
  const fig = $('.flag'), fb = $('#flag-build'), cellsG = $('.cells', fb), solid = $('.solid', fb);
  const navMark = $('.brand .mark');
  if (reduce) {
    // static flag; the nav mark appears with a plain fade once the hero flag is off screen
    new IntersectionObserver(([e]) => animate(navMark, { opacity: e.isIntersecting ? 0 : 1, duration: T.t.tick, ease: 'linear' })).observe(fig);
  } else {
    const phone = innerWidth < 900;                    // below 900 px the flag sits in the flow under the hero text, as on a phone
    const N = 32, c = 15.5;
    const inCross = (x, y) => (x >= 13 && x < 19 && y >= 6 && y < 26) || (y >= 13 && y < 19 && x >= 6 && x < 26);
    // field cells sit in 16 concentric rings so the release can be scrubbed with 16 writes a frame
    const rings = Array.from({ length: 16 }, (_, r) => `<g data-r="${r}">`);
    let crossHtml = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const cell = `<rect x="${x}" y="${y}" width="1" height="1" data-i="${y * N + x}"`;
      if (inCross(x, y)) crossHtml += `${cell} fill="#FFFFFF"/>`;
      else rings[Math.floor(Math.max(Math.abs(x - c), Math.abs(y - c)))] += `${cell} fill="#DA291C"/>`;
    }
    cellsG.innerHTML = rings.map(r => r + '</g>').join('') + `<g class="cross">${crossHtml}</g>`;
    const ringGs = $$('[data-r]', cellsG);
    const cells = $$('rect', cellsG).sort((a, b) => a.dataset.i - b.dataset.i);
    const d = stagger(1, { grid: [N, N], from: 'center' });
    const dist = cells.map((el, i) => d(el, i, cells));
    const cross = [], field = [], cd = [], fd = [];
    cells.forEach((el, i) => el.getAttribute('fill') === '#FFFFFF' ? (cross.push(el), cd.push(dist[i])) : (field.push(el), fd.push(dist[i])));
    const norm = (ds, span) => { const lo = Math.min(...ds), hi = Math.max(...ds); return ds.map(v => (v - lo) / (hi - lo) * span); };
    const cD = norm(cd, 600 - T.t.tick), fD = norm(fd, 700 - T.t.tick);
    solid.style.opacity = 0;
    utils.set(cells, { opacity: 0 });
    navMark.style.opacity = film ? 1 : 0;
    root.classList.add('dock-live');
    const build = delay => createTimeline({ delay })
      // the cross assembles in white, outward from the centre; it is never red
      .add(cross, { opacity: [0, 1], duration: T.t.tick, ease: 'linear', delay: (_, i) => cD[i] }, 0)
      // the red field closes in around the finished cross
      .add(field, { opacity: [0, 1], duration: T.t.tick, ease: 'linear', delay: (_, i) => fD[i] }, 600);
    // on a phone the flag sits below the fold, so it is built when it scrolls into view rather than unseen on load
    const fr = fig.getBoundingClientRect();
    if (film) film.onEnd = () => build(0);                // with the hero film, the flag is built as the flight lands
    else if (!phone || fr.bottom <= innerHeight || fr.top < 0) build(250); else once(fig, 'bottom 80%', () => build(0));
    const navY = () => { const t = nav.style.transform.match(/-?[\d.]+%/); return t ? parseFloat(t[0]) / 100 * nav.offsetHeight : 0; };
    const releaseRings = rel => ringGs.forEach((g, r) => { g.style.opacity = clamp01(1 - (rel * 17 - (15 - r))).toFixed(3); });

    if (phone) {
      // phones: the flag scrolls with the page until it meets the nav, then rides there position:fixed — anchored by the
      // compositor, so it holds still under a native touch scroll — while the field releases and the cross condenses into the mark
      root.classList.add('dock-fixed');
      let size = 1, left = 0, ride = 0, sRide = 0, span = 1, mx = 0, my = 0, fixed = false;
      const pin = on => Object.assign(fb.style, on ? { left: `${left}px`, top: `${ride}px`, width: `${size}px` } : { left: '', top: '', width: '' });
      measures.add(() => {
        const r = fig.getBoundingClientRect(), cs = getComputedStyle(fig), m = navMark.getBoundingClientRect();
        const pl = parseFloat(cs.paddingLeft);
        size = r.width - pl - parseFloat(cs.paddingRight); left = r.left + pl;
        fig.style.minHeight = `${size}px`;                 // keeps the flag's place in the hero while it rides
        ride = nav.offsetHeight + 16; sRide = docTop(fig) - ride; span = innerHeight * .4;
        mx = m.left + m.width / 2; my = m.top - nav.getBoundingClientRect().top + m.height / 2;
        navHoldUntil = Math.max(120, sRide + span + 240);
        if (fixed) pin(true);
      });
      scrollFns.add(() => {
        const y = scrollTop();
        // p crosses .5 exactly as the flag meets the nav, so the ride and the condensing begin together
        const p = clamp01((y - sRide + span) / (2 * span));
        const q = T.ease.scrub(clamp01((p - .5) / .5));
        releaseRings(clamp01((p - .1) / .45));
        if (fixed !== (y >= sRide)) { fixed = !fixed; pin(fixed); fb.classList.toggle('ride', fixed); }
        const s = 1 + (16 / size - 1) * q, half = size / 2;
        const dx = (mx - left - half) * q, dy = (my + navY() - ride - half) * q;
        fb.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${s.toFixed(4)}) perspective(1200px) rotateX(${(12 * clamp01(p / .5) * (1 - q)).toFixed(2)}deg)`;
        fb.style.opacity = q > .92 ? (1 - (q - .92) / .08).toFixed(3) : 1;
        navMark.style.opacity = Math.max(film ? film.mark : 0, clamp01((q - .9) / .1)).toFixed(3);
      });
    } else {
      // dock: tilt ≤ 12°, field cells release outermost first, the white cross condenses into the 16 px nav mark
      let top = 0, h = 1, cx = 0, cy = 0, size = 1, mx = 0, my = 0;
      measures.add(() => {
        const saved = fb.style.transform; fb.style.transform = 'none';
        const r = fb.getBoundingClientRect(), m = navMark.getBoundingClientRect();
        fb.style.transform = saved;
        cx = r.left + r.width / 2; cy = r.top + scrollTop() + r.height / 2; size = r.width;
        if (film) {
          // the dock starts where the film's sticky stage lets go
          const s = $('.hero-film'), st = $('.hf-stage');
          top = docTop(s) + s.offsetHeight - innerHeight; h = innerHeight;
          cy = top + r.top - st.getBoundingClientRect().top + r.height / 2;
        } else { const hero = $('.hero'); top = docTop(hero); h = hero.offsetHeight; }
        navHoldUntil = Math.max(120, top + h * .8 + 240);
        mx = m.left + m.width / 2; my = m.top + m.height / 2;
      });
      scrollFns.add(() => {
        const p = clamp01((scrollTop() - top) / (h * .8));
        const q = T.ease.scrub(clamp01((p - .5) / .5));
        releaseRings(clamp01((p - .1) / .45));
        // the flag rides just under the nav once it reaches it, then shrinks and slides into the mark
        const s = 1 + (16 / size - 1) * q, natY = cy - scrollTop(), half = size * s / 2;
        const minY = (nav.offsetHeight + half + 16) * (1 - q) + (my + navY()) * q;
        const dx = (mx - cx) * q, dy = Math.max(natY, minY) - natY;
        fb.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${s.toFixed(4)}) rotateX(${(12 * clamp01(p / .5) * (1 - q)).toFixed(2)}deg)`;
        fb.style.opacity = q > .92 ? (1 - (q - .92) / .08).toFixed(3) : 1;
        navMark.style.opacity = Math.max(film ? film.mark : 0, clamp01((q - .9) / .1)).toFixed(3);
      });
    }
  }
}

/* ---- section overture: rule draws, index types, heading rises word by word, body follows ---- */
const overture = sec => {
  const rule = $('.sec-rule', sec), idx = $('.idx', sec), h2 = $('h2', sec), body = $$('.sec-head .lede', sec);
  if (!rule || !idx || !h2) return;
  const words = splitText(h2, { words: { wrap: 'clip' } }).words;
  const n = idx.textContent.length;
  const play = () => createTimeline()
    // the top hairline draws left to right: a new section starts here
    .add(rule, { clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], duration: 600, ease: T.ease.enter }, 0)
    // the index label types in, one character per 18 ms
    .add(idx, { clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], duration: n * 18, ease: steps(n) }, 200)
    // the heading rises out of its own measure, 40 ms per word
    .add(words, { y: ['105%', '0%'], duration: T.t.reveal, ease: T.ease.enter, delay: stagger(40) }, 360)
    // the body follows once the heading has landed
    .add(body, { opacity: [0, 1], y: [12, 0], duration: T.t.reveal, ease: T.ease.enter }, 360 + words.length * 40 + 120);
  if (!belowFold(sec)) return;
  utils.set([rule, idx], { clipPath: 'inset(0% 100% 0% 0%)' });
  utils.set(words, { y: '105%' });
  utils.set(body, { opacity: 0 });
  once(sec, '85% top', play);
};
if (!reduce) $$('.sec').forEach(overture);

/* ---- figures: each digit column rolls like an odometer, once the figure is on screen ---- */
if (!reduce) for (const b of $$('.fig b')) {
  const final = b.textContent.trim();
  once(b, '92% top', () => {
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = final;
    const odo = document.createElement('span'); odo.className = 'odo'; odo.setAttribute('aria-hidden', 'true');
    const strips = [...final].map(ch => {
      const col = document.createElement('span'); col.className = 'odo-col';
      const strip = document.createElement('span'); strip.className = 'odo-strip';
      strip.innerHTML = '<i>0</i><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i><i>7</i><i>8</i><i>9</i>';
      col.append(strip); odo.append(col);
      return [strip, +ch];
    });
    b.replaceChildren(sr, odo);
    strips.forEach(([s, dg], i) => animate(s, { translateY: ['0em', `${-dg}em`], ease: sp('glide'), delay: 120 * i }));
  });
}

/* ---- roster: two rows drift in opposite directions, speed coupled to scroll velocity ---- */
{
  const readout = $('.readout');
  const rest = readout.innerHTML;
  const show = btn => {
    if (!btn) { readout.innerHTML = rest; return; }
    const name = btn.firstChild.textContent;
    readout.textContent = '';
    const b = document.createElement('b'); b.textContent = name;
    readout.append(b, ` · ${btn.dataset.m}`);
  };
  $$('.mq').forEach((mq, i) => {
    const track = $('.mq-track', mq);
    const set = btn => { $$('button', track).forEach(x => x.classList.toggle('on', x === btn)); show(btn); };
    const letGo = () => { hold = false; set(null); };
    track.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const b = e.target.closest('button'); if (b) { hold = true; set(b); } });
    track.addEventListener('pointerleave', e => { if (e.pointerType === 'touch') return; hold = mq.contains(document.activeElement); if (!hold) set(null); });
    // touch has no hover: a tap pins the client in the readout and stops the row under the finger; a tap anywhere else lets go
    let touched = false;
    addEventListener('pointerdown', e => { touched = e.pointerType === 'touch'; if (touched && hold && !track.contains(e.target)) letGo(); });
    // the separator after a name belongs to its item, so a tap that lands between names still finds one
    track.addEventListener('click', e => { const b = e.target.closest('li')?.querySelector('button'); if (b && touched) { hold = true; set(b); } });
    // only a keyboard focus recentres the row; a tapped name stays where the finger found it
    const keyed = el => { try { return el.matches(':focus-visible'); } catch { return true; } };
    track.addEventListener('focusin', e => { hold = true; set(e.target.closest('button')); if (!reduce && keyed(e.target)) centre(e.target.closest('li')); });
    track.addEventListener('focusout', e => { if (!track.contains(e.relatedTarget)) letGo(); });
    mq.addEventListener('scroll', () => { mq.scrollLeft = 0; });       // focus must not scroll the clipped row
    let hold = false;
    if (reduce) return;
    // clones close the loop without a visible jump; they are inert and hidden from assistive tech
    const clones = [...track.children].map(li => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.inert = true; return c; });
    track.append(...clones);
    const dir = i % 2 ? 1 : -1, base = .045;                            // px per ms at rest
    let half = 1, x = 0, s = 1, v = 0, on = false;
    measures.add(() => { half = track.scrollWidth / 2; if (dir > 0 && x === 0) x = -half; });
    const centre = li => { x = -(li.offsetLeft - mq.clientWidth / 2 + li.offsetWidth / 2); };
    // a row scrolled out of view is released, so a tapped row is moving again when the reader comes back
    new IntersectionObserver(([e]) => { on = e.isIntersecting; if (!on && hold && !mq.contains(document.activeElement)) letGo(); }).observe(mq);
    const { stiffness: k, damping: c } = T.spring.float;
    tickers.add(dt => {
      if (!on) return;
      const target = hold ? 0 : 1 + Math.min(5, Math.abs(lenis ? lenis.velocity : 0) * .12);
      // the row's speed follows scroll velocity through the float spring, and eases to a stop under the pointer
      const a = k * (target - s) - c * v; v += a * dt / 1000; s += v * dt / 1000;
      x += dir * base * s * dt;
      if (x <= -half) x += half; else if (x > 0) x -= half;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  });
}

/* ---- expertise: the sticky column counts the practice being read ---- */
{
  const side = $('.xp-side'), items = $$('.xp-item');
  if (side && items.length) {
    const nEl = $('.xp-count .n', side), now = $('.xp-now', side), where = $('.xp-where', side);
    const titles = items.map(li => $('h3', li).textContent), places = items.map(li => li.dataset.where || '');
    // two digit columns, so the counter ticks like a meter
    nEl.innerHTML = '<span class="odo"><span class="odo-col"><span class="odo-strip">' + '0123456789'.split('').map(d => `<i>${d}</i>`).join('') +
      '</span></span><span class="odo-col"><span class="odo-strip">' + '0123456789'.split('').map(d => `<i>${d}</i>`).join('') + '</span></span></span>';
    const [s1, s2] = $$('.odo-strip', nEl);
    let cur = -1;
    const setTo = i => {
      if (i === cur) return;
      const first = cur < 0; cur = i;
      const n = String(i + 1).padStart(2, '0');
      const opts = first || reduce ? { duration: 0 } : { ease: sp('snap') };
      // the counter digits roll to the practice in view
      animate(s1, { translateY: `${-n[0]}em`, ...opts });
      animate(s2, { translateY: `${-n[1]}em`, ...opts });
      if (first) { now.textContent = titles[i]; where.textContent = places[i]; return; }
      // the practice name crossfades in place
      animate([now, where], { opacity: 0, duration: T.t.tick, ease: 'linear', onComplete: () => {
        now.textContent = titles[i]; where.textContent = places[i];
        animate([now, where], { opacity: 1, duration: T.t.tick, ease: 'linear' });
      } });
    };
    setTo(0);
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && setTo(items.indexOf(e.target))), { rootMargin: '-40% 0px -59% 0px' });
    items.forEach(li => io.observe(li));
  }
}

/* ---- Chart A: bars, values and axis all derive from one spring-driven state ---- */
{
  const host = $('#chart-a'), svgEl = $('svg', host), tip = $('.tip', host), L = host.dataset;
  const pct = new Intl.NumberFormat(root.lang, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sets = $$('table[data-set]', host).map(t => ({
    table: t, wrap: t.parentElement, title: t.dataset.title, unit: t.dataset.unit, source: t.dataset.source,
    rows: $$('tbody tr', t).map(tr => { const td = $$('td', tr); return { label: $('th', tr).textContent.trim(), v: +td[0].textContent, names: td[1]?.textContent || '' }; }),
  }));
  const rows = $$('.row', svgEl).map((el, i) => ({
    el, bar: $('.bar', el), hi: $('.hi', el), val: $('.val', el), labs: $$('.lab', el),
    y: 28 + i * 44, on: true, p: { v: sets[0].rows[i].v, to: sets[0].rows[i].v },
  }));
  const nice = max => { const step = [1, 2, 5, 10, 20, 50].find(s => max / s <= 4); return { step, max: Math.ceil(max / step) * step }; };
  const tickSet = set => { const { step, max } = nice(Math.max(...set.rows.map(r => r.v))); return Array.from({ length: max / step + 1 }, (_, i) => i * step); };
  const D = { v: 15, to: 15 };
  let cur = 0, act = null;

  // ticks move by transform from here on: zero their percentage attributes
  const tickG = $('.ticks', svgEl), ticks = new Map($$('.tick', tickG).map(g => [+g.dataset.t, g]));
  for (const g of ticks.values()) { for (const l of $$('line', g)) { l.setAttribute('x1', 0); l.setAttribute('x2', 0); } $('text', g).setAttribute('x', 0); }
  const tickFor = t => {
    if (!ticks.has(t)) {
      const g = ticks.get(0).cloneNode(true); g.dataset.t = t; $('text', g).textContent = t; utils.set(g, { opacity: 0 });
      tickG.append(g); ticks.set(t, g);
    }
    return ticks.get(t);
  };
  const totalEl = $('[data-total]', host);
  const render = () => {
    let sum = 0;
    for (const r of rows) {
      r.bar.style.transform = `scaleX(${(r.p.v / D.v).toFixed(4)})`;
      const n = Math.round(r.p.v); sum += n;
      r.val.textContent = r.on || n ? n : '';
    }
    for (const [t, g] of ticks) g.style.transform = `translateX(${(t / D.v * 100).toFixed(3)}%)`;
    totalEl.textContent = sum;                                   // the total is the sum of the bars, every frame
  };
  render();

  if (!reduce) {
    if (belowFold(svgEl)) rows.forEach(r => { r.bar.style.transform = 'scaleX(0)'; });   // bars only; the numbers stay final until seen
    once(svgEl, 'bottom 40%', () => {
      for (const r of rows) r.p.v = 0;
      render();
      createTimeline()
        // axis first: gridlines draw top to bottom
        .add(svg.createDrawable($$('.tick line', svgEl)), { draw: ['0 0', '0 1'], duration: 300, ease: 'linear' }, 0)
        // then bars grow from the baseline on the glide spring, 50 ms apart, values counting in step
        .add(rows.map(r => r.p), { v: p => p.to, ease: sp('glide'), delay: stagger(50), onUpdate: render }, 300);
    });
  }

  // hover / focus: the bar brightens, the rest dim to 40%, crosshair and tooltip spring to it
  const xh = $('.xhair', svgEl), xv = $('.xv', svgEl), xhl = $('.xh', svgEl);
  const move = () => reduce ? { duration: 0 } : { ease: sp('snap') };
  const activate = r => {
    if (r === act) return;
    act = r;
    for (const x of rows) {
      animate(x.el, { opacity: !x.on ? 0 : !r || x === r ? 1 : .4, duration: T.t.tick, ease: 'linear' });
      animate(x.hi, { opacity: x === r ? 1 : 0, duration: T.t.tick, ease: 'linear' });
    }
    if (!r) { animate([tip, xh], { opacity: 0, duration: T.t.tick, ease: 'linear' }); return; }
    const set = sets[cur], i = rows.indexOf(r), d = set.rows[i], total = set.rows.reduce((s, x) => s + x.v, 0);
    $('b', tip).textContent = d.label;
    $('.mono', tip).textContent = `${d.v} ${set.unit} · ${pct.format(d.v / total)} ${L.of} ${total}`;
    $('.n', tip).textContent = d.names;
    const w = svgEl.clientWidth, x = d.v / D.to * w, flip = x + tip.offsetWidth + 16 > w;
    animate(tip, { x: flip ? Math.max(0, x - tip.offsetWidth - 12) : x + 12, y: r.y + 40, opacity: 1, ...move() });
    animate(xv, { x: `${(d.v / D.to * 100).toFixed(3)}%`, ...move() });
    animate(xhl, { y: r.y + 28, ...move() });
    animate(xh, { opacity: 1, duration: T.t.tick, ease: 'linear' });
  };
  // touch: a tap pins a bar and its tooltip; tapping it again, or anywhere outside the chart, lets go
  let touched = false, before = null;
  addEventListener('pointerdown', e => {
    touched = e.pointerType === 'touch'; before = act;          // the state before a tap may focus the row
    if (touched && act && !svgEl.contains(e.target)) activate(null);
  });
  for (const r of rows) {
    r.el.addEventListener('focus', () => activate(r));
    r.el.addEventListener('pointerenter', e => e.pointerType !== 'touch' && r.on && activate(r));
    r.el.addEventListener('click', () => { if (touched && r.on) activate(before === r ? null : r); });
  }
  svgEl.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && !svgEl.contains(document.activeElement)) activate(null); });
  svgEl.addEventListener('focusout', e => { if (!svgEl.contains(e.relatedTarget)) activate(null); });
  svgEl.addEventListener('keydown', e => {
    const vis = rows.filter(r => r.on), i = vis.indexOf(act);
    const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: -99, End: 99 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    vis[utils.clamp(i + k, 0, vis.length - 1)].el.focus();
  });

  // toggle: the bars morph into the other dataset and the axis rescales on the same spring
  const seg = $('.seg', host), segBtns = $$('button', seg), segPill = $('.seg-pill', seg);
  const pillTo = b => `inset(0px ${(seg.clientWidth - 8 - b.offsetLeft - b.offsetWidth + 4).toFixed(1)}px 0px ${(b.offsetLeft - 4).toFixed(1)}px round 999px)`;
  measures.add(() => utils.set(segPill, { clipPath: pillTo(segBtns[cur]) }));
  const show = k => {
    if (k === cur) return;
    cur = k;
    const set = sets[k], fade = reduce ? T.t.tick : T.t.move;
    segBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === k)));
    // the selection pill slides to the pressed button
    animate(segPill, { clipPath: pillTo(segBtns[k]), ...move() });
    activate(null);
    const want = new Set(tickSet(set));
    D.to = Math.max(...want);
    rows.forEach((r, i) => {
      const d = set.rows[i];
      r.on = !!d; r.p.to = d ? d.v : 0;
      r.el.tabIndex = d ? 0 : -1;
      d ? r.el.removeAttribute('aria-hidden') : r.el.setAttribute('aria-hidden', 'true');
      r.el.setAttribute('aria-label', d ? `${d.label}: ${d.v} ${set.unit}` : '');
      r.labs[k].textContent = d ? d.label : '';
      // labels crossfade in place while the bar under them morphs
      animate(r.labs[1 - k], { opacity: 0, duration: fade, ease: 'linear' });
      animate(r.labs[k], { opacity: d ? 1 : 0, duration: fade, ease: 'linear' });
      animate(r.el, { opacity: d ? 1 : 0, duration: fade, ease: 'linear' });
      r.el.style.pointerEvents = d ? '' : 'none';
    });
    for (const t of new Set([...ticks.keys(), ...want])) animate(tickFor(t), { opacity: want.has(t) ? 1 : 0, duration: fade, ease: 'linear' });
    for (const [t, g] of ticks) $('text', g).setAttribute('text-anchor', t === 0 ? 'start' : t === D.to ? 'end' : 'middle');
    if (reduce) { for (const r of rows) r.p.v = r.p.to; D.v = D.to; render(); }
    else animate([...rows.map(r => r.p), D], { v: o => o.to, ease: sp('glide'), onUpdate: render });
    $('#ca-t').textContent = `${set.title}: ${set.rows.reduce((s, x) => s + x.v, 0)} ${set.unit}`;
    $('#ca-d').textContent = `${L.bars} ` + set.rows.map(r => `${r.label} ${r.v}`).join(', ') + '.';
    $('.unit-out', host).textContent = set.unit;
    $('[data-src]', host).textContent = `${L.sourceLabel} ${set.source}.`;
    sets.forEach((s, j) => { s.wrap.hidden = j !== k; });
  };
  segBtns.forEach((b, k) => b.addEventListener('click', () => show(k)));

  const tv = $('.view-table', host), fig = $('.chart-fig', host);
  tv.addEventListener('click', () => {
    const on = tv.getAttribute('aria-pressed') !== 'true';
    tv.setAttribute('aria-pressed', String(on));
    tv.textContent = on ? L.viewChart : L.viewTable;
    fig.hidden = on;
    sets.forEach(s => { s.wrap.classList.toggle('sr-only', !on); s.wrap.classList.toggle('fade-x', on); });
  });
}

/* ---- Chart B: a playhead scrubs 2002 → 2026; ticks draw and events drop in as it passes ---- */
{
  const tl = $('#timeline');
  // the horizontal form pins a stage the height of the screen: it is used only where that stage fits
  let wide = false;
  if (tl && !reduce && innerWidth >= 900) {
    tl.classList.add('tl-live');
    wide = $('.span-r', tl).offsetHeight + nav.offsetHeight <= innerHeight;
    if (!wide) tl.classList.remove('tl-live');
  }
  if (wide) {
    const pin = $('.tl-pin', tl), axis = $('.tl-axis', tl), yr = $('.tl-yr', tl), items = $$('.tl-list li', tl);
    items.forEach(li => li.style.setProperty('--x', li.dataset.x));
    const NS = 'http://www.w3.org/2000/svg';
    const line = (cls, x, y1, y2) => { const l = document.createElementNS(NS, 'line'); l.setAttribute('class', cls); l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', y1); l.setAttribute('y2', y2); axis.append(l); return l; };
    const base = document.createElementNS(NS, 'line');
    base.setAttribute('class', 'base'); base.setAttribute('x1', '0'); base.setAttribute('x2', '100%'); base.setAttribute('y1', 12); base.setAttribute('y2', 12); axis.append(base);
    const yticks = Array.from({ length: 25 }, (_, i) => line('yt', `${(i / 24 * 100).toFixed(3)}%`, i % 5 ? 8 : 2, 16));
    const ph = line('ph', '0', -160, 180); ph.style.transformBox = 'view-box'; ph.style.transformOrigin = '0 0';
    let top = 0, len = 1, shownTicks = -1;
    const state = items.map(() => null);
    measures.add(() => { top = docTop(pin); len = Math.max(1, pin.offsetHeight - innerHeight); });
    utils.set(yticks, { scaleY: 0 }); utils.set(items, { opacity: 0 });
    scrollFns.add(() => {
      const p = clamp01((scrollTop() - top) / len);
      // the playhead tracks scroll linearly, so the scrub is exactly reversible
      ph.style.transform = `translateX(${(p * 100).toFixed(3)}%)`;
      yr.textContent = Math.min(2026, Math.floor(2002 + p * 24 + 1e-6));
      const t = Math.floor(p * 24 + 1e-6);
      if (t !== shownTicks) {
        // year ticks draw up to the playhead
        yticks.forEach((l, i) => { const on = i <= t; if ((i <= shownTicks) !== on) animate(l, { scaleY: on ? 1 : 0, duration: T.t.tick, ease: T.ease.enter }); });
        shownTicks = t;
      }
      items.forEach((li, i) => {
        const on = p + 1e-6 >= +li.dataset.x;
        if (state[i] === on) return;
        state[i] = on;
        // each event drops in as the playhead passes it, and lifts out if the reader scrolls back
        animate(li, { opacity: on ? 1 : 0, duration: T.t.move, ease: 'linear' });
        animate([...li.children], { translateY: on ? [-10, 0] : -10, duration: T.t.move, ease: T.ease.enter });
      });
    });
  } else if (tl && !reduce && CSS.supports('overflow', 'clip')) {
    // phones and short screens: the list stays vertical. The year readout is pinned to the foot of the screen by CSS
    // (sticky, so it holds still under a native touch scroll) and is the playhead: the rail fills down to it
    tl.classList.add('tl-rail');
    const track = $('.tl-track', tl), items = $$('.tl-list li', tl);
    const ph = document.createElement('p'), yr = document.createElement('span');
    ph.className = 'tl-ph mono'; ph.setAttribute('aria-hidden', 'true');
    ph.append(document.createElement('i'), yr); track.append(ph);
    const years = items.map(li => +$('time', li).getAttribute('datetime').slice(0, 4));
    const kids = items.map(li => [...li.children]);
    let marks = [], lift = 0;
    const state = items.map(() => null);
    // each event's mark is its node on the rail, level with the date
    measures.add(() => { marks = items.map(li => docTop(li) + parseFloat(getComputedStyle(li, '::before').top) + 4.5); lift = 16 + ph.offsetHeight / 2; });
    utils.set(kids.flat(), { opacity: 0 });
    scrollFns.add(() => {
      const y = scrollTop() + innerHeight - lift;                 // the playhead, in page coordinates
      let i = 0;
      while (i < marks.length - 1 && y >= marks[i + 1]) i++;
      // the year runs through the gaps between events, so it reads each event's year exactly as the playhead reaches it
      const t = y < marks[0] || i === marks.length - 1 ? years[i] : Math.floor(years[i] + (years[i + 1] - years[i]) * (y - marks[i]) / (marks[i + 1] - marks[i]));
      if (yr.textContent !== String(t)) yr.textContent = t;
      items.forEach((li, k) => {
        const on = y >= marks[k];
        if (state[k] === on) return;
        state[k] = on;
        li.classList.toggle('on', on);
        // each event drops in as the playhead passes its node, and lifts out if the reader scrolls back
        animate(kids[k], { opacity: on ? 1 : 0, duration: T.t.move, ease: 'linear' });
        animate(kids[k], { translateY: on ? [-10, 0] : -10, duration: T.t.move, ease: T.ease.enter });
      });
    });
  }
}

/* ---- healthcare: the arc draws from Geneva to Freetown ---- */
{
  const arc = $('.hc-map .arc'), dates = $$('.hc-map text.d'), map = $('.hc-map svg');
  if (arc && !reduce) {
    const [drawable] = svg.createDrawable(arc);
    if (belowFold(map)) { utils.set(drawable, { draw: '0 0' }); utils.set(dates, { opacity: 0 }); }
    once(map, '75% top', () => createTimeline()
      // the route of the 2022 pilot, drawn from Geneva to Freetown
      .add(drawable, { draw: ['0 0', '0 1'], duration: T.t.draw, ease: T.ease.enter }, 0)
      // the dates settle onto the arc once it reaches them
      .add(dates, { opacity: [0, 1], duration: T.t.move, ease: 'linear', delay: stagger(240) }, 700));
  }
}

/* ---- Elysium Labs: the contour draws, then morphs between the two measured frames ---- */
{
  const frame = $('.ex-frame'), live = $('#c-live'), c00 = $('#c00'), c15 = $('#c15');
  const f15 = $('.f15', frame), rFrame = $('[data-r=frame]'), rArea = $('[data-r=area]'), rState = $('[data-r=state]'), RL = $('.ex-read').dataset;
  if (frame && !reduce) {
    live.setAttribute('d', c00.getAttribute('d'));
    const morph = animate(live, { d: svg.morphTo(c15), duration: 1000, ease: 'linear', autoplay: false });
    let top = 0, h = 1, drawn = false, lastKey = '';
    measures.add(() => { top = docTop(frame); h = frame.offsetHeight; });
    const [dr] = svg.createDrawable(live);
    utils.set(dr, { draw: '0 0' });
    once(frame, '70% top', () => {
      // the boundary is traced once, as computed from the pixels
      animate(dr, { draw: ['0 0', '0 1'], duration: T.t.draw, ease: T.ease.enter, onComplete: () => { drawn = true; runScroll(); } });
    });
    scrollFns.add(() => {
      if (!drawn) return;
      const vh = innerHeight, p = clamp01((scrollTop() + vh * .7 - (top + h * .5)) / (vh * .5));
      // scroll moves the shape between frame 00 and frame 15, both measured; between them it is interpolated
      morph.seek(p * 1000);
      f15.style.opacity = p.toFixed(3);
      const key = p <= .001 ? '00' : p >= .999 ? '15' : 'mid';
      if (key === lastKey) return;
      lastKey = key;
      rFrame.textContent = key === 'mid' ? '—' : key;
      rArea.textContent = key === '00' ? RL.a00 : key === '15' ? RL.a15 : '—';
      rState.textContent = key === 'mid' ? RL.interp : RL.measured;
    });
    rFrame.textContent = '00'; rArea.textContent = RL.a00;
  }
}

/* ---- private AI: the perimeter draws, then the flow inside it, then the closed route out ---- */
{
  const diag = $('.pai-diag');
  if (diag && !reduce) {
    const [edge] = svg.createDrawable($('.pai-edge rect', diag));
    const nodes = $$('.pai-node, .pai-org-l', diag), arrows = $$('.pai-arrow', diag), down = $('.pai-down', diag), x = $('.pai-x', diag), out = $('.pai-out', diag);
    // in the stacked phone layout the arrows point down, so they draw downwards
    const grow = matchMedia('(max-width:699px)').matches ? 'scaleY' : 'scaleX';
    if (belowFold(diag)) { utils.set(edge, { draw: '0 0' }); utils.set(nodes, { opacity: 0 }); utils.set(arrows, { [grow]: 0 }); utils.set(down, { scaleY: 0 }); utils.set([x, out], { opacity: 0 }); }
    once(diag, '75% top', () => createTimeline()
      // the organisation's perimeter is traced first: everything that follows happens inside it
      .add(edge, { draw: ['0 0', '0 1'], duration: T.t.draw, ease: T.ease.enter }, 0)
      // documents, server and team appear in reading order
      .add(nodes, { opacity: [0, 1], translateY: [12, 0], duration: T.t.reveal, ease: T.ease.enter, delay: stagger(120) }, 400)
      // the data path draws from documents to server to team
      .add(arrows, { [grow]: [0, 1], duration: T.t.move, ease: T.ease.enter, delay: stagger(180) }, 800)
      // the route out to public providers draws, and stops at the perimeter
      .add(down, { scaleY: [0, 1], duration: T.t.move, ease: T.ease.enter }, 1200)
      .add([x, out], { opacity: [0, 1], duration: T.t.tick, ease: 'linear' }, 1560));
  }
  // "Register interest" starts the message for the visitor
  for (const a of $$('[data-topic]')) a.addEventListener('click', () => {
    const msg = $('#f-msg');
    if (msg && !msg.value.trim()) msg.value = a.dataset.topic.trim() + ' ';
  });
}

/* ---- work: screenshots unmask, drift inside their frames, and cases stack as the next arrives ---- */
{
  const cases = $$('.case'), shots = $$('.case .shot');
  if (!reduce) {
    for (const s of shots) {
      if (belowFold(s)) utils.set(s, { clipPath: 'inset(100% 0% 0% 0%)' });
      // the screenshot is revealed bottom-up, like a screen being drawn
      once(s, '90% top', () => animate(s, { clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'], duration: T.t.reveal, ease: T.ease.enter }));
    }
    const imgs = shots.map(s => $('img', s));
    utils.set(imgs, { scale: 1.08 });
    let tops = [];
    root.classList.add('stack-live');
    measures.add(() => {
      // natural positions: sticky cases are measured from their flow order, not their stuck position
      const list = cases[0].parentElement, gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      let y = docTop(list); tops = cases.map(c => { const t = y; y += c.offsetHeight + gap; return [t, c.offsetHeight]; });
      // a case taller than the screen sticks only once its foot is in view, so none is covered before it has been seen
      for (const c of cases) c.style.setProperty('--case-h', `${c.offsetHeight}px`);
    });
    scrollFns.add(() => {
      const st = scrollTop(), vh = innerHeight;
      cases.forEach((c, i) => {
        const [t, h] = tops[i] || [0, 1];
        // the image drifts at most 40 px inside its frame while the case is on screen
        const p = clamp01((st + vh - t) / (vh + h));
        for (const img of $$('img', c)) img.style.transform = `translateY(${((p - .5) * 40).toFixed(1)}px) scale(1.08)`;
        if (i === cases.length - 1) return;
        // the case steps back to .94 as the next one arrives over it
        const [tn] = tops[i + 1] || [0];
        const q = clamp01((st + vh - tn) / (vh - 80));
        c.style.transform = `scale(${(1 - .06 * q).toFixed(4)})`;
      });
    });
  }
  // contact sheet: where nothing hovers, each row comes into full colour as it crosses the middle of the screen
  if (matchMedia('(hover: none)').matches) {
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('lit', e.isIntersecting)), { rootMargin: '-40% 0px -40% 0px' });
    $$('.sheet img').forEach(img => io.observe(img));
  }
}

/* ---- cities: Switzerland's outline is traced, then the two offices light up ---- */
{
  const ch = $('.ch svg');
  if (ch && !reduce) {
    const [o] = svg.createDrawable($('.outline', ch));
    const pts = $$('circle, text', ch);
    if (belowFold(ch)) { utils.set(o, { draw: '0 0' }); utils.set(pts, { opacity: 0 }); }
    once(ch, '75% top', () => createTimeline()
      // the border of Switzerland, drawn from Natural Earth's outline
      .add(o, { draw: ['0 0', '0 1'], duration: T.t.draw, ease: T.ease.enter }, 0)
      // Geneva, then Zürich, at their true coordinates
      .add(pts, { opacity: [0, 1], duration: T.t.move, ease: 'linear', delay: stagger(90) }, 900));
  }
}

/* ---- contact form: validates inline, and says plainly that it is not connected ---- */
{
  const f = $('#contact-form'), E = f.dataset;
  const rules = {
    'f-name': el => el.value.trim() ? '' : E.errName,
    'f-email': el => !el.value.trim() ? E.errEmail : el.validity.typeMismatch ? E.errFormat : '',
    'f-msg': el => el.value.trim() ? '' : E.errMsg,
  };
  const check = el => {
    const msg = rules[el.id]?.(el) ?? '';
    el.setAttribute('aria-invalid', String(!!msg));
    const err = $('#e-' + el.id.slice(2));
    if (err) err.textContent = msg;
    return !msg;
  };
  let tried = false;
  for (const id of Object.keys(rules)) {
    const el = $('#' + id);
    el.addEventListener('blur', () => { if (tried || el.value) check(el); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); });
  }
  f.addEventListener('submit', e => {
    e.preventDefault();
    tried = true;
    const bad = Object.keys(rules).map(id => $('#' + id)).filter(el => !check(el));
    const ok = $('.ok', f);
    if (bad.length) { bad[0].focus(); ok.textContent = ''; return; }
    ok.textContent = E.notSent;
  });
}

/* ---- pills: press answers on snap; primary pills lean toward the pointer, 6 px at most, or toward the pressing finger, 4 px ---- */
if (!reduce) for (const b of $$('.pill-btn')) {
  const primary = b.classList.contains('primary');
  const toward = (e, box, max) => {
    const nx = (e.clientX - box.left - box.width / 2) / (box.width / 2), ny = (e.clientY - box.top - box.height / 2) / (box.height / 2);
    return { x: utils.clamp(nx * max, -max, max), y: utils.clamp(ny * max, -max, max) };
  };
  // touch has no hover to lean on, so the press itself leans toward the finger
  b.addEventListener('pointerdown', e => animate(b, { scale: .97, ...(primary && e.pointerType === 'touch' ? toward(e, b.getBoundingClientRect(), 4) : {}), ease: sp('snap') }));
  const up = e => {
    animate(b, { scale: 1, ease: sp('snap') });
    if (e.pointerType === 'touch') animate(b, { x: 0, y: 0, ease: sp('float') });
  };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointerleave', up);
  if (!primary || !matchMedia('(hover: hover)').matches) continue;
  let box = null;
  b.addEventListener('pointerenter', () => { box = b.getBoundingClientRect(); });
  b.addEventListener('pointermove', e => {
    if (!box) return;
    animate(b, { ...toward(e, box, 6), ease: sp('snap') });
  });
  b.addEventListener('pointerleave', () => { box = null; animate(b, { x: 0, y: 0, ease: sp('float') }); });
}

/* in-page links go through Lenis so anchor jumps share the same clock */
if (lenis) for (const a of $$('a[href^="#"]')) a.addEventListener('click', e => {
  const id = a.getAttribute('href'); if (id.length < 2) return;
  const t = $(id); if (!t) return;
  e.preventDefault(); lenis.scrollTo(t, { offset: id === '#top' ? 0 : -8 }); history.replaceState(null, '', id);
});

remeasure();
if (document.fonts) document.fonts.ready.then(remeasure);
addEventListener('load', remeasure);
