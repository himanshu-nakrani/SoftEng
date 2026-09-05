# Implementation plan

**Goal.** Grow syslab from one system-design track into a curriculum covering
software engineering broadly, without breaking the promise that every concept is a
running, deterministic simulation.

**Audience.** Whoever picks this up next. Read `CLAUDE.md` first for architecture
and invariants; this document is only *what is done, what is left, and what has
already been decided*. Open debt lives in [`debt.md`](./debt.md).

**State verified 2026-09-05**, by running the gate rather than recalling:
72 lessons · 248 sections · **8 tracks** · 762 unit tests (26 files) · 47 quizzes ·
clean static export, 26 legacy redirect stubs. `npm run check` green.

Phase 2 F and G are now RESOLVED, both BUILD: the F spike proved a real code
metric (cyclomatic complexity) moves as a consequence of a toy-AST refactoring,
and the G gate proved a scenario choice mutates a real archetype-B run's measured
outcome. Both unlocked tracks opened with a first module — Software Design &
Architecture (`software-design`, 3 lessons) and Engineering Practice
(`engineering-practice`, 2 lessons).

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
| 5 | Track rollout | 8 of 11 tracks; 72 lessons of ~120 |

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
  shapes on archetype B. Nine step producers exist: `concurrency.ts`,
  `mutation.ts`, `repo.ts`, `transactions.ts`, `wal.ts`, `mvcc.ts`, `refactor.ts`
  (F — computes cyclomatic complexity and fan-out from a toy AST), and
  `scenario.ts` (G — drives a real sub-run per option and measures the outcome).
- Nine views: `ArrayView`, `ThreadsView`, `MutationView`, `RepoView`, `TableView`,
  `WalView`, `VersionsView`, `RefactorView`, `ScenarioView`.
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

Roughly **50 lessons remain**. Each track is independently shippable; the gate for
each is the per-lesson loop in §1 plus a regenerated README.

**A track's number is its POSITION IN THE REGISTRY ARRAY**, not an identity —
`Track 04` in the README is simply `curriculum.tracks[3]`. Adding a track in the
middle renumbers everything after it, so refer to tracks by slug in code and treat
these numbers as the current display order.

| # | Track (slug) | Archetypes | Est. | Status |
|---|---|---|---|---|
| 01 | System Design Fundamentals (`system-design-fundamentals`) | A | 26 | 31 shipped — **effectively finished** (see §6) |
| 02 | Concurrency (`concurrency`) | C on B | 9 | **complete** |
| 03 | Databases & Transactions (`databases`) | B | ~10 | **open — 9 shipped, 3 modules** |
| 04 | Testing & Verification (`testing`) | D + C | ~8 | **open — 7 shipped, 2 modules** |
| 05 | Version Control & Delivery (`version-control`) | E + A | ~8 | **open — 7 shipped, 2 modules** |
| 06 | Networking & the Web (`networking`) | A + B | ~10 | **open — 4 shipped, 1 module** |
| 07 | Software Design & Architecture (`software-design`) | F on B | ~10 | **open — 3 shipped, 1 module** |
| 08 | Engineering Practice (`engineering-practice`) | G on B | ~8 | **open — 2 shipped, 1 module** |
| — | Security Engineering | A + B + D | ~12 | not started |
| — | Languages & Runtimes | B | ~12 | not started |
| — | Operating Systems | B + C | ~12 | not started |

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

The `mvcc` module is **open at one lesson**: **MVCC** shipped, on its own new
view (`algo/mvcc.ts`, `views/VersionsView.tsx`) — row version chains that open
the "snapshot" black box the isolation lessons rely on. It is deliberately an
isolated view rather than a change to `runTransactions`, so it did not disturb
the five isolation lessons that depend on that model.

**The remaining topics each need a new view built from scratch** — unlike the five
transaction lessons, which all reused `runTransactions` and `TableView`. Budget
accordingly:

