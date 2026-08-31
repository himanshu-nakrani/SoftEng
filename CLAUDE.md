# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**syslab** — an interactive system-design learning site. Every lesson is built around a running simulation (animated request packets, live sliders, killable servers) rather than prose. Next.js 16 App Router + React 19 + TypeScript, Tailwind CSS v4, `motion` (import from `"motion/react"`, NOT legacy `framer-motion` — lint-enforced), zustand. Static export (`output: "export"`) — no server, no accounts; progress lives in localStorage. Five tracks: **01 System Design Fundamentals** (26 lessons, five modules — scaling, data, resilience, distributed, observability) on the packet engine; and on the discrete-step engine **02 Concurrency** (9, complete), **03 Databases & Transactions** (8, open), **04 Testing & Verification** (2, open), **05 Version Control & Delivery** (2, open). A track's NUMBER is its position in the registry array, not an identity — refer to tracks by slug in code. Beyond lessons: `/review` (a practice deck over every prediction checkpoint, deep-linking `?t=<sim-second>` into lessons via the transport scrubber — practice answers never write to the store; deck ordering is confidence-aware via the learning journal in `src/stores/journal.ts`), lesson-page reading mode + reflection surfaces (the causal workbench: `engine/components/CausalWorkbench.tsx`, `LessonUiContext`), a per-figure caption transcript whose rows seek, and a hand-rolled service worker (`public/sw.js`) making visited lessons work offline.

## Commands

- `npm run dev` — dev server. Note: dev mode occasionally serves a stale/404 CSS chunk after route recompiles (Tailwind v4 + HMR quirk); fix with `rm -rf .next` and restart. Production builds are unaffected.
- `npm run build` — static export to `out/`. Honors optional `BASE_PATH` (project-site hosting) and `NEXT_PUBLIC_SITE_URL` (canonical origin for metadata/sitemap).
- `npm run check` — `tsc --noEmit && eslint . && npx tsx scripts/check-curriculum.mts && vitest run`. Run before considering any change done.
  - The curriculum check also pins README's lesson table to the registry. After adding a lesson or track: `npx tsx scripts/check-curriculum.mts --write-readme` regenerates the fenced `CURRICULUM` block; without it the check fails with the first differing line.
- `npm run test` — vitest alone (node environment, 14 files). The packet engine: invariant suite (determinism, packet cap, topology integrity, meter coverage, quiz semantics for every FLOW lesson) + golden-run regression + seek/workbench. Archetype B: `src/engine/algo/__tests__/` per producer. Lesson PROSE: `src/lessons/__tests__/*-claims.test.ts`. Pure app logic: the progress store and progress math.
  - Goldens live in `src/lessons/__tests__/goldens/`; a missing golden bootstraps on first run. After a DELIBERATE behavior change: `UPDATE_GOLDENS=1 npx vitest run`, then eyeball the diff.
  - A new FLOW lesson needs one line in `SIM_BY_KEY` in `src/engine/__tests__/harness.ts` — the matrix guard fails loudly if you forget. `engine: "steps"` lessons are excluded by the harness and must NOT be added there.
- `npm run test:e2e` — Playwright over the built export: desktop smoke (registry-derived routes, zero console/hydration errors, sim drive, reduced-motion), mobile (drawer, fullscreen no-remount, overflow, touch targets), axe (wcag2a/aa on the sampled routes; both former findings are FIXED and enforced — faint-text contrast via the token ladder, interactive-stage semantics via labelled `role="group"` stages), and visual regression (`e2e/visual.spec.ts` — per-lesson stage screenshots at seeked sim-seconds; **opt-in everywhere via `PW_VISUAL=1`**, not just on CI, because Linux is the only canonical baseline platform). Needs `npm run build` first.
  - **Routes are SAMPLED**: `e2e/_selection.ts` picks one lesson per module on a pull request (an axe scan costs ~5s per lesson). `E2E_FULL=1 npx playwright test` sweeps every lesson — that is what the nightly runs.
  - If port 4173 is occupied, set `E2E_PORT=<free port>` — otherwise Playwright's `reuseExistingServer` tests the wrong app.
  - `PW_CHROMIUM_PATH=<binary>` overrides the browser, but should not be needed: run `npx playwright install chromium` to fetch the build the pinned `@playwright/test` expects.
  - **Baselines are stale and the suite enforces nothing** (tracked as D10 in `debt.md`). They predate the phosphor pass, and Linux is the only canonical platform — the darwin set was deleted rather than half-maintained. To fix: run the `E2E (full sweep)` workflow with `regen_visual: true`, which produces baselines in the same ubuntu image that verifies them and uploads them as an artifact; review every png, commit, then enable `PW_VISUAL=1` on the e2e step.
