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
