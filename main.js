/* Elysium — motion.
   Built on Motion (motion.dev) and anime.js v4, both vendored under
   assets/vendor so the page makes no external request at runtime.

   One rule throughout: every animation states something — it reveals
   structure, shows state, or makes a number readable. Nothing decorates.
   All content is present and correct with this file absent. */
(() => {
'use strict';

const M = window.Motion, A = window.anime;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LOC = () => document.documentElement.lang || 'en-GB';
const num = (n, d = 0) => n.toLocaleString(LOC(), { minimumFractionDigits: d, maximumFractionDigits: d });

/* Authored springs. Named by intent, tuned once, reused everywhere — the
   motion equivalent of the easing tokens in the stylesheet. */
const SETTLE = { type: 'spring', stiffness: 190, damping: 26, mass: 0.9 };  // arrives and stops
const GATE   = { type: 'spring', stiffness: 320, damping: 34, mass: 0.7 };  // decisive open/close
const DRIFT  = { type: 'spring', stiffness: 90,  damping: 22, mass: 1.1 };  // slow, weighty

/* A reveal keyed on a tall container firing at 10% of that container means the
   block animates a screen and a half below the fold and is already at rest by
   the time it is read — the motion is spent where nobody is looking. Pulling
   the observation root up off the bottom edge fires it where the eye is, and
   unlike raising `amount` it behaves the same whether the container is a third
   of a screen tall or three screens. */
const IN = { amount: 0.1, margin: '0px 0px -18% 0px' };

/* Siblings need to arrive far enough apart to read as a cascade rather than one
   block fading. Measured house range is 150-300ms for a handful of elements and
   40-90ms for a large grid, so the step comes down as the count goes up while
   the whole group still resolves inside about two-thirds of a second. */
const cascade = n => Math.max(0.045, Math.min(0.11, 0.6 / n));

if (!M) return;                       // no library, no motion — content stands on its own

/* Anything we hide in order to animate it back in gets registered here.
   If an observer never fires — element never intersects, IO throws, a later
   script errors — the net reveals it anyway. Content is never lost to motion. */
const hidden = new Set();
const hide = el => { el.style.opacity = '0'; hidden.add(el); };
const shown = els => { for (const el of [].concat(els)) hidden.delete(el); };
setTimeout(() => { for (const el of hidden) el.style.opacity = ''; hidden.clear(); }, 2500);

/* ---- 1. Reveals ---------------------------------------------------------
   inView + stagger. The stagger step is derived from item count so a
   collection of six and a collection of sixty both resolve in one beat. */
(() => {
  if (reduce) return;
  // .roster li, .spec article and .sheet a are waves — see §17
  const groups = [
    '.card', '.tl li', '.cities article',
    '.llm-points > div', '.stat-row > div', '.care-list > div',
    '.trust-list > div', '.totals tbody tr'
  ];
  const solo = ['.case', '.calc', '#contact-form', '.instr-cap', '.lab-fig'];
  const show = (els, opts) => M.animate(els, { opacity: [0, 1], y: [16, 0] }, opts);

  for (const sel of groups) {
    const els = $$(sel);
    if (!els.length) continue;
    els.forEach(hide);
    M.inView(els[0].parentElement, () => {
      shown(els);
      show(els, { ...SETTLE, delay: M.stagger(cascade(els.length)) });
      return false;                   // fire once
    }, IN);
  }
  for (const sel of solo) for (const el of $$(sel)) {
    hide(el);
    M.inView(el, () => { shown(el); show(el, SETTLE); return false; }, IN);
  }
})();

/* ---- 2. Counters --------------------------------------------------------
   The correct value is already in the HTML and is what a crawler, a screen
   reader and a no-JS visitor get. This only replays the approach to it. */
(() => {
  if (reduce) return;
  for (const el of $$('[data-count]')) {
    const end = +el.dataset.count;
    M.inView(el, () => {
      M.animate(0, end, {
        duration: 1.1, ease: [0.22, 0.61, 0.24, 1],
        onUpdate: v => { el.textContent = num(Math.round(v)); },
        onComplete: () => { el.textContent = num(end); }
      });
      return false;
    }, { amount: 0.6 });
  }
})();

/* ---- 3. The studio card -------------------------------------------------
   The printed face is what the card shows. The contact face is stacked on
   top of it and masked to a soft circle that tracks the pointer, so moving
   the light across the card reads as lighting one object rather than
   crossfading two pictures. The pointer also tilts the slab a few degrees,
   which is what sells it as a thing with thickness.

   The mask is a CSS radial-gradient, not a canvas repainted and re-encoded
   to a data URL every frame: identical falloff, one style write, and no
   per-frame allocation. The loop only runs while the hero is on screen. */
(() => {
  const stage = $('#bcard'); if (!stage) return;
  const plate = $('.bc-plate', stage), reveal = $('.bc-reveal', stage);
  if (!plate || !reveal || reduce) return;

  // no hover means no spotlight: a tap shows the whole contact face
  if (matchMedia('(hover: none)').matches) {
    stage.addEventListener('click', () => {
      const on = reveal.classList.toggle('shown');
      stage.setAttribute('aria-pressed', String(on));
    });
    return;
  }

  const EASE = 0.1;
  let mx = null, my = 0, sx = 0, sy = 0, raf = 0, seeded = false;

  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  const frame = () => {
    const b = plate.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;

    // the light rests on the contact stack, so the card opens already
    // showing the thing worth finding rather than an empty board
    const hx = b.left + b.width * 0.38, hy = b.top + b.height * 0.33;
    if (!seeded) { sx = hx; sy = hy; seeded = true; }

    sx += ((mx === null ? hx : mx) - sx) * EASE;
    sy += ((mx === null ? hy : my) - sy) * EASE;

    // the spotlight is a third of the card, not a fixed pixel radius — at
    // 260px it covered the whole thing and both faces just muddied together
    const R = Math.max(104, b.width * 0.30);
    const m = `radial-gradient(circle ${R.toFixed(0)}px at ${(sx - b.left).toFixed(1)}px ${(sy - b.top).toFixed(1)}px,`
      + 'rgba(0,0,0,1) 0%,rgba(0,0,0,1) 62%,rgba(0,0,0,.55) 74%,'
      + 'rgba(0,0,0,.18) 86%,rgba(0,0,0,0) 100%)';
    reveal.style.webkitMaskImage = m;
    reveal.style.maskImage = m;

    plate.style.transform =
      `rotateX(${(((sy - cy) / innerHeight) * -13).toFixed(2)}deg) ` +
      `rotateY(${(((sx - cx) / innerWidth) * 17).toFixed(2)}deg)`;

    raf = requestAnimationFrame(frame);
  };

  reveal.classList.add('lit');
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) raf = requestAnimationFrame(frame);
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(stage);
})();

/* ---- 4. Applied research: the segmentation contour ----------------------
   Drawn once with anime's drawable, then held. The shape is the measured
   output — it is not redrawn on a loop, which would read as decoration. */
(() => {
  const trace = $('#trace'); if (!trace || !A) return;
  if (reduce) { trace.style.opacity = '1'; return; }
  M.inView(trace.closest('.lab-fig') || trace, () => {
    try {
      A.animate(A.svg.createDrawable(trace),
        { draw: ['0 0', '0 1'], duration: 1400, ease: 'inOut(3)' });
    } catch { /* leave the contour drawn */ }
    M.animate(trace, { opacity: [0, 1] }, { duration: 0.3 });
    return false;
  }, { amount: 0.4 });
})();

/* ---- 5. Header ----------------------------------------------------------
   The rule under the header firms up once the page has left the hero, so
   the bar reads as pinned rather than floating. */
(() => {
  const hdr = $('.hdr'), hero = $('.hero');
  if (!hdr || !hero) return;
  const plate = () => hdr.classList.toggle('off-plate',
    hero.getBoundingClientRect().bottom <= hdr.offsetHeight + 8);
  plate();
  addEventListener('scroll', plate, { passive: true });
  addEventListener('resize', plate, { passive: true });
  if (reduce || !M.scroll) return;
  M.scroll(p => {
    hdr.style.borderBottomColor =
      `color-mix(in srgb, var(--ink) ${(Math.min(p * 2, 1) * 46).toFixed(0)}%, var(--rule))`;
  }, { target: hero, offset: ['start start', 'end start'] });
})();

/* ---- 6. Portfolio filter ------------------------------------------------
   FLIP: measure, change, invert, play. Cards that stay travel to their new
   position instead of jumping, so the filter reads as a rearrangement. */
(() => {
  const grid = $('#grid'); if (!grid) return;
  const cards = $$('.card', grid), btns = $$('.filters button');

  const apply = f => {
    const before = new Map(cards.map(c => [c, c.getBoundingClientRect()]));
    const keep = [];
    for (const c of cards) {
      const on = f === 'all' || c.dataset.cat.split(' ').includes(f);
      c.hidden = !on;
      if (on) keep.push(c);
    }
    if (reduce) return;
    for (const c of keep) {
      const a = before.get(c), b = c.getBoundingClientRect();
      if (a && a.width) {
        const dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) M.animate(c, { x: [dx, 0], y: [dy, 0] }, GATE);
      } else {
        M.animate(c, { opacity: [0, 1], scale: [0.97, 1] }, { ...GATE, delay: 0.04 });
      }
    }
  };

  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    apply(b.dataset.f);
  }));
})();

