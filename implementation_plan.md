# Implementation plan

**Goal.** Grow syslab from one system-design track into a curriculum covering
software engineering broadly, without breaking the promise that every concept is a
running, deterministic simulation.

**Audience.** Whoever picks this up next. Read `CLAUDE.md` first for architecture
and invariants; this document is only *what is done, what is left, and what has
already been decided*. Open debt lives in [`debt.md`](./debt.md).

**State verified 2026-09-06**, by running the gate rather than recalling:
132 lessons · 430 sections · **11 tracks** · 1495 unit tests (95 files) · 47 quizzes ·
clean static export, 26 legacy redirect stubs. `npm run check` green.

Tracks 01–11 are complete. Parsing, GC, the event loop, JIT/deopt, and vtables
shipped on `parser.ts` / `runtime.ts` / `gc.ts` / `eventloop.ts` / `jit.ts` /
`vtable.ts`. Parked: Track 01 API design / sagas.

**Every number in this document was re-checked against the repository on the date
above.** If you change the curriculum, the honest way to update them is to run the
gate and read them off, not to adjust them by hand.

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
3. **Write the prose against those numbers**, not the other way round. Measuring
   has repeatedly changed the lesson rather than confirming it: serializable turned
   out not to "fix" lost update, and a checkpoint's "records applied" was 3 rather
   than the 2 the draft claimed, because the meter counts redo AND undo.
4. **Pin the numbers as claim tests** — see `src/lessons/__tests__/*-claims.test.ts`.
   If a page quotes a figure, a test owns it. Then **break the mechanism and watch
   the test fail**; a claim test that has never failed is decoration.
5. **`npx tsx scripts/check-curriculum.mts --write-readme`, then `npm run check`.**
6. **Screenshot the figure and look at it.** Non-negotiable, and it has never once
   been wasted: EVERY first render of a view has produced at least one defect a
   fully green headless suite did not see. A sample: a counter reading 0 beside two
   waiting lanes, clipped pseudocode, a size readout printed twice, orphaned commits
   drawn invisibly, a stage banner claiming something vacuously true, a node
   rendered below the stage edge, and a toggle contradicting its own meter.

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
| 1 | Multi-track foundation | **Done**, ⌘K search included |
| 2 | Engine archetypes | A–E done; **F and G now RESOLVED — both BUILD** (see §3), archetypes shipped as `refactor.ts` + `scenario.ts` |
| 3 | Authoring pipeline | **Done** |
| 4 | CI + weight budget | **Done** (OG consolidation deferred with a measurement) |
| 5 | Track rollout | 11 of 11 tracks **complete**; 132 lessons |

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
- **C, D, E, F and G are not engines.** Thread interleaving, the mutation harness,
  the repo DAG, the refactor workbench and the branching scenario are all state
  shapes on archetype B. Thirteen step producers exist: `concurrency.ts`,
  `mutation.ts`, `repo.ts`, `transactions.ts`, `wal.ts`, `mvcc.ts`, `storage.ts`,
  `queryPlan.ts`, `paging.ts`, `scheduler.ts`, `refactor.ts`
  (F — computes cyclomatic complexity and fan-out from a toy AST), and
  `scenario.ts` (G — drives a real sub-run per option and measures the outcome).
- Thirteen views: `ArrayView`, `ThreadsView`, `MutationView`, `RepoView`, `TableView`,
  `WalView`, `VersionsView`, `StorageView`, `QueryPlanView`, `PagingView`,
  `SchedulerView`, `RefactorView`, `ScenarioView`.
- `check-curriculum.mts` enforces route parity both ways, track integrity, globally
  unique module slugs, `AlgoDef` shape, code-panel width, prerequisite ordering,
  quiz-id uniqueness, and the README table.
