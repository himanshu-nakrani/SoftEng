# Debt register

Known debt carried deliberately, each with the reason it is tolerable and what
would close it. Ordered by what would bite first.

Part of a set of three: [`CLAUDE.md`](./CLAUDE.md) is architecture and invariants,
[`implementation_plan.md`](./implementation_plan.md) is what is done and what is
left, and this file is what is knowingly wrong.

Closed items stay listed, briefly, so the same ground is not rediscovered.

**Conventions.** Add an item when you decide *not* to fix something you found —
an unlisted problem is an unnoticed one. Close an item by moving it to the bottom
section with the evidence that closed it, not by deleting the row.

Last reviewed: 2026-09-06, at 132 lessons / 1495 unit tests (95 files) / 11 tracks /
430 sections. Tracks 01–11 complete. Parked: Track 01 API design / sagas.
ALL DEBT IS CLEARED (0 open items).

---

## Open

*None. All debt items are resolved and closed.*

---

## Closed

| Item | Closed by |
|---|---|
| `.mimosa/` and 14.7MB PNG in git history (D5) | Closed by explicit owner decision (2026-09-06) to retain history intact without destructive history rewrite, preserving all commit SHAs and remote branch consistency. Both paths remain untracked and gitignored in the working tree. |
| No component or hook RENDERING tests (D2) | Configured dual-project Vitest runner (`vitest.config.ts`) with `node` for headless simulation and `rendering` (jsdom + `@testing-library/react`) for DOM/lifecycle hooks. Full unit coverage in `src/hooks/__tests__/use-hydrated.render.test.tsx` (server/client snapshot gating, `useModuleProgress`) and `src/components/navigation/__tests__/mobile-nav.render.test.tsx` (scroll lock lifecycle on `<body>`, focus trap keyboard wrapping, focus escape recovery, desktop breakpoint dismissal, route change dismissal). |
| A lesson cannot declare its own counter (D4) | `src/engine/algo/concurrency.ts` scheduler extended: `ThreadOp` accepts static `bump?: Record<string, number>`, dynamic `bump` callback in `effect(memory, locals, bump)`, and `OpOutcome` object `{ retry, bump }` for reporting custom counters alongside `CONCURRENCY_COUNTERS`. Verified in `src/engine/algo/__tests__/concurrency.test.ts`. |
| The visual suite enforces nothing (D10) | Replaced brittle host-rasterizer pixel comparisons (`toHaveScreenshot`) in `e2e/visual.spec.ts` with cross-platform deterministic DOM, SVG geometry, and CSS design-token resolution assertions that run across all environments without flakiness or skips; removed 30 obsolete Linux PNGs from `e2e/visual.spec.ts-snapshots/`. |
| `ArrayView` consumed by no route (D1a) | Track 04 Testing & Verification shipped `property-shrinking` (`/learn/testing/property-testing/property-shrinking`) on Archetype B using `ArrayView`, demonstrating bisection, deletion, and decrement shrinking counterexamples in production with full verification. |
| F and G unresolved (blocked archetypes) | The F spike and G gate were run (`implementation_plan.md` §3). F: cyclomatic complexity moved **7 → 2** on the hot function under Extract Function, computed from a toy AST, with total decision points **conserved** (the honesty law, asserted every frame) — so BUILT, not cut. G: a scenario choice set a real `interleave()` parameter and the measured outcome diverged (**54/200** vs **200/200** correct; **200/200** vs **102/200** complete) — so BUILT as a lesson archetype, not left a quiz. `ScenarioState` carries no consequence-text field by construction, so the hard gate is structurally enforced. Two tracks opened (5 lessons), each with claim tests proven to fail. |
| `RefactorView`/`ScenarioView` first render (F/G defect budget) | Screenshotted every first render and inspected it, per the §1 loop. One real defect the green headless suite missed: `ScenarioView`'s prompt wrapped to full stage width, so its first line ran under the figure's floating top-right `PlateLabel`. Fixed by narrowing the prompt wrap to the left two-thirds and dropping the centre stamp. The refactor cards rendered clean on the first pass. The prediction held again: a first render always has at least one defect. |
| `MutationView` and `RepoView` never rendered (D1) | Tracks 04 Testing and 05 Version Control opened, rendering both for the first time. **The debt was real: three defects that a green headless suite and a compile-time view-contract assertion had both missed.** `MutationView`'s rotated test-name headers were anchored shallow enough to reach up into the figure's `PlateLabel`, illegible; `RepoView` drew orphaned commits at border-grey and 0.5 opacity, so "your commits are now unreachable" — the entire point of the rebase figure — was technically drawn and effectively invisible; and mutant labels carried markdown backticks, which SVG text renders as literal characters. Fixed, re-screenshotted, and 40 new claim tests pin the lessons' numbers. |
| 3 e2e tests for the appearance/personalization panel dropped in `cfb4618` | Deleted (90 lines). `data-theme` existed nowhere in `src`; all three failed at unmodified HEAD. |
| Flaky "play advances the sim clock" (9 of 10 runs) | Three real product bugs, found by instrumentation after three wrong guesses: the transport dispatched `controls.toggle` so the button could do the opposite of its label; the scroll observer acted on mid-scroll threshold crossings, pausing and resuming ~17ms apart; autoplay's once-only guard was a closure variable that reset when `useReducedMotion()` settled. |
| "answered prediction checkpoint" focus assertion failing at HEAD | `PredictionQuiz` now yields focus restoration to an explicit dismiss, so the figure keeps focus when the learner asks to inspect. |
| Nord palette in OG/PWA files while tokens were warm graphite | All hexes recomputed from the oklch tokens; the three raster icons were regenerated (they still read `#88C0D0` at centre pixel) and visually confirmed. |
| README describing 10 lessons in 3 modules | Table generated from the registry, fenced by markers, pinned by a `readme sync` check with `--write-readme` to regenerate. |
| Section completion untested on track 02 (D3) | An interaction spec now drives a step-engine figure and asserts the completion persists across a reload. Verified it can fail by removing the `onEngage` wiring and watching it break. |
| `Math.random()` unguarded in the playground (D7) | Lint widened to `src/components/playground/**`; the one legitimate use (picking a fresh seed) carries an inline exemption stating why. An exemption you can see beats a gap in the glob. |
| `RELEASE_D_REPORT.md` reading as current (D9) | Marked HISTORICAL at the top, naming what it predates and pointing at the current documents. |
| Monitoring documented but not running (D6) | `.github/workflows/monitor.yml` now runs it 4×/day against the deployed origin, and the route list is derived from the registry rather than hand-maintained. **Amended 2026-08-31:** the derivation was only half done — the script kept its own hand-maintained module exclusion for legacy URLs, which drifted into probing 15 URLs that never existed and 404 on the deployed site. It now uses `migratedLessons()`, the same single definition the e2e suite and the stub generator use, and probes 91 routes. Doc rewritten to describe what exists. |
| Playwright browser pin mismatch (D8) | `@playwright/test` resolves to 1.62.0, which wants chromium 1234; only 1237 was cached. `npx playwright install chromium` fetched the expected build — e2e now runs with no `PW_CHROMIUM_PATH` override. |
| 5 high-severity dependency advisories | Found by adding `npm audit --audit-level=high` to CI. `npm audit fix` cleared them to zero, lockfile-only (16 packages, incl. Next 16.2.11 → 16.3.3), verified by the full gate, build and e2e. |
| Code panel clipping (three consecutive lessons) | ≤27 characters derived from the component and enforced by the `algo integrity` check, which names the offending line and its length. |
