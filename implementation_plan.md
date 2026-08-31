# Implementation plan

**Goal.** Grow syslab from one system-design track into a curriculum covering
software engineering broadly, without breaking the promise that every concept is a
running, deterministic simulation.

**Audience.** Whoever picks this up next. Read `CLAUDE.md` first for architecture
and invariants; this document is only *what is done, what is left, and what has
already been decided*. Open debt lives in [`debt.md`](./debt.md).

**State verified 2026-08-31**, by running the gate rather than recalling:
47 lessons · 153 sections · **5 tracks** · 534 unit tests (18 files) · 110 e2e
tests sampled (59 run, 51 in the opt-in visual suite) and 139 on the full
smoke+axe sweep · clean static export, 109 routes. `npm run check` green.

---

## 1 · How to work here

```bash
npm run check                 # tsc + eslint + curriculum checks + unit tests. The gate.
npm run build                 # static export to out/
npx playwright test           # e2e, sampled (one lesson per module)
E2E_FULL=1 npx playwright test # every lesson — what the nightly runs
npm run new:lesson <track>/<module>/<slug> -- --title "…"
npx tsx scripts/check-curriculum.mts --write-readme   # after any registry change
npm run monitor:routes        # check the deployed site
```

### The per-lesson loop

This is the part that matters, and it is not obvious from the code. Six steps,
in order, every time:

1. **Scaffold** — `npm run new:lesson`. Writes the def, figure wrapper, page with
   matching section ids, OG route, registry entry, learning-guide stub.
2. **Model, then measure.** Write the def, then drive it with `npx tsx` over ~200
   seeds and *read the numbers*. Never write a quantitative sentence you have not
   measured.
3. **Write the prose against those numbers.** Twice this session a measurement
   changed the lesson: serializable turned out not to "fix" lost update, and
   read-committed's non-repeatable read needed different final balances than I had
   assumed.
4. **Pin the numbers as claim tests** — see `src/lessons/__tests__/*-claims.test.ts`.
   If a page quotes a figure, a test owns it. Then **break the mechanism and watch
   the test fail**; a claim test that has never failed is decoration.
5. **`npx tsx scripts/check-curriculum.mts --write-readme`, then `npm run check`.**
6. **Screenshot the figure and look at it.** Non-negotiable. This step has caught a
   defect in five separate lessons that a fully green headless suite did not: a
   counter reading 0 beside two waiting lanes, clipped pseudocode, a size meter
   labelled "N" next to a "buffer capacity" slider, prose contradicting the run,
   and a transaction name colliding with its status text.

### Non-negotiables

- **All randomness through the seeded RNG.** `Math.random` is lint-banned in
  `src/engine/**`, `src/lessons/**` and the playground.
- **Model, don't assert.** If a lesson claims a mechanism, the figure must
  demonstrate it. Two lessons needed explicit models for this reason (a store
  buffer as shared state; a cache line as a claimable resource), and both document
  the modelling decision *and its limits* in the def so it cannot be mistaken for
  the engine's own semantics.
- **A constraint invisible at the point of authoring belongs in a check, not a
  comment.** The ≤27-character code-panel limit was documented and then violated in
  three consecutive lessons before it became an `algo integrity` check.

---

## 2 · Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Thesis + repo/doc debt | **Done** |
| 1 | Multi-track foundation | **Done** except the ⌘K search, now unblocked |
| 2 | Engine archetypes | A–E **done**; F and G remain, both conditional |
| 3 | Authoring pipeline | **Done** |
| 4 | CI + weight budget | **Done** (OG consolidation deferred with a measurement) |
| 5 | Track rollout | 5 of 11 tracks; 47 lessons of ~120 |

### Foundations in place

- Routes are `/learn/<track>/<module>/<slug>`. The 26 pre-migration URLs survive as
  generated redirect stubs (`src/app/learn/[...legacy]/`), monitored so a dead old
  link is caught.
- Progress, sidebar and prev/next are **per track**. `modules` and `allLessons` are
  cross-track flattenings for global indexes only — using them for progress dilutes
  the denominator.
- Two engines: **A** packet flow (`src/engine/`), **B** discrete steps
  (`src/engine/algo/`). Registry field `engine?: "flow" | "steps"` selects one;
  omitted means flow.