- `npm run monitor:routes` — checks the DEPLOYED site (74 routes derived from the registry, plus content markers). The only thing that tests what Pages actually serves; `ci.yml` only tests a local export.
- Three workflows:
  - `ci.yml` — audit (`npm audit --audit-level=high`) → check → build → **sampled** e2e, on every push/PR. Pushes to `main` deploy to Pages with `BASE_PATH=/SoftEng`.
  - `e2e-full.yml` — nightly full sweep (`E2E_FULL=1`), plus a `regen_visual` input that regenerates visual baselines in CI's own image and uploads them for review.
  - `monitor.yml` — the route monitor, 4×/day against the deployed origin.

## Architecture

Three layers, strictly ordered: **curriculum registry → lesson pages → simulation engine**. Data flows down; nothing imports upward (lesson sims are lint-banned from importing render internals).

### Curriculum registry (single source of truth)

`src/curriculum/registry.ts` defines tracks → modules → lessons → sections. The sidebar, mobile drawer, `/learn` lesson map, progress math, prev/next navigation, per-page metadata (`lessonMetadata`), sitemap, e2e route list, test matrix, and the CI check all derive from it. Lesson metadata lives ONLY here — pages never restate it; `<Lesson slug>` looks it up.

**Multi-track rules** (the registry holds an array of tracks; nothing may assume one):

- Routes are `/learn/<track>/<module>/<slug>`. The pre-track URLs are kept alive by `src/app/learn/[...legacy]/page.tsx`, a `generateStaticParams` catch-all that renders a client-side redirect stub per moved lesson (a static host cannot 301). `lessonPath()` is the only place the shape is written; `legacyLessonPath()` exists solely to feed that generator.
- **Only track 01 ever had pre-track URLs.** `MIGRATED_TRACK` and `migratedLessons()` in `src/lib/curriculum.ts` are the single definition of which lessons get a stub — the route generator AND the e2e suite both derive from it. They used to disagree: the suite excluded one module by name (`!== "shared-state"`), which was silently wrong once track 03 added modules, and asserted redirects for URLs that never existed.
- `/learn` is the curriculum INDEX (all tracks, cross-track counts). `/learn/<track>` is a track landing (`<TrackLanding trackSlug>` + `trackMetadata`), which owns the progress readout and lesson map.
- Anything a learner reads as "my progress" is per track: `useTrackProgress(trackSlug)`, `LessonMap trackSlug`. `modules` and `allLessons` in `src/lib/curriculum.ts` are cross-track flattenings for global indexes ONLY (sitemap, review deck, test matrix) — using them for progress or nav dilutes the denominator across tracks.
- `nextLesson`/`prevLesson` are track-bounded; `undefined` at a track edge is the end-of-track signal.
- Accent lives on the TRACK (`Track.accent`), with an optional per-module override. Always resolve via `accentOf(module)` — reading `module.accent` gives `Accent | undefined`, and the ring/card props default to amber, so a miss fails silently.
- The active track comes from `trackFromPathname()` — one definition, so sidebar, its stamp, and the drawer cannot disagree. Never hardcode "track 01"; use `trackLabel(track)`.
- Module slugs must be globally unique across tracks (`getModule()` is a flat map) — enforced by `check-curriculum`.

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

Transport and autoplay invariants (each one is a bug that was shipped once):