/* ---- 7. Cost model ------------------------------------------------------
   Every figure below is arithmetic on the visitor's own four inputs. The
   bars are springs so a drag reads as continuous rather than stepped. */
(() => {
  const vol = $('#i-vol'), api = $('#i-api'), gpu = $('#i-gpu'), set = $('#i-set');
  if (!vol) return;
  const out = id => $('#' + id);
  const money = n => '$' + num(Math.round(n)).replace(/[,  ]/g, ' ');
  const bA = $('#bar-api'), bS = $('#bar-self');
  const wA = M.motionValue(0), wS = M.motionValue(0);
  wA.on('change', v => { bA.style.width = v.toFixed(2) + '%'; });
  wS.on('change', v => { bS.style.width = v.toFixed(2) + '%'; });

  const draw = () => {
    const V = +vol.value;              // million tokens per month
    const P = +api.value / 100;        // $ per million tokens
    const G = +gpu.value;              // $ per month, GPU + operation
    const S = +set.value;              // $ one-off deployment

    const apiMonth = V * P, selfMonth = G;
    const apiY1 = apiMonth * 12, selfY1 = selfMonth * 12 + S;
    const d1 = apiY1 - selfY1;                        // positive = private is cheaper
    const monthlyGap = apiMonth - selfMonth;
    const breakEven = P > 0 ? G / P : Infinity;       // M tokens where the monthly costs meet
    const payback = monthlyGap > 0 ? S / monthlyGap : null;

    out('o-vol').textContent = num(V) + (LOC().startsWith('de') ? ' Mio. Token' : ' M tokens');
    out('o-api').textContent = '$' + num(P, 2) + (LOC().startsWith('de') ? ' / Mio. Token' : ' / M tokens');
    out('o-gpu').textContent = money(G);
    out('o-set').textContent = money(S);

    out('t-am').textContent = money(apiMonth);
    out('t-sm').textContent = money(selfMonth);
    out('t-a1').textContent = money(apiY1);
    out('t-s1').textContent = money(selfY1);
    out('t-a2').textContent = money(apiY1);
    out('t-s2').textContent = money(selfMonth * 12);

    const d = out('t-d1');
    d.textContent = (d1 >= 0 ? money(d1) + ' ' + d.dataset.saved : money(-d1) + ' ' + d.dataset.extra);
    d.classList.toggle('good', d1 >= 0);

    const be = out('t-be');
    be.textContent = isFinite(breakEven)
      ? (breakEven >= 1000 ? num(breakEven / 1000, 2) + ' ' + be.dataset.b
                           : num(Math.round(breakEven)) + ' ' + be.dataset.m)
      : '—';

    const pb = out('t-pb');
    pb.textContent = payback === null ? pb.dataset.never
      : pb.dataset.month.replace('{n}', num(Math.ceil(payback)));
    pb.classList.toggle('good', payback !== null && payback <= 12);

    const max = Math.max(apiMonth, selfMonth, 1);
    const anim = reduce ? { duration: 0 } : DRIFT;
    const pA = (apiMonth / max) * 100, pS = (selfMonth / max) * 100;
    M.animate(wA, pA, anim);
    M.animate(wS, pS, anim);
    $('#lab-api').textContent = money(apiMonth);
    $('#lab-self').textContent = money(selfMonth);
    bA.classList.add('on'); bS.classList.add('on');
    bA.classList.toggle('out', pA < 34);
    bS.classList.toggle('out', pS < 34);

    const c = $('#crossover'), F = c.dataset;
    const bev = breakEven >= 1000 ? num(breakEven / 1000, 2) + ' ' + F.b : num(Math.round(breakEven)) + ' ' + F.m;
    c.innerHTML = F.lead.replace('{p}', '$' + num(P, 2)) + ' <b>' + bev + '</b> ' + F.tail
      + ' ' + (monthlyGap > 0 ? F.under : F.over);
  };

  [vol, api, gpu, set].forEach(i => i.addEventListener('input', draw));
  addEventListener('elysium:lang', draw);
  draw();
})();

