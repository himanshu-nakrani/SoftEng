# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**syslab** — an interactive system-design learning site. Every lesson is built around a running simulation (animated request packets, live sliders, killable servers) rather than prose. Next.js 15 App Router + React 19 + TypeScript, Tailwind CSS v4, `motion` (import from `"motion/react"`, NOT legacy `framer-motion` — lint-enforced), zustand. Static export (`output: "export"`) — no server, no accounts; progress lives in localStorage. One track, four modules (scaling, data, resilience, distributed), 20 lessons.

## Commands

- `npm run dev` — dev server. Note: dev mode occasionally serves a stale/404 CSS chunk after route recompiles (Tailwind v4 + HMR quirk); fix with `rm -rf .next` and restart. Production builds are unaffected.
- `npm run build` — static export to `out/`. Honors optional `BASE_PATH` (project-site hosting) and `NEXT_PUBLIC_SITE_URL` (canonical origin for metadata/sitemap).
- `npm run check` — `tsc --noEmit && eslint . && npx tsx scripts/check-curriculum.mts && vitest run`. Run before considering any change done.
- `npm run test` — vitest alone: invariant suite (determinism, packet cap, topology integrity, meter coverage, quiz semantics for EVERY available lesson) + golden-run regression.
  - Goldens live in `src/lessons/__tests__/goldens/`; a missing golden bootstraps on first run. After a DELIBERATE behavior change: `UPDATE_GOLDENS=1 npx vitest run`, then eyeball the diff.
  - A new lesson needs one line in `SIM_BY_KEY` in `src/engine/__tests__/harness.ts` — the matrix guard fails loudly if you forget.
- `npm run test:e2e` — Playwright smoke over the built export (routes derived from the registry, zero console/hydration errors, one sim drive, reduced-motion). Needs `npm run build` first. In sandboxes where the pinned browser mismatches: `PW_CHROMIUM_PATH=<chromium binary> npx playwright test`.
- CI (`.github/workflows/ci.yml`) runs check + build + e2e on every push/PR; pushes to `main` deploy to GitHub Pages with `BASE_PATH=/SoftEng`.

## Architecture

Three layers, strictly ordered: **curriculum registry → lesson pages → simulation engine**. Data flows down; nothing imports upward (lesson sims are lint-banned from importing render internals).

### Curriculum registry (single source of truth)

`src/curriculum/registry.ts` defines tracks → modules → lessons → sections. The sidebar, mobile drawer, `/learn` lesson map, progress math, prev/next navigation, per-page metadata (`lessonMetadata`), sitemap, e2e route list, test matrix, and the CI check all derive from it. Lesson metadata lives ONLY here — pages never restate it; `<Lesson slug>` looks it up.

- Progress % denominator = the registry's `sections` array.
- `scripts/check-curriculum.mts` (real imports via tsx, not regex) enforces: route parity both ways, `<LessonSection id>` ↔ registry section parity both ways, figure+sim companion files, slug/module integrity, prerequisites resolving strictly earlier in curriculum order, quiz-id uniqueness and validity, and meter sanity.

### Simulation engine (`src/engine/`)

The product core. A lesson is **data + a step function** (`LessonSim<L>` in `engine/types.ts`): `{ id, topology, params, init, step, timeline?, quiz?, meters, packetStyles?, packetLegend?, initialNodes? }`. Lessons never touch render internals; `<InteractiveFigure sim={...}>` is the single entry point (stage + legend + meters + controls + transport + quiz overlay, wrapped in `FigureErrorBoundary` so a crashing sim halts its own figure, never the page).

**`engine/runner.ts` is the headless core** — `createRunner(sim, {seed, params})` owns initial state, the tick body (step → clock → timeline → quiz detection, with optional `when` gates), captions, and restart; `useSimulation` is a thin React binding over it (rAF accumulator, status/speed mirrors, snapshot publishing, quiz pause policy). Tests and scratch scripts drive the runner directly.

Rendering is two layers with different update disciplines:

- **Structure layer** (React + Motion): nodes/edges/meters subscribe to a ~10Hz snapshot (`useSimSnapshot` / `engine/snapshot.ts` — carries metrics, nodes with deep-copied `meta`, bounded `series`, and per-edge `edgeActivity`). CSS transitions interpolate between snapshots. Under `prefers-reduced-motion`, packets hide and edges render a traffic-heat view from `edgeActivity` instead.
- **Packet layer** (imperative): `PacketLayer` owns a pool of 128 `<circle>`s mounted once and writes attributes per frame from the live state ref inside the single rAF loop. React never re-renders per frame. Packet styles resolve through `resolvePacketStyles(sim)` (built-ins + lesson `packetStyles`); the legend shares the same map so they cannot drift.

Engine invariants — do not violate when adding lessons or features:

- Sim time ≠ wall time. Fixed 30-tick/sec accumulator loop; never animate packets with CSS/Motion/WAAPI (pause/step/speed require positions computed from the sim clock).
- All randomness via the seeded RNG in `SimState.rng` (mulberry32) — same seed ⇒ identical run. Prediction quizzes and golden tests depend on this. `Math.random()` in sim code is lint-banned. Hoist `shouldSpawn` out of loop conditions (in-condition calls burn extra RNG draws).
- In-flight packets are capped at `PACKET_POOL` (128); `spawnPacket` silently no-ops at the cap. Represent high volume with aggregates (queue-depth chips, load bars, numeric meters), never more dots — see `fanout.ts` for the pattern at 5M writes.
- Packet positions are computed analytically from quadratic Béziers (`engine/paths.ts`) — no DOM measurement.
- `step` mutates state in place. Author verbs live in `engine/sim-helpers.ts`: `spawnPacket` (stamps `bornAt`, accepts `diesAt`), `advancePackets`, `shouldSpawn`, `approach`, `drainQueue`/`ServiceQueue`, `emaRate`, `emaEvent` (pass rate < 1 for genuine ratio gauges — rate ≥ 1 latches to the newest sample), `bounceDrop`, `killNode`/`reviveNode`/`isAlive`, `expirePackets` (deadline reaping), `severEdge` (partitions), `recordSample` (bounded `series` ring buffers feeding `"sparkline"` meters).
- "button" params: engine sets `params[key] = true` on press; the lesson's step must consume and reset it to `false`. Pressing while paused auto-resumes.
- Timeline events and quiz checkpoints accept `when?: (state, params) => boolean` gates. Gated quizzes are EXCLUDED from golden pinning (they may legitimately never fire) — prefer ungated checkpoints when a fixed `at` works at seed 42.

`LessonSim<L>` is invariant in `L` — components that don't touch lesson state accept `LessonSimView`.

### RSC boundary pattern

`LessonSim` objects contain functions, so they cannot cross the server→client prop boundary. Every lesson has a `"use client"` figure component co-located with its sim (`src/lessons/<module>/<slug>-figure.tsx`) binding it to `<SectionFigure>`; server-component pages import the figure, never the sim.

`SectionFigure` props beyond the sim: `stageOverlay` (full-stage SVG decoration from the snapshot — hash ring, keyspace strip, partition divider), `nodeOverlay` (node-internals rendering — token gauges, role badges; ghosts draw no overlay), and `completes` (cross-section completion rules, below).

### Progress system

`src/stores/progress.ts` — zustand + persist (`softeng-progress`, version 2, sanitized on migrate AND merge so corrupt localStorage can't crash pages). Any component reading progress must gate on `useHydrated()`. Completion is interaction-gated:

- `concept` sections: IntersectionObserver dwell in `LessonSection` (ratio ≥ 0.35 OR filling 60% of the viewport; paused in hidden tabs).
- `interactive` sections: only via genuine engagement (`SectionFigure`'s `onEngage` — scroll-autoplay uses `play({system:true})` and never engages) or via `completes` rules mapping `SimEvent`s (node-kill / param-change / button-press / quiz-answered) to OTHER section ids — the pattern for interactive sections whose subject lives in another section's figure.
- Prediction-quiz answers persist as `"<lessonSlug>/<quizId>"` → `{choiceId, correctFirstTry, attempts, completedAt}`. A lesson is **mastered** when complete AND every recorded checkpoint was right first try.
- `ProgressSettings` (on `/learn`) exports/imports/resets; import sanitizes then keep-best merges.

### Design system

All tokens are CSS custom properties in `@theme` in `src/app/globals.css` (Tailwind v4 CSS-first — no tailwind.config). Theme: warm-graphite "amber console" — `--color-accent` (phosphor amber) is the PRIMARY; `--color-glow-orange` is the warning/degraded hue (never brand amber for warnings); cyan is demoted to info/misses; red means capacity loss/faults, not policy refusals. SVG viz and UI share the same variables — packet colors, node strokes, meter fills, and overlay hues must reference tokens, never hard-coded colors. `.tech-label`/`.tech-num` live in `@layer components` so color utilities can override them; effect classes (`.text-outline`, `.glow-blob`, …) are deliberately unlayered. Range inputs get the `sim-slider` treatment (thumb + 44px hit area + `--fill` gradient). Fonts: Bricolage Grotesque (display), IBM Plex Sans (body), IBM Plex Mono (technical labels).

## Adding a lesson (the recipe)

1. Registry entry with `sections` (ids are the contract for the page AND completion).
2. `src/lessons/<module>/<slug>.ts` — the `LessonSim` (`id` MUST equal the slug; ~150–330 lines; `src/lessons/scaling/client-server.ts` is the minimal reference, the distributed module has richer patterns). Follow the arc: observe (timeline captions) → manipulate (params) → predict (an ungated checkpoint whose premise you VERIFY at seed 42 via the runner, firing before its proof) → break (breakable nodes, plus a scripted beat so passive learners see it). Conventions: quiz ids lesson-prefixed; "dropped" = capacity loss, "rejected" = policy; ≤5 meters.
3. `src/lessons/<module>/<slug>-figure.tsx` — the `"use client"` wrapper; wire any second interactive section via `completes`.
4. `src/app/learn/<module>/<slug>/page.tsx` — `<Lesson slug>` + `<LessonSection id>` blocks (ids must match the registry) + prose primitives (`P`, `Lead`, `Term`, `Callout`); `export const metadata = lessonMetadata("<slug>")`.
5. One line in `SIM_BY_KEY` (`src/engine/__tests__/harness.ts`).
6. `npm run check && npm run build` — the first vitest run bootstraps the lesson's golden; review and commit it.