- A play/pause CONTROL must dispatch the intent its label shows (`playing ? pause() : play()`), never `controls.toggle`. `toggle` asks the engine which way to flip, and the engine's status changes without a re-render (the scroll observer pauses off-screen figures), so a label can disagree with engine state — and the button then does the opposite of what it says.
- Scroll-driven pause/resume acts on a SETTLED intersection (180ms debounce in `InteractiveFigure`). A single scroll crosses the 0.35 threshold several times; reacting per crossing pauses and resumes within the same frame budget.
- Autoplay is once per FIGURE, not once per effect: the guard is a ref, because `useReducedMotion()` settles after mount and re-runs the observer effect.
- Explicit interaction outranks the viewport: `uiControls` (play/pause/toggle/seekTo) cancels any pending scroll decision, disarms scroll-resume, marks autoplay superseded, and updates the status mirror eagerly. User-driven paths — the transport, the Space shortcut, workbench focuses and experiments — must go through it, not through `simulation.controls`.
- `data-sim-status` on the `<figure>` is the transport's state contract for e2e. Assert on it rather than inferring state from a button's accessible name.
- `PredictionQuiz` restores focus to the checkpoint's trigger on exit, EXCEPT after an explicit dismiss ("Close and inspect"), where the figure keeps focus because it owns the inspection shortcuts.

### Archetype B — the discrete-step player (`src/engine/algo/`)

The second interaction archetype, for things that are a finite list of states rather than a continuous flow: algorithms, protocol state machines, storage-engine operations, compiler passes. What it buys that the packet sim cannot: **step BACK**, scrub to any step, and exact operation counts. Determinism is trivial because the step list IS the truth.

The engine is deliberately ignorant of what it steps through:

- **`AlgoDef<S, I>`** (`algo/types.ts`) is PURE DATA — `{ id, title, code, counters, size?, generateInput, run }`. `S` is the per-step state a view draws; `I` is the generated input. Same layering as archetype A: no JSX in a def.
- **`AlgoStep<S>`** is `{ state, codeLine?, note?, counters }`. `state` is opaque to the engine. `counters` is a `Record<string, number>` keyed by `def.counters[].key`, cumulative and monotonic non-decreasing.
- **`buildAlgoSteps(def, size, seed)`** (`algo/build.ts`) is the React-free core — the archetype-B counterpart of `runner.ts`. Tests and scripts drive it directly; `useAlgoPlayer` is only a playback binding (index, interval, speed) that never reads `step.state`.
- **`StepRecorder<S>`** (`algo/recorder.ts`) is the authoring verb, as `sim-helpers.ts` is for archetype A: `bump(key)` then `record({ codeLine, note })`. It copies counters per frame and takes a `snapshot()` closure, which is what prevents the two classic bugs — frames aliasing live state (every step shows the final result, step-back looks broken) and counters drifting from the frames that label them.
- **Views are injected**: `<AlgoFigure def={...} view={ArrayView} />`. A view's whole contract is `{ state: S }` — it knows nothing about playback, seeds, or the transport. Counters and the size slider are declared by the def, so adding an algorithm never edits the figure. `algo/views/<view>.ts` holds a view's state contract as pure data (lesson-safe); `algo/views/<View>.tsx` is the component.
- Highlight vocabularies are view-specific, not engine concepts: `AlgoHighlight` indexes array POSITIONS and means nothing to a tree, so it lives in `views/array.ts`, not in `types.ts`.
- **Labels are drawn as plain SVG text**, so markdown (backticks, asterisks) renders as literal characters. Write code fragments bare in any string a view will draw.
- **The stage's top-right corner belongs to the figure's `PlateLabel`** (`absolute top-2.5 right-5`). Put nothing there. Note the SVG is SCALED to the stage width, so a small viewBox `y` is still inside the plate's box — `ThreadsView` collided with it via lock chips, `WalView` via a phase stamp. Anchor stage-level status to something in the middle of the stage instead.
- **A strip of chips must WRAP.** `WalView`'s log strip fit six records and slid
  the seventh under the stage edge — the code panel's clipping bug in a new place.
  Wrapping removes the constraint; a check would only police it.
- **Size a chip column ONCE and pass the width down.** Both `WalView` rows had a per-chip rect width beside an all-chips column pitch, so a marker drawn just outside a narrow chip landed inside the next chip's slot — invisible until two chips were marked at the same time.
- The stage and the step caption are two channels; do not print the same sentence in both. A stage banner should be the glanceable verdict, the caption the prose.
- **A verdict that is vacuously true reads as a contradiction.** "Every acknowledged commit came back" beside three lost lanes is technically correct when nothing was acknowledged, and it was the DEFAULT frame of a shipped figure. `WalState.acknowledged` exists so the stamp can say "nothing was promised" instead.

Lint enforces the layering both ways: lessons may import `@/engine/algo/types`, `/recorder` and a view's state module, but never `AlgoFigure`/`useAlgoPlayer`/`CodePanel` — only a `-figure.tsx` wrapper names a view component.