/* ---- 8. Contact form ----------------------------------------------------
   Validates and reports. The endpoint is not wired yet and the page says so
   rather than pretending to send. */
(() => {
  const f = $('#contact-form'); if (!f) return;
  f.addEventListener('submit', e => {
    e.preventDefault();
    const bad = [...f.elements].find(el => el.required && !el.value.trim());
    if (bad) {
      bad.focus();
      bad.style.borderColor = 'var(--red)';
      if (!reduce) M.animate(bad, { x: [0, -5, 4, -2, 0] }, { duration: 0.32 });
      return;
    }
    f.classList.add('sent');
    if (!reduce) M.animate($('.ok', f), { opacity: [0, 1], y: [8, 0] }, SETTLE);
  });
  $$('#contact-form input,#contact-form textarea').forEach(el =>
    el.addEventListener('input', () => { el.style.borderColor = ''; }));
})();

/* ---- 9. Headline masks --------------------------------------------------
   A headline rises out of its own measure, word by word. The wrapping is
   built at runtime and can be undone: the served markup stays one clean
   sentence, which is what a crawler reads and what the language build
   looks up. elysiumText lets the preview's language switch put the
   sentence back, translate it, and re-wrap it. */
const splits = [];

function makeSplit(el) {
  const texts = [];
  (function walk(n) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3 && c.nodeValue.trim()) texts.push(c);
      else if (c.nodeType === 1) walk(c);
    }
  })(el);

  const rec = { el, on: false, revealed: false, words: [],
                parts: texts.map(t => ({ text: t, nodes: null })) };

  rec.apply = () => {
    if (rec.on) return rec.words;
    rec.words = [];
    for (const p of rec.parts) {
      const frag = document.createDocumentFragment();
      for (const part of p.text.nodeValue.split(/(\s+)/)) {
        if (!part) continue;
        if (!part.trim()) { frag.append(part); continue; }
        const wm = document.createElement('span'); wm.className = 'wm';
        const w = document.createElement('i'); w.textContent = part;
        if (!rec.revealed) w.style.transform = 'translateY(110%)';
        wm.append(w); frag.append(wm); rec.words.push(w);
      }
      p.nodes = [...frag.childNodes];
      p.text.replaceWith(frag);
    }
    rec.on = true;
    return rec.words;
  };

  rec.restore = () => {                    // the original Text nodes go back in,
    if (!rec.on) return;                   // so anything holding a reference to
    for (const p of rec.parts) {           // them keeps working
      p.nodes[0].replaceWith(p.text);
      for (const n of p.nodes.slice(1)) n.remove();
      p.nodes = null;
    }
    rec.on = false;
  };

  splits.push(rec);
  return rec;
}

