# Elysium — section grounds and section motion

The hero resolves into the page properly. Nothing after it does. This spec makes the
rest of the document follow the hero: same dark, same blue, same kind of handover
between one ground and the next, and one repeatable way that a section opens.

Scope: `index.html`, `styles.css`, `main.js`. Vanilla, no new dependencies. Everything
here is driven by the existing `motion.js` (`M.inView`, `M.animate`, `M.scroll`,
`M.stagger`) and the existing `.rv` / `makeSplit` machinery. The i18n build reads text
nodes, so no change may introduce a new wrapper that splits a translatable sentence.

---

## 1. Palette bridge — the page inherits the hero's colours

The disconnect is not only the seam, it is the accent. The hero is `#0C0C0B` with a
blue; every section below it is warm paper with a Swiss red. They read as two brands.

Add to `:root`, beside the existing tokens:

```
--plate:#0C0C0B;      /* the hero's ground, now the site's dark ground   */
--blue:#1F4FD8;       /* the printed card's blue                          */
--blue-lift:#9FC4FF;  /* the same blue, legible on --plate                */
--blue-ink:#1B45BE;   /* the same blue, ≥4.5:1 on --paper, for body text  */
```

Rules:

- **`--plate` replaces `--ink` as the ground of every dark block.** `.llm` and
  `.spec article.lead` currently sit on `#16181A`. They become `var(--plate)`, so the
  dark in the middle of the page is the *same* dark as the hero. One dark, not two.
- `--ink` stays what it is for **type on paper**. Do not repaint body copy.
- **The Swiss red retires to the federal cross and nothing else.** Not the timeline,
  not the filter indicator, not button hover, not the focus ring. Half-converting is
  worse than not converting: a blue index beside a red bullet reads as two accents
  arguing. If blue is the accent, every functional red goes.
- **Blue becomes the through-line.** Section index numbers, the leading edge of every
  section rule, the rail run, and link underlines on paper use `--blue-ink`. On
  `--plate` grounds they use `--blue-lift`.
- Contrast is not negotiable: `--blue-ink` on `--paper` and `--blue-lift` on `--plate`
  must both clear 4.5:1. Verify, do not assume.

---

## 2. Ground shifts — generalise `.plate-out`

`.plate-out` already does the hero handover: a tall ramp, the hero's four grid
verticals carrying down through it and dissolving, terminating on the next section's
top rule. It works. It is also hard-coded to one direction and one pair of colours.

Replace it with one reusable element:

```html
<div class="ground-shift" data-to="paper" aria-hidden="true"></div>
```

```
.ground-shift{--from:var(--plate);--to:var(--paper);
  --gh:clamp(9rem,21vh,15rem);block-size:var(--gh);pointer-events:none}
.ground-shift[data-to="plate"]{--from:var(--paper);--to:var(--plate)}
```

Body: the nine-stop ramp from `--from` to `--to`, spaced so the perceived midpoint
lands mid-band and not at the light end, plus the four verticals at
`12.6% 37.5% 61.9% 86.2%`, 1px wide, running 72% of the height and fading out. On a
`data-to="plate"` shift the verticals fade *in* downward instead — the grid arrives
before the dark does.

**Placement — three seams, not one:**

| # | Between | Direction |
|---|---|---|
| 1 | `#hero` → `#roster` | plate → paper (exists) |
| 2 | `#care` → `#llm` | paper → plate |
| 3 | `#llm` → `#work` | plate → paper |

Each shift consumes the following section's top padding rather than adding to it:
`.ground-shift + section{padding-block-start:0}`. Page rhythm must not change.

`#llm` keeps its own internal padding. Its `.sec-head` rule flips to `--paper` on the
dark ground, its index to `--blue-lift`.

---

## 3. The section overture — one way a section opens

Every `.sec-head` is the same three parts: a mono index (`01 — Mandates`), an `h2`, and
a `.lede`. Today they fade up together. They should arrive in order, as an instrument
drawing itself, and it must be the *same* order every time — that repetition is what
makes the page feel composed rather than assembled.

Fires once, on `M.inView(secHead, …, { amount: 0.3 })`. Four beats, 1.05s total:

| Beat | Element | Motion | Start | Duration |
|---|---|---|---|---|
| 1 | the `border-top` rule | `scaleX 0 → 1`, origin left | 0ms | 700ms, `--e-trace` |
| 2 | leading edge | a 2rem blue segment rides the rule's growing end, then dissolves | 0ms | 700ms |
| 3 | mono index | `opacity 0→1`, `x -10 → 0` | 180ms | 400ms, `--e-settle` |
| 4 | `h2` | word masks via `makeSplit` + `rise`, stagger 0.05 | 320ms | per §9 |
| 5 | `.lede` | `opacity 0→1`, `y 14 → 0` | 620ms | 400ms, `--e-settle` |

The rule cannot be animated as a `border-top`. Replace it with a child
`<i class="sec-rule">` at `inset-inline:0; top:0; height:1px`, `transform-origin:left`,
and drop `border-top` from `.sec-head`. The blue leading edge is that element's
`::after`: a 2rem block pinned to its right end, `background:var(--blue-ink)`, fading
to 0 over the last 30% of the wipe.

`h2` word masks: reuse `makeSplit(el)` and `rise(rec, delay)` from §9 exactly. Do not
write a second splitter — §9 already handles the i18n round-trip that the language
switch depends on, and a parallel implementation will break it.

---

## 4. Continuity between sections

- **The rail** (§14) already tracks reading position. Its run becomes `--blue-ink`.
- **No new scroll-linked effects.** The page already carries the hero card, the rail,
  the header progress, the filter indicator, the counters and seven inView groups.
  Another continuous listener is what makes a page feel heavy.

---

## 5. Reduced motion

`prefers-reduced-motion: reduce` gets: ground shifts still rendered (they are colour,
not motion), rules at full width, index and headings at full opacity, no word masks,
no wipes. The overture is enhancement; the composition must read without it.

---

## 6. Acceptance

1. All three seams ramp. No hard dark/paper butt joint anywhere in the document.
2. `#llm` and `.spec article.lead` are `--plate` — byte-identical to the hero's ground.
3. Every `.sec-head` opens with the same four beats, in the same order.
4. `--blue-ink` on `--paper` ≥ 4.5:1; `--blue-lift` on `--plate` ≥ 4.5:1. Measured.
5. `node build.js` → 0 keys missing in `fr` and `de`. No new untranslated strings.
6. No console errors; reduced-motion path verified.