- **B-tree vs LSM** (`storage` module, Archetype B: `algo/storage.ts`, `views/StorageView.tsx`):
  contrasts in-place page updates with append-only memtables and SSTables. Models
  write amplification (small updates rewriting full pages vs compaction write cost)
  and read amplification (single root-to-leaf traversal vs multi-SSTable bloom
  filter checks). Slider: write-to-read ratio or dataset growth. Counters:
  `page_reads`, `page_writes`, `compactions`, `bloom_misses`.
- **Indexes & Query Plans** (`indexing` module, Archetype B: `algo/query_plan.ts`,
  `views/QueryPlanView.tsx`): clustered index vs secondary index lookup. Models
  table scan vs index seek, showing the tipping point where a secondary index lookup
  becomes more expensive than a full scan due to random I/O bookmark lookups.

#### Track 04 · Testing & Verification (~1 lesson remaining to ~8)

Currently 7 lessons across TWO modules (`test-quality` [5 lessons: Coverage Is Not
Correctness, Boundaries and Off-By-One, Not Every Survivor Is a Bug, Assertion-Free
Tests, Brittle Mocks vs State Verification], `flakiness` [2 lessons: Why Suites Go
Flaky, Tests That Depend on Each Other]). Remaining topic:

- Module 3: `property-testing` (1 lesson, Archetype B: `algo/shrinking.ts`, `views/ShrinkView.tsx`):
  - **Property Shrinking**: a generated random input fails an invariant. The runner
    deterministically shrinks the failing test case step-by-step (halving, element
    deletion, integer decrementing) until finding the minimal reproducible
    counterexample. Slider controls search budget or input bounds.

#### Track 05 · Version Control & Delivery (~1 lesson remaining to ~8)

Currently 7 lessons across TWO modules: `history` on the repo DAG (4 lessons) and
`delivery` on the packet engine (3 lessons).

- In `history`:
  - **Three-Way Merge & Conflict Mechanics** (`algo/repo.ts`, extended `views/RepoView.tsx`):
    moves beyond fast-forward and clean rebase. Identifies the merge base (Best
    Common Ancestor / LCA) between two diverged branches `ours` and `theirs`. Uses
    a chunk-level diff model: non-overlapping chunk changes auto-merge cleanly,
    while overlapping modifications to the same hunk produce a conflict state
    requiring manual resolution. Counters: `commits`, `ancestor_dist`, `clean_hunks`,
    `conflict_hunks`.

#### Track 06 · Networking & the Web (~6 lessons remaining to ~10)

Currently 4 lessons in `web-requests` (DNS Resolution, The TCP Handshake, HTTP
Request & Response, Keep-Alive & Connection Reuse). To reach ~10 lessons, add:

- Module 2: `http-protocols` (3 lessons, Archetypes A + B):
  - **HTTP/1.1 Pipelining & Head-of-Line Blocking**: FIFO ordering on a single TCP
    stream. A slow dynamic response stalls subsequent fast static requests, forcing
    browsers to open parallel connections.
  - **HTTP/2 Multiplexing & Stream Priorities**: binary framing layer interleaving
    concurrent streams over a single connection. Stream prioritization weights
    bandwidth allocation, but packet loss reveals transport-level HOL blocking.
  - **QUIC & HTTP/3: Independent UDP Streams**: eliminates transport HOL blocking
    by decoupling streams onto UDP. Packet loss on stream 1 halts only stream 1;
    streams 2 and 3 continue unimpeded. Measured across packet drop rates (0%–10%).
- Module 3: `caching-and-security` (3 lessons, Archetype A):
  - **HTTP Caching: Max-Age & Revalidation**: `Cache-Control` directives (`max-age`,
    `s-maxage`, `stale-while-revalidate`). Client vs CDN vs origin server hit rates.
  - **Conditional Requests & ETags**: `If-None-Match` and `If-Modified-Since`.
    Compares full payload transfer (200 OK) against 304 Not Modified 0-byte transfer.
  - **The TLS Handshake: 1-RTT to 0-RTT**: asymmetric key agreement (ECDHE),
    certificate validation, and session key derivation. Demonstrates 1-RTT full
    handshake vs 0-RTT session resumption with replay attack trade-offs.