Tests: `src/engine/algo/__tests__/algo.test.ts` is the matrix guard (determinism per seed, first frame = untouched input, multiset preserved, counters monotonic, no frame aliasing, `codeLine` in range, both ends of the size range). It also runs a deliberately non-array state shape through the engine, so an array assumption creeping back in fails there.

The sorting defs in `src/lessons/algorithms/` are NOT registered lessons — the DSA track is deferred. They stay as the reference consumers and the test fixtures; they are what proves the def/recorder/view seam composes.

### Archetype C — seeded thread interleaving (`algo/concurrency.ts`)

Not a separate engine: an interleaving IS a step list, so concurrency rides on archetype B and inherits step-back, scrubbing, and counters. A concurrency lesson is an ordinary `AlgoDef<ConcurrencyState, Program>` whose `run` calls `interleave(program, rng)`.

- A `Program` is `{ threads, memory, locks? }`; a `Thread` is a list of `ThreadOp`s, each with a `label`, optional `codeLine`, an optional `lock` acquire/release, and an `effect(memory, locals)` that runs atomically. **Op granularity is the author's choice, and it is usually the lesson** — splitting `counter++` into read / add / write is what makes the lost update visible.
- The scheduler picks uniformly among RUNNABLE threads each step, drawing from the run's seeded RNG. So `(program, seed)` replays an interleaving exactly, and reseeding explores different legal ones. That pair is the teachable content: the bug is not in the code you read, it is in the order you did not choose.
- An acquire on a lock held by another thread blocks the thread rather than executing. When every unfinished thread is blocked, the run records a final `deadlocked` frame and stops — a deadlock is an outcome to show, not an error to hide. Note two distinct shapes reach it: a circular wait (all blocked) and a leaked lock (one blocked, one finished holding it).
- `interleave` maintains `CONCURRENCY_COUNTERS` — `steps`, `waits`, `switches`, `retries` — for a def's `counters` declaration.
- `views/ThreadsView.tsx` draws lanes per thread with shared memory and lock ownership above; its `aria-label` is rebuilt per frame so the interleaving is narrated, not just drawn.
- **Control flow.** A thread's ops are a static list, so two escape hatches carry everything that repeats:
  - an `effect` returning `"retry"` re-runs the SAME op (the program counter does not advance) — the honest shape of compare-and-swap, whose attempt count depends on contention and is unbounded;
  - `op.await = { label, ready }` parks the thread until a predicate holds — a condition wait, not a spin, so it consumes no steps. Bounded buffers wait for space or for an item this way.
- **Counters are the scheduler's.** A def may only declare keys `interleave` bumps (`steps`, `waits`, `switches`, `retries`); there is no hook for a lesson-specific counter yet. Track 02 surfaces domain meaning by RENAMING them — `retries` is "failed attempts" for CAS and "line transfers" for false sharing.
- **Two failure outcomes, and they are different.** `deadlocked` means nothing is runnable (every thread is waiting for something nobody will provide). `livelocked` means threads are still running but the step budget (`totalOps * 12 + 64`) expired — optimistic retries knocking each other back. Both are recorded as a final frame and shown, never swallowed.

Because of C, `AlgoDef.run` receives the seeded RNG as a second argument (`run(input, rng)`), continuing the same stream `generateInput` drew from. Pure algorithms ignore it. Consequence worth knowing: changing an input generator also reshuffles a scheduler's decisions, so a golden can move for no visible reason.

Lesson PROSE is pinned too, per track: `concurrency-claims.test.ts` and `transaction-claims.test.ts` in `src/lessons/__tests__/` assert every number a page states ("blocked turns go 1, 6, 15", "roughly one run in three", "exactly two transfers", "18 ops either way"). A failure there means a lesson page now lies, and the message names the sentence. It is the archetype-B counterpart of `goldens.test.ts` — and it is deliberately about claims rather than hashes, so the failure tells you what became untrue.

Tests: `algo/__tests__/concurrency.test.ts` pins the claims themselves — determinism per seed, >5 distinct orders across 40 seeds, exactly one thread's `pc` advancing per frame, lost updates occurring under some orders and replaying identically, a mutex holding the result at 3 across 60 seeds, mutual exclusion never violated, and AB/BA deadlocking without hanging.

### Transactions (`algo/transactions.ts`, `views/TableView.tsx`)