const WORD_STEP = 0.08;                  // per-word stagger; the house measure

const rise = (rec, delay = 0) => {
  const words = rec.apply();
  rec.revealed = true;
  M.animate(words, { transform: ['translateY(110%)', 'translateY(0%)'] },
    { ...SETTLE, delay: M.stagger(WORD_STEP, { startDelay: delay }) });
  // per-headline net: if that animation never ran, the words are still put back.
  // It has to clear the last word's own start, or a long headline gets its tail
  // snapped into place while the line is still rising.
  const net = (delay + WORD_STEP * words.length) * 1000 + 900;
  setTimeout(() => { for (const w of words)
    if (w.style.transform.includes('110')) w.style.transform = ''; }, net);
  return words;
};

window.elysiumText = {                     // used by the preview language switch
  unsplit: () => { for (const r of splits) r.restore(); },
  resplit: () => { for (const r of splits) r.apply(); }
};

/* The section overture. Every section opens the same way and in the same
   order: the rule draws left to right with a blue segment riding its growing
   end, then the index, then the headline out of its own measure, then the
   lede. One observer per section, so the four beats cannot drift apart — and
   the repetition is what makes eight sections read as one document. */
(() => {
  if (reduce) return;
  for (const head of $$('.sec-head')) {
    const rule = $('.sec-rule', head);
    const idx  = $(':scope > .mono', head);
    const h2   = $('h2', head);
    const lede = $('.lede', head);

    if (rule) rule.style.width = '0%';
    for (const el of [idx, lede]) if (el) hide(el);
    const rec = h2 ? makeSplit(h2) : null;

    M.inView(head, () => {
      if (rule) {
        rule.classList.add('drawing');
        M.animate(rule, { width: ['0%', '100%'] },
          { duration: 0.7, ease: [0.35, 0, 0.15, 1] })
          .finished.then(() => rule.classList.remove('drawing')).catch(() => {});
      }
      if (idx)  { shown(idx);  M.animate(idx,  { opacity: [0, 1], x: [-10, 0] }, { ...SETTLE, delay: 0.18 }); }
      if (rec)  rise(rec, 0.32);
      if (lede) { shown(lede); M.animate(lede, { opacity: [0, 1], y: [14, 0] }, { ...SETTLE, delay: 0.62 }); }
      return false;
    }, { amount: 0.3 });
  }
})();