- **C, D and E are not engines.** Thread interleaving, the mutation harness and the
  repo DAG are all state shapes on archetype B. Five step producers exist:
  `concurrency.ts`, `mutation.ts`, `repo.ts`, `transactions.ts`, `wal.ts` — the
  last of them the first with no scheduler at all.
- Six views: `ArrayView`, `ThreadsView`, `MutationView`, `RepoView`, `TableView`,
  `WalView`.
- `check-curriculum.mts` enforces route parity both ways, track integrity, globally
  unique module slugs, `AlgoDef` shape, code-panel width, prerequisite ordering,
  quiz-id uniqueness, and the README table.

**The rule that collapsed three archetypes into one, and should be applied before
building any new engine:** ask whether the subject is a finite sequence of states.
If it is, it is a state contract + a step producer + a view + a test file.

---

## 3 · What remains

### Phase 1 · ⌘K curriculum search

Does little at 40 lessons; essential at ~120. Registry-derived, no separate index,
keyboard-first.

**Acceptance:** reachable from any learn-area page, navigable by keyboard alone,
axe-clean, one interaction spec.

**Do it when** the per-track sidebar stops being sufficient — realistically when a
fourth track opens. **That condition is now met: there are five tracks.** This is
the top recommended item.

### Phase 2 · F and G — both conditional

**F · Code-transform workbench** (unlocks track 10: refactoring, patterns, SOLID).
Try archetype B first: state is `{ files, activeFile, highlights, metrics }`, each
step one transformation.

*The open question:* can coupling / complexity / duplication be computed honestly
from a toy AST? **Spike one refactoring and see whether a real metric moves.** If
the number has to be hand-authored per step, the figure is theatre — cut F and
teach those topics with A/B/G instead.

**G · Branching scenario** (unlocks track 11: requirements, review, on-call,
ethics). The archetype most at risk of becoming a quiz with prose consequences.

*Hard gate:* **a scenario choice must mutate the parameters of a real A or B run,
or the lesson does not ship.** A choice that only reveals text is a quiz, and
`/review` already does quizzes better.

### Phase 5 · Track rollout

Roughly **73 lessons remain**. Each track is independently shippable; the gate for
each is the per-lesson loop in §1 plus a regenerated README.

**A track's number is its POSITION IN THE REGISTRY ARRAY**, not an identity —
`Track 04` in the README is simply `curriculum.tracks[3]`. Adding a track in the
middle renumbers everything after it, so refer to tracks by slug in code and treat
these numbers as the current display order.

| # | Track (slug) | Archetypes | Est. | Status |
|---|---|---|---|---|
| 01 | System Design Fundamentals (`system-design-fundamentals`) | A | 26 | **complete** |
| 02 | Concurrency (`concurrency`) | C on B | 9 | **complete** |
| 03 | Databases & Transactions (`databases`) | B | ~10 | **open — 8 shipped** |
| 04 | Testing & Verification (`testing`) | D | ~8 | **open — 2 shipped** |
| 05 | Version Control & Delivery (`version-control`) | E | ~8 | **open — 2 shipped** |
| — | Networking & the Web | A + B | ~10 | not started |
| — | Security Engineering | A + B + D | ~12 | not started |
| — | Languages & Runtimes | B | ~12 | not started |
| — | Operating Systems | B + C | ~12 | not started |
| — | Software Design & Architecture | F | ~14 | blocked on the F spike |
| — | Engineering Practice | G | ~10 | blocked on the G gate |

**Estimates are ~30% lower than originally planned, deliberately.** Track 02 was
projected at ~14 and came in at 9, because nine covered the subject without
padding. Assume the same correction elsewhere rather than treating these as
targets to fill.

#### Track 03, specifically

Shipped, and the `transactions` module is complete as an argument: **Dirty Reads
and Read Committed · Non-Repeatable Reads · Write Skew · Lost Update · Two-Phase
Locking**. Four anomalies of increasing subtlety, then both ways to enforce
serializable. All four isolation levels are implemented; all five lessons reuse
`runTransactions` and `TableView`.

Adding a level means touching exactly three places in `transactions.ts`, and
nothing else:

1. the `Isolation` union;
2. `visibleTo` — the read rule, which is where "read uncommitted sees a dirty
   value" is *demonstrated* rather than claimed;
3. the commit-time check (the read-set comparison that catches write skew).

A *mechanism* rather than a level — 2PL is the existing example — additionally
sets a flag near the top of `runTransactions` and declares `Statement.locks`.

The `durability` module is **complete as an argument**, at three lessons:
**Write-Ahead Logging · Checkpoints · Group Commit**. What makes a commit true,
what bounds recovery, and what a commit costs.

Only WAL needed new machinery (`algo/wal.ts`, `views/WalView.tsx`). Checkpoints
cost one boolean on `WalScript`, a redo bound and a counter; Group Commit cost one
policy field, one op, and moving acknowledgement into `forceLog`. That ratio — one
producer, three lessons — is the argument for asking whether an existing producer
can carry a subject before building another view.

Read WAL first if you are extending this module. It is the reference for two
things the transaction lessons never needed: a `size` slider used as something
other than a size (the crash point), and a state contract whose subject is what
survives losing power rather than what a transaction can see.

**The remaining topics each need a new view built from scratch** — unlike the five
transaction lessons, which all reused `runTransactions` and `TableView`. Budget
accordingly:

- **MVCC** — needs row version chains; opens the "snapshot" black box the
  isolation lessons rely on. Note this changes a model five lessons depend on.
- **B-tree vs LSM**, **indexes & query plans** — new views each.

#### Tracks 04 and 05, specifically

Both are OPEN at two lessons each, and both rendered their view for the first time
— which closed D1 and cost three real defects (see the closed section of
`debt.md`). The engines carry more than two lessons each:

- **04 Testing** (`runMutationSuite`): shipped Coverage Is Not Correctness ·
  Boundaries and Off-By-One. The harness also supports test-suite smells that
  coverage cannot express — a test asserting nothing, a mutant no input reaches, a
  suite whose whole score rests on one test. Judge honestly whether each is a
  distinct lesson or the same point twice; the module is already a complete
  argument at two.
- **05 Version Control** (`runRepoScript`): shipped Merge vs Rebase ·
  Fast-Forward. `RepoOp` covers commit/branch/checkout/merge/rebase and nothing
  else, so cherry-pick, revert, reset and conflict handling would each need a new
  op. Adding an op is cheap; adding a CONFLICT is not, because the model has no
  file contents at all.

#### Also available, needing no new engine work

Track 01 additions: consistency models and quorums, saga/outbox, load shedding and
admission control, bulkheads, distributed locks and clock skew, API design, canary
and blue-green (~7–8 lessons).

---

## 4 · Decisions already made

Do not re-litigate these without new information.

| Decision | Rationale |
|---|---|
| **DSA cut** (~18 lessons) | Owner's call. Consequence carried: nothing teaches complexity analysis, which tracks 03, 08 and 09 assume. Teach it inline or accept the gap. `ArrayView` and the sorting defs remain as archetype-B reference implementations and test fixtures — they are deliberately consumer-less, not dead code. |
| **Cross-track prerequisites allowed** | "Strictly earlier in curriculum order" already prevents cycles. They stay a soft gate; `prerequisiteLabels` names the other track so the reader is not stranded. |
| **Linux is the only visual-baseline platform** | Two half-maintained sets are worse than one; the darwin set was deleted. Regenerate via the `E2E (full sweep)` workflow's `regen_visual` input. |
| **Visual suite is opt-in everywhere** (`PW_VISUAL=1`) | Running 30 pixel comparisons by default on a non-canonical host produced noise *and* starved other suites — 40 failures combined vs 1 apart. |
| **E2E samples one lesson per module on PRs** | Lesson pages come from the same components, so a module's second lesson rarely adds signal. Full sweep runs nightly. |
| **Audit threshold is `high`** | Moderate findings in dev-only tooling would block every PR on something nobody can act on. |
| **OG routes stay per-lesson** | Measured: 35 routes → 72 pngs in a 26s build, and the scaffolder writes the file. Revisit above ~2 minutes. |
| **Counters belong to the scheduler** | A lesson may only surface keys its producer bumps. Track 02 works around this by renaming (`retries` reads as "failed attempts" or "line transfers"). A lesson-specific counter needs a producer hook — see D4. |