Track 03's step producer, and the fourth thing to ride archetype B. A transaction interleaving shares the IDEA of concurrency's scheduler — seeded choice among runnable actors — but not the vocabulary, so it owns a small scheduler of its own rather than bending threads into transactions.

- `TxnProgram` is `{ rows, txns, isolation, mechanism? }`; a `Statement` has a `label`, a `codeLine`, an optional `run(ctx)`, an optional `commit: true`, and optional `locks` (2PL only). Returning `"abort"` rolls the transaction back, discarding its pending writes.
- **Adding an isolation level touches exactly three places** in `transactions.ts`: the `Isolation` union, `visibleTo` (the read rule), and the commit-time read-set check. A *mechanism* rather than a level additionally sets a flag near the top of `runTransactions` and declares `Statement.locks`. That is what makes "read uncommitted sees a dirty value" something the run demonstrates rather than something the prose claims — and it is why the same program at a stronger level cannot produce the anomaly. All four levels are implemented: `read uncommitted` (other transactions' pending writes are visible), `read committed` (committed only), `repeatable read` (answered from a snapshot taken at the transaction's first statement), `serializable` (snapshot reads PLUS a commit refused when any row in the transaction's read set has changed since).
- `mechanism: "2pl"` on a `TxnProgram` switches serializable from optimistic to pessimistic: a statement declares the rows it needs via `Statement.locks`, takes them exclusively, and holds them until the transaction ends. A blocked transaction WAITS instead of failing, and an all-blocked run picks a seeded deadlock victim. Measured contrast, pinned as tests: optimistic commits both transactions in 49 of 200 runs with nobody ever waiting; 2PL commits both in 200 of 200 with something waiting in every run.
- The read set is what catches write skew. Two transactions writing DIFFERENT rows have no overwrite to detect, so the conflict is between one's reads and the other's writes — invisible to a snapshot by design. Measured consequence, pinned as a test: at repeatable read the on-call invariant breaks in 151 of 200 seeds, and serializable refuses a commit in exactly those 151 runs, never more and never fewer.
- `TableState` splits every row into `committed` and `pending` (by transaction). That gap is where every read anomaly lives, and it is why this needed a new view: a thread lane diagram cannot show it. `TableView` draws pending values dashed and hollow so an uncommitted number never reads as fact, and surfaces `state.anomaly` as a banner so the reader is not left to infer it.

### Durability (`algo/wal.ts`, `views/WalView.tsx`)

Track 03's second producer, and the FIFTH thing to ride archetype B. The first one
that is not an interleaving at all: there is no scheduler and no seeded choice,
because durability is not about which actor goes next, it is about when state
stops being volatile.

- A `WalScript` is `{ pages, txns, ops, crashAfter, policy }`. `WalOp` covers
  `write` / `commit` / `flush` / `checkpoint`. **`crashAfter` is the lesson's
  control, wired to the SIZE slider** — the slider is not a size, it is where the
  power fails, so every position is a different crash. `runWal` takes no RNG.
- Two policies produce the contrast: `"pages-only"` keeps no log, so the disk
  pages are the only durable state; `"write-ahead"` appends a record before each
  change, forces the log at commit, and refuses to write a page out while the
  records describing it are still volatile.
- **A logged write and a commit are each TWO frames**, deliberately: record
  appended, then page changed; commit record appended, then fsynced. The order
  between them is the entire mechanism, and one frame cannot show an order. A
  transaction is `acknowledged` only at the fsync — appended is not durable.
- Recovery is ARIES reduced to its two load-bearing passes: redo committed
  changes forward, undo uncommitted ones backward using each record's
  before-image. Analysis collapses into one scan of the durable log. Redo is
  idempotent via `diskLsn`, so a change already on disk is skipped.
- **The invariant that pins the whole design**, asserted on every frame of every
  crash point: `page.diskLsn <= state.flushedUpTo`. Remove the force in the flush
  path and this fails — and so does recovery, which is the evidence that the
  ordering rule is load-bearing rather than ceremonial.
- The verdict is measured against `expectedDisk`, which reads the SCRIPT rather
  than the log, so a bug in recovery cannot make itself look correct.
- `WalState` splits every page into `buffered` and `disk`, and the log into a
  forced prefix and a volatile tail. `WalView` draws a horizontal DURABILITY
  DIVIDE and puts the same log on both sides of it — which is the one thing
  `TableView` structurally cannot show, since both of its columns are in memory.
  `logged` is an explicit field: "there is no log" and "the log is empty so far"
  are different statements, and the second is true on the first frame of every
  logged run.

- **ACKNOWLEDGEMENT IS A CONSEQUENCE OF `forceLog`, not of the commit op.** A
  transaction may be reported successful exactly when its commit record is
  durable, so putting that in the force is what lets ONE fsync answer several
  transactions — and it correctly acknowledges a commit that an unrelated page
  flush happened to carry over the line. `commitPolicy: "grouped"` appends commit
  records without forcing; a `groupFlush` op forces the tail. A transaction
  waiting for that force has status `"committing"`: logically finished, unanswered.
- **Batching the force is safe; batching the ANSWER is not.** Acknowledging at the
  append rather than the force is the classic bug, and breaking it that way fails 7
  claim tests including "neither policy loses acknowledged work".
- **Checkpointing is a POLICY on the script** (`checkpoints?: boolean`), not a
  different script. Two runs must be comparable at the same crash point, and a
  shorter script would shift every later operation so "crash after 6" would mean
  different work in each. The `checkpoint` op marks where one *could* be taken.
- **Redo starts at the last durable checkpoint; undo does not.** Redo's bound is a
  promise about pages (a sharp checkpoint forced them all, so nothing older can
  need replaying). Undo is asking which transactions never committed, and one may
  have started before the checkpoint and still be running. Bounding undo the same
  way leaves an uncommitted value on disk forever — verified by breaking it, which
  fails 8 claim tests across BOTH lessons.
- Consequence worth knowing: a checkpoint forces dirty pages without asking whose
  they are, so it puts uncommitted values on disk and thereby **creates** undo
  work. Measured: redo 4→2, undo 0→1. A checkpoint is not a pure saving.

Measured and pinned in `durability-claims.test.ts`: without a log, acknowledged
work is lost at 5 of the 8 crash points, in three distinct shapes (the commit
missing entirely, half of it present, an uncommitted value in its place); with
one, at none of them. At the moment of commit: one force, zero page writes, and
fully recoverable. With one checkpoint, redo considers 5 records instead of 8,
bought with 3 page writes spent while nothing was wrong. Grouped, three
transactions cost ONE force instead of three for the same six log records, and T1
is answered five crash points later — latency traded for throughput, with
correctness unchanged at every crash point.

### Archetypes D and E — also step lists (`algo/mutation.ts`, `algo/repo.ts`)

Three archetypes in a row have collapsed into archetype B. The pattern to apply before building any new engine: **ask whether the thing is a finite sequence of states.** If it is, it is a state contract in `algo/views/<name>.ts`, a step producer in `algo/<name>.ts`, a view component, and a test file — not new machinery.

- **D · mutation harness** (`runMutationSuite`). A `MutationSuite` is `{ baseline, mutants, tests }`; a `Mutant` carries a `label`, a `codeLine`, and a broken `fn`. One frame per test execution. It verifies the BASELINE first and stops dead if the suite fails the correct code, because a red baseline makes every mutation number meaningless. A test that throws counts as a kill, not a harness error — mutants crash more often than they return wrong answers. Mutant order is seeded so reseeding reshuffles the narrative, but the verdict cannot change: which mutants survive is a property of the suite. Counters: `tests`, `killed`, `survived`. What it teaches is what coverage cannot show — each survivor is a nameable hole ("nothing here would notice if `>` became `>=`").
- **E · repo DAG** (`runRepoScript`). A `RepoScript` is a list of `RepoCommand`s over `commit` / `branch` / `checkout` / `merge` / `rebase`; one frame per command. Merge fast-forwards when it legitimately can (learners expect a merge commit and do not get one) and otherwise makes a two-parent commit; rebase COPIES commits onto a new base, chains them oldest-first, and the frame exposes the originals as `unreachable` with `rewriteOf` set on each copy. That is the lesson: identical work, two shapes. Counters: `commits`, `merges`, `replayed`. Takes no RNG — git is not random.
- Both views (`MutationView`, `RepoView`) are verified against the figure's `view` contract by a compile-time assertion in their test file, and both suites assert no frame aliasing, because a shared array would make the whole run show the final state and silently break step-back.
- **Both are now rendered** by tracks 04 and 05, and the first render cost three defects that the headless tests and the contract assertion had both missed: `MutationView`'s rotated column headers reached up into the figure's `PlateLabel` (fixed by deepening `HEADER_H` to 100 — they anchor at `HEADER_H - 8` and extend ~32 units up-and-right), `RepoView` drew orphaned commits at border-grey/0.5 opacity so the rebase lesson's whole point was invisible (now red and dashed, matching `WalView`'s grammar for a lost record), and mutant labels carried markdown backticks, which SVG text renders literally.
- **`RepoOp` is closed at commit/branch/checkout/merge/rebase.** Cherry-pick, revert and reset would each be a new op — cheap. A CONFLICT would not be: the model has no file contents, only a DAG.
- **`ArrayView` is still rendered by nothing.** The sorting defs are deliberately consumer-less (see the DSA cut); treat it as unverified if you ever ship it.

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