/* ---- 11. Scroll, read continuously --------------------------------------
   The reading position tracks the scroll rather than firing at a threshold,
   so there is something moving under the finger the whole way down. */
(() => {
  if (reduce || !M.scroll) return;

  const hdr = $('.hdr');
  if (hdr) {
    const prog = document.createElement('span');
    prog.className = 'hdr-prog';
    prog.setAttribute('aria-hidden', 'true');
    hdr.append(prog);
    const w = M.motionValue(0);
    w.on('change', v => { prog.style.transform = `scaleX(${v.toFixed(4)})`; });
    M.scroll(p => w.set(p));
  }

})();

/* ---- 12. Pointer ---------------------------------------------------------
   Spring on the way in, settle on the way out. Colour and background stay
   in the stylesheet; only the displacement is animated, so a hover reads as
   the element answering rather than as a repaint. */
(() => {
  if (reduce) return;
  const lift = (sel, to, raise) => {
    for (const el of $$(sel)) {
      el.addEventListener('pointerenter', () => {
        if (raise) el.style.zIndex = '2';
        M.animate(el, to, GATE);
      });
      el.addEventListener('pointerleave', () => {
        M.animate(el, { y: 0, x: 0, scale: 1 }, SETTLE)
          .finished.then(() => { if (raise) el.style.zIndex = ''; }).catch(() => {});
      });
    }
  };
  lift('.card',                { y: -5 });
  lift('.spec article',        { y: -4 });
  lift('.roster li',           { y: -3 });
  lift('.tl li',               { x: 6 });
  lift('.sheet a',             { scale: 1.075 }, true);
  lift('.cities article',      { y: -4 });
})();

/* ---- 12b. The mandate readout -------------------------------------------
   The card grid is an index; this strip is the readout it feeds. The detail
   cannot live in the card — measured at four columns, the card is 324x323 and
   the longest detail 315, so it would either double every card's height or
   cover the row below — so it is written here instead, in a region that is
   always present. Nothing moves and nothing is covered.

   The strip reserves the tallest detail up front rather than resizing per card:
   a strip that grew and shrank as the pointer crossed the grid would move the
   grid under the pointer, which is the thing this placement exists to avoid.
   The height is measured from the real strings, so a translation that runs
   longer than the English is accounted for on its own terms. */
