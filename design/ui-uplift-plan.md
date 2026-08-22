# syslab UI Uplift — Analysis & Redesign Plan

*Status: proposal · 2026-08-23*
*North star: `design/phosphor-cartography.md` + `design/phosphor-cartography-plate-01.png`*

---

## Part I — Where the UI stands today

### What is already right (keep, don't touch)

- **Token architecture.** One `@theme` in `src/app/globals.css` feeds both DOM *and* SVG;
  viz and UI cannot drift on color. This is rare and worth protecting.
- **The bones of the aesthetic already exist**: film grain (`body::after`), `.dot-grid`,
  `.tech-label`/`.tech-num`, `.text-outline`, `CornerTicks`, the `fig · <id> · seed 42`
  plate stamp, `Meter`'s threshold ticks and sparkline luminance ramp, `EdgeLine`'s 1.25px
  hairlines, the lesson-page engineering title block.
- **Accessibility craft**: exemplary `SegmentedControl` (roving tabindex, WAI-ARIA),
  `SystemNode`'s manual SVG focus rect + padded hit areas, `Meter`'s rich labeling,
  site-wide `prefers-reduced-motion` handling, full mobile drawer modal hygiene.
- **A safety net most redesigns lack**: 27 pinned stage baselines with a written regen
  protocol (`e2e/visual.spec.ts`), mobile specs asserting 44px targets and zero horizontal
  scroll, axe runs on seven routes with two honestly-pinned findings.

### Gap A — Systemic drift (the "kit" was never finished)

| Drift | Evidence |
|---|---|
| Wordmark/site header pasted inline **6×** | `app/page.tsx:13`, `navigation/Sidebar.tsx:14`, `navigation/MobileNav.tsx:176`, `about/page.tsx:24`, `review/page.tsx:34`, `playground/page.tsx:16`, `not-found.tsx:19` |
| Container widths per page: 6xl / 3xl / 2xl | landing+playground 6xl, learn/review/404 3xl, about 2xl |
| Primary CTA re-implemented **4×** with drift | `ContinueCta.tsx:15`, `not-found.tsx:62` (`rounded-md`+glow) vs `about/page.tsx:84`, `ReviewDeck.tsx:192` (`rounded-lg`, no glow). `ui/Button.tsx` has only 3 consumers |
| Three icon-button idioms | `TransportBar.tsx:290,301,416` (quiet), `InteractiveFigure.tsx:487` (bordered), plus ad-hoc |
| Fig-plate stamp string triplicated | `InteractiveFigure.tsx:472`, `FigureErrorBoundary.tsx:103`, `hash-table-lab.tsx:63` |
| Section-header rule pattern re-implemented **~9×** | `page.tsx:36`, `learn/page.tsx:15`, `LessonMap.tsx:304`, `Lesson.tsx:121`, `LessonSection.tsx:101`, `ReviewDeck.tsx:85,113`, `review/page.tsx:49`, `prose.tsx:161` |
| Duplicated maps | `difficultyColor` (`LessonMap.tsx:21` ≈ `Lesson.tsx:15`); accent→var (`lib/accent.ts` vs `PlaygroundClient.tsx:13`) vs a third **hex** parallel in `lib/og.tsx:49` |
| No radius scale | `rounded-md` / `rounded-lg` / `rounded-full` / `rounded`(4px) / `rx=10` / `rx=12` all coexist, unruled |
| Quiet-text ladder loose | same job done with `text-fg-muted`, `text-fg-faint`, `text-fg-faint/80` depending on file |
| Four focus treatments | Button: none (UA default); SegmentedControl: negative-offset outline; sliders: bespoke thumb ring; SystemNode: manual rect |
| Motion governance silently failed | `src/lib/motion.ts` self-describes as "one animation voice" — **zero imports anywhere**; real durations scatter 150/200/250/300ms + motion-react defaults |
| Dead / weak primitives | `Badge` unused entirely; `Kbd` used once; `cn()` lacks tailwind-merge so override order is luck |

### Gap B — Aesthetic distance from Phosphor Cartography