The governing direction is **Phosphor Cartography** (`design/phosphor-cartography.md`, plan: `design/ui-uplift-plan.md`): warm darkness, one amber light, hierarchy by luminance, hairlines and tick-scales, mono marginalia, scientific-plate composition. All tokens are CSS custom properties in `@theme` in `src/app/globals.css` (Tailwind v4 CSS-first — no tailwind.config). Theme: warm-graphite "amber console" — `--color-accent` (phosphor amber) is the PRIMARY; `--color-glow-orange` is the warning/degraded hue (never brand amber for warnings); cyan is demoted to info/misses; red means capacity loss/faults, not policy refusals. SVG viz and UI share the same variables — packet colors, node strokes, meter fills, and overlay hues must reference tokens, never hard-coded colors.

Conventions that keep it coherent (violating them is how the drift this branch fixed crept back in):

- **Quiet-text ladder**: `fg` = sentences; `fg-muted` = support voice; `fg-faint` = marginalia (stamps, timestamps, units). `fg-faint` as TEXT must be solid and only on bg/surface/raised (AA holds there; alpha variants `/50 /70 /80` composite below threshold and are banned for text). On tinted grounds (e.g. `bg-accent/10` selections) step up to `fg-muted`.
- **Radius grammar**: plates/chips/asides are 2px (`rounded-sm/lg/xl` are all remapped to 2px), controls are `rounded-md` (6px), circles keep `rounded-full`. No other radii.
- **Chrome color budget**: outside simulation data encodings, hue never carries hierarchy — chrome is fg-ladder + amber + red-as-wound. Multi-hue belongs to packets/legends/meter semantics inside stages.
- **Primitives are the kit**: `SiteHeader/SiteFooter/Wordmark` (never inline a wordmark), `IconButton` (no hand-rolled icon buttons), `PlateLabel` (fig stamps), `SectionRule` (kicker + fading rule rows; children may wrap — never force-shrink headings), `Button`/`buttonClasses` (all CTAs), `Badge` (tick-tags). Containers are only ever `max-w-3xl` (read) or `max-w-6xl` (app).
- **Motion**: CSS transitions with `--ease-out-soft`; there is no motion-tokens module (`lib/motion.ts` was deleted — engine timing lives in the snapshot discipline).
- **Release-D feature hooks** (journal cards, causal workbench, reading mode) ride semantic classes (`.surface-card`, `.module-row`, `.sim-figure`, `.calibration-secondary`, `.causal-meter-focus`) defined as phosphor-styled equivalents at the bottom of globals.css — keep them token-based; don't reintroduce literal colors.
- **OG/PWA color sync**: keep the hex copies in `src/lib/og.tsx`, `src/app/opengraph-image/route.tsx`, `icon.svg`, and `manifest.webmanifest` in sync with the tokens when the palette moves.