- **⌘K search** (`components/navigation/CommandPalette.tsx`), mounted in `Sidebar`
  so it reaches every learn-area page. Registry-derived from `allLessons`, no
  separate index; keyboard-only, axe-clean with the dialog open, covered by
  `e2e/search.spec.ts`. Two inherited gotchas: it is PORTALED to `document.body`
  because rendering inside the sidebar's `<aside>` let page chrome paint over it
  (z-index cannot escape an ancestor stacking context), and results are RANKED by
  where the match landed (title prefix > title substring > module/track > tagline)
  because the haystack includes taglines — unranked, "dead" put Circuit Breakers
  above Deadlock.

**The rule that collapsed three archetypes into one, and should be applied before
building any new engine:** ask whether the subject is a finite sequence of states.
If it is, it is a state contract + a step producer + a view + a test file.

---

## 3 · What remains

### Phase 2 · F and G — RESOLVED, both BUILD

**F · Code-transform workbench** (unlocked track 10: Software Design &
Architecture). **Built**, on archetype B, as `algo/refactor.ts` + `views/refactor.ts`
+ `views/RefactorView.tsx`.

*The open question was:* can coupling / complexity / duplication be computed
honestly from a toy AST? **Answer: yes.** The spike implemented Extract Function
over a toy AST (statement nodes over branch / loop / && / || / case / call /
plain) and computed McCabe cyclomatic complexity (1 + decision points) and fan-out
(distinct callees) by FOLDING over the tree. Measured, before → after the
extraction: the hot function `handle` went **cc 7 → 2**, the new `validate` arrived
at **cc 6**, and the module's max complexity fell **7 → 6** — while the total
decision points stayed **6**, because a pure extraction MOVES complexity, it does
not invent it. That conservation law is asserted on every frame and is the proof
the number is not hand-authored: a hand-authored metric could not obey it by
construction. De-duplication (the `dedupe` transform, reuse an existing function)
is the one refactoring that genuinely reduces total decision points, measured
**4 → 2**. So F is not theatre; it ships. First module: **Extract Function ·
Duplicated Logic · Inline & Rename** (3 lessons).

**G · Branching scenario** (unlocked track 11: Engineering Practice). **Built**, on
archetype B, as `algo/scenario.ts` + `views/scenario.ts` + `views/ScenarioView.tsx`.

*Hard gate:* a scenario choice must mutate the parameters of a real A or B run, or
the lesson does not ship — a choice that only reveals text is a quiz, and
`/review` already does quizzes better. **The gate is met.** The producer runs a
REAL `interleave()` (or another archetype-B producer) per option over a sample of
seeds and MEASURES the outcome; the size slider IS the choice, exactly as WAL uses
size as the crash point. Measured divergence: the counter-fix scenario is correct
in **54/200** runs if you leave the race and **200/200** if you take the mutex; the
lock-ordering scenario completes **200/200** with one global order and **102/200**
(the rest deadlock) with opposite orders. The numbers move with the choice because
they are the output of running the scheduler, not prose. So G ships as a lesson
archetype. First module: **The Mutex Call · Retry or Back Off (lock ordering)**
(2 lessons); the module is a coherent first argument and will grow.

**The archetype design that made G safe.** The `ScenarioState` contract carries no
"consequence text" field, by construction — only the measured `ScenarioOutcome`
(score, value/outOf) of each option's real run. There is nowhere to put a prose
consequence, so a scenario that could only reveal text cannot be authored on this
view. That is the structural enforcement of the hard gate.

### Phase 5 · Track rollout

**Tracks 01–11 are complete.** **132 lessons shipped.** Parked: Track 01 API design / sagas (neither is a natural packet-engine subject). Each track is independently shippable; the gate for each is the per-lesson loop in §1 plus a regenerated README.

**A track's number is its POSITION IN THE REGISTRY ARRAY**, not an identity —
`Track 04` in the README is simply `curriculum.tracks[3]`. Adding a track in the
middle renumbers everything after it, so refer to tracks by slug in code and treat
these numbers as the current display order.