---

## 5 · Traps that have actually bitten

- **A green test run is not evidence a view is correct.** Five lessons had layout
  or prose defects found only by screenshot.
- **A passing test can sit beside a wrong sentence.** A claim test asserted a *sum*
  was 200 while the prose named the wrong individual values. Assert what the page
  says, not a weaker property.
- **The scaffolder's inserts are anchored text edits.** They fail loudly by design,
  but one produced `),};` on a single line — valid TypeScript, so the gate passed,
  and it broke the *next* run. The applier now asserts its own output shape.
  `--sections` splits on commas, so a section title cannot contain one.
- **`useReducedMotion()` settles `null → false` after mount**, re-running any effect
  that depends on it. A once-only guard in such an effect must be a ref.
- **A control must dispatch the intent its label shows**, never ask the engine which
  way to flip: engine status changes without a re-render, so `toggle` could do the
  opposite of the button's label.
- **A view that has never been rendered is not merely unverified — it is wrong.**
  Rendering `MutationView` and `RepoView` for the first time cost three defects
  despite both having passing headless tests AND a compile-time view-contract
  assertion. Worst of them: `RepoView` drew orphaned commits at border-grey and
  half opacity, so the rebase lesson's entire point was invisible. Budget a
  screenshot pass and fixes as part of shipping any first render.
- **Trust a measurement over your own eyes on a downscaled screenshot.** Twice
  this session I misread a figure — a chip colour once, a digit (`0` as `5`) once —
  and both times driving the def with `npx tsx` settled it in seconds. Screenshot
  to find layout defects; verify the values in code.
- **A hand-maintained exclusion list will drift, and the sampling can hide it.**
  `selectedLegacyRoutes` excluded one module by name to skip lessons with no
  pre-track URL. That was right when track 02 was the only later track and wrong
  the moment track 03 added modules — it asserted redirects for URLs that never
  existed. It could not fail on a pull request, because the sampled run takes the
  first three, which are all track 01. Only `E2E_FULL=1` found it. Both sides now
  derive from `migratedLessons()`.
- **Run `E2E_FULL=1` before believing the suite is green.** The sampled run takes
  one lesson per module, so a brand-new lesson that is a module's SECOND is not
  covered by it at all.
- **A claim test earns its keep at authoring time, not just later.** Writing the
  checkpoint prose, "records applied" was stated as 2; the meter reads 3, because
  it counts redo AND undo. The claim test failed on the first run and the sentence
  was wrong, not the code.
- **The first time a config path is actually RENDERED, expect a latent bug.**
  `write-ahead-logging` was the first shipped lesson def to declare a `size`, and
  rendering it exposed an `AlgoFigure` defect that had been there all along: the
  size was reported twice, as a counter and on its own slider. Nothing was wrong
  with the new lesson. This is D1's thesis arriving on a path nobody had listed.
- **A view must not infer semantics from an empty collection.** `WalView` read an
  empty log as "this policy keeps no log", which is also true of the first frame
  of every logged run — so the write-ahead figure opened by announcing it had no
  log. The producer now states it explicitly.
- **This machine's load skews test timing.** Failures at load average >30 were
  environmental every time; re-run in isolation before investigating.

---

## 6 · Recommended order

1. **⌘K curriculum search.** Its stated trigger has fired — five tracks, 47
   lessons, and the sidebar only ever shows the active track, so there is now no
   way to find a lesson whose track you are not already in. Acceptance criteria are
   in §3.
2. **Track 01 additions** — ~7–8 lessons on the existing packet engine, no new
   machinery at all. The cheapest content left anywhere.
3. **Extend tracks 04 and 05** — both are open at two lessons on engines that can
   carry more, and both views are now screenshot-verified, so the expensive part is
   already paid.
4. **Track 03's remaining topics** — MVCC and the storage/index lessons, each
   needing a new view. MVCC also changes a model five shipped lessons depend on, so
   it is the most expensive thing on this list.
5. **F spike, then the G gate** — resolve whether the refactoring and practice
   tracks are viable before committing to them.

Debt to clear opportunistically: **D10** needs one run of the regen workflow;
**D5** needs owner approval for a history rewrite; **D2** needs two devDependencies
for hook rendering tests.