The philosophy asks for **one light** (amber, spent like ink from a nearly-empty well), a
second color appearing **once, as a wound**, everything else hairline and half-tone,
hierarchy carried by **luminance**, typography that **whispers in monospace**, and
composition like a **scientific plate**: one central figure, generous dark margins,
marginalia (scale bar, specimen count, registration marks) at the edges.

Where today's UI departs:

1. **Color budget exceeded in chrome.** Six glow hues (amber, orange, cyan, violet, green,
   red) appear across cards, legends, chips, piers and prose callouts. In chrome, hue
   competes with luminance as the hierarchy device.
2. **The stage reads as "UI cards on a dark page", not an instrument.** `SystemNode` draws
   rounded rectangles with icon glyphs and pill-shaped load bars; the consistent-hashing
   ring renders as thick saturated arcs (amber/violet/teal) rather than a hairline dashed
   circumference with radial ticks; `ControlPanel`'s toggle is a stock iOS switch — the one
   control with no instrument character. Compare the plate: rings, dials, tick scales,
   dotted circumferences, engraving.
3. **Typography talks when it should whisper.** Bricolage headlines dominate; H1 scale is
   bespoke per page (hero clamp → `text-3xl` → bare `text-xl` on Playground). The mono
   label layer — the site's actual signature — is still treated as garnish rather than the
   primary typographic voice for titles-as-title-blocks.
4. **Cartographic devices missing site-wide.** Progress is rounded bars; there are no tick
   rulers, tally counts, or scale bars outside individual meters. `CornerTicks` exists but
   frames only figures, not pages/cards.
5. **Small violations of "nothing overlaps"**: lesson ghost numerals under the kicker
   (`Lesson.tsx:113`), `-mt-8` coupling on the learn hub (`learn/page.tsx:29`).

### Gap C — Known accessibility debt (pinned, fixable)

1. `--color-fg-faint` fails contrast as text (worst 1.54:1 ghost numerals, 2.93:1 landing
   meta) — pinned in `e2e/a11y.spec.ts` `KNOWN_FINDINGS`; the stated fix is a token change.
2. `nested-interactive`: the `role="img"` stage SVG contains focusable breakable nodes —
   pinned pending a design decision.

### Blast-radius reality (shapes the sequencing)

- **Page chrome is unpinned** by visual tests → free to redesign.
- **Any change to a `--color-*` value consumed inside the stage blows all 27 goldens**
  (fg-faint alone appears in sparklines, fig stamps, sidebar footer…).
- Stage *geometry* changes also blow them. Conclusion: batch token changes once, batch
  stage-geometry changes once, run the documented regen protocol twice total.

---

## Part II — Design direction: the plate grammar

Ten working rules that translate Phosphor Cartography into daily decisions:

1. **Luminance is the hierarchy.** Bright = matters; faint = supports; dark = space. Hue is
   never the first thing a viewer reads.
2. **Chrome color budget:** neutral fg-ladder + amber + red-as-wound. Semantic multi-hue
   (packet types, module accents) lives **only inside simulation data encodings**, never in
   navigation, prose, cards, or buttons.
3. **Hairlines carry structure.** 1px borders and rules; filled areas are earned (a meter
   fill, a packet, one CTA).
4. **Geometry over ornament.** Circles/rings/dials, radial ticks, dotted circumferences,
   tallies. Radii collapse to a ruled scale: `0 / 2 / 6 / full(pips only)` — plates and
   cards go near-square with corner registration marks; "machined" controls get 6px.
5. **Mono whispers, display speaks once.** All metadata, labels, coordinates, stamps:
   Plex Mono uppercase tracked (`.tech-label`). Display type appears once per page (H1),
   everything below it steps down fast. One `.text-outline` moment per site (hero / 404).
6. **Numbers are honest.** Tabular numerals, units always shown, every rendered quantity
   traceable to sim state; progress shown as tick-scales/tallies, not rounded bars.
7. **Margins are part of the drawing.** Generous, asymmetric-but-exact; nothing overlaps;
   nothing crowds; marginalia live at edges (registration marks, plate numbers, scale bars).
8. **One motion voice.** Either wire `lib/motion.ts` and route every duration/spring
   through it, or delete it — no third option. Engine CSS transitions stay (10Hz snapshot
   discipline is correct).