(() => {
  const strip = $('#readout'), body = $('.readout-body', strip || document);
  const grid = $('#grid');
  if (!strip || !body || !grid || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cards = $$('.card', grid);
  const fill = card => {
    const intel = $('.card-intel', card);
    if (!intel) return;
    body.replaceChildren(...[...intel.cloneNode(true).childNodes]);
    strip.classList.add('live');
  };
  const clear = () => strip.classList.remove('live');

  const measure = () => {
    strip.style.minHeight = '';
    const prev = body.innerHTML, vis = strip.classList.contains('live');
    let tallest = 0;
    for (const c of cards) {
      const intel = $('.card-intel', c);
      if (!intel) continue;
      body.replaceChildren(...[...intel.cloneNode(true).childNodes]);
      tallest = Math.max(tallest, body.scrollHeight);
    }
    body.innerHTML = prev;
    if (!vis) clear();
    // the strip's own box is one line of resting text; the body is out of flow,
    // so the reserved height has to be stated explicitly
    if (tallest) strip.style.minHeight = (tallest + 46) + 'px';
  };

  for (const c of cards) {
    c.addEventListener('pointerenter', () => fill(c));
    c.addEventListener('focusin', () => fill(c));
  }
  grid.addEventListener('pointerleave', clear);
  grid.addEventListener('focusout', e => {
    if (!grid.contains(e.relatedTarget)) clear();
  });

  measure();
  addEventListener('resize', measure);
  addEventListener('elysium:lang', measure);      // the preview's language switch
  if (document.fonts) document.fonts.ready.then(measure).catch(() => {});
})();

/* ---- 13. Filter state, travelling ---------------------------------------
   The pressed state is one element that moves between the buttons, so the
   filter reads as a single selection changing position rather than two
   buttons repainting at once. */
(() => {
  const bar = $('.filters'); if (!bar || reduce) return;
  const ind = document.createElement('span');
  ind.className = 'f-ind';
  ind.setAttribute('aria-hidden', 'true');
  bar.prepend(ind);

  const place = (b, animate) => {
    const r = b.getBoundingClientRect(), p = bar.getBoundingClientRect();
    const to = { x: r.left - p.left, y: r.top - p.top, width: r.width + 'px', height: r.height + 'px' };
    if (!animate) { Object.assign(ind.style, { width: to.width, height: to.height,
      transform: `translate(${to.x}px,${to.y}px)` }); return; }
    M.animate(ind, to, GATE);
  };

  const current = () => bar.querySelector('button[aria-pressed=true]') || bar.querySelector('button');
  place(current(), false);
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) requestAnimationFrame(() => place(b, true));
  });
  addEventListener('resize', () => place(current(), false));
})();

/* ---- 14. The rail --------------------------------------------------------
   The page is long and every section is numbered, so the margin carries a
   chart recorder: a tick per section, a run that fills behind the needle,
   and the section's own label set vertically beside it. The needle is a
   follower rather than a direct readout — it lags the scroll and settles,
   the way a pen arm does. That lag is the whole point: it makes the scroll
   feel like it is driving something with mass. */
(() => {
  if (reduce || innerWidth < 1180) return;
  const secs = $$('.sec-head').map(h => ({
    el: h.closest('section'),
    label: (h.querySelector('.mono')?.textContent || '').replace(/\s+/g, ' ').trim()
  })).filter(s => s.el);
  if (secs.length < 3) return;

  const rail = document.createElement('div');
  rail.className = 'rail';
  rail.setAttribute('aria-hidden', 'true');
  const run = document.createElement('span'); run.className = 'rail-run';
  const cur = document.createElement('span'); cur.className = 'rail-cur';
  const bar = document.createElement('i'), lab = document.createElement('b');
  cur.append(bar, lab);
  rail.append(run);
  for (const s of secs) {
    s.tick = document.createElement('span');
    s.tick.className = 'rail-tick';
    rail.append(s.tick);
  }
  rail.append(cur);
  document.body.append(rail);

  let H = 1, railH = 1;
  const measure = () => {
    H = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    railH = rail.clientHeight;
    for (const s of secs) {
      // where in the scroll a section is actually being read, not where its
      // box starts: the two differ by most of a viewport, which is the
      // difference between the needle naming 05 and naming 06
      s.at = Math.min(1, Math.max(0, (s.el.offsetTop - innerHeight * 0.35) / H));
      s.tick.style.top = (s.at * railH).toFixed(1) + 'px';
    }
  };
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure).catch(() => {});

  /* the needle: a first-order follower, so a fast scroll throws it and it
     catches up. One rAF loop, and only while it is actually moving. */
  let target = 0, pos = 0, running = false, active = -1;
  const step = () => {
    const d = target - pos;
    pos += d * 0.16;
    if (Math.abs(d) < 0.0002) { pos = target; running = false; }
    else requestAnimationFrame(step);
    cur.style.transform = `translateY(${(pos * railH).toFixed(2)}px)`;
    run.style.transform = `scaleY(${pos.toFixed(4)})`;

    let now = -1;
    for (let i = 0; i < secs.length; i++) if (pos >= secs[i].at) now = i;
    if (now !== active) {
      active = now;
      secs.forEach((s, i) => {
        s.tick.classList.toggle('past', i < now);
        s.tick.classList.toggle('now', i === now);
      });
      lab.style.opacity = '0';
      setTimeout(() => {
        lab.textContent = now >= 0 ? secs[now].label : '';
        lab.style.opacity = '1';
      }, 130);
    }
  };
  M.scroll(p => {
    target = p;
    if (!running) { running = true; requestAnimationFrame(step); }
  });
})();

