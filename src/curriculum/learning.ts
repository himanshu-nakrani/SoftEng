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
  "quorums": guide(
    "How can a replicated system return a correct answer without waiting for every replica?",
    "A write now returns after only W of N replicas ack and a read consults only R, so neither blocks on the slowest node — but a read set and a write set drawn from the same N can miss each other entirely.",
    "One inequality decides correctness: R + W > N forces every read set to overlap every write set, so a read cannot miss the newest committed write. At or below N the sets can be disjoint and reads go stale — and it is the SUM you choose, not the split, that decides correctness, while the split decides which side pays the latency.",
    "Hold R + W > N and slide the split: W=1 R=5 makes writes cheap, W=5 R=1 makes reads cheap, and both stay at 0% stale. Then kill replicas below W and watch writes get rejected.",
    [{ slug: "replication", relation: "builds on" }],
  ),
  "bulkheads": guide(
    "When several dependencies share one pool, what happens to the healthy ones if a single dependency slows down?",
    "A call holds its slot for the dependency's whole service time, so a stalled dependency keeps its slots and fills the shared pool; healthy calls then find nothing free and are rejected. Reserving each dependency its own half confines the stall.",
    "Availability becomes coupled across dependencies that have nothing to do with each other: with one pool, the slowest dependency dictates everybody's availability, so an incident in one feature quietly takes down others. A bulkhead moves the blast radius, and it is paid for in utilisation — a reserved slot sits idle when its dependency is quiet.",
    "Turn on isolation, then stall a dependency, and compare the healthy one's throughput against the shared run — then look at what it cost in pool utilisation.",
    [{ slug: "circuit-breaker", relation: "builds on" }],
  ),
  "canary-releases": guide(
    "If a new version is broken, does it matter how many users you gave it to?",
    "Traffic to the new version is a fraction you set, so its errors are bounded to that fraction instead of reaching everyone, and one control takes it back.",
    "A canary turns a bad release from an outage you dig out of into a bounded, reversible signal. The bound is the point: the blast radius is a number you chose in advance rather than one you discover afterwards.",
    "Hold the share at 5% and notice the error rate barely moves — then ask what a slow leak or a rare-input bug would have shown at that share in two minutes, and why a clean canary is a reason to widen rather than a proof it is safe.",
    [],
  ),
  "outbox-pattern": guide(
    "A service commits a row and then publishes an event. What happens if it crashes between the two writes?",
    "The row and an outbox record now commit in one local transaction, and a separate relay publishes the outbox to the broker.",
    "The event can no longer be lost, because it becomes durable at the same instant the data does. A dual write can silently commit a row whose event never arrives, and nothing downstream ever notices — there is no rollback and no retry, just a gap.",
    "In outbox mode, crash the service while the relay is mid-publish: duplicates rise while lost events stays at zero. That is at-least-once, and it is why consumers still need idempotency.",
    [{ slug: "delivery-guarantees", relation: "builds on" }],
  ),
  "distributed-locks": guide(
    "If a lock can expire, what stops a paused holder from writing after someone else has taken over?",
    "The lock became a lease with an expiry, and every grant now carries a monotonic fencing token that the shared store checks before accepting a write.",
    "A GC pause or a descheduled VM can outlive any lease you pick, so two workers can believe they hold the lock at the same time — and no timeout tuning fixes that. Only the store refusing the lower token stops the second writer, which moves safety off the clock entirely.",
    "Turn fencing off and watch the stale write land; turn it on and watch the same write get rejected while the split brain still exists. The two holders do not go away — the damage does.",
    [{ slug: "leader-election", relation: "builds on" }],
  ),
  "blue-green": guide(
    "How does a blue-green deploy trade off against a canary?",
    "The deploy control is a two-position switch rather than a share: cutting over sends every request to green at once, and reverting flips straight back.",
    "Blue-green bounds the TIME a bad version is live, because one atomic flip undoes it — but not the blast radius, because everyone is exposed at once, and it costs a second full fleet. That is the mirror image of a canary, which bounds the radius but exposes users for longer. Neither dominates.",
    "Cut over, watch the error rate hit green's own failure rate for everybody, then revert and note the tail of in-flight requests — then ask why a schema migration makes that revert dangerous.",
    [{ slug: "canary-releases", relation: "builds on" }],
  ),
  "flaky-tests": guide(
    "If the code never changed, why does the suite pass sometimes and fail others?",
    "The flake is reframed as an order-dependence on shared state, replayable from a seed rather than attributable to randomness.",
    "A test that fails half the time trains everyone to ignore it, which hides a bug that is present on every run. Re-running is not a fix, and “retry on failure” in CI is the same non-fix automated. The order was always the variable; nobody had written it down.",
    "Reseed the shared figure until the verdict flips, then give each test its own slot and confirm no order can fail.",
    [{ slug: "coverage-vs-correctness", relation: "builds on" }],
  ),
  "cherry-pick-revert": guide(
    "How do you move or undo a single commit without rewriting a branch everyone else has?",
    "Cherry-pick copies one commit under a new id; revert adds a new commit that inverts an earlier one. Both leave the original in place, which is what separates them from a rebase.",
    "A cherry-picked commit is a DUPLICATE, so the same change arrives a second time when its branch is later merged — one logical change, two commits, often a conflict. Revert is purely additive and therefore safe on published history; the price is that history records both the mistake and its undoing.",
    "Step the cherry-pick figure past the merge and watch the same change land twice, then compare with a rebase, which orphans instead of duplicating.",
    [{ slug: "merge-vs-rebase", relation: "builds on" }],
  ),
  "feature-flags": guide(
    "If the new code is already on every server, what is left to do to release it — and to undo the release?",
    "Releasing became flipping a runtime value rather than deploying a build, so both the release and its undo happen with no deployment at all.",
    "Decoupling deploy from release makes rollback instant and lets you target a chosen cohort by attribute rather than a random share — but every live flag is a permanent branch that must be tested both ways, so N flags mean 2^N configurations of which a suite exercises a handful. A flag that outlives its rollout is debt.",
    "Flip the flag on, kill it and watch the error counter freeze mid-tail, then set it to the beta cohort and compare that blast radius with a canary's random share.",
    [{ slug: "canary-releases", relation: "builds on" }],
  ),
  "test-pollution": guide(
    "If a test passes in the suite but fails when you run it alone, what did it depend on?",
    "A dependent test reads shared state it never set up, so its verdict is decided by whether the seeding test ran before it — reframed as an interleaving, not luck.",
    "This is the asymmetric flake: unlike a collision over one slot, one test quietly leans on another's leftover state. It hides until someone reorders or isolates the suite, and then the depending test fails for a reason nobody changed. Running tests in a random order is the cheapest way to surface a dependence the code refused to declare.",
    "Reseed the polluted figure until the dependent test's assertion falls before the seeding insert, then give it its own setup and confirm no order can fail.",
    [{ slug: "flaky-tests", relation: "builds on" }],
  ),
  "reset": guide(
    "You want a bad commit gone — do you undo it or discard it, and what is the difference?",
    "Reset moves the branch pointer to an earlier commit and creates nothing; the commits ahead of the new tip lose their last reference and go unreachable, unless another branch still holds them.",
    "Reset does not undo the work in the record, it discards the work from the record — no new commit, no id preserved. That makes it the cleanest tool for local cleanup and the same hazard as a rebase on shared history: you take a teammate's base out from under them. Revert is additive and safe to share; reset is destructive and belongs on commits that never left your machine.",
    "Reset back with no safety net and watch two commits turn red and dashed, then set a backup branch first and watch the same reset orphan nothing.",
    [{ slug: "cherry-pick-revert", relation: "builds on" }],
  ),
  "dns-resolution": guide(
    "Why is the first request to a new site slower than the ones after it?",
    "A cold name walks the root, TLD, and authoritative servers in sequence; a cached name is answered by the resolver in one short hop until its TTL lapses.",
    "DNS is the cache in front of the whole web: the TTL is both the grace period during an outage and the staleness you risk on a change — one number read two ways.",
    "Drag the TTL down and watch the authoritative server's load climb, then kill it and count how long cached names keep resolving.",
    [
      { slug: "tcp-handshake", relation: "leads to" },
      { slug: "cdn-edge", relation: "connects to" },
    ],
  ),
  "tcp-handshake": guide(
    "Why does a fresh connection cost a round trip before the request even goes out?",
    "TCP spends one full round trip on a SYN / SYN-ACK / ACK handshake before data may flow, so time-to-first-byte on a new connection is about two RTTs, half of it pure setup.",
    "On a lossy link a dropped setup packet is not noticed until a retransmit timeout — much longer than an RTT — so packet loss wrecks tail connection latency long before it moves the average.",
    "Open connections on a clean link and read time-to-send, then raise the loss slider and watch worst-first-byte jump on the retransmit timeout.",
    [
      { slug: "dns-resolution", relation: "builds on" },
      { slug: "connection-reuse", relation: "leads to" },
      { slug: "retries-timeouts", relation: "connects to" },
    ],
  ),
  "http-request-response": guide(
    "Why does a page with eight small requests take so much longer than one request?",
    "On a single HTTP/1.1 connection requests are served strictly in order, so the page-load time is the SUM of every round trip, not the largest — and a slow response blocks everything queued behind it.",
    "Each extra connection is an independent lane that lets requests overlap, which is why browsers open several per host and why HTTP/2 multiplexing exists to remove the single-lane limit entirely.",
    "Load a page on one connection, then raise the connections slider and watch the page time fall toward the batch divided by the lane count.",
    [
      { slug: "tcp-handshake", relation: "builds on" },
      { slug: "connection-reuse", relation: "leads to" },
      { slug: "message-queues", relation: "connects to" },
    ],
  ),
  "connection-reuse": guide(
    "If opening a connection costs a round trip, why pay it on every request?",
    "A new connection per request pays the handshake every time (~2 RTT); a reused keep-alive connection pays it once, so every request after the first is ~1 RTT — the two strategies tie only on the very first request.",
    "The saving is the setup cost times the number of requests you avoided repeating it on, which is why busy clients keep connection pools of warm connections ready in advance.",
    "Run both clients, then toggle keep-alive off and watch the reused lane converge with the new-connection lane.",
    [
      { slug: "http-request-response", relation: "builds on" },
      { slug: "tcp-handshake", relation: "builds on" },
      { slug: "thread-pools", relation: "connects to" },
    ],
  ),
  "multi-version-reads": guide(
    "How can a reader see a consistent world without blocking the writers changing it?",
    "A row becomes a chain of versions, and a transaction reads the newest one committed before its snapshot — so an old version stays readable beside a newer committed one, and a write-write conflict is refused rather than lost.",
    "It is the machinery behind repeatable read's snapshot: readers never wait for writers, which is why MVCC underpins most production databases — and why write skew still slips through it.",
    "Reshuffle the report until the transfer commits between its two reads and watch it ring the OLD version; then run the conflict figure and confirm the loser is rolled back, never merged.",
    [
      { slug: "non-repeatable-reads", relation: "builds on" },
      { slug: "lost-update", relation: "builds on" },
      { slug: "write-skew", relation: "connects to" },
    ],
  ),
  "extract-function": guide(
    "How do you turn 'this function does too much' into a number that moves?",
    "Lifting a validate block out of a handler drops its cyclomatic complexity from 7 to 2, and a new function takes on 6.",
    "Complexity is folded from the code's structure, so the same restructuring that eases reading also lowers a measurable score — and the module's total decision points are conserved, proving the number is not hand-authored.",
    "Count the tinted decision lines against each function's header, then confirm the module's decision-point total is identical before and after.",
    [{ slug: "duplicated-logic", relation: "leads to" }],
  ),
  "inline-and-rename": guide(
    "Does every refactoring lower a metric?",
    "Inlining an over-thin helper removes a function and a coupling edge; renaming a vague function moves no metric at all.",
    "Structure is a dial, not a ratchet: extraction and inlining are inverse moves, and the most valuable change — a clearer name — is invisible to every number.",
    "Inline the helper and watch fan-out fall, then rename and watch every metric hold while the call sites all update.",
    [{ slug: "extract-function", relation: "builds on" }],
  ),
  "duplicated-logic": guide(
    "What is the difference between extracting a copy and removing one?",
    "Extracting the shared guard once and then reusing it from the second handler drops duplication to 0 and total decision points from 4 to 2.",
    "De-duplication is the one refactoring that reduces total decision points, because a rule that lived in two bodies now lives in one — extracting a second copy would leave duplication untouched.",
    "On the second step, notice the handler gets a call to the shared function rather than a second copy; that reuse is what collapses the duplication.",
    [{ slug: "extract-function", relation: "builds on" }],
  ),
  "the-mutex-call": guide(
    "Does taking the lock actually change what the system does, or just what you say about it?",
    "Choosing 'leave the race' keeps the counter correct in only 54 of 200 interleavings; choosing the mutex keeps it correct in all 200.",
    "The choice sets a real parameter of a real run and the measured outcome diverges — which is what separates an engineering decision worth studying from a quiz with a prose answer.",
    "Move the slider between the two calls and read the measured pass bars, then note that the option you did not pick was measured too.",
    [{ slug: "retry-or-back-off", relation: "leads to" }],
  ),
  "retry-or-back-off": guide(
    "Is it worth imposing one global lock order across teams?",
    "Enforcing A-then-B everywhere completes all 200 runs; letting each team pick its own order deadlocks in about half of them.",
    "The unsafe choice fails intermittently, not always, which is exactly why lock-ordering bugs survive review and testing — a rate measured over 200 seeds makes the risk arguable in numbers.",
    "Slide to opposite orders and watch the completion bar fall to roughly half; the missing runs deadlocked rather than erroring.",
    [{ slug: "the-mutex-call", relation: "builds on" }],
  ),
  "assertion-free-tests": guide(
    "Why can a suite with 100% line coverage fail to catch broken calculations?",
    "A smoke test suite that exercises every line without assertions only catches unhandled crashes, letting every mutated calculation survive.",
    "Line coverage measures only code execution, not verification; catching defects requires asserting the observable outcome.",
    "Compare how the asserted suite catches calculation mutants by verifying output values against expected return states.",
    [{ slug: "equivalent-mutants", relation: "builds on" }],
  ),
  "brittle-mocks": guide(
    "Why do mock-heavy test suites fail when internal code is safely refactored?",
    "Mock assertions couple tests to internal call counts and sequences, creating false alarms on harmless refactorings while missing real output errors.",
    "Verifying observable state decouples tests from implementation details, letting you refactor safely while catching genuine regressions.",
    "Compare how the state verification suite stays green across three refactorings while catching all three calculation bugs.",
    [{ slug: "assertion-free-tests", relation: "builds on" }],
  ),
  "extract-class": guide(
    "How does decomposing a god class change coupling and cohesion across a module?",
    "Extracting receipt formatting from OrderProcessor drops its cyclomatic complexity from 7 to 3 and its fan-out from 5 to 3, while module max fan-out falls from 5 to 3.",
    "Low cohesion is not just an aesthetic flaw; it binds unrelated subsystems together. Extracting a class partitions dependencies so changes to presentation cannot ripple into pricing calculations.",
    "Step forward to extract ReceiptFormatter, then check how OrderProcessor's fan-out drops as its formatting callees migrate to the new class.",
    [{ slug: "extract-function", relation: "builds on" }],
  ),
  "replace-conditional": guide(
    "How do you eliminate cascading switch statements without duplicating branching logic?",
    "Refactoring a type-dispatching switch chain into polymorphic strategy handlers reduces the dispatcher's cyclomatic complexity from 6 to 1, distributing single-responsibility methods of complexity 1.",
    "Centralized conditionals require editing a single hotspot every time a new variant is introduced, violating the Open-Closed Principle; polymorphic dispatch turns type branching into extensible object collaboration.",
    "Step through each strategy extraction, observe the dispatcher shedding decision points as its complexity falls to 1, and verify that adding a new type requires zero edits to existing code.",
    [{ slug: "extract-class", relation: "builds on" }],
  ),
  "thread-pool-sizing": guide(
    "How should a service handle traffic when a downstream dependency slows down by 40x?",
    "Expanding threads thrashes CPU and deep queues explode latency to 30s; keeping a bounded pool of 16 threads and shedding excess preserves a 400ms SLA for all admitted requests across all 200 runs.",
    "Adding threads or queue depth during a downstream slowdown turns latency into an outage; fast rejection with 503 protects system capacity and ensures admitted work completes on time.",
    "Move the slider across the three policies and compare how SLA compliance and latency headlines respond across 200 runs.",
    [{ slug: "the-mutex-call", relation: "builds on" }],
  ),
  "circuit-breaker-hysteresis": guide(
    "How should a circuit breaker reopen when a failing dependency starts to recover?",
    "Immediate reopening crashes fragile dependencies in 0/200 runs and fixed cooldowns waste capacity in 100/200, while rate-ramped probing recovers cleanly in all 200 runs.",
    "Recovering dependencies cannot absorb sudden thundering herds; asymmetric hysteresis damping allows caches and connection pools to warm up safely under controlled probe traffic.",
    "Slide between immediate reopening, fixed cooldown, and half-open probing to observe how rate damping eliminates both flapping loops and artificial downtime.",
    [{ slug: "the-mutex-call", relation: "builds on" }],
  ),
  "zero-downtime-migration": guide(
    "How do you migrate a live database schema without locking out writes or crashing reads?",
"A direct ALTER TABLE locks the table and drops over 200 writes, premature reads crash on NULLs, but expand/contract completes cleanly in 200/200 runs.",
    "High-throughput tables cannot tolerate exclusive table locks or out-of-order code releases; schema changes must be broken into backward-compatible phases.",
    "Slide between the monolithic rename, premature read release, and expand/contract to see how decoupling DB migrations from code deployments avoids downtime.",
    [{ slug: "the-mutex-call", relation: "builds on" }],
  ),
  "async-race": guide(
    "Why does an asynchronous test pass on a fast development machine but intermittently fail in CI?",
    "Replacing an arbitrary sleep with condition awaiting eliminates the timing window, turning a 50% flake rate into 100% deterministic passes.",
    "A fixed sleep is a wager on thread scheduling and container load; when CI throttles CPU, the sleep expires before background work finishes. Synchronizing on actual state conditions removes the race while allowing fast runs to proceed without artificial delay.",
    "Run the sleep figure at seed 42 to observe the early assertion failure, then switch to the awaiting figure and confirm that 100% of orders pass.",
    [{ slug: "flaky-tests", relation: "builds on" }],
  ),
  "cascading-failure": guide(
    "What happens when a cache node crashes under 10k QPS, and how do you stop the primary database from collapsing?",
    "Direct DB queries and unbacked retries exhaust connection pools and trigger total failure in 0/200 runs; singleflight coalesces duplicate key queries so DB CPU stays < 40% across all 200/200 runs.",
    "When caches fail under peak load, the database cannot handle raw traffic; resilience requires collapsing redundant concurrent requests before they reach the data store.",
    "Move the slider to compare direct database passthrough, aggressive retries, and singleflight request coalescing to see how query coalescing preserves availability.",
    [
      { slug: "the-mutex-call", relation: "builds on" },
      { slug: "caching", relation: "connects to" },
      { slug: "circuit-breaker-hysteresis", relation: "connects to" },
    ],
  ),
  "memory-leak-triage": guide(
    "How do you triage a severe memory leak without dropping live traffic or destroying diagnostic data?",
    "Simultaneous restarts drop 350 to 500 in-flight requests, waiting for OOM-kill resets sockets mid-flight across 0/200 runs, but rolling graceful drain holds SLA in 200/200 runs.",
    "Killing or crashing a leaking container destroys the in-memory object graph and drops in-flight work; cordoning before draining preserves both client requests and diagnostic heap dumps.",
    "Slide between simultaneous restart, waiting for OOM-kill, and rolling drain to compare dropped connections and SLA compliance across 200 incident runs.",
    [{ slug: "the-mutex-call", relation: "builds on" }],
  ),
  "split-brain-partition": guide(
    "How should a distributed database handle writes when a network partition cuts off a minority node?",
    "Accepting writes on both sides loses 40 to 60 updates upon healing (0/200 safe) and freezing halts write traffic (0/200 meet SLA), while majority quorum with fencing commits safely in all 200 runs.",
    "In an asynchronous network, an isolated node cannot distinguish network lag from peer crashes; without majority quorum and fencing tokens, concurrent split-brain writes permanently destroy data.",
    "Slide between uncoordinated dual writes, global write freezing, and majority quorum with fencing to observe how consensus and fencing tokens guarantee zero write loss.",
    [{ slug: "the-mutex-call", relation: "builds on" }],
  ),
  "three-way-merge": guide(
    "How does git integrate divergent branches without misattributing changes or guessing intent?",
    "With both branches moved past base, git found their lowest common ancestor and created a two-parent merge commit (growing four commits to five), while an undiverged trunk simply slid its pointer in a zero-commit fast-forward.",
    "A two-way diff between branch tips cannot distinguish additions from deletions; only a three-way diff against the merge base attributes each edit to the branch that introduced it and flags true collisions as conflicts.",
    "Step through the diverged merge to see the two-parent commit join c4 and c3, then contrast it with the fast-forward run where no merge commit is created.",
    [{ slug: "merge-vs-rebase", relation: "builds on" }],
  ),
  "http-pipelining-hol": guide(
    "Why was HTTP/1.1 pipelining abandoned despite promising zero-wait requests?",
    "Sending requests back-to-back works, but RFC 2616 requires responses in exact FIFO order, trapping fast assets behind slow ones.",
    "A single heavy query blocks every subsequent asset at the application layer, driving browsers to open multiple parallel TCP connections instead.",
    "Move to HTTP/2 Multiplexing to see how binary framing breaks streams into interleaved chunks over a single connection.",
    [{ slug: "connection-reuse", relation: "builds on" }],
  ),
  "http2-multiplexing": guide(
    "How does HTTP/2 interleave streams concurrently without waiting for slow responses?",
    "Binary framing divides messages into tagged frames that interleave over a single TCP socket, eliminating application HOL blocking.",
    "Small responses finish in milliseconds alongside large downloads, but TCP in-order delivery means a single dropped packet stalls every stream simultaneously.",
    "Advance to QUIC & HTTP/3 to see how running streams independently over UDP eliminates transport head-of-line blocking.",
    [{ slug: "http-pipelining-hol", relation: "builds on" }],
  ),
  "http3-quic": guide(
    "How does HTTP/3 eliminate transport-level head-of-line blocking under packet loss?",
    "QUIC replaces TCP with UDP, providing independent per-stream sequencing and loss recovery in user space.",
    "A dropped packet on one stream retransmits independently while other streams continue streaming without a millisecond of delay.",
    "Explore HTTP Caching & Revalidation to see how client and CDN edge caches eliminate network round trips entirely.",
    [{ slug: "http2-multiplexing", relation: "builds on" }],
  ),
  "http-caching": guide(
    "How do HTTP cache headers eliminate round trips across browser, CDN, and origin?",
    "Directives like max-age serve responses from local memory with 0ms latency, while stale-while-revalidate refreshes in the background.",
    "Caching cuts server traffic by over 50% and slashes user-perceived load times, but requires precise invalidation rules.",
    "Proceed to Conditional Requests & ETags to see how 304 Not Modified saves bandwidth when a cached resource has not changed.",
    [{ slug: "connection-reuse", relation: "builds on" }],
  ),
  "conditional-requests": guide(
    "How do conditional headers eliminate redundant payload downloads when a cache expires?",
    "If-None-Match sends a content hash (ETag) to the origin, which responds with a 304 header if the data is unchanged.",
    "A 304 response carries zero body bytes, saving >80% of total transfer bandwidth and sparing origin database load.",
    "Explore the TLS Handshake to see how cryptographic key exchange protects connections from eavesdropping and tampering.",
    [{ slug: "http-caching", relation: "builds on" }],
  ),
  "tls-handshake": guide(
    "How does TLS 1.3 eliminate handshake round trips without sacrificing forward secrecy or inviting replay attacks?",
    "TLS 1.3 bundles ECDHE key share with ClientHello for 1-RTT setup and uses PSK resumption for 0-RTT early data while rejecting duplicate tickets with anti-replay caches.",
    "Shaving 1 to 2 round trips dramatically speeds up mobile connection setup, but 0-RTT early data lacks interactive forward secrecy and requires single-use ticket enforcement to prevent duplicate execution.",
    "Explore next tracks to see how systems maintain data consistency, tolerate network partitions, and scale distributed architectures.",
    [{ slug: "conditional-requests", relation: "builds on" }],
  ),
  "property-shrinking": guide(
    "How does property-based testing isolate the minimal failing input from a noisy, randomized counterexample?",
    "A three-phase shrinker bisects large chunks, prunes non-essential elements one by one, and decrements scalar values towards the boundary until only the root cause remains.",
    "A 10-element random array with dozens of irrelevant integers obscures whether a bug stems from order, size, or a specific value; shrinking reduces it to a single boundary case (like [50]), turning hours of triage into an instant fix.",
    "Explore Fast-Forward Merges in Version Control to see how Git advances branch heads without merge commits when history has not diverged.",
    [{ slug: "async-race", relation: "builds on" }],
  ),
  "coupling-metrics": guide(
    "How do architectural refactorings quantitatively move afferent and efferent coupling across package boundaries?",
    "Extracting domain interfaces and injecting dependencies reduced billing's efferent coupling from 3 to 1 and db's afferent coupling from 3 to 2, shrinking total system coupling from 12 to 8.",
    "High efferent coupling (Ce) makes a package fragile to upstream churn, while high afferent coupling (Ca) makes concrete infrastructure hazardous to modify without triggering cascading regressions.",
    "Step through each refactoring phase to observe how inverting dependencies converts high-instability concrete imports into isolated, stable domain boundaries.",
    [
      { slug: "replace-conditional", relation: "builds on" },
      { slug: "instability-abstractness", relation: "leads to" },
    ],
  ),
  "instability-abstractness": guide(
    "How do stability and abstractness balance to prevent rigid dependencies in core packages?",
    "Refactoring a concrete core package with abstract interfaces raised abstractness from A=0 to A=0.5, cutting distance from the Main Sequence D from 1.0 down to 0.5.",
    "Maximally stable packages with many dependents must be abstract so new behaviors can be plugged in without modifying brittle production code.",
    "Explore Cyclic Dependencies & ADP to discover how circular dependencies shatter package release stability and how to invert them.",
    [{ slug: "coupling-metrics", relation: "builds on" }],
  ),
  "cyclic-dependencies": guide(
    "How do cyclic dependencies paralyze independent releases, and how does interface inversion break the loop?",
    "Replacing Billing's direct concrete dependency on Users with an extracted UsersInterface broke the circular cycle and restored a Directed Acyclic Graph.",
    "Circular dependencies fuse independent packages into an indivisible unit where no package can be built or versioned first; breaking the cycle restores a deterministic topological release order.",
    "Step forward to see Tarjan's cycle detection flag the back-edge, then watch topological sort compute the linear build sequence [Billing, Users, Orders].",
    [{ slug: "instability-abstractness", relation: "builds on" }],
  ),
  "dependency-inversion": guide(
    "How do you isolate core domain logic from volatile infrastructure drivers without sacrificing integration or runtime performance?",
    "Domain entities extracted abstract repository and notifier ports, reversing the dependency arrows so concrete infrastructure adapters depend inward on domain contracts.",
    "Direct coupling to databases and third-party APIs makes domain logic brittle and slows tests to network latencies; inverting dependencies isolates business rules and allows swapping in-memory test doubles.",
    "Step through the four architectural phases to watch domain fan-out collapse from 2 to 0, then observe how in-memory test doubles achieve full isolation.",
    [{ slug: "cyclic-dependencies", relation: "builds on" }],
  ),
  "strangler-fig": guide(
    "How can an engineering team migrate a monolithic system to microservices without risking a catastrophic big-bang rewrite or incurring downtime?",
    "Deploying an interceptor facade proxy in front of the monolith enabled incremental route-by-route migration (/catalog, /orders, /payments, /users), dropping monolith traffic from 100% to 0% with zero downtime.",
    "Big-bang rewrites compound delivery risk and freeze business innovation; the Strangler Fig pattern delivers continuous business value and immediate feedback by replacing legacy components behind an edge proxy one boundary at a time.",
    "Step through the cutover phases to observe how the routing facade transparently redirects live traffic while maintaining zero downtime across every stage of the migration.",
    [{ slug: "dependency-inversion", relation: "builds on" }],
  ),
  "btree-vs-lsm": guide(
    "If a write is durable, how many pages did it actually touch?",
    "Eight keys rewrote eight B-tree leaves (24 page reads); the same eight keys cost an LSM two flushes, three page reads, and four bloom misses.",
    "Write amplification is a property of the engine, not of durability: in-place update pays per key, log-structured update pays at flush and compaction, and a later read pays for however many runs you have not merged.",
    "Compare the page-writes meter at 8, then drag the LSM to 12 and watch the first compaction add two writes that the B-tree never needed.",
    [
      { slug: "write-ahead-logging", relation: "builds on" },
      { slug: "index-vs-scan", relation: "leads to" },
    ],
  ),
  "index-vs-scan": guide(
    "Does an index always read fewer pages than scanning the table?",
    "A secondary lookup grows by one heap fetch per match and crosses the scan at seven matching rows (9 pages against a constant 8); a clustered seek at that point still reads 4.",
    "An index is an access path, not a discount: when the result is a large fraction of the heap, bookmark lookups are a scan with extra work, and the planner's job is to notice the crossing before the query runs.",
    "Set matching rows to 6 (tied at 8 pages), then 7 (secondary 9, scan 8), then step the clustered figure at 7 and confirm it still reads 4.",
    [{ slug: "btree-vs-lsm", relation: "builds on" }],
  ),
  "address-translation": guide(
    "Why does translating a virtual page take two memory reads, not one?",
    "Three translations of VPNs 0, 4 and 8 walk the directory then a table and stop at 6 table refs with 0 faults; the same three pages inside one table still cost 6.",
    "A two-level page table keeps the directory small and allocates a table only for a used region; the cost is that every translation is two references until a TLB exists.",
    "Step the default of three, drag to four so every directory slot lights, then to eight: the meter always adds two refs, even when VPN 1 shares a table with VPN 0.",
    [{ slug: "tlb", relation: "leads to" }],
  ),
  "tlb": guide(
    "Why doesn't every virtual address walk the page tables?",
    "Eight repeats of VPN 0 cost 16 table refs with no TLB, and 2 with a TLB of 4 — one miss, then seven hits that skip the walk.",
    "A two-level walk is two memory references on the path of every load; a TLB hit turns that into a cached VPN-to-frame lookup, so locality in the page stream is what keeps the CPU from walking.",
    "Set repeated accesses to 3 on both figures (6 table refs vs 1 miss, 2 hits, 2 refs), then 8, and confirm the TLB's table refs stay at 2 while the no-TLB figure grows to 16.",
    [
      { slug: "address-translation", relation: "builds on" },
      { slug: "page-faults", relation: "leads to" },
    ],
  ),
  "page-faults": guide(
    "Why does the first access to a page cost disk, and a later access to the same page not?",
    "Two unique pages produced two faults and two disk reads; repeating VPN 0 walked the tables and did not fault.",
    "Demand paging leaves every PTE invalid until first touch, so a process can own a huge address space while RAM holds only the pages it has actually used.",
    "Drag unique pages to 4 and confirm faults stay equal to disk reads, with evictions still at zero after every frame is full.",
    [
      { slug: "tlb", relation: "builds on" },
      { slug: "page-replacement", relation: "leads to" },
    ],
  ),
  "page-replacement": guide(
    "When every frame is full, who gets thrown out — and does it matter?",
    "On accesses 0,1,2,0,3 with three frames, FIFO (and CLOCK) evict VPN 0 to install 3; LRU keeps 0 and evicts 1. Four frames: zero evictions. Two frames: five faults, three evictions, both policies end at 3 and 0.",
    "Replacement is a policy over a scarce resource. FIFO is simple and can throw out a page you just used; LRU tracks recency and is expensive to implement exactly; CLOCK approximates LRU with a referenced bit, and on a freshly filled set its first victim is FIFO's.",
    "Leave frames at 3 and compare the FIFO and LRU victims, then drag to 4 (no eviction) and 2 (the re-access of 0 becomes a fault).",
    [{ slug: "page-faults", relation: "builds on" }],
  ),
  "preemptive-scheduling": guide(
    "Why do two short bursts wait so long when a longer one arrived at the same instant?",
    "Cooperative FIFO: A waits 0, B waits 8, C waits 10. A timer of quantum 1 cuts those waits to 4, 3 and 4 after four preemptions; quantum 8 is the convoy again.",
    "A cooperative kernel cannot reclaim the CPU until the occupant yields, so one long burst delays every short request behind it. Interactive systems need a timer so short work is not stuck in a convoy.",
    "On the preemptive figure, drag quantum from 1 (B waits 3) to 2 (B waits 2) to 8 (B waits 8, same as cooperative).",
    [
      { slug: "data-races", relation: "connects to" },
      { slug: "deadlock", relation: "connects to" },
    ],
  ),
  "round-robin": guide(
    "Why can a shorter time slice make a short job wait longer?",
    "With a switch cost of 1, quantum 1 wastes 6 and B waits 7; quantum 2 wastes 3 and B waits 3; quantum 8 wastes 2 and B waits 9.",
    "Context switches are not free. A timer that fires every step buys responsiveness only if dispatch is cheap; once it costs a unit, extra preemptions inflate the wall that short jobs sit in.",
    "Leave quantum at 1 (waste 6, B wait 7), then drag to 2 (waste 3, B wait 3) and to 8 (waste 2, B wait 9).",
    [
      { slug: "preemptive-scheduling", relation: "builds on" },
      { slug: "mlfq", relation: "leads to" },
    ],
  ),
  "mlfq": guide(
    "How does a scheduler prefer short work without knowing the bursts, and what keeps a long job from staying demoted?",
    "With queues Q0/Q1/Q2 and quanta 1/2/4, SHORT finishes at t=2 in Q0; LONG is demoted twice and finishes at t=9 in Q2. Aging every 4 steps boosts LONG back to Q0 after 4 demotions.",
    "Interactive work looks short because it yields before a slice ends; CPU-bound work burns the slice and sinks. Without aging that classification never expires, and later interactive arrivals would skip the sunk job.",
    "Leave aging off and confirm LONG ends in Q2 with 2 demotions, then set age-every to 4 (LONG ends in Q0, 4 demotions) and to 12 (identical to off — the run is only 9 steps).",
    [
      { slug: "round-robin", relation: "builds on" },
      { slug: "preemptive-scheduling", relation: "builds on" },
    ],
  ),
  "priority-inversion": guide(
    "Why does a high-priority task wait for a medium-priority one that never took the lock it needs?",
    "Without inheritance High waits 9 (done@11) — Medium ran its burst of 4 over the lock holder. With inheritance High waits 5, Low waits 0, Medium waits 7; one boost, zero preemptions.",
    "A priority scheduler that does not donate lets Medium run over Low while High is blocked on Low's lock, so the urgent work waits for both. Inheritance makes the holder as urgent as the waiter until the lock is free.",
    "Step the inverted figure until M preempts L (preemptions 1, H wait 9), then the inherit figure until L's chip reads prio 0→2 and M stays ready (boosts 1, H wait 5).",
    [
      { slug: "preemptive-scheduling", relation: "builds on" },
      { slug: "deadlock", relation: "connects to" },
    ],
  ),
  "inode": guide(
    "Why does the fifth block of a file cost an extra disk read the first four did not?",
    "A 4-block file is 4 inode reads, 4 data reads, and 0 pointer reads; the fifth block adds 1 pointer read, and eight blocks add 4.",
    "An inode is a fixed-size record. Direct pointers name data from inside it; past that range the name lives in a pointer block, and every later data block pays to fetch it.",
    "Leave file blocks at 4 and confirm pointer reads stay at 0, then drag to 5 (the stamp flips to 1 pointer read) and to 8 (4 pointer reads).",
    [
      { slug: "address-translation", relation: "builds on" },
      { slug: "fs-journaling", relation: "leads to" },
    ],
  ),
  "fs-journaling": guide(
    "A crash between writing a file's data and writing the inode that names it — what is left on disk, and how does a journal change that?",
    "Without a journal, crashing after the data write leaves block 0 on disk with an empty inode — an orphan. With one, crashing after the journal force, before the inode write, still recovers: the inode names 0.",
    "The inode write is a random I/O; the journal force is sequential. WAL's ordering rule applied to metadata: make the name durable in a log before installing it, so a crash in that gap is recoverable rather than a leaked block.",
    "On the unordered figure, leave the crash at 1 and read the orphan; drag to 2 and watch it vanish. On the journaled figure, start at 3 (recovery names 0), then drag to 2 (unforced record, still an orphan).",
    [
      { slug: "inode", relation: "builds on" },
      { slug: "write-ahead-logging", relation: "connects to" },
    ],
  ),
  "buffer-cache": guide(
    "A write() already returned success — why can a crash still lose the bytes?",
    "Write-back crash after two writes loses both (lost 2, disk still 0). After fsync, or write-through at the same crash: lost 0, diskWrites 2.",
    "The buffer cache acknowledges a write when the page is dirty in RAM. Until fsync those bytes are a loss window. Write-through closes it by paying a disk write on every write().",
    "On write-back, leave the crash at 2 (lost 2, disk 0), then drag to 3 (lost 0, diskWrites 2). On write-through, crash at 2: lost 0, diskWrites 2.",
    [
      { slug: "fs-journaling", relation: "builds on" },
      { slug: "write-ahead-logging", relation: "connects to" },
      { slug: "syscalls", relation: "leads to" },
    ],
  ),
  "syscalls": guide(
    "Why do eight one-byte writes cost eight traps when one eight-byte write moves the same eight bytes?",
    "Eight calls of 1 byte trap 8 times, copy 8 times, and move 8 bytes; one call of 8 bytes traps once, copies once, and still moves 8 bytes.",
    "User code cannot talk to devices. Every write() is a mode switch; the bytes are the work, so batching calls is the lever, not making the trap cheaper.",
    "Leave the one-byte figure at 8 (traps 8, copies 8, bytes 8), then the batched figure at 8 (traps 1, copies 1, bytes 8). Drag both to 1: they agree.",
    [
      { slug: "buffer-cache", relation: "builds on" },
      { slug: "inode", relation: "connects to" },
    ],
  ),
  "hash-functions": guide(
    "Why is a hash cheap to compute and expensive to invert, and what actually moves when one input bit flips?",
    "mix8(42) is 23; flipping bit 0 moves 6 of 8 output bits, bit 1 moves 4, bit 2 moves 3, bits 3–5 and 7 move 2, bit 6 moves 4. An 8-bit preimage is 256 guesses.",
    "A real digest (SHA-256) is the same argument at 256 bits: one-way because a preimage is 2^256 guesses, not because the mixing is mysterious. Avalanche is measured diffusion, not a promised 50%.",
    "Leave flip bit at 0 and step until the stamp reads 6/8 avalanche; then drag through bits 1–7 and confirm 4, 3, 2, 2, 2, 4, 2 bits moved.",
    [{ slug: "diffie-hellman", relation: "leads to" }],
  ),
  "diffie-hellman": guide(
    "How do two parties agree on a secret over a channel Eve can read, without ever sending the secret?",
    "Alice keeps 6 and Bob keeps 7; they publish 8 and 17 and both land on 12. Eve's brute-force bound is 23 trials — p, not a simulated guess loop.",
    "The channel never carried the exponents. Recovering a from g^a mod p is a discrete log; on a 2048-bit modulus that bound is not 23.",
    "Leave Alice's secret at 6 (shared 12, 18 multiplies), then drag to 2 (A becomes 2, secret 13) and 10 (A becomes 9, secret 4). B stays 17; both sides still match.",
    [
      { slug: "hash-functions", relation: "builds on" },
      { slug: "digital-signatures", relation: "leads to" },
    ],
  ),
  "digital-signatures": guide(
    "How can anyone check a signature if they cannot make one?",
    "Signing with d produces a signature that raising to e recovers; a tampered message makes that check fail, so verified is 1 then 0.",
    "Authentication does not need a shared secret: the public exponent verifies, the private exponent signs, and a changed message cannot reuse the signature.",
    "Leave the message at 4 on the honest figure (verified 1, stamp verify ok), then on the tampered figure (verified 0, stamp verify fail). Drag 1 through 16: every honest run accepts and every tampered run rejects.",
    [
      { slug: "diffie-hellman", relation: "builds on" },
      { slug: "hash-functions", relation: "connects to" },
    ],
  ),
  "session-cookies": guide(
    "Which cookie flag, turned off, lets the session leave the browser?",
    "Sid S7 with HttpOnly+Secure+SameSite=Strict is stolen 0 csrf 0. HttpOnly off: XSS steals it. Secure off: HTTP leaks it. SameSite=None: a cross-site POST sends it (csrf 1, stolen 0).",
    "The cookie is the session. Flags are not decoration — each one closes a different door, and the figure counts which door opened.",
    "Leave flags at 0 (stolen 0, csrf 0, stamp cookie), then 1 (stolen 1, stamp stolen), 2 (stolen 1), and 3 (csrf 1, stamp csrf).",
    [
      { slug: "digital-signatures", relation: "builds on" },
      { slug: "jwt-pitfalls", relation: "leads to" },
    ],
  ),
  "jwt-pitfalls": guide(
    "What does a verifier actually check, and what happens if it checks nothing?",
    "Naive accepts all four tokens (verified 1). Strict accepts only the signed unexpired one; alg=none, exp=5 against now=10, and sub=mallory with ada's sig 56 are rejected.",
    "A JWT is three strings. Trusting the header's alg, skipping exp, or skipping the signature are three different ways to accept a token nobody signed.",
    "On the naive figure drag 0–3: every run accepts. On the strict figure, 0 accepts and 1–3 reject.",
    [
      { slug: "session-cookies", relation: "builds on" },
      { slug: "oauth-pkce", relation: "leads to" },
    ],
  ),
  "oauth-pkce": guide(
    "Why is an authorization code not a token, and what does PKCE change when someone steals the code?",
    "Without PKCE, intercepting C9 issues T1 to the attacker (stolen 1, issued 0). With PKCE challenge 77, the attacker is rejected and the client still holds T1 (rejected 1, issued 1, stolen 0).",
    "The redirect carried a code, not a session. PKCE binds that code to a verifier the attacker never saw — S256 is the real hash, 77 is the toy.",
    "Leave intercept at 1 on the no-PKCE figure (stamp stolen, attacker holds T1), then on the PKCE figure (stamp client holds, rejected 1).",
    [
      { slug: "jwt-pitfalls", relation: "builds on" },
      { slug: "sql-injection", relation: "leads to" },
    ],
  ),
  "sql-injection": guide(
    "When does user input become SQL syntax instead of a value?",
    "Concatenating 7 OR 1=1 adds an OR node and returns rows 1, 7, and 9 (injected 1, rows 3). Binding the same string as a parameter matches nobody (injected 0, rows 0).",
    "A query is a tree. Concatenation lets input grow that tree. A parameter is a leaf, even when the string looks like SQL.",
    "On concat leave payload at 1 (3 rows, stamp 3 rows); on param leave payload at 1 (0 rows, stamp 0 rows). Payload 0 is id=7 either way (1 row).",
    [
      { slug: "oauth-pkce", relation: "builds on" },
      { slug: "xss", relation: "leads to" },
    ],
  ),
  "xss": guide(
    "When does a name in HTML become a script instead of text?",
    "Ada is a text node either way (scripts 0). Raw <script> becomes a script node (scripts 1). Encoded, the same payload stays text as &lt;script&gt; (scripts 0).",
    "The DOM is a tree too. Concatenating into HTML lets input become a script node. Encoding keeps it a text node. This page never runs the payload.",
    "On raw leave payload at 1 (scripts 1, stamp script); on encode leave payload at 1 (scripts 0, stamp text). Payload 0 is Ada, text, both figures.",
    [
      { slug: "sql-injection", relation: "builds on" },
      { slug: "ssrf", relation: "leads to" },
    ],
  ),
  "ssrf": guide(
    "What does the server fetch when the caller chooses the host?",
    "An open fetch of 169.254.169.254 is fetched 1 leaked 1. The same host against an allowlist of api.example.com is blocked 1 leaked 0. api.example.com is fetched either way, leaked 0.",
    "The server is on a network the browser is not. An open URL is a confused deputy; an allowlist is a host check, not a DNS tutorial.",
    "On open leave target at 1 (stamp metadata); on allowlist leave target at 1 (stamp blocked). Target 0 fetches api.example.com on both.",
    [
      { slug: "xss", relation: "builds on" },
      { slug: "rbac-vs-abac", relation: "leads to" },
    ],
  ),
  "rbac-vs-abac": guide(
    "Does the role grant the write, or do the attributes?",
    "Alice (admin) and bob (owner) are allowed under both. Mallory is an editor who does not own doc1: RBAC allows her (escalation 1), ABAC denies her (allowed 0).",
    "RBAC answers with a role. ABAC answers with who owns the row. Horizontal escalation is a grant that is not admin and not owner.",
    "On RBAC drag to mallory (subject 2, stamp escalation); on ABAC the same subject stamps deny. Subjects 0 and 1 allow on both.",
    [
      { slug: "ssrf", relation: "builds on" },
      { slug: "credential-stuffing", relation: "leads to" },
    ],
  ),
  "credential-stuffing": guide(
    "Which key should the rate-limit bucket be on when guesses rotate addresses?",
    "Six attempts, correct password on attempt 5. No limit: stolen 1 blocked 0. IP cap 3 with three addresses: still stolen 1. Username cap 3: blocked 3 stolen 0, attempts 4–6 never run the password.",
    "Stuffing is many passwords against one account. An IP bucket is the wrong key once the attacker has more than one address; the username is the thing being guessed.",
    "Leave the no-limit figure as-is (stamp stolen, attempt 5 ok). On the user-bucket figure the last three chips read block and stolen stays 0.",
    [
      { slug: "rbac-vs-abac", relation: "builds on" },
      { slug: "mtls", relation: "leads to" },
    ],
  ),
  "mtls": guide(
    "Did the server authenticate the client, or only the network?",
    "Perimeter connects with no client cert (connected 1, verified 0). mTLS connects only when the cert is from this CA (size 0: connected 1 verified 1). Missing or other-ca: rejected 1 connected 0.",
    "Being on the network is not a name. Mutual TLS is the server checking the client's cert the same way the client checks the server's. This is not a CA lesson.",
    "On perimeter drag to 1 (no cert, stamp connected). On mTLS leave at 0 (connected), then 1 and 2 (stamp reject).",
    [
      { slug: "credential-stuffing", relation: "builds on" },
    ],
  ),
  "lexical-analysis": guide(
    "What does a scanner group, and when is let a keyword rather than the start of an ident?",
    "let n=2 is kw let, ident n, op =, num 2 (4 tokens, 1 skipped). let n = 2 is the same four with 3 skipped. let 'n=2' is kw plus one string (2 tokens). letn=2 is ident letn, not the keyword (3 tokens, 0 skipped).",
    "Source is characters. Tokens are the groups the parser will see. A keyword is a whole ident in the reserved set; a string is one token even when it contains operators.",
    "Leave source at 0 (4 tokens, 1 skipped), then 1 (4 tokens, 3 skipped), 2 (2 tokens, string 'n=2'), 3 (ident letn, 3 tokens).",
    [{ slug: "recursive-descent", relation: "leads to" }],
  ),
  "recursive-descent": guide(
    "Why is 1+2*3 equal to 7, not 9?",
    "Flat left-to-right parses 1+2*3 as 9. Precedence puts * in a tighter production and gets 7. (1+2)*3 is 9 either way. 1*2+3 is 5 either way.",
    "Precedence is which production you call, not a later rewrite of the tree. Parentheses are a different production, counted the same way.",
    "On flat leave expr at 0 (stamp 9). On prec leave expr at 0 (stamp 7, notes Atom 1/2/3, * → 6, + → 7). Drag both to 2: both 9.",
    [
      { slug: "lexical-analysis", relation: "builds on" },
      { slug: "tree-walk-vs-bytecode", relation: "leads to" },
    ],
  ),
  "tree-walk-vs-bytecode": guide(
    "Same 1+2*3, two machines — what is different besides the drawing?",
    "Both yield 7. The walk visits 5 nodes. Bytecode is 5 ops (LOAD 1, LOAD 2, LOAD 3, MUL, ADD) with stack max 3. (1+2)*3 is 9 with stack max 2.",
    "A tree walk is recursive structure. Bytecode is a linear instruction list plus a stack. The value is the same; the peak stack is not.",
    "On walk leave expr at 1 (visits 5, stamp 7). On bytecode the last notes are MUL stack [1 6], ADD stack [7], stack max 3. Drag to 2: stack max 2.",
    [
      { slug: "recursive-descent", relation: "builds on" },
      { slug: "call-stack", relation: "leads to" },
    ],
  ),
  "call-stack": guide(
    "How many frames does f(n) need, and what happens at n=4?",
    "f(n) = n==0 ? 1 : n * f(n-1). Cap 4. f(3) returns 6 at depth 4, pushes 4, overflow 0. f(4) overflows at f(0), result null, overflow 1.",
    "Each call is a frame. Unbounded recursion is not an infinite loop — it is a cap you can count. f(0) is the fifth frame and there is no fifth slot.",
    "Leave n at 3 (stamp 6, depth 4). Drag to 4: Overflow at f(0). cap 4. Then four Unwind notes.",
    [
      { slug: "tree-walk-vs-bytecode", relation: "builds on" },
      { slug: "reference-counting", relation: "leads to" },
    ],
  ),
  "reference-counting": guide(
    "When does rc hitting 0 free an object, and when does a cycle keep it?",
    "A.p=B then drop both: freed 2, leaked 0. A.p=B and B.p=A then drop both: freed 0, leaked 2 — rc stays 1.",
    "A cycle is two objects each holding the last pointer to the other. Dropping the roots is not enough. Mark-sweep is the next lesson because it does not care.",
    "On the acyclic figure skip to the end (2 freed). On the cycle figure skip to the end (2 leaked).",
    [
      { slug: "call-stack", relation: "builds on" },
      { slug: "mark-and-sweep", relation: "leads to" },
    ],
  ),
  "mark-and-sweep": guide(
    "Does an unrooted cycle survive mark-sweep the way it survived refcount?",
    "Root 0→1 marks 2 and sweeps 2. The same heap with an unrooted 2↔3 cycle still marks 2 and sweeps 2. Roots 0 and 2 mark all 4.",
    "Reachability from a root is the live set. A cycle with no root is garbage. That is the fact refcount could not see.",
    "Leave size at 0 (2 marked 2 swept). Drag to 1: same counts, the cycle is still swept. Drag to 2: 4 marked 0 swept.",
    [
      { slug: "reference-counting", relation: "builds on" },
      { slug: "incremental-gc", relation: "leads to" },
    ],
  ),
  "incremental-gc": guide(
    "What is the pause of marking 4 live objects, all at once vs in slices?",
    "Stop-the-world: one pause of 4, 1 slice. Incremental budget 1: pause 1, 4 slices. Budget 4: pause 4, 1 slice — the same as STW.",
    "The mutator waits for the current slice, not for the whole heap. The work is the same 4 marks; the pause is the slice.",
    "On STW skip to the end (pause 4, slices 1). On incremental leave budget at 1 (pause 1, slices 4), then drag to 4.",
    [
      { slug: "mark-and-sweep", relation: "builds on" },
      { slug: "generational-gc", relation: "leads to" },
    ],
  ),
  "generational-gc": guide(
    "What happens to a young object that only an old object points to?",
    "O0.p=Y1 with no write barrier: minor GC sweeps Y1, lost 1. With a barrier: card O0, Y1 is marked, lost 0. No old-to-young pointer: Y1 is garbage and swept, lost 0.",
    "A minor GC only walks young plus dirty cards. The barrier is how an old→young store becomes a card. Without it the young object is live and still dies.",
    "On no-barrier leave the old-to-young store on (lost Y1). On barrier the same store holds (stamp held, cards 1).",
    [
      { slug: "incremental-gc", relation: "builds on" },
      { slug: "event-loop", relation: "leads to" },
    ],
  ),
  "event-loop": guide(
    "In what order do sync, micro, and macro actually run?",
    "Log 1, queue micro 2, queue macro 3, log 4 → 1,4,2,3. A micro that queues micro B still beats the timer: 1,3,A,B,2. Two micros: 1,5,2,3,4.",
    "The current turn finishes. Then the micro queue drains fully, including work it just queued. Then one macrotask. That is the loop, counted as a log.",
    "Leave script at 0 (stamp 1,4,2,3). Drag to 2 (stamp 1,3,A,B,2).",
    [
      { slug: "generational-gc", relation: "builds on" },
      { slug: "jit-compilation", relation: "leads to" },
    ],
  ),
  "jit-compilation": guide(
    "After how many hits does the loop compile, and what are 8 iterations?",
    "Hot is 4. 3 iterations: interp 3, compiles 0. 4: interp 4, compiles 1, compiled 0. 8: interp 4, compiles 1, compiled 4.",
    "The interpreter counts hits. At 4 the loop compiles; the remaining iterations run compiled. There is no deopt here — that is the next lesson.",
    "Leave iters at 8 (4 compiled). Drag to 4 (compiles 1, compiled 0) and 3 (compiles 0).",
    [
      { slug: "event-loop", relation: "builds on" },
      { slug: "deoptimization", relation: "leads to" },
    ],
  ),
  "deoptimization": guide(
    "What happens when a compiled iteration fails the type assumption?",
    "8 iterations, deopt at 6: interp 7, compiled 1, deopts 1, compiles 1. At 5 (first compiled iter): interp 8, compiled 0, deopts 1. At 8: interp 5, compiled 3, deopts 1.",
    "The compile is speculative. One bad iteration falls back; the rest of the loop is interpreted. The compile still counted — it was not free.",
    "Leave deopt at 6 (interp 7, compiled 1). Drag to 5 and 8.",
    [
      { slug: "jit-compilation", relation: "builds on" },
      { slug: "vtables", relation: "leads to" },
    ],
  ),
  "vtables": guide(
    "How many loads does a call take when the class is named, when it lives in a vtable, and when speak is an interface iid?",
    "Static Dog.speak is 0 lookups, woof. A class vtable is 2 lookups (vptr then slot 0); cat is meow, still 2. An itable with speak at slot 2 scans 3 and costs 4 lookups — same woof.",
    "The call site either is the function, or it follows a pointer into a table, or it scans an itable. The result can be the same. The load count is not.",
    "Leave static at dog (lookups 0, woof), then the vtable figure at dog (lookups 2). On the itable leave speak slot at 2 (scans 3, lookups 4), then drag to 0 (lookups 2, same as a vtable).",
    [{ slug: "deoptimization", relation: "builds on" }],
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
