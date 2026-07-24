# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**syslab** — an interactive system-design learning site. Every lesson is built around a running simulation (animated request packets, live sliders, killable servers) rather than prose. Next.js 15 App Router + React 19 + TypeScript, Tailwind CSS v4, `motion` (import from `"motion/react"`, NOT legacy `framer-motion`), zustand. Static export (`output: "export"`) — no server, no accounts; progress lives in localStorage.

## Commands

- `npm run dev` — dev server. Note: dev mode occasionally serves a stale/404 CSS chunk after route recompiles (Tailwind v4 + HMR quirk); fix with `rm -rf .next` and restart. Production builds are unaffected.
- `npm run build` — static export to `out/`. Serve with any static server (`npx serve out`) to verify.
- `npm run check` — `tsc --noEmit && eslint . && node scripts/check-curriculum.mjs`. Run before considering any change done.
- There are no unit tests. Simulation logic can be exercised headlessly: drive `sim.step()` in a loop with `mulberry32` RNG via `npx tsx` (see the LessonSim contract below — steps are pure-ish functions over plain state).

## Architecture

Three layers, strictly ordered: **curriculum registry → lesson pages → simulation engine**. Data flows down; nothing imports upward.

### Curriculum registry (single source of truth)

`src/curriculum/registry.ts` defines tracks → modules → lessons → sections. The sidebar, `/learn` lesson map, progress math, prev/next navigation, and CI check all derive from it. Lesson metadata (title, difficulty, prerequisites, section list) lives ONLY here — pages never restate it; `<Lesson slug>` looks it up.

- Progress % denominator = the registry's `sections` array, so progress is computable without rendering a lesson.
- `scripts/check-curriculum.mjs` enforces: every `status: "available"` lesson has `src/app/learn/<module>/<slug>/page.tsx`, every route folder is registered, and `coming-soon` lessons have no route.

### Simulation engine (`src/engine/`)

The product core. Key contract: a lesson is **data + a step function** (`LessonSim<L>` in `engine/types.ts`): `{ id, topology, params, init, step, timeline?, quiz?, meters }`. Lessons never touch render internals; `<InteractiveFigure sim={...}>` is the single entry point (stage + meters + controls + transport + quiz overlay).

Rendering is two layers with different update disciplines:

- **Structure layer** (React + Motion): nodes/edges/meters subscribe to a ~10Hz snapshot (`useSimSnapshot` / `engine/snapshot.ts`). CSS transitions interpolate between snapshots.
- **Packet layer** (imperative): `PacketLayer` owns a pool of 128 `<circle>`s mounted once and writes `transform` per frame from the live state ref inside the single rAF loop (`useSimulation`). React never re-renders per frame.

Engine invariants — do not violate when adding lessons or features:

- Sim time ≠ wall time. Fixed 30-tick/sec accumulator loop; never animate packets with CSS/Motion/WAAPI (pause/step/speed require positions computed from the sim clock).
- All randomness via the seeded RNG in `SimState.rng` (mulberry32) — same seed ⇒ identical run. Prediction quizzes depend on this. Never `Math.random()` in sim code.
- In-flight packets are capped at `PACKET_POOL` (128); `spawnPacket` silently no-ops at the cap. Represent high volume with aggregates (queue-depth chips, load bars), never more dots.
- Packet positions are computed analytically from quadratic Béziers (`engine/paths.ts`) — no DOM measurement, no `getPointAtLength`.
- `step` mutates state in place (reducer-shaped, mutation-friendly; the sim is never serialized). Author verbs live in `engine/sim-helpers.ts` (`spawnPacket`, `advancePackets`, `shouldSpawn`, `approach`, `killNode`…).
- "button" params: engine sets `params[key] = true` on press; the lesson's step must consume and reset it to `false`.

`LessonSim<L>` is invariant in `L` (covariant init, contravariant step) — components that don't touch lesson state accept `LessonSimView`; `useSimulation`/`InteractiveFigure`/`SectionFigure` are generic in `L`.

### RSC boundary pattern

`LessonSim` objects contain functions, so they cannot cross the server→client prop boundary. Every lesson therefore has a tiny `"use client"` figure component co-located with its sim (`src/lessons/<module>/<slug>-figure.tsx`) that binds the sim to `<SectionFigure>`; server-component pages import the figure, never the sim.

### Progress system

`src/stores/progress.ts` — zustand + persist (`softeng-progress`, versioned). Any component reading progress must gate on `useHydrated()` (mounted-flag) to avoid hydration mismatches — the static HTML has no localStorage. Section completion is interaction-gated: `concept` sections complete via IntersectionObserver dwell in `LessonSection`; `interactive` sections complete only via `SectionCompletionContext` (wired through `SectionFigure`'s `onEngage`). There are no end-of-lesson quizzes — the only quizzes are the in-sim `PredictionQuiz` checkpoints defined on a `LessonSim`.

### Design system

All tokens are CSS custom properties in `@theme` in `src/app/globals.css` (Tailwind v4 CSS-first — there is no tailwind.config). Theme: warm-graphite "amber console" — `--color-accent` (phosphor amber) is the PRIMARY (CTAs, request packets, rings, outlined type); `--color-glow-orange` is the warning/degraded hue (never use the brand amber for warnings); cyan is demoted to info/misses. SVG viz code and UI share the same variables — packet colors, node strokes, and meter fills must reference tokens, never hard-coded colors. Fonts: Bricolage Grotesque (display), IBM Plex Sans (body), IBM Plex Mono (technical labels — the `.tech-label` / `.tech-num` utilities).

## Adding a lesson (the recipe)

1. `src/lessons/<module>/<slug>.ts` — the `LessonSim` (copy `src/lessons/scaling/client-server.ts` as the reference; ~150–250 lines). Follow the pedagogical arc: observe (timeline captions) → manipulate (params) → predict (quiz checkpoint that the resumed sim proves) → break (breakable nodes).
2. `src/lessons/<module>/<slug>-figure.tsx` — the `"use client"` wrapper.
3. `src/app/learn/<module>/<slug>/page.tsx` — server page: `<Lesson slug>` + `<LessonSection id>` blocks (ids must match the registry) + prose primitives (`P`, `Lead`, `Term`, `Callout`).
4. Registry: flip `status` to `"available"` (or add the entry with its `sections`).
5. `npm run check && npm run build`.

Stage decoration beyond nodes/edges (hash ring, partition divider) goes through `InteractiveFigure`'s `stageOverlay` render prop — see `consistent-hashing-figure.tsx` / `cap-theorem-figure.tsx`.