/* ---- 15. The record, drawn as it is read ---------------------------------
   A line runs down the date column and fills as the section is read; a date
   turns from grey to red once the fill has passed it. Without this file the
   dates are simply all red, which is the correct static state. */
(() => {
  const tl = $('.tl'); if (!tl || reduce || !M.scroll) return;
  const line = document.createElement('span'); line.className = 'tl-line';
  const fill = document.createElement('span'); fill.className = 'tl-fill';
  line.append(fill); tl.append(line); tl.classList.add('live');

  const items = $$('li', tl);
  const f = M.motionValue(0);
  f.on('change', v => {
    fill.style.transform = `scaleY(${v.toFixed(4)})`;
    const h = tl.clientHeight;
    for (const li of items) li.classList.toggle('past', li.offsetTop + li.offsetHeight * 0.5 <= v * h);
  });
  M.scroll(p => f.set(p), { target: tl, offset: ['start 78%', 'end 62%'] });
})();

/* ---- 16. The contact sheet develops --------------------------------------
   Eighteen unattributed pieces out of the domain's own history. Colour
   returns to whichever of them is under the middle of the screen, so the
   sheet reads as being passed over rather than displayed all at once. */
(() => {
  const sheet = $('#sheet'); if (!sheet || reduce) return;
  const imgs = $$('img', sheet);
  let hover = null;

  // Rects are read live rather than cached. A cache taken at load describes a
  // page a few hundred pixels shorter than the one being scrolled — the fonts
  // have not landed yet — and every thumbnail then sits outside its own reach.
  const paint = () => {
    const eye = innerHeight / 2, reach = innerHeight * 0.52;
    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      const t = img === hover ? 1 : Math.max(0, 1 - Math.abs(r.top + r.height / 2 - eye) / reach);
      const e = t * t * (3 - 2 * t);                       // ease the falloff
      // filter only: the reveal in §17 owns opacity, and two writers on one
      // property is how an element ends up stuck half-visible
      img.style.filter = `grayscale(${(1 - e).toFixed(3)}) contrast(${(0.95 + e * 0.06).toFixed(3)}) ` +
                         `brightness(${(0.93 + e * 0.07).toFixed(3)})`;
    }
  };
  let queued = false;
  const tick = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  };
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick, { passive: true });
  for (const a of $$('a', sheet)) {
    a.addEventListener('pointerenter', () => { hover = a.querySelector('img'); paint(); });
    a.addEventListener('pointerleave', () => { hover = null; paint(); });
  }
  paint();
})();

/* ---- 17. Grids arrive on the diagonal ------------------------------------
   A uniform stagger reads as a list being dealt out. Keying the delay to
   the cell's own position instead lets a grid resolve as a wave across it,
   which is the shape the eye is already scanning in. */
(() => {
  if (reduce) return;
  const wave = (sel, k = 0.00055) => {
    const els = $$(sel); if (els.length < 4) return;
    const box = els[0].parentElement.getBoundingClientRect();
    const d = els.map(el => { const r = el.getBoundingClientRect();
      return ((r.left - box.left) + (r.top - box.top) * 0.75) * k; });
    els.forEach(hide);
    M.inView(els[0].parentElement, () => {
      shown(els);
      els.forEach((el, i) => M.animate(el,
        { opacity: [0, 1], y: [18, 0] }, { ...SETTLE, delay: d[i] }));
      return false;
    }, IN);
  };
  wave('.roster li');
  wave('.sheet a', 0.0011);
  wave('.spec article', 0.0009);
})();

})();