`.tech-label`/`.tech-num` live in `@layer components` so color utilities can override them; effect classes (`.text-outline`, `.glow-blob`, …) are deliberately unlayered. Range inputs get the `sim-slider` treatment (thumb + 44px hit area + `--fill` gradient). Fonts: Bricolage Grotesque (display, once per page), IBM Plex Sans (body), IBM Plex Mono (technical labels).

## Adding a lesson (the recipe)

**Scaffold it first:** `npm run new:lesson <track>/<module>/<slug> -- --title "Some Title" [--engine flow|steps] [--minutes 12] [--difficulty intermediate] [--prereq a,b] [--sections id:kind:Title,...]`

That writes the def/sim, the `-figure.tsx` wrapper, the page with `<LessonSection>` blocks whose ids already match, the OG route, the registry entry, and a learning-guide stub — plus `simBySlug` and `SIM_BY_KEY` lines for `flow` lessons. It refuses to overwrite anything, and aborts before writing if an anchor or the target module is missing. Its output passes the whole gate untouched except the README block.

**The files now exist; the list below is what to FILL IN.** Do not hand-write any of the plumbing above — if you find yourself editing the registry by hand for a new lesson, the scaffolder failed and you should find out why.

1. **Registry entry** — replace the `TODO` tagline. The `sections` ids are the contract for the page AND for completion, so change them here and in the page together.
2. **`src/lessons/<module>/<slug>.ts`** — the `LessonSim` (`id` MUST equal the slug; ~150–330 lines; `src/lessons/scaling/client-server.ts` is the minimal reference, the distributed module has richer patterns). Follow the arc: observe (timeline captions) → manipulate (params) → predict (an ungated checkpoint whose premise you VERIFY at seed 42 via the runner, firing before its proof) → break (breakable nodes, plus a scripted beat so passive learners see it). Conventions: quiz ids lesson-prefixed; "dropped" = capacity loss, "rejected" = policy; ≤5 meters.
3. **`-figure.tsx`** — the description prop is the figure's accessible text; wire any second interactive section via `completes`.
4. **The page** — prose primitives (`P`, `Lead`, `Term`, `Callout`, `TryThis`). Measure before you write any number: see the per-lesson loop in `implementation_plan.md` §1.
5. **A learning-guide entry** in `src/curriculum/learning.ts` — the scaffolder stubs it with `TODO`s, and `learning.test.ts` only checks length, so a stub will pass the gate while reading as unfinished.
6. `npx tsx scripts/check-curriculum.mts --write-readme`, then `npm run check && npm run build`. The first vitest run bootstraps a FLOW lesson's golden; review and commit it.
7. **Screenshot the figure and look at it.** Five lessons had defects a green suite did not catch.