9. **One focus convention.** 2px amber outline, offset −2 inside clipped chrome / +2
   elsewhere; the slider thumb-ring and SystemNode rect become implementations of it.
10. **Made, not generated.** Grain stays; glows breathe only at edges; alignments tuned
    like an instrument.

---

## Part III — Plan (five phases, each shippable)

### Phase 1 — Foundation: tokens, type, rhythm *(small, no layout change)*

Goal: make the right thing the easy thing. All token-value changes happen HERE, once.

- `globals.css @theme`: raise `--color-fg-faint` until text usages pass AA (~oklch 55%+
  region; verify against axe) — clears pinned finding #1. Optionally warm the ground a step
  toward the plate's bakelite brown-black. Resolve the amber/orange split-brain: orange is
  *only* degraded-state, rename/document it as `--color-warn` alias to kill accidental use.
- Add missing scales as tokens: radii (rule 4), space rhythm (one padding idiom for stacked
  strips: `px-4 py-3` wins), durations (150/250/400ms + `--ease-out-soft`), container
  widths (`--width-read: 48rem`, `--width-app: 72rem`).
- Codify the quiet-text ladder (fg → muted → faint roles, one sentence each) as comments +
  CLAUDE.md.
- Decide focus convention; implement in base layer; adapt slider/node implementations to it.
- Motion: route Tailwind/CSS durations through the new tokens; either adopt `lib/motion.ts`
  in CaptionOverlay/PredictionQuiz/SystemNode springs or delete the file.
- `cn()` gains tailwind-merge.
- **Then run the visual regen protocol once** (token values moved → goldens re-pinned) and
  commit pngs with the change.
- Verify: `npm run check`, build, axe now reports finding #1 fixed → remove from
  `KNOWN_FINDINGS`.

### Phase 2 — Primitive kit: consolidate the duplicates *(medium, near-zero visual delta)*

Goal: one implementation per recurring artifact, so Phase 3 restyles in one place.

- `SiteHeader` / `SiteFooter` (wordmark ×6 → ×1; nav slots per page).
- `IconButton` absorbing the three idioms (quiet / bordered / solid).
- `PlateLabel` — the fig-stamp class string (×3 → ×1).
- `SectionHeading` — kicker + `tech-rule` pattern (×9 → ×1) with size variants.
- Adopt `Button` at all four CTA call sites; standardize primary (glow) / ghost / outline.
- Extract `PlateFrame` (CornerTicks + plate stamp + optional scale-bar slot) so
  `InteractiveFigure` and labs compose instead of copy (`hash-table-lab.tsx` refactor).
- Reinvent dead `Badge` as a square-cornered tick-tag chip (or delete if unwanted).
- Instrument toggle replacing the iOS switch in `ControlPanel` (ring + tick + amber state).
- Single source for accent maps: `PlaygroundClient` and `lib/og.tsx` derive from
  `lib/accent.ts`; `difficultyColor` moves to `curriculum/`.
- Verify: `npm run check` + build + smoke e2e (should be pixel-identical or near).

### Phase 3 — Chrome redesign pass *(large, unpinned by visual tests)*

Apply the plate grammar to everything **outside** the stage:

- **Shared chrome:** header/footer with plate marginalia (plate number left, seed/status
  right); unify containers (reading pages 48rem; app surfaces 72rem).
- **Landing:** hero becomes the site's Plate 01 — monumental central `HeroSim`, generous
  margins, corner registration marks, scale bar + specimen-count marginalia; vignette
  ledger rows gain tick-scale numerals; manifest rows become numbered chapter entries.
- **Learn hub + sidebar:** progress spine becomes a tick ruler with tally counts;
  `TrackProgress` bar becomes a sectioned tick-scale; module clusters keep `mod.01`
  numbering; difficulty encoded by mark shape/luminance, not hue alone.
- **Lesson pages:** generalize the existing engineering title block as THE header pattern
  (index numeral, title, spec strip); checkpoint rail becomes marginalia ruler with tick
  marks; resolve ghost-numeral overlap per rule 7.
- **Type-scale rollout:** one H1 treatment per page; Playground's `text-xl` H1 fixed;
  Review's label-styled `<h2>`s restored to heading voice.
- **Review / Playground / About / 404:** widths unified, CTA variants adopted, About's
  stray `rounded-lg` CTA absorbed.