| # | Track (slug) | Archetypes | Est. | Status |
|---|---|---|---|---|
| 01 | System Design Fundamentals (`system-design-fundamentals`) | A | 26 | 31 shipped — **effectively finished** (see §6) |
| 02 | Concurrency (`concurrency`) | C on B | 9 | **complete** |
| 03 | Databases & Transactions (`databases`) | B | ~10 | **complete — 11 shipped, 5 modules** |
| 04 | Testing & Verification (`testing`) | D + C + B | ~9 | **complete — 9 shipped, 3 modules** |
| 05 | Version Control & Delivery (`version-control`) | E + A | 8 | **complete — 8 shipped, 2 modules** |
| 06 | Networking & the Web (`networking`) | A + B | 10 | **complete — 10 shipped, 3 modules** |
| 07 | Software Design & Architecture (`software-design`) | F + B | 10 | **complete — 10 shipped, 3 modules** |
| 08 | Engineering Practice (`engineering-practice`) | G on B | 8 | **complete — 8 shipped, 2 modules** |
| 09 | Operating Systems (`operating-systems`) | B | ~12 | **complete — 12 shipped, 3 modules** |
| 10 | Security Engineering (`security`) | B | ~12 | **complete — 12 shipped, 4 modules** |
| 11 | Languages & Runtimes (`languages`) | B | ~12 | **complete — 12 shipped, 3 modules** |

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

The `mvcc` module is **complete at one lesson**: **MVCC** shipped, on its own new
view (`algo/mvcc.ts`, `views/VersionsView.tsx`) — row version chains that open
the "snapshot" black box the isolation lessons rely on. It is deliberately an
isolated view rather than a change to `runTransactions`, so it did not disturb
the five isolation lessons that depend on that model.

The `storage` and `indexing` modules are **complete** — each one lesson, each a
new view, because unlike the five transaction lessons they could not reuse
`TableView`:

- **B-tree vs LSM** (`storage`, `algo/storage.ts`, `views/StorageView.tsx`):
  eight keys rewrite eight B-tree leaves (24 page reads); the same eight keys
  cost an LSM two flushes, three page reads, and four bloom misses. At twelve
  keys the LSM's first compaction makes page writes 4. Slider: keys written.
- **Indexes & Query Plans** (`indexing`, `algo/queryPlan.ts`,
  `views/QueryPlanView.tsx`): a scan always reads 8 heap pages; a secondary
  index ties that at 6 matches and loses at 7 (9 vs 8); a clustered seek at 7
  still reads 4. Slider: matching rows.

#### Track 04 · Testing & Verification (8 shipped across 2 modules)

Currently 8 lessons across TWO modules (`test-quality` [5 lessons: Coverage Is Not
Correctness, Boundaries and Off-By-One, Not Every Survivor Is a Bug, Assertion-Free
Tests, Brittle Mocks vs State Verification], `flakiness` [3 lessons: Why Suites Go
Flaky, Tests That Depend on Each Other, Async Timing and Sleep Flakes]). Remaining topic
to extend to 9 lessons:

- Module 3: `property-testing` (1 lesson, Archetype B: `algo/shrinking.ts`, `views/ShrinkView.tsx`):
  - **Property Shrinking**: a generated random input fails an invariant. The runner
    deterministically shrinks the failing test case step-by-step (halving, element
    deletion, integer decrementing) until finding the minimal reproducible
    counterexample. Slider controls search budget or input bounds.

#### Track 05 · Version Control & Delivery (8 shipped across 2 modules)

