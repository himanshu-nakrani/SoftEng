import { allLessons, getLesson, lessonPath } from "@/lib/curriculum";

export type LearningRelation = "builds on" | "connects to" | "leads to";

export interface LearningGuide {
  /** The question the learner should be able to answer after the lesson. */
  question: string;
  /** The causal change the simulation makes visible. */
  changed: string;
  /** Why the change matters in a real system. */
  why: string;
  /** A concrete next manipulation or comparison to try. */
  tryNext: string;
  /** Lessons that form the nearest conceptual neighborhood. */
  related: Array<{ slug: string; relation: LearningRelation }>;
}

const guide = (
  question: string,
  changed: string,
  why: string,
  tryNext: string,
  related: Array<{ slug: string; relation: LearningRelation }>,
): LearningGuide => ({ question, changed, why, tryNext, related });

/**
 * The UI uses one small authored learning lens per lesson rather than trying
 * to infer pedagogy from titles. Keeping this data outside the lesson engines
 * preserves deterministic simulation contracts and gives the lesson shell a
 * single, reviewable source for its summary and concept bridges.
 */
export const learningGuides: Record<string, LearningGuide> = {
  "client-server": guide(
    "What does one request actually travel through?",
    "A request leaves the client, waits in a queue, reaches the server, and returns as a response.",
    "Every later scaling and resilience decision changes one part of this path; if the path is vague, the failure is vague too.",
    "Raise arrival rate until the queue grows, then identify the first bottleneck before adding capacity.",
    [
      { slug: "scaling-strategies", relation: "leads to" },
      { slug: "load-balancing", relation: "leads to" },
    ],
  ),
  "scaling-strategies": guide(
    "Where should capacity live when one machine becomes a failure domain?",
    "The same total capacity is concentrated in one large machine or distributed across smaller machines.",
    "Horizontal capacity trades simple deployment for graceful degradation and a coordination problem.",
    "Switch strategies immediately before the scripted failure and compare live capacity, not just total capacity.",
    [
      { slug: "client-server", relation: "builds on" },
      { slug: "load-balancing", relation: "leads to" },
      { slug: "sharding", relation: "connects to" },
    ],
  ),
  "load-balancing": guide(
    "Who decides which healthy machine receives the next request?",
    "Routing policy changes how load concentrates, and health checks remove dead capacity from the decision.",
    "A fleet is only as resilient as the routing layer that knows which part of it can still serve.",
    "Try the same traffic with round-robin and least-connections, then remove one server and watch the policy adapt.",
    [
      { slug: "scaling-strategies", relation: "builds on" },
      { slug: "circuit-breaker", relation: "connects to" },
      { slug: "rate-limiting", relation: "connects to" },
    ],
  ),
  autoscaling: guide(
    "What happens when demand rises faster than capacity can boot?",
    "The controller reacts to a trend, but provisioned capacity arrives after the spike has already done damage.",
    "Autoscaling absorbs sustained pressure; it is not a time machine for sudden bursts.",
    "Shorten the provisioning lag and compare dropped work during the same spike.",
    [
      { slug: "load-balancing", relation: "builds on" },
      { slug: "rate-limiting", relation: "connects to" },
      { slug: "tail-latency", relation: "connects to" },
    ],
  ),
  "realtime-delivery": guide(
    "Which delivery model pays for freshness, connection state, and reconnects?",
    "Polling, long-polling, and WebSockets move cost between client chatter, server state, and restart behavior.",
    "Realtime is a systems trade-off, not a single protocol choice; the failure mode changes with the transport.",
    "Choose a transport, restart the server, and compare the recovery burst with steady-state request cost.",
    [
      { slug: "client-server", relation: "builds on" },
      { slug: "message-queues", relation: "connects to" },
    ],
  ),
  caching: guide(
    "When does a cache turn a slow dependency into a fast path?",
    "Hits avoid the database, while TTL and capacity decide how often the fast path remains fresh.",
    "Caching improves latency by changing where work happens, but it introduces freshness and invalidation decisions.",
    "Increase traffic, then adjust TTL and capacity separately so you can see which knob changes hit ratio.",
    [
      { slug: "client-server", relation: "builds on" },
      { slug: "cache-stampede", relation: "leads to" },
      { slug: "cdn-edge", relation: "leads to" },
    ],
  ),
  "cache-stampede": guide(
    "Why can one expired key overload a healthy database?",
    "Many callers discover the same miss at once and duplicate the refill work unless requests are coalesced.",
    "A cache failure can amplify demand precisely when the dependency has the least spare capacity.",
    "Expire the hot key with and without single-flight protection, then compare duplicate fetches.",
    [
      { slug: "caching", relation: "builds on" },
      { slug: "retries-timeouts", relation: "connects to" },
    ],
  ),
  "cdn-edge": guide(
    "How much origin work disappears when content moves near the user?",
    "Regional edges serve warm copies, but dynamic content and regional failures still route work back toward origin.",
    "Edge caching lowers distance and origin load while making staleness and invalidation visible system concerns.",
    "Kill the origin after warming the edges, then change cacheability and observe which requests remain exposed.",
    [
      { slug: "caching", relation: "builds on" },
      { slug: "geo-replication", relation: "connects to" },
    ],
  ),
  replication: guide(
    "What does a follower know, and when does it know it?",
    "Writes commit at a leader while replicas catch up, creating a measurable window for stale reads.",
    "Replication improves read capacity and failure recovery but makes time part of the consistency contract.",
    "Increase propagation lag, issue a read immediately after a write, and identify the stale-read window.",
    [
      { slug: "caching", relation: "builds on" },
      { slug: "cap-theorem", relation: "leads to" },
      { slug: "geo-replication", relation: "leads to" },
    ],
  ),
  sharding: guide(
    "What breaks when a keyspace is divided across more owners?",
    "Hash-based routing sends keys to slices, but changing the shard count remaps most of the keyspace.",
    "Sharding raises capacity by splitting ownership; scale-out is paid for in movement, hotspots, and routing complexity.",
    "Add a shard and count remapped keys before comparing the result with a consistent-hash ring.",
    [
      { slug: "consistent-hashing", relation: "leads to" },
      { slug: "replication", relation: "connects to" },
      { slug: "fanout", relation: "connects to" },
    ],
  ),
  "consistent-hashing": guide(
    "How can a ring make adding capacity less disruptive?",
    "Ownership moves only around the changed node’s neighbors instead of remapping every key.",
    "The ring turns a global reshuffle into a local remap, though uneven ownership still needs virtual nodes.",
    "Remove a node, then add virtual nodes and compare ownership balance with the same failure.",
    [
      { slug: "sharding", relation: "builds on" },
      { slug: "load-balancing", relation: "connects to" },
    ],
  ),
  "tail-latency": guide(
    "Why can a good average still feel slow?",
    "A small number of slow legs dominate the p95 and p99, especially when one request fans out to many dependencies.",
    "Users experience the slow tail, not the average; fan-out multiplies the chance that one dependency sets the deadline.",
    "Increase fan-out and test selective hedging, watching p99 against extra work.",
    [
      { slug: "load-balancing", relation: "builds on" },
      { slug: "retries-timeouts", relation: "leads to" },
      { slug: "metrics-logs-traces", relation: "leads to" },
    ],
  ),
  "retries-timeouts": guide(
    "When does a helpful retry become more load on the outage?",
    "Timeout thresholds and retry policy feed back into downstream pressure, while backoff and jitter spread recovery.",
    "Recovery is a system behavior: clients can keep a dependency unhealthy after the original fault is gone.",
    "Shorten the timeout during an outage, then add jitter and compare the recovery curve.",
    [
      { slug: "tail-latency", relation: "builds on" },
      { slug: "circuit-breaker", relation: "leads to" },
      { slug: "cache-stampede", relation: "connects to" },
    ],
  ),
  "circuit-breaker": guide(
    "How can failing fast protect a dependency and its callers?",
    "The breaker moves from forwarding to open fast-fail, then permits a controlled half-open probe.",
    "A breaker contains feedback loops, but recovery still needs a cautious test that does not reopen the floodgate.",
    "Trip the breaker, wait for half-open, and compare fast-fail cost with a closed circuit during the same outage.",
    [
      { slug: "retries-timeouts", relation: "builds on" },
      { slug: "incident-triage", relation: "leads to" },
    ],
  ),
  "metrics-logs-traces": guide(
    "Which signal tells you where a slow request actually spent time?",
    "Metrics show the shape, logs show the event, and traces connect the request to the dependency span.",
    "Observability is triangulation: one signal alerts, another explains, and the trace gives the path to act on.",
    "Start with the slow metric, follow the trace, then use the log to confirm the dependency failure.",
    [
      { slug: "tail-latency", relation: "builds on" },
      { slug: "slos-error-budgets", relation: "leads to" },
      { slug: "incident-triage", relation: "leads to" },
    ],
  ),
  "slos-error-budgets": guide(
    "When should reliability stop a release?",
    "An SLO turns user-visible failure into a budget whose burn rate can constrain rollout speed.",
    "The budget makes reliability a decision rule instead of a vague aspiration or a post-incident argument.",
    "Trigger a rollout burn, then pause it at the threshold and compare remaining budget with release velocity.",
    [
      { slug: "metrics-logs-traces", relation: "builds on" },
      { slug: "incident-triage", relation: "leads to" },
    ],
  ),
  "incident-triage": guide(
    "Which intervention stops a failure from feeding itself?",
    "A dependency timeout creates retry load, and backoff plus load shedding breaks the feedback loop.",
    "Triage is not just finding the first error; it is reducing the blast radius while evidence remains clear.",
    "Apply backoff first, then shed load, and observe which action changes downstream pressure sooner.",
    [
      { slug: "metrics-logs-traces", relation: "builds on" },
      { slug: "circuit-breaker", relation: "builds on" },
      { slug: "slos-error-budgets", relation: "connects to" },
    ],
  ),
  "rate-limiting": guide(
    "How do you reject work before it becomes downstream damage?",
    "A token bucket admits bursts while refill rate defines sustained capacity and rejection becomes an intentional policy.",
    "A limit protects the system by converting overload into a bounded, visible response at the edge.",
    "Spend the bucket with a burst, then change refill rate and distinguish policy rejection from dependency failure.",
    [
      { slug: "load-balancing", relation: "builds on" },
      { slug: "message-queues", relation: "leads to" },
      { slug: "autoscaling", relation: "connects to" },
    ],
  ),
  "message-queues": guide(
    "What does a buffer buy when producers outrun consumers?",
    "The queue absorbs a burst, but backlog and bounded capacity expose the gap between arrival rate and drain rate.",
    "Queues decouple timing, not volume; they trade immediate failure for latency, storage pressure, and eventual drain work.",
    "Pause the consumer mid-deploy, fill the queue, and change drain rate to find the recovery boundary.",
    [
      { slug: "rate-limiting", relation: "builds on" },
      { slug: "delivery-guarantees", relation: "leads to" },
      { slug: "fanout", relation: "connects to" },
    ],
  ),
  "delivery-guarantees": guide(
    "What is the cost of acknowledging work at the wrong moment?",
    "A crash between side effect and acknowledgement creates redelivery and duplicates unless the consumer is idempotent.",
    "Delivery semantics are business semantics: a duplicate charge is not the same as a duplicate metric.",
    "Crash after the side effect, then add an idempotency key and compare duplicate outcomes.",
    [
      { slug: "message-queues", relation: "builds on" },
      { slug: "retries-timeouts", relation: "connects to" },
      { slug: "two-phase-commit", relation: "connects to" },
    ],
  ),
  fanout: guide(
    "Where should work happen when one author has millions of readers?",
    "Push makes reads cheap but expands writes, while pull moves cost to read time and hybrid policies reserve special handling.",
    "Fan-out is a placement decision: pay once at write, repeatedly at read, or selectively at both.",
    "Raise follower count for a celebrity post, then switch to hybrid and compare freshness against backlog.",
    [
      { slug: "message-queues", relation: "builds on" },
      { slug: "sharding", relation: "connects to" },
    ],
  ),
  "cap-theorem": guide(
    "What do you preserve when communication between replicas breaks?",
    "During a partition, CP rejects some writes while AP continues and must reconcile divergent state later.",
    "Partition tolerance is not a choice; the design choice is which user-visible guarantee gives way.",
    "Drag a partition through the system, compare CP and AP, and inspect what reconciliation cannot recover.",
    [
      { slug: "replication", relation: "builds on" },
      { slug: "leader-election", relation: "leads to" },
      { slug: "geo-replication", relation: "leads to" },
    ],
  ),
  "leader-election": guide(
    "What keeps one writer authoritative when nodes disappear?",
    "Heartbeats detect leader loss, votes restore a leader when quorum survives, and quorum loss stops writes safely.",
    "Consensus availability depends on the number of surviving voices, not merely the number of surviving processes.",
    "Kill the leader, then remove another voter and compare election recovery with quorum loss.",
    [
      { slug: "replication", relation: "builds on" },
      { slug: "cap-theorem", relation: "builds on" },
      { slug: "gossip", relation: "leads to" },
    ],
  ),
  gossip: guide(
    "How can a cluster converge without a leader or broadcast?",
    "Each node shares a rumor with a few peers, and repeated local exchanges produce global convergence.",
    "Gossip trades immediate certainty for scalable dissemination and tolerance of holes in the network.",
    "Start one rumor, remove nodes mid-spread, and compare convergence with a changed fan-out factor.",
    [
      { slug: "leader-election", relation: "builds on" },
      { slug: "message-queues", relation: "connects to" },
    ],
  ),
  "two-phase-commit": guide(
    "Why can unanimous agreement still block a system?",
    "Participants prepare and hold locks while the coordinator collects votes; coordinator loss leaves them unable to decide.",
    "Atomic commit buys all-or-nothing state at the cost of coordination overhead and a blocking failure mode.",
    "Kill the coordinator after prepare, then restore it and measure lock-holding time before the commit completes.",
    [
      { slug: "cap-theorem", relation: "builds on" },
      { slug: "delivery-guarantees", relation: "connects to" },
    ],
  ),
  "geo-replication": guide(
    "How do distance and conflict shape a multi-region write path?",
    "Local writes are fast but converge later; single-primary writes coordinate farther away and pay latency for consistency.",
    "Geography turns network delay into product behavior: conflict, freshness, and failover are coupled choices.",
    "Write in both regions, then switch to single-primary and compare conflict cost with write latency.",
    [
      { slug: "replication", relation: "builds on" },
      { slug: "cap-theorem", relation: "builds on" },
      { slug: "cdn-edge", relation: "connects to" },
    ],
  ),

  /* ---- track 02 · concurrency ---- */

  "data-races": guide(
    "Why can three threads each add one and the total still be two?",
    "One increment split into read, add and write, with the scheduler free to cut between any two of them.",
    "A data race is not a bug in the code you are reading — it is a bug in the order you did not choose, which is why it survives review and passes tests.",
    "Reseed until an update is lost, then step backward to the frame where two threads held the same value.",
    [{ slug: "deadlock", relation: "leads to" }],
  ),
  deadlock: guide(
    "If every critical section is locked correctly, what is left to go wrong?",
    "Two threads each hold one lock and wait for the other, so the run stops with both threads alive and neither progressing.",
    "Deadlock is not missing synchronisation — it is a cycle in who waits for whom, which is why adding locks can cause it and a global acquisition order removes it.",
    "Reseed until it hangs, then compare against the ordered-lock figure and watch the lock waits stay non-zero while the cycle disappears.",
    [{ slug: "data-races", relation: "builds on" }],
  ),
  "atomic-operations": guide(
    "Can a counter be correct without ever blocking a thread?",
    "The write becomes conditional: a thread that lost the race is refused and loops, instead of overwriting silently.",
    "Atomics move the cost from waiting to wasted work, and they are what locks are built from — which is why a spin lock is just test-and-set plus a retry.",
    "Raise the thread count and watch failed attempts climb, then compare the same count against the spin-lock figure.",
    [
      { slug: "data-races", relation: "builds on" },
      { slug: "deadlock", relation: "connects to" },
    ],
  ),
  "producer-consumer": guide(
    "How do two threads at different speeds hand work to each other?",
    "A bounded buffer absorbs the difference, and each side parks on a condition — full for the producer, empty for the consumer.",
    "Capacity buys independence rather than throughput, and a full queue is not a failure: it is the slow end setting the pace, which is what backpressure means.",
    "Compare capacity 1 against 4, then make the consumer slow and watch which thread blocks more often.",
    [
      { slug: "message-queues", relation: "connects to" },
      { slug: "data-races", relation: "builds on" },
    ],
  ),
  "lock-granularity": guide(
    "How much of the program should one lock speak for?",
    "Threads that share no data still queue behind a single lock, and blocked turns grow with the square of the threads sharing it.",
    "Granularity trades throughput against reasoning cost: one lock cannot deadlock, and every lock you add multiplies the orderings you must get right.",
    "Compare blocked turns at 2, 4 and 6 threads under one lock, then split the lock and watch the same work block a quarter as often.",
    [
      { slug: "deadlock", relation: "builds on" },
      { slug: "atomic-operations", relation: "connects to" },
    ],
  ),
  "read-write-locks": guide(
    "Why should two threads that only read ever wait for each other?",
    "Shared mode lets every reader in at once while the writer waits for an empty room, so blocking stops growing with the reader count.",
    "A read-write lock is a protocol over ordinary shared state, not a primitive — and its cost is more state to get right plus the risk of starving the writer.",
    "Raise the reader count and watch blocked turns stay flat, then run the same threads under one exclusive lock and watch them grow.",
    [{ slug: "lock-granularity", relation: "builds on" }],
  ),
  "memory-visibility": guide(
    "Can two threads disagree about which write happened first?",
    "A store sits in a buffer until it is flushed, so both threads can read zero and each conclude it went first.",
    "This is a visibility bug, not a race: every variable has a single writer, so there is nothing to exclude — what is missing is an ordering both threads agree on.",
    "Shuffle until both r1 and r2 read zero, then step backward to the frame where both reads preceded both flushes.",
    [
      { slug: "atomic-operations", relation: "builds on" },
      { slug: "data-races", relation: "builds on" },
    ],
  ),
  "false-sharing": guide(
    "Why would two threads writing different variables slow each other down?",
    "The cache line, not the variable, is the unit of ownership — so neighbouring variables force cores to hand the line back and forth.",
    "It is a layout defect rather than a logic one: the results stay correct, so it survives review and appears only as a program that will not speed up.",
    "Watch the line owner flip between cores, then compare transfer counts against the padded version.",
    [{ slug: "memory-visibility", relation: "builds on" }],
  ),
  "thread-pools": guide(
    "If two connections serve two queries at a time, what do six threads buy?",
    "The same work and the same operation count, with four threads blocked waiting for a connection instead of a pool of two that never waits.",
    "Capacity belongs to the resource, not the threads: extra threads move the queue somewhere nobody measures, which is why a pool is sized to what it protects.",
    "Raise the request count and watch blocking grow, then run the identical work through a pool and watch it fall to zero.",
    [
      { slug: "producer-consumer", relation: "builds on" },
      { slug: "message-queues", relation: "connects to" },
    ],
  ),
  "dirty-reads": guide(
    "Can a query return a number that no transaction ever committed?",
    "A reader sees another transaction's half-finished writes, then that transaction rolls back and the value it read stops having ever existed.",
    "Atomicity promises nobody observes the middle of a transaction; isolation level decides whether that promise is kept, and the weakest level does not keep it.",
    "Shuffle until the report reads 150 or 250, then step to the rollback and watch the pending values vanish while the reported number does not.",
    [],
  ),
  "non-repeatable-reads": guide(
    "Can two correct reads of committed data still add up to a wrong answer?",
    "A commit lands between the transaction's two reads, so it sees one row before and the other after.",
    "Read committed promises each read sees committed data, not that two reads see the same moment — a consistent point of view is a separate guarantee, and it is what a snapshot buys.",
    "Shuffle until the report reads 250, then step back to find the commit landing between the two reads.",
    [{ slug: "dirty-reads", relation: "builds on" }],
  ),
  "write-skew": guide(
    "Can two correct transactions break a rule neither of them broke?",
    "Each reads the other's row from its own snapshot, decides it is safe to act, and writes only its own — so nothing overwrites anything and the invariant still fails.",
    "The conflict is between one transaction's reads and another's writes, which a snapshot is designed to hide — so serializable is a different promise rather than a stricter snapshot, and it charges for it in refused commits.",
    "Watch both commit and leave nobody on call, then run the same program at serializable and see one commit refused.",
    [{ slug: "non-repeatable-reads", relation: "builds on" }],
  ),
  "lost-update": guide(
    "Where does an update go when two transactions both read before either writes?",
    "Both compute from the same starting value and the second write overwrites the first, so one update is gone and no error is reported.",
    "Serializable does not fix it — it refuses one commit instead, turning a silently wrong number into a visible error the application must retry.",
    "Shuffle until the balance lands on 150 or 70, then run the same program at serializable and watch a commit refused on exactly those runs.",
    [
      { slug: "write-skew", relation: "builds on" },
      { slug: "data-races", relation: "connects to" },
    ],
  ),
  "two-phase-locking": guide(
    "If serializable refuses a commit, why not make the other transaction wait instead?",
    "A lock taken at the read and held until commit makes the second transaction wait, so both succeed and nothing is discarded.",
    "Serializable names a guarantee, not a mechanism: optimistic enforcement pays in wasted work and retries, pessimistic pays in blocking — and which is cheaper depends on whether your transactions actually conflict.",
    "Compare how many runs commit both transactions under each mechanism, and watch a lane wait for the balance row instead of failing.",
    [
      { slug: "lost-update", relation: "builds on" },
      { slug: "lock-granularity", relation: "connects to" },
    ],
  ),
  "write-ahead-logging": guide(
    "A commit returns, and the power fails a moment later. What made the promise true?",
    "Appending a record before each change, and forcing only that log at commit, makes every crash point recoverable — where writing pages alone loses acknowledged work at five of eight.",
    "Durability is not a property of the convenient moment; it is a claim about every moment. One sequential force can make any number of scattered pages recoverable, which is why the log exists — and the ordering rule is what makes the log trustworthy, because a record written after its change has already lost the before-image undo needs.",
    "Drag the crash point across the whole range under both policies and compare the verdict, then watch the records-applied counter fall as pages reach disk on their own.",
    [
      { slug: "dirty-reads", relation: "builds on" },
      { slug: "two-phase-locking", relation: "connects to" },
    ],
  ),
  "checkpoints": guide(
    "Recovery replays the log from the beginning. What stops that from growing without limit?",
    "Forcing every dirty page and recording that you did lets redo start at the checkpoint instead of at the start of the log — 5 records considered instead of 8, bought with 3 page writes while nothing was wrong.",
    "Checkpointing moves recovery work out of the crash and into normal running, which is why the interval is a tuning knob and not a setting with a right answer. It is also not a pure saving: a checkpoint forces uncommitted pages too, so it shortens redo while creating undo work — and undo cannot use the same floor, because a transaction running before the checkpoint is still running after it.",
    "Compare the scan counter across crash points on both figures, then find the record undo reaches for and check its LSN against the checkpoint's.",
    [
      { slug: "write-ahead-logging", relation: "builds on" },
      { slug: "two-phase-locking", relation: "connects to" },
    ],
  ),
  "group-commit": guide(
    "A commit costs one sequential force. At ten thousand commits a second, is it one force each?",
    "Letting commit records accumulate and forcing them together answered three transactions with one fsync instead of three, for the same six log records.",
    "Grouping is not a durability compromise, and that is the point most easily got wrong: a transaction whose commit record has been appended but not forced was never acknowledged, so a crash there breaks no promise. What is actually traded is latency — T1 is answered five crash points later than it would have been. The one thing that must never be batched is the answer itself.",
    "Stop at crash 6 on the batched figure and read the transaction rows: three of them committing, and an empty durable prefix. Then compare the forces meter with the other figure.",
    [
      { slug: "write-ahead-logging", relation: "builds on" },
      { slug: "checkpoints", relation: "connects to" },
    ],
  ),
  "coverage-vs-correctness": guide(
    "If a coverage report says 100%, does that mean the tests would catch a bug?",
    "Two suites with identical line coverage disagree completely: weak assertions kill 0 of 6 mutants, exact assertions kill all 6.",
    "Coverage measures whether a line ran, not whether any test asserts the right result. A surviving mutant names a specific change your suite sleeps through, which is a thing you can act on — a percentage is not.",
    "Read the survivor list rather than the percentage, then move on to boundary-mutants, where the assertions are exact and the inputs still miss.",
    [],
  ),
  "boundary-mutants": guide(
    "If my tests assert the exact right answer, can an off-by-one still slip through?",
    "Exact-assertion tests that sample the middle of a range let 4 of 5 boundary mutants survive; the same assertions moved onto the edge kill all 5.",
    "A boundary bug is wrong at exactly one value, so a range of inputs is not a range of behaviours. The decisions live only at the edges, and a test that never visits one cannot see them however strictly it asserts.",
    "Aim tests at the edge and the two values bracketing it rather than the comfortable middle.",
    [{ slug: "coverage-vs-correctness", relation: "builds on" }],
  ),
  "merge-vs-rebase": guide(
    "You integrate a feature branch — does git keep your commits, or replace them?",
    "Merge added one two-parent commit over four preserved commits, five in total with nothing orphaned; rebase copied the two feature commits onto a new base, six in total, and left the originals unreachable.",
    "A linear history is bought by rewriting. The commits you had are replaced by copies with new ids, which is exactly why rebasing history someone else has already pulled takes their work out from under them.",
    "Watch the two originals turn red and dashed after the rebase, then ask what happens to a teammate who had based work on one of them.",
    [],
  ),
  "fast-forward": guide(
    "You run git merge and expect a merge commit — why do you sometimes get nothing new?",
    "With the feature branch merely ahead of an unmoved trunk, merge fast-forwarded and created no commit at all; once the trunk gained a single commit of its own, the same command produced a two-parent merge commit.",
    "git merge promises to integrate, not to make a commit. It slides a pointer when history is already linear and only records a merge when the branches have genuinely diverged — so the shape of your history is decided by what everyone else did, not by what you typed.",
    "Add or remove one commit on the trunk before merging and watch the merge commit appear and vanish.",
    [{ slug: "merge-vs-rebase", relation: "builds on" }],
  ),
  "load-shedding": guide(
    "When a server is overloaded, is it better to queue every request or to refuse some?",
    "Accepting everything into a growing queue pushed the wait past the deadline, so the server ran at 100% while useful answers froze at 21; admission control settled the queue near 17, held the wait around 1400ms, and let useful answers climb past 160.",
    "High utilisation is not throughput. A queue only adds waiting, and past the deadline it drives useful work to zero — so shedding trades refused requests for fast answers to the ones you keep. Note the vocabulary: a policy refusal is a REJECT, a capacity loss is a DROP, and they mean different things to whoever is paged.",
    "Kill api-1 and watch the counter move to dropped rather than rejected — a dead box has lost capacity, it is not applying a policy.",
    [{ slug: "tail-latency", relation: "builds on" }],
  ),
  "equivalent-mutants": guide(
    "If a mutant survives every test, is it always a bug you can fix?",
    "One suite now holds both kinds of survivor: real holes, and equivalent mutants that compute the identical answer for every input and so can never be killed.",
    "A mutation score has a floor set by its unkillable mutants, so 100% is the wrong target. The useful output is not the percentage but the survivor list, split into work you can do and equivalents you should leave alone — and deciding which is which is undecidable in general, so it stays a judgement.",
    "Complete the suite and watch the score plateau at 60%: the two survivors left are exactly the equivalent mutants.",
    [{ slug: "coverage-vs-correctness", relation: "builds on" }],
  ),
};

export function getLearningGuide(slug: string): LearningGuide {
  return (
    learningGuides[slug] ?? {
      question: "What changed in this system?",
      changed: "The experiment makes one causal relationship visible.",
      why: "Naming the relationship helps you carry the lesson into the next design decision.",
      tryNext: "Change one control, observe the consequence, and explain the path in your own words.",
      related: [],
    }
  );
}

export function validateLearningGuides(): string[] {
  const available = new Set(allLessons.map((lesson) => lesson.slug));
  const errors: string[] = [];
  for (const lesson of allLessons) {
    if (!learningGuides[lesson.slug]) errors.push(`missing guide: ${lesson.slug}`);
  }
  for (const [slug, item] of Object.entries(learningGuides)) {
    if (!available.has(slug)) errors.push(`guide points to unavailable lesson: ${slug}`);
    for (const link of item.related) {
      if (!available.has(link.slug)) {
        errors.push(`${slug} links to unavailable lesson: ${link.slug}`);
      }
    }
  }
  return errors;
}

export function learningLinks(slug: string) {
  return getLearningGuide(slug).related.flatMap((link) => {
    const lesson = getLesson(link.slug);
    return lesson ? [{ ...link, lesson, href: lessonPath(lesson) }] : [];
  });
}
