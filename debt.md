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

Last reviewed: 2026-08-31, at 52 lessons / 576 unit tests / e2e green (sampled, and 156 on the full smoke+axe+search sweep).

---

## Open

### D1a · `ArrayView` is still consumed by no route
The sorting defs in `src/lessons/algorithms/` are reachable from nowhere, so
`ArrayView` remains the one view never rendered in anger. This is the **residual
of the DSA cut**, not an oversight: the defs stay deliberately consumer-less as
archetype-B reference implementations and as the fixtures `algo.test.ts` runs.

**Why it is tolerable:** nothing ships it, so no learner can meet a defect in it.
The cost is only that it cannot be trusted the day someone does ship it — and D1
just demonstrated, twice more, what that day looks like.

**Closes when:** either a lesson renders it (and it gets a screenshot review), or
the DSA decision is reversed, or the defs are deleted. Leave as is until then.

### D2 · No component or hook RENDERING tests
`vitest.config.ts` is `environment: "node"` by design, so anything that must
actually render — `useHydrated`'s pre-mount gate, focus traps, the drawer — is
proven only in Playwright, which needs a full build and takes minutes.

**Narrowed 2026-08-30.** The pure logic underneath is now covered in the node
project: `src/stores/__tests__/progress.test.ts` (18 tests over sanitize / merge /
export, including hostile payloads) and `src/hooks/__tests__/progress-math.test.ts`
(13 tests over the four functions behind every ring and percentage). Writing them
found a real bug — `sectionsDone` counted duplicated ids, so a hand-edited or
older-build payload of `["a","a","b"]` read 3 of 3 sections from two completions,
and `lessonFraction` clamps at 1 so it showed 100% rather than anything obviously
wrong. Fixed to count distinct ids.

**Closes when:** a jsdom project plus a renderer covers the rendering-dependent
hooks. Keep the node project as-is; the engine core is deliberately React-free.

### D4 · A lesson cannot declare its own counter
`interleave` owns counter bumping, so an `AlgoDef` may only surface
`CONCURRENCY_COUNTERS` keys (`steps`, `waits`, `switches`, `retries`). Track 02
works around this by renaming — `retries` reads as "failed attempts" for CAS and
"line transfers" for false sharing — which is honest but limits what a future
lesson can measure.

**Closes when:** the scheduler exposes a hook (e.g. an op may report counter
increments) — worth doing only when a lesson actually needs it.

### D5 · `.mimosa/` and a 14.7 MB PNG remain in git history
Both are untracked and gitignored now (527 → 322 tracked files), but the blobs are
still in history, so clone size is unchanged.

**Closes when:** a history rewrite is run. **Destructive and shared-history
affecting — needs explicit owner approval**, which is why it has not been done.

### D10 · The visual suite enforces nothing
`e2e/visual.spec.ts` is gated off on CI (`CI && !PW_VISUAL`) and the 30 committed
Linux baselines predate the phosphor pass, so they would fail if enabled. Darwin
baselines were deleted, so Linux is now the single canonical platform.

It is now opt-in everywhere (`PW_VISUAL=1`), not just on CI: running 30 pixel
comparisons by default on a non-canonical host produced noise, and starved the
rest of the suite enough to make load-sensitive assertions fail.

**Why it stayed:** baselines are host-rasterizer specific, and nobody could
regenerate the Linux set from a Mac. That blocker is now removed — run the
`E2E (full sweep)` workflow with `regen_visual: true`, review the uploaded pngs,
commit them, then flip `PW_VISUAL=1` on the e2e step.

**Closes when:** baselines are regenerated in CI's image and the gate is turned on
— or the pixel suite is deleted in favour of DOM/token assertions. Either is fine;
leaving it half-enabled is not.

---

## Closed

| Item | Closed by |
|---|---|
| `MutationView` and `RepoView` never rendered (D1) | Tracks 04 Testing and 05 Version Control opened, rendering both for the first time. **The debt was real: three defects that a green headless suite and a compile-time view-contract assertion had both missed.** `MutationView`'s rotated test-name headers were anchored shallow enough to reach up into the figure's `PlateLabel`, illegible; `RepoView` drew orphaned commits at border-grey and 0.5 opacity, so "your commits are now unreachable" — the entire point of the rebase figure — was technically drawn and effectively invisible; and mutant labels carried markdown backticks, which SVG text renders as literal characters. Fixed, re-screenshotted, and 40 new claim tests pin the lessons' numbers. |
| 3 e2e tests for the appearance/personalization panel dropped in `cfb4618` | Deleted (90 lines). `data-theme` existed nowhere in `src`; all three failed at unmodified HEAD. |
| Flaky "play advances the sim clock" (9 of 10 runs) | Three real product bugs, found by instrumentation after three wrong guesses: the transport dispatched `controls.toggle` so the button could do the opposite of its label; the scroll observer acted on mid-scroll threshold crossings, pausing and resuming ~17ms apart; autoplay's once-only guard was a closure variable that reset when `useReducedMotion()` settled. |
| "answered prediction checkpoint" focus assertion failing at HEAD | `PredictionQuiz` now yields focus restoration to an explicit dismiss, so the figure keeps focus when the learner asks to inspect. |
| Nord palette in OG/PWA files while tokens were warm graphite | All hexes recomputed from the oklch tokens; the three raster icons were regenerated (they still read `#88C0D0` at centre pixel) and visually confirmed. |
| README describing 10 lessons in 3 modules | Table generated from the registry, fenced by markers, pinned by a `readme sync` check with `--write-readme` to regenerate. |
| Section completion untested on track 02 (D3) | An interaction spec now drives a step-engine figure and asserts the completion persists across a reload. Verified it can fail by removing the `onEngage` wiring and watching it break. |
| `Math.random()` unguarded in the playground (D7) | Lint widened to `src/components/playground/**`; the one legitimate use (picking a fresh seed) carries an inline exemption stating why. An exemption you can see beats a gap in the glob. |
| `RELEASE_D_REPORT.md` reading as current (D9) | Marked HISTORICAL at the top, naming what it predates and pointing at the current documents. |
| Monitoring documented but not running (D6) | `.github/workflows/monitor.yml` now runs it 4×/day against the deployed origin, and the route list is derived from the registry rather than hand-maintained — 74 routes instead of a stale 30 that had fallen 14 lessons behind. Doc rewritten to describe what exists. |
| Playwright browser pin mismatch (D8) | `@playwright/test` resolves to 1.62.0, which wants chromium 1234; only 1237 was cached. `npx playwright install chromium` fetched the expected build — e2e now runs with no `PW_CHROMIUM_PATH` override. |
| 5 high-severity dependency advisories | Found by adding `npm audit --audit-level=high` to CI. `npm audit fix` cleared them to zero, lockfile-only (16 packages, incl. Next 16.2.11 → 16.3.3), verified by the full gate, build and e2e. |
| Code panel clipping (three consecutive lessons) | ≤27 characters derived from the component and enforced by the `algo integrity` check, which names the offending line and its length. |