#### Track 07 · Software Design & Architecture (~7 lessons remaining to ~10)

Currently 3 lessons in `refactoring` (Extract Function, Duplicated Logic, Inline &
Rename on `algo/refactor.ts`). To reach ~10 lessons, expand beyond function-level
metrics into class modularity and coupling:

- In `refactoring` (2 lessons on `refactor.ts`):
  - **Extract Class / Modularity**: splitting an AST node with multiple disparate
    responsibilities into two cohesive units. Measures Lack of Cohesion of Methods
    (LCOM) dropping from high to low.
  - **Replace Conditional with Polymorphism**: converting cascading `switch(type)`
    or `if-else` blocks into polymorphic dispatch. Centralized cyclomatic
    complexity drops to 1 per subclass method.
- Module 2: `modularity-coupling` (3 lessons on Archetype B, `views/DependencyGraphView.tsx`):
  - **Afferent & Efferent Coupling ($C_a, C_e$)**: quantifying incoming dependencies
    ($C_a$) vs outgoing dependencies ($C_e$) across module boundaries as code is reorganized.
  - **Instability & Abstractness ($I, A$)**: computing Instability $I = C_e / (C_a + C_e)$
    and plotting against Martin's Main Sequence ($D = |A + I - 1|$). Demonstrates the
    "Zone of Pain" (concrete and stable) vs "Zone of Uselessness" (abstract and unstable).
  - **Cyclic Dependencies & the Acyclic Dependencies Principle (ADP)**: circular
    import cycles ($A \to B \to C \to A$). Topological sort fails on cycle; introducing
    interface inversion breaks the cycle into a clean DAG.
- Module 3: `architecture-boundaries` (2 lessons on Archetype B + G):
  - **Dependency Inversion & Ports/Adapters**: decoupling domain business entities
    from infrastructure drivers (DB/HTTP) using abstract ports.
  - **The Strangler Fig Pattern**: routing traffic between a legacy monolith and an
    extracted microservice, migrating endpoints incrementally with zero downtime.

#### Track 08 · Engineering Practice (~6 lessons remaining to ~8)

Currently 2 lessons in `on-call` (The Mutex Call, Retry or Back Off on `algo/scenario.ts`).
To reach ~8 lessons, add real incident and resilience scenarios where choices mutate
a running simulation's parameters:

- In `on-call` (3 lessons on Archetype G `scenario.ts` driving real B/A runs):
  - **Thread Pool vs Bounded Queue Sizing**: downstream dependency latency jumps
    10ms → 400ms. Sizing the queue too large hides latency; pool too large causes
    OOM/context switching; fast-reject (shedding) maintains SLA for un-queued callers.
  - **Circuit Breaker Hysteresis**: dependency flaps between healthy and broken.
    Fixed failure threshold vs damped exponential recovery probing.
  - **Zero-Downtime Schema Migration (Expand/Contract)**: column rename/split under
    1,000 writes/sec. 5-step sequence (add nullable → dual-write → backfill → read
    new → drop old). Breaking sequence drops writes or causes lock contention.
- Module 2: `resilience-engineering` (3 lessons on Archetype G + A):
  - **Memory Leak & Buffer Bloat Triage**: heap allocation rate outpaces GC.
    Choosing restart vs throttling vs heap dump capture under impending OOM kill.
  - **Cascading Failure & Thundering Herd**: cache node crashes; cold cache
    thunders against primary database. Cache warm-up vs singleflight request coalescing.
  - **Split-Brain & Partition Healing**: 2-node vs 3-node partition reconciliation.
    Conflict resolution and write loss under inconsistent majority assumptions.

#### Unstarted Track · Security Engineering (~12 lessons)

Security concepts modeled as deterministic state machines and packet flows:

- Module 1: `cryptography` (3 lessons, Archetype B: `algo/crypto.ts`, `views/CryptoView.tsx`):
  - **Hash Functions & Preimage Resistance**: avalanche effect, collision resistance,
    and computational work factor (SHA-256 vs Argon2/bcrypt).
  - **Diffie-Hellman Key Exchange**: modular exponentiation ($g^a \bmod p$); deriving
    shared secrets over an insecure public channel.
  - **Digital Signatures & Asymmetric Auth**: public/private key pairs, signing
    digests, and tamper detection.
- Module 2: `identity-access` (3 lessons, Archetype B / A):
  - **Session Hijacking & Cookie Hardening**: cookie flags (`HttpOnly`, `Secure`,
    `SameSite=Strict/Lax`); session fixation and token rotation.
  - **JWT Anatomy & Validation Pitfalls**: header tampering, the `none` algorithm
    vulnerability, expiry checks, and revocation blocklists.
  - **OAuth 2.0 & OIDC Authorization Code Flow**: redirect URIs, authorization code
    exchange, and PKCE (Proof Key for Code Exchange).
- Module 3: `application-security` (3 lessons, Archetype D + B: `views/SecurityASTView.tsx`):
  - **SQL Injection & AST Parameterization**: string concatenation altering the AST
    vs parameterized queries treating input strictly as literal leaves.
  - **Cross-Site Scripting (XSS) & Contextual Encoding**: injected `<script>`
    payloads in HTML vs DOM contexts; sanitizer rules.
  - **Server-Side Request Forgery (SSRF)**: cloud metadata endpoints (`169.254.169.254`),
    DNS rebinding, and IP allowlist validation.
- Module 4: `defense-in-depth` (3 lessons, Archetype A + B):
  - **RBAC vs ABAC Policy Evaluation**: role hierarchies vs attribute rule
    evaluation; horizontal/vertical privilege escalation.
  - **Rate Limiting & Credential Stuffing Defense**: IP vs username token buckets,
    progressive backoff, CAPTCHA escalation.
  - **mTLS & Zero-Trust Service Identity**: mutual certificate verification between
    microservices; eliminating perimeter-only trust.

#### Unstarted Track · Languages & Runtimes (~12 lessons)

Execution and memory models on Archetype B (`algo/runtime.ts`, `views/RuntimeView.tsx`,
`views/GcView.tsx`):

- Module 1: `parsing-execution` (4 lessons, Archetype B):
  - **Lexical Analysis & Token Streams**: scanning source code into discrete token
    streams; handling delimiters, keywords, and string literals.
  - **Recursive Descent Parsing & Precedence**: parsing tokens into an abstract
    syntax tree using operator precedence climbing.
  - **Tree-Walking Interpreter vs Bytecode VM**: direct AST node traversal vs
    linear bytecode instruction dispatch (stack VM).
  - **The Call Stack & Stack Frames**: activation frames, local variable offsets,
    return pointers, and stack overflow under unbounded recursion.
- Module 2: `memory-management` (4 lessons, Archetype B: `views/GcView.tsx`):
  - **Reference Counting & Cycle Traps**: bumping ref counts on assignment, immediate
    deallocation on zero; cyclic references leaking memory.
  - **Mark-and-Sweep Garbage Collection**: root set traversal (registers, stack,
    globals), mark bit propagation, and sweeping unvisited heap allocations.
  - **Stop-the-World vs Incremental GC**: pacing GC collection phases to bound
    stop-the-world pause latency vs mutator throughput.
  - **Generational GC & Write Barriers**: young vs old generation; weak generational
    hypothesis; card tables and write barrier tracking.