Currently 8 lessons across TWO modules: `history` on the repo DAG (**5 shipped — module
complete**: Merge vs Rebase, Fast-Forward, Cherry-Pick and Revert, Reset, Three-Way
#### Track 06 · Networking & the Web (~1 lesson remaining to ~10)

Currently 9 lessons across THREE modules: `web-requests` (4 lessons: DNS Resolution,
The TCP Handshake, HTTP Request & Response, Keep-Alive & Connection Reuse), `http-protocols`
(**3 lessons — module complete**), and `caching-and-security` (2 lessons shipped).

- Module 2: `http-protocols` (**3 shipped — module complete**):
  - **HTTP/1.1 Pipelining & Head-of-Line Blocking** (shipped — RFC 2616 FIFO response constraint traps fast static assets behind slow dynamic queries, causing >700ms HOL delay; uniform requests drop HOL delay to 0ms)
  - **HTTP/2 Multiplexing & Stream Priorities** (shipped — binary framing interleaves streams over one TCP socket, letting fast API call finish in 733ms vs 1200ms sequential; packet loss causes 600ms TCP transport freeze across all streams)
  - **QUIC & HTTP/3: Independent UDP Streams** (shipped — independent UDP stream delivery isolates packet loss to the affected stream alone, keeping transport HOL delay pinned at strictly 0ms)
- Module 3: `caching-and-security` (2 shipped, 1 remaining):
  - **HTTP Caching: Max-Age & Revalidation** (shipped — max-age serves from local memory with 0ms latency, raising hit rate to 63% and cutting latency from 700ms to 256ms; stale-while-revalidate serves stale content instantly with 88% hit rate and 58ms average latency)
  - **Conditional Requests & ETags** (shipped — If-None-Match with 304 Not Modified header cuts bandwidth from 300 KB to 51.5 KB with 83% 304 rate, saving 83% of wire transfer)
  - **The TLS Handshake: 1-RTT to 0-RTT**: asymmetric key agreement (ECDHE),
    certificate validation, and session key derivation. Demonstrates 1-RTT full
    handshake vs 0-RTT session resumption with replay attack trade-offs.

#### Track 07 · Software Design & Architecture (**complete — 10 shipped across 3 modules**)

Track complete across refactoring AST transforms, package modularity metrics, and architectural boundaries:

- Module 1: `refactoring` (**5 shipped — module complete**):
  - **Extract Function** (shipped)
  - **Duplicated Logic** (shipped)
  - **Inline & Rename** (shipped)
  - **Extract Class** (shipped — god class decomposed, complexity and fan-out drop, decisions conserved)
  - **Replace Conditional with Polymorphism** (shipped — cascading conditionals refactored to strategy handlers, cc drops to 1)
- Module 2: `modularity-coupling` (**3 shipped — module complete** on Archetype B, `views/TableView.tsx`):
  - **Afferent & Efferent Coupling ($C_a, C_e$)** (shipped — incoming vs outgoing dependency counts across 4 packages, total coupling drops 12 → 8 while sum(Ca) = sum(Ce) holds)
  - **Instability & Abstractness ($I, A$)** (shipped — Martin's Main Sequence, Zone of Pain D=1.0 drops to D=0.5 via interface extraction)
  - **Cyclic Dependencies & the Acyclic Dependencies Principle (ADP)** (shipped — circular cycle detected with Tarjan DFS, broken via DIP to produce valid topological release order)
- Module 3: `architecture-boundaries` (**2 shipped — module complete** on Archetype B, `views/TableView.tsx`):
  - **Dependency Inversion & Ports/Adapters** (shipped — decoupling domain business entities from infrastructure drivers using abstract ports, domain fan-out drops 2 → 0)
  - **The Strangler Fig Pattern** (shipped — routing traffic between a legacy monolith and microservices via facade proxy, incremental cutover completes with 0 downtime)

#### Track 08 · Engineering Practice (**complete — 8 shipped across 2 modules**)

Track complete on Archetype G (`algo/scenario.ts` driving real discrete/scheduler simulations,
rendered by `views/ScenarioView.tsx`):

- Module 1: `on-call` (**5 shipped — module complete**):
  - **The Mutex Call** (shipped)
  - **Retry or Back Off** (shipped)
  - **Thread Pool vs Bounded Queue Sizing** (shipped — bounded pool with shedding maintains SLA; deep queue explodes latency to 30s)
  - **Circuit Breaker Hysteresis** (shipped — rate-ramping half-open probing prevents flapping loop and artificial downtime)
  - **Zero-Downtime Schema Migration (Expand/Contract)** (shipped — 5-phase expand/contract completes under 1000 writes/sec with 0 dropped writes)
- Module 2: `resilience-engineering` (**3 shipped — module complete**):
  - **Cascading Failure & Thundering Herd** (shipped — singleflight request coalescing collapses 10k QPS cache failure, DB CPU stays < 40% across 200/200 runs)
  - **Memory Leak & Buffer Bloat Triage** (shipped — pod cordoning and rolling drain prevents dropped connections and captures heap profile in 200/200 runs)
  - **Split-Brain & Network Partitions** (shipped — majority quorum with monotonic fencing token prevents split-brain write collision in 200/200 runs)

#### Track 10 · Security Engineering — COMPLETE (12 shipped)

Toys on archetype B. Real hashes, JWS, S256, SQL parsers, browsers, and X.509
are named as the scale-up, not simulated.

- Module 1: `cryptography` (**3 shipped** — `algo/crypto.ts`, `CryptoView`):
  - Hash Functions (`mix8(42)=23`, flip bit 0 moves 6/8), Diffie-Hellman (`p=23`
    shared 12), Digital Signatures (toy RSA `n=55`, sig 25, tamper rejects).
- Module 2: `identity-access` (**3 shipped** — `algo/auth.ts`, `AuthView`):
  - Session Cookies (S7; flags 0 stolen 0 csrf 0; HttpOnly/Secure off stolen 1;
    SameSite=None csrf 1), JWT Pitfalls (naive accepts none/expired/tampered;
    strict accepts only sig 56 unexpired), OAuth & PKCE (intercept C9 without
    PKCE stolen 1 issued 0; with challenge 77 rejected 1 issued 1).
- Module 3: `application-security` (**3 shipped** — `algo/inject.ts`, `InjectView`):
  - SQL Injection (concat `7 OR 1=1` → 3 rows; bind as literal → 0), XSS (raw
    `<script>` scripts 1; encoded text), SSRF (open metadata leaked 1; allowlist
    blocked 1).
- Module 4: `defense-in-depth` (**3 shipped** — `policy.ts`, `stuffing.ts`, `mtls.ts`):
  - RBAC vs ABAC (mallory escalation 1 vs deny), Credential Stuffing (attempt 5
    succeeds without a limit and under an IP cap of 3; username cap 3 blocks 3),
    mTLS (perimeter connects with no cert; mTLS rejects missing and other-ca).

#### Track 11 · Languages & Runtimes — COMPLETE (12 shipped)

Toys on archetype B. A real parser, VM, and GC are named as the scale-up.

- Module 1: `parsing-execution` (**4 shipped** — `lexer.ts`, `parser.ts`, `runtime.ts`):
  - Lexical Analysis (`let n=2` is 4 tokens 1 skipped; `letn=2` is ident letn).
  - Recursive Descent (flat `1+2*3` is 9; prec is 7).
  - Tree Walk vs Bytecode (both 7; walk visits 5; bytecode stack max 3).
  - Call Stack (`f(3)` is 6 at depth 4; `f(4)` overflows cap 4).
- Module 2: `memory-management` (**4 shipped** — `gc.ts`, `GcView`):
  - Reference Counting (A→B frees 2; A↔B leaks 2).
  - Mark-and-Sweep (unrooted cycle still swept 2).
  - Incremental GC (STW pause 4; budget 1 pause 1, 4 slices).
  - Generational GC (old→young without a barrier loses Y1; a dirty card holds it).
- Module 3: `runtime-systems` (**4 shipped** — `eventloop.ts`, `jit.ts`, `vtable.ts`):
  - Event Loop (log `1,4,2,3`; nested micro `1,3,A,B,2`).
  - JIT Compilation (hot 4; 8 iters: interp 4 compiled 4).
  - Deoptimization (deopt at 6: interp 7 compiled 1 deopts 1).
  - Virtual Method Tables (named call 0 lookups; vtable 2; itable slot 2 is 4 lookups, same woof).

#### Unstarted Track · Operating Systems (~12 lessons)

Kernel resource management on Archetypes B + C (`algo/os.ts`, `views/PagingView.tsx`,
`views/SchedulerView.tsx`):

- Module 1: `virtual-memory` (4 lessons, Archetype B: `views/PagingView.tsx`):
  - **Address Translation & Page Tables**: splitting virtual addresses into VPN
    and offset; walking multi-level page tables.
  - **The Translation Lookaside Buffer (TLB)**: fast-path TLB hits vs multi-cycle
    page walks; TLB invalidation on context switch.
  - **Page Faults & Demand Paging**: handling missing page faults, disk swap reads,
    and major vs minor fault latency.
  - **Page Replacement: FIFO, LRU, & CLOCK**: evicting pages under memory pressure;
    page thrashing and working set sizing.
- Module 2: `cpu-scheduling` (4 lessons, Archetypes B + C: `views/SchedulerView.tsx`):
  - **Preemptive vs Cooperative Scheduling**: voluntary yields vs timer interrupt
    preemption; convoy effect in FIFO vs SJF.
  - **Round-Robin & Time Slice Sizing**: quantum size tradeoffs: short quantum
    (responsive, high context-switch waste) vs long quantum (batch efficiency, sluggish I/O).
  - **Multi-Level Feedback Queues (MLFQ)**: dynamic process priority adjustment
    based on CPU burst history; preventing starvation.
  - **Priority Inversion & Priority Inheritance**: low-priority task holding a mutex
    blocking high-priority task while medium-priority task runs; Mars Pathfinder
    reproduction and resolution.
- Module 3: `storage-io` (4 lessons, Archetype B):
  - **The Inode & File System Structure**: direct block pointers, indirect blocks,
    and directory entry traversal.
  - **File System Journaling & Crash Consistency**: metadata writes, data block flush,
    and journal commit; write barrier ordering to prevent filesystem corruption.
  - **The Buffer Cache & Fsync**: dirty page caching, background flushers, and
    write-back latency vs crash loss window.
  - **System Calls & Kernel Privilege Transitions**: trap instructions, user/kernel
    mode switching, register saving, and syscall overhead.

#### Track 01's addition list is spent

Shipped from it: **Load Shedding · Quorums · Bulkheads · The Outbox Pattern ·
Distributed Locks & Clock Skew**, plus **Canary Releases** and **Blue-Green
Deploys** which went to track 05's new `delivery` module instead. Track 01's
`distributed` module now holds 12 lessons and the track holds 31.

Only API design and sagas-with-compensation are left unclaimed, for the reasons in
§6. There is no longer a pool of cheap packet-engine content waiting.

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
- **A CODE PATH THAT HAS NEVER BEEN EXERCISED IS BROKEN, not merely unverified.**
  The single most reliable prediction in this repo. Four confirmed instances:
  `AlgoFigure` reported a def's `size` twice, latent until the first lesson declared
  one; `MutationView`'s rotated headers reached into the figure's `PlateLabel`, and
  `RepoView` drew orphaned commits at half opacity so the rebase lesson's whole
  point was invisible — both latent until a lesson rendered them, and both despite
  passing headless tests AND a compile-time view-contract assertion; and the
  scaffolder's FLOW template had rotted entirely (did not typecheck, `--engine`
  defaulted to `steps` contradicting the registry where omitted MEANS flow,
  inserted `simBySlug`/`SIM_BY_KEY` entries without their imports, and its meter
  read a metric the step never wrote) because every lesson since it was written had
  been archetype B. Budget a screenshot pass AND fixes as part of shipping any
  first render or first use of a config path. Nothing was wrong with the new lesson
  in any of these cases.
- **A control the timeline cannot write WILL drift from the state it controls.**
  `TimelineEvent.apply` receives only `state`, never `params`, so a scripted beat
  physically cannot move a slider or flip a toggle. Both `delivery` lessons hit
  this and it surfaced two different ways: canary had a `canary share` METER beside
  a `canary share` SLIDER holding different numbers (routing took
  `max(slider, scripted)`, so dragging the slider down could not lower the meter),
  and blue-green's toggle read OFF while 100% of traffic was on green with a
  caption inviting the reader to do what had already happened. Three rules follow:
  the scripted value must YIELD the moment the reader touches the control; it must
  RELEASE before any caption invites them to try it; and a meter must never share a
  label with a control. Same family as `AlgoFigure` printing a def's `size` twice —
  two readouts, one name, two numbers.
- **Never PAD a `code` array to make a `codeLine` line up.** A def did that and
  the panel rendered two blank numbered lines. It also meant a shared command
  builder carried an index belonging to a DIFFERENT def's code array. Shorten the
  array and give the command the right index. Now enforced: `algo integrity` fails
  a blank `code` entry and says what usually causes it.
- **Check that every node is inside the frame.** One of the quorums lesson's five
  replicas sat at y=390, under the stage edge where the caption sits, so the
  figure showed four replicas while the prose discussed five.
- **Raising z-index cannot escape an ancestor stacking context.** The command
  palette rendered inside the sidebar's `<aside>` and page chrome painted over it.
  A portal to `document.body` is the fix.
- **Trust a measurement over your own eyes on a downscaled screenshot.** Two
  misreadings so far — a chip colour, and a `0` read as a `5` — both settled in
  seconds by driving the def with `npx tsx`. Screenshot to find LAYOUT defects;
  verify VALUES in code.
- **A FACT ABOUT HISTORY cannot be derived from current data — write it down.**
  The best trap in this file, because the obvious fix was also wrong. "Which URLs
  existed before the route migration" was first a hand-maintained module exclusion
  (`!== "shared-state"`), which went stale the moment track 03 added modules and
  asserted redirects for URLs that never existed. It was then "derived, not listed"
  from the migrated TRACK — which broke differently as soon as track 01 GREW:
  five lessons added afterwards got phantom redirect stubs, and the e2e suite
  dutifully asserted those phantoms resolved. Both versions were green. The set is
  now a frozen `PRE_MIGRATION_SLUGS` list of 26 that must never grow, because a
  lesson added today did not exist yesterday. Derive from data; never derive from
  the past.
- **Fix a duplicated rule in EVERY copy, then prove there are no more.** The
  exclusion above lived in three places — the stub generator, the e2e suite, and
  `scripts/check-live-routes.mts`. Two were fixed and the docs then described the
  problem as solved, while the monitor quietly kept probing 15 URLs that never
  existed and 404 on the deployed site, reporting failures against reality rather
  than regressions. An independent audit found it, not the gate: nothing in
  `npm run check` exercises the monitor. When you consolidate a rule, grep for the
  old shape afterwards.
- **The sampled run can hide a drift like that.** The first version could not fail
  on a pull request, because the sampled legacy check takes the first three
  lessons and those are all track 01. Only `E2E_FULL=1` found it.
- **Run `E2E_FULL=1` before believing the suite is green.** The sampled run takes
  one lesson per module, so a brand-new lesson that is a module's SECOND is not
  covered by it at all.
- **A claim test earns its keep at authoring time, not just later.** Writing the
  checkpoint prose, "records applied" was stated as 2; the meter reads 3, because
  it counts redo AND undo. The claim test failed on the first run and the sentence
  was wrong, not the code.
- **A view must not infer semantics from an empty collection.** `WalView` read an
  empty log as "this policy keeps no log", which is also true of the first frame
  of every logged run — so the write-ahead figure opened by announcing it had no
  log. The producer now states it explicitly.
- **An un-asserted string replace will rot this document silently.** §6 of this
  plan drifted for two sessions because edits used a plain `replace()` with no
  assertion: the anchor stopped matching after an earlier edit, the replace became
  a no-op, the script still reported success, and the section kept claiming track 01
  had 7–8 cheap lessons left after five of them had shipped. It also ended up
  numbered 1, 3, 3, 4. **Assert that every anchor exists and is unique, then read
  the file back.** The same applies to shell heredocs: use `<<'PY'`, not `<<PY`, or
  bash will expand backticks inside the script and eat the identifiers.
- **This machine's load skews test timing.** Failures at load average >30 were
  environmental every time; re-run in isolation before investigating.

---

## 6 · Recommended order

A sequenced execution plan covering the remaining ~50 lessons and open debt:

1. **Tier 1 · Finish low-hanging modules in Tracks 04 and 05 (~4 lessons)**:
   - *Why first:* The engines (`runMutationSuite`, repo DAG) and views (`MutationView`, `RepoView`) are already implemented, tested, and screenshot-verified.
   - *Track 04:* Add Assertion-Free Tests and Brittle Mocks to `test-quality`, plus Property Shrinking (`algo/shrinking.ts`).
   - *Track 05:* Add Three-Way Merge & Conflict Mechanics to `history` to finish the core git curriculum.
2. **Tier 2 · Complete Track 06 Networking & the Web (~6 lessons)**:
   - *Why second:* Reuses established archetypes (A packet flow + B discrete steps) without needing heavy new engine frameworks.
   - Add `http-protocols` (HTTP/1.1 HOL blocking, HTTP/2 multiplexing, HTTP/3 independent UDP streams).
   - Add `caching-and-security` (HTTP caching directives, conditional ETag 304s, TLS 1.3 1-RTT/0-RTT handshake).
3. **Tier 3 · Track 03 storage topics — SHIPPED (2 lessons)**:
   - `algo/storage.ts` + `views/StorageView.tsx` (B-Tree vs LSM write/read amplification).
   - `algo/queryPlan.ts` + `views/QueryPlanView.tsx` (clustered vs secondary index seek/scan tipping point).
   - Track 03 Databases & Transactions is complete at 11 lessons, 5 modules.
4. **Tier 4 · Extend Tracks 07 and 08 on resolved archetypes F and G (~8 lessons remaining)**:
   - Archetypes F (`refactor.ts`) and G (`scenario.ts`) are proven and screenshot-verified.
   - *Phase A (Shipped — 5 lessons):* Added Extract Class and Replace Conditional with Polymorphism to `refactoring` (Track 07 now 5 shipped, `refactoring` module complete); added Thread Pool Sizing, Circuit Breaker Hysteresis, and Zero-Downtime Migration to `on-call` (Track 08 now 5 shipped, `on-call` module complete).
   - *Phase B (Remaining — ~8 lessons):* Build `views/DependencyGraphView.tsx` for `modularity-coupling` ($C_a, C_e, I, A$ metrics and ADP cycle detection); add Ports/Adapters and Strangler Fig to `architecture-boundaries` in Track 07; add Memory Leaks, Cascading Herd, and Split-Brain to `resilience-engineering` in Track 08.
5. **Tier 5 · Track 09 Operating Systems — COMPLETE (12 shipped)**:
   - Also shipped: Buffer Cache, System Calls. Producers `cache.ts`, `syscall.ts`.
6. **Tier 6 · Track 11 Languages & Runtimes — COMPLETE (12 shipped)**:
   - Lexer, parser, tree-walk/bytecode, call stack, refcount, mark-sweep, incremental GC, generational GC, event loop, JIT, deopt, vtables.
7. **Tier 7 · Track 10 Security Engineering — COMPLETE (12 shipped)**:
   - Cryptography (`crypto.ts`), identity (`auth.ts`), injection (`inject.ts`), RBAC/ABAC (`policy.ts`), stuffing (`stuffing.ts`), mTLS (`mtls.ts`).

**Track 01 is effectively finished** at 31 lessons against an estimate of 26. Of
its original addition list only **API design** and **sagas with compensation**
remain, and neither is a natural packet-engine subject — API design is about
contracts rather than flows, and a saga needs compensating actions the engine has
no vocabulary for. Leave the track as it stands.

**Debt to clear opportunistically alongside curriculum work**:
- **D10 (Visual suite):** Run `E2E (full sweep)` workflow with `regen_visual: true` to generate Linux baselines post-phosphor pass, commit PNGs, and enable `PW_VISUAL=1` in CI.
- **D2 (Rendering tests):** Add jsdom environment and React Testing Library to cover `useHydrated`, drawer, and focus traps without requiring full Playwright builds.
- **D5 (Git history):** Request owner approval for git history rewrite to purge `.mimosa/` and 14.7 MB PNG.