- Prose kit: `Callout` recolored to the chrome budget (note=neutral, warning=orange-wound,
  insight=amber); bullet markers become tick dashes consistently.
- Verify: `npm run check`, build, mobile suite (drawer, overflow, 44px), axe on seven
  routes.

### Phase 4 — Stage aesthetic pass *(large, ONE planned golden regen at the end)*

Goal: the figure itself becomes the instrument plate. Order within the phase minimizes
rework: shell → nodes → data layers → overlays.

- `InteractiveFigure` shell: graticule upgrade — edge tick-scales (like the plate's
  arrivals ruler) alongside the dot grid; plate frame via `PlateFrame`; expanded mode
  keeps fullscreen contract tested by `mobile.spec.ts`.
- `SystemNode`: engraved-instrument redraw — hairline body, corner-ticked, ring/dial load
  gauge replacing the pill bar, engraved mono labels; keep hit/focus/a11y machinery as-is.
- Consistent-hashing-style arcs: hairline dashed circumference + radial range ticks +
  luminance-weighted arc strokes instead of thick saturated bands (lesson-side
  `stageOverlay`s reviewed case by case).
- Packet palette harmonization: keep the six-type legend (it is *data*, rule 2 allows it)
  but tune toward the amber family + luminance/shape differentiation; legend shares the
  map so nothing drifts.
- `PredictionQuiz`: redesign from centered modal to plate overlay (registration marks,
  mono kicker, hairline choices with tick reveals) while keeping the entire dialog a11y
  contract (focus management, live verdict).
- `TransportBar`/`ControlPanel`: instrument-strip idiom (tick-ruled scrub track, engraved
  clock, instrument toggle from Phase 2).
- **Then** the second (and last) golden regen: `--update-snapshots` → eyeball every png →
  commit pngs + code together → clean re-run.
- Decide and fix axe finding #2 here (recommended: drop `role="img"` in favor of a
  figure-level label + keep node buttons; or move the kill affordance to a control row) →
  remove from `KNOWN_FINDINGS`.

### Phase 5 — Hardening & documentation

- Add page-chrome visual baselines (landing, learn hub, one lesson, review at
  desktop + 390px) now that the redesign has settled — chrome stops being unprotected.
- Update `CLAUDE.md` design-system section: plate grammar rules, new primitives, token
  scales, the two-regen history.
- Full gate: `npm run check && npm run build && npm run test:e2e` (with `PW_VISUAL=1`
  locally once).

---

## Sequencing rationale

1. Tokens first (Phase 1) — every later phase consumes them; contrast fix is overdue.
2. Kit second (Phase 2) — Phase 3/4 then restyle single implementations, not 20 copies.
3. Chrome before stage (3 before 4) — chrome is unpinned (free), stage goldens are the
   expensive blast radius; batching stage changes means exactly two golden regens total.
4. A11y findings are cleared opportunistically where they're cheapest (#1 in Phase 1,
   #2 in Phase 4) and enforcement turned on by emptying `KNOWN_FINDINGS`.

## Risks & guardrails

- Never touch engine determinism/step functions — this plan is presentation-layer only.
- Preserve reduced-motion contracts (packets hide → edge heat view; animations collapse).
- Keep globals.css layering discipline (`@layer components` vs unlayered effects) — it
  documents a real bug it solved.
- Mobile invariants (44px targets, zero horizontal scroll at 390px, drawer hygiene) are
  regression-tested after every phase.
- Visual diffs are *eyeballed*, never bulk-accepted (protocol already says this).

## Open decisions (recommendations included)

1. **Radius direction** — recommend the collapsed scale (0/2/6/full) for plate character;
   softer alternative keeps today's `rounded-lg` warmth.
2. **Display-font fate** — recommend keeping Bricolage for the single per-page H1 and
   demoting everything else to the mono/title-block system (closest to the philosophy);
   stronger alternative: mono-only headings site-wide.
3. **Stage color budget** — recommended: keep six packet hues as data encoding, harmonized
   saturation; stricter alternative: luminance+shape-coded packets with hue reserved for
   faults only (prettier, riskier pedagogically).
4. **Chrome baselines** — recommend adding them in Phase 5.