- Module 3: `runtime-systems` (4 lessons, Archetype B):
  - **The Event Loop & Task Queues**: execution order of call stack, macrotasks
    (timers, I/O), and microtasks (promises); microtask queue starvation.
  - **JIT Profiling & Tiered Compilation**: interpreter execution profiling hot loops;
    compiling to optimized native code via inline caches.
  - **Deoptimization Bailouts**: speculative type assumptions violated by polymorphic
    inputs; deoptimizing back to interpreted bytecode.
  - **Virtual Method Tables (Vtables)**: static dispatch vs dynamic dispatch through
    class vtable pointers; interface lookup overhead.

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
3. **Tier 3 · Build bespoke views for Track 03 storage topics (~2 lessons)**:
   - Implement `algo/storage.ts` + `views/StorageView.tsx` (B-Tree vs LSM write/read amplification).
   - Implement `algo/query_plan.ts` + `views/QueryPlanView.tsx` (clustered vs secondary index seek/scan tipping point).
   - This completes Track 03 Databases & Transactions at ~11 lessons.
4. **Tier 4 · Extend Tracks 07 and 08 on resolved archetypes F and G (~13 lessons)**:
   - Archetypes F (`refactor.ts`) and G (`scenario.ts`) are proven and screenshot-verified.
   - *Track 07 (~7 lessons):* Add Extract Class and Replace Conditional with Polymorphism to `refactoring`; build `views/DependencyGraphView.tsx` for `modularity-coupling` ($C_a, C_e, I, A$ metrics and ADP cycle detection); add Ports/Adapters and Strangler Fig to `architecture-boundaries`.
   - *Track 08 (~6 lessons):* Add Thread Pool Sizing, Circuit Breaker Hysteresis, and Zero-Downtime Migration to `on-call`; add Memory Leaks, Cascading Herd, and Split-Brain to `resilience-engineering`.
5. **Tier 5 · Open Track 11 Operating Systems (~12 lessons)**:
   - Highly mechanical and natural fit for Archetype B discrete steps and C scheduler.
   - Build `views/PagingView.tsx` (Virtual Memory: page tables, TLB hits/misses, page faults, LRU/CLOCK).
   - Build `views/SchedulerView.tsx` (CPU Scheduling: Round-Robin quantum sizing, MLFQ aging, Mars Pathfinder priority inversion).
   - Build file system journaling and syscall context-switch lessons.
6. **Tier 6 · Open Track 10 Languages & Runtimes (~12 lessons)**:
   - Pure discrete steps on Archetype B.
   - Build `views/RuntimeView.tsx` (call stack frames, bytecode execution vs AST walking).
   - Build `views/GcView.tsx` (Reference counting cycles, Mark-and-Sweep, stop-the-world pauses, Generational write barriers).
   - Build runtime systems lessons (event loop microtasks, JIT inline cache profiling and deopt traps).
7. **Tier 7 · Open Track 09 Security Engineering (~12 lessons)**:
   - Builds on Archetypes B, A, and D.
   - Build `views/CryptoView.tsx` (preimage resistance, Diffie-Hellman modular math, asymmetric signatures).
   - Build `views/SecurityASTView.tsx` (SQL injection AST leaf vs operator mutation, XSS context sanitization, SSRF metadata bypass).
   - Add identity lessons (cookies/SameSite, JWT validation flaws, OAuth2 PKCE) and defensive architecture (RBAC/ABAC, mTLS zero-trust).

**Track 01 is effectively finished** at 31 lessons against an estimate of 26. Of
its original addition list only **API design** and **sagas with compensation**
remain, and neither is a natural packet-engine subject — API design is about
contracts rather than flows, and a saga needs compensating actions the engine has
no vocabulary for. Leave the track as it stands.

**Debt to clear opportunistically alongside curriculum work**:
- **D10 (Visual suite):** Run `E2E (full sweep)` workflow with `regen_visual: true` to generate Linux baselines post-phosphor pass, commit PNGs, and enable `PW_VISUAL=1` in CI.
- **D2 (Rendering tests):** Add jsdom environment and React Testing Library to cover `useHydrated`, drawer, and focus traps without requiring full Playwright builds.
- **D5 (Git history):** Request owner approval for git history rewrite to purge `.mimosa/` and 14.7 MB PNG.