### …or an archetype-B lesson (`engine: "steps"`)

Set `engine: "steps"` on the registry entry and the contract changes:

1. `src/lessons/<module>/<slug>.ts` exports one or more **`AlgoDef`s** instead of a `LessonSim`. Each id must START with the lesson slug (`data-races`, `data-races-guarded`) — a lesson often ships two defs to contrast a broken run with a fixed one. `check-curriculum`'s `algo integrity` check enforces id prefix, non-empty `code` and `counters`, unique counter keys, and a coherent `size` range.
2. The `-figure.tsx` wrapper composes `<SectionAlgoFigure def={...} view={...} />`. It is the ONLY file allowed to name a view component.
3. **No `SIM_BY_KEY` line and no golden.** `availableLessons` in the test harness filters `engine !== "steps"`, because a step list has no topology, no `step(state, dt)` and no tick loop — none of the packet invariants apply. The engine itself is covered by `src/engine/algo/__tests__/`.
4. **No `simBySlug` line either.** An archetype-B lesson has no packet-sim quiz checkpoints, so it does not appear in `/review` or `/playground`, and `getSim` deliberately stays quiet for it rather than warning.
5. Pseudocode lines must be **≤ 27 characters**, indent and trailing comment included. Derived from the component (240px panel − padding − line-number gutter − gap = 185px, at 6.62px per mono character) and ENFORCED by `check-curriculum`'s `algo integrity` check. A longer line does not wrap — it slides under the panel edge, where the author never sees it, because defs are written in a `.ts` file and the clipping only appears at `lg` and above. Drop the trailing comment before shortening the code: the lanes and step captions already carry that detail.
6. A learning guide entry in `src/curriculum/learning.ts` is required for EVERY lesson regardless of engine — `learning.test.ts` fails on a missing one.
7. `def.size` need not be a size. `write-ahead-logging` uses it as the crash point, which is what makes the lesson interactive at all. If you do that, make every position meaningful — the WAL range deliberately stops one short of the script, because letting the run finish would leave a transaction in flight and the figure would be giving a verdict it has no standing to give. Note `write-ahead-logging` was the FIRST rendered lesson def to declare a `size`, and rendering it found a latent `AlgoFigure` bug (the size was reported twice, as a counter and on its own slider).
