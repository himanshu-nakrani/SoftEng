import type { Curriculum } from "./types";

/**
 * THE single source of truth for the curriculum.
 * The sidebar, lesson map, progress math, prev/next navigation, and the
 * check-curriculum CI script all derive from this file.
 *
 * Shipping a lesson = add its route folder + flip `status` to "available".
 */
export const curriculum: Curriculum = {
  tracks: [
    {
      slug: "system-design-fundamentals",
      title: "System Design Fundamentals",
      description:
        "How large-scale systems actually behave — learned by driving, breaking, and repairing them.",
      accent: "amber",
      modules: [
        {
          slug: "scaling",
          title: "Scaling",
          description: "From one server to a fleet.",
          accent: "amber",
          lessons: [
            {
              slug: "client-server",
              moduleSlug: "scaling",
              title: "Client & Server",
              tagline:
                "Every system starts here: one client, one server, and the request lifecycle between them.",
              difficulty: "foundational",
              estimatedMinutes: 10,
              prerequisites: [],
              status: "available",
              sections: [
                { id: "lifecycle", title: "The request lifecycle", kind: "concept" },
                { id: "drive-it", title: "Drive the traffic", kind: "interactive" },
                { id: "saturation", title: "Saturation & drops", kind: "concept" },
              ],
            },
            {
              slug: "scaling-strategies",
              moduleSlug: "scaling",
              title: "Vertical vs Horizontal Scaling",
              tagline:
                "Bigger machine or more machines? Watch the same traffic saturate one and spread across the other.",
              difficulty: "foundational",
              estimatedMinutes: 12,
              prerequisites: ["client-server"],
              status: "available",
              sections: [
                { id: "two-axes", title: "Two ways to grow", kind: "concept" },
                { id: "compare", title: "Scale it yourself", kind: "interactive" },
                { id: "tradeoffs", title: "Ceilings & failure domains", kind: "concept" },
              ],
            },
            {
              slug: "load-balancing",
              moduleSlug: "scaling",
              title: "Load Balancing",
              tagline:
                "Round-robin, least-connections, random — and what happens the moment a server dies.",
              difficulty: "foundational",
              estimatedMinutes: 14,
              prerequisites: ["scaling-strategies"],
              status: "available",
              sections: [
                { id: "why", title: "The traffic cop", kind: "concept" },
                { id: "strategies", title: "Pick a strategy", kind: "interactive" },
                { id: "failure", title: "Kill a server", kind: "interactive" },
                { id: "health-checks", title: "Health checks", kind: "concept" },
              ],
            },
            {
              slug: "autoscaling",
              moduleSlug: "scaling",
              title: "Autoscaling",
              tagline:
                "Capacity that follows load — until a spike arrives faster than a server can boot.",
              difficulty: "intermediate",
              estimatedMinutes: 13,
              prerequisites: ["load-balancing"],
              status: "available",
              sections: [
                { id: "reactive-capacity", title: "Capacity that follows load", kind: "concept" },
                { id: "ride-the-ramp", title: "Ride the ramp", kind: "interactive" },
                { id: "the-cliff", title: "The cliff & the gap", kind: "interactive" },
              ],
            },
            {
              slug: "realtime-delivery",
              moduleSlug: "scaling",
              title: "Realtime Delivery",
              tagline:
                "Polling, long-polling, websockets — and the reconnect storm when the server restarts.",
              difficulty: "intermediate",
              estimatedMinutes: 13,
              prerequisites: ["client-server"],
              status: "available",
              sections: [
                { id: "three-ways", title: "Three ways to hear back", kind: "concept" },
                { id: "pick-transport", title: "Pick a transport", kind: "interactive" },
                { id: "reconnect-storm", title: "The reconnect storm", kind: "interactive" },
              ],
            },
          ],
        },
        {
          slug: "data",
          title: "Data at Scale",
          description: "Caches, replicas, shards — where the state lives.",
          accent: "violet",
          lessons: [
            {
              slug: "caching",
              moduleSlug: "data",
              title: "Caching",
              tagline:
                "A cache in front of a slow database: tune size and TTL, watch the hit-ratio dial move.",
              difficulty: "foundational",
              estimatedMinutes: 14,
              prerequisites: ["client-server"],
              status: "available",
              sections: [
                { id: "why-cache", title: "The speed hierarchy", kind: "concept" },
                { id: "tune-it", title: "Tune the cache", kind: "interactive" },
                { id: "eviction", title: "Eviction & TTL", kind: "concept" },
              ],
            },
            {
              slug: "cache-stampede",
              moduleSlug: "data",
              title: "Cache Stampede",
              tagline:
                "One hot key expires and forty requests hit the database at once — unless exactly one does.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["caching"],
              status: "available",
              sections: [
                { id: "dogpile", title: "The dogpile", kind: "concept" },
                { id: "expire-it", title: "Expire the hot key", kind: "interactive" },
                { id: "coalesce", title: "Request coalescing", kind: "interactive" },
              ],
            },
            {
              slug: "cdn-edge",
              moduleSlug: "data",
              title: "CDN & Edge Caching",
              tagline:
                "Three regions, three PoPs, one origin — kill the origin and users don't notice. At first.",
              difficulty: "intermediate",
              estimatedMinutes: 14,
              prerequisites: ["caching"],
              status: "available",
              sections: [
                { id: "edge-of-the-world", title: "Content at the edge", kind: "concept" },
                { id: "regions", title: "Serve three regions", kind: "interactive" },
                { id: "origin-down", title: "Kill the origin", kind: "interactive" },
                { id: "ttl-tradeoff", title: "TTLs & staleness", kind: "concept" },
              ],
            },
            {
              slug: "replication",
              moduleSlug: "data",
              title: "Database Replication",
              tagline:
                "Writes to the leader, lagging copies to the followers — and the stale read that surprises you.",
              difficulty: "intermediate",
              estimatedMinutes: 15,
              prerequisites: ["caching"],
              status: "available",
              sections: [
                { id: "leader-follower", title: "Leader & followers", kind: "concept" },
                { id: "watch-lag", title: "Watch the lag", kind: "interactive" },
                { id: "stale-reads", title: "The stale read", kind: "interactive" },
              ],
            },
            {
              slug: "sharding",
              moduleSlug: "data",
              title: "Sharding",
              tagline:
                "Split the data by hash(key) % N — then add a shard and watch almost every key remap.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["replication"],
              status: "available",
              sections: [
                { id: "why-shard", title: "When one box can't hold it", kind: "concept" },
                { id: "route-keys", title: "Route the keys", kind: "interactive" },
                { id: "reshard-pain", title: "The resharding disaster", kind: "interactive" },
              ],
            },
            {
              slug: "consistent-hashing",
              moduleSlug: "data",
              title: "Consistent Hashing",
              tagline:
                "The ring that fixes resharding: add or kill a node and only its neighbours notice.",
              difficulty: "intermediate",
              estimatedMinutes: 14,
              prerequisites: ["sharding"],
              status: "available",
              sections: [
                { id: "the-ring", title: "Keys on a circle", kind: "concept" },
                { id: "spin-it", title: "Add & remove nodes", kind: "interactive" },
                { id: "virtual-nodes", title: "Virtual nodes", kind: "concept" },
              ],
            },
          ],
        },
        {
          slug: "resilience",
          title: "Resilience",
          description: "Timeouts, retries, breakers — surviving partial failure.",
          accent: "green",
          lessons: [
            {
              slug: "tail-latency",
              moduleSlug: "resilience",
              title: "Tail Latency",
              tagline:
                "Your average is 40ms and your users are furious — the p99 is where systems are judged.",
              difficulty: "intermediate",
              estimatedMinutes: 14,
              prerequisites: ["load-balancing"],
              status: "available",
              sections: [
                { id: "averages-lie", title: "Why averages lie", kind: "concept" },
                { id: "find-the-tail", title: "Find the tail", kind: "interactive" },
                { id: "fanout-amplification", title: "Fan-out amplifies the tail", kind: "interactive" },
                { id: "budgets-hedging", title: "Budgets & hedged requests", kind: "concept" },
              ],
            },
            {
              slug: "retries-timeouts",
              moduleSlug: "resilience",
              title: "Timeouts & Retries",
              tagline:
                "The database comes back up — and the accumulated retries keep it on the floor.",
              difficulty: "intermediate",
              estimatedMinutes: 14,
              prerequisites: ["load-balancing"],
              status: "available",
              sections: [
                { id: "why-timeouts", title: "Waiting is a choice", kind: "concept" },
                { id: "tune-retries", title: "Timeouts & retries", kind: "interactive" },
                { id: "retry-storm", title: "The retry storm", kind: "interactive" },
                { id: "backoff", title: "Backoff & jitter", kind: "concept" },
              ],
            },
            {
              slug: "circuit-breaker",
              moduleSlug: "resilience",
              title: "Circuit Breakers",
              tagline:
                "Fail fast while the downstream is dead — then let one probe decide when to trust it again.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["retries-timeouts"],
              status: "available",
              sections: [
                { id: "fail-fast", title: "Failing fast", kind: "concept" },
                { id: "trip-it", title: "Trip the breaker", kind: "interactive" },
                { id: "half-open", title: "The half-open probe", kind: "interactive" },
              ],
            },
                      {
              slug: "load-shedding",
              moduleSlug: "resilience",
              title: "Load Shedding",
              tagline:
                "A queue that accepts everything ends up serving nobody. Refusing work early is what keeps the rest fast.",
              difficulty: "advanced",
              estimatedMinutes: 14,
              prerequisites: ["tail-latency"],
              status: "available",
              sections: [
                { id: "overload", title: "When demand outruns capacity", kind: "concept" },
                { id: "queue-of-death", title: "The queue that kills you", kind: "interactive" },
                { id: "shedding", title: "Refusing work early", kind: "interactive" },
                { id: "what-to-drop", title: "Choosing what to refuse", kind: "concept" },
              ],
            },
                      {
              slug: "bulkheads",
              moduleSlug: "resilience",
              title: "Bulkheads",
              tagline:
                "One shared pool is efficient until a single slow dependency drinks it dry and takes the healthy ones with it.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["circuit-breaker"],
              status: "available",
              sections: [
                { id: "one-pool", title: "One pool for everything", kind: "concept" },
                { id: "shared", title: "The shared pool drowning", kind: "interactive" },
                { id: "isolated", title: "Partitioned pools", kind: "interactive" },
                { id: "sizing", title: "What isolation costs", kind: "concept" },
              ],
            },
          ],
        },
        {
          slug: "observability",
          title: "Observability & Incident Response",
          description: "Signals, objectives, and safe response under production pressure.",
          accent: "amber",
          lessons: [
            {
              slug: "metrics-logs-traces",
              moduleSlug: "observability",
              title: "Metrics, Logs & Traces",
              tagline:
                "One slow checkout request, three kinds of evidence — learn which signal finds the dependency that matters.",
              difficulty: "intermediate",
              estimatedMinutes: 14,
              prerequisites: ["tail-latency", "retries-timeouts"],
              status: "available",
              sections: [
                { id: "three-signals", title: "Three complementary signals", kind: "concept" },
                { id: "inspect-incident", title: "Inspect the incident", kind: "interactive" },
                { id: "follow-trace", title: "Follow the slow span", kind: "interactive" },
              ],
            },
            {
              slug: "slos-error-budgets",
              moduleSlug: "observability",
              title: "SLOs & Error Budgets",
              tagline:
                "A rollout burns the budget faster than the calendar can forgive — decide when reliability must stop the release.",
              difficulty: "intermediate",
              estimatedMinutes: 14,
              prerequisites: ["metrics-logs-traces", "tail-latency"],
              status: "available",
              sections: [
                { id: "availability-target", title: "The user-facing target", kind: "concept" },
                { id: "burn-rate", title: "Watch the budget burn", kind: "interactive" },
                { id: "release-decision", title: "Pause the rollout", kind: "interactive" },
              ],
            },
            {
              slug: "incident-triage",
              moduleSlug: "observability",
              title: "Incident Triage",
              tagline:
                "Payments fails, retries multiply, and checkout slows — contain the feedback loop before it becomes the outage.",
              difficulty: "advanced",
              estimatedMinutes: 16,
              prerequisites: ["slos-error-budgets", "circuit-breaker", "retries-timeouts"],
              status: "available",
              sections: [
                { id: "symptoms", title: "Symptoms are a system", kind: "concept" },
                { id: "find-feedback", title: "Find the feedback loop", kind: "interactive" },
                { id: "mitigate", title: "Reduce the blast radius", kind: "interactive" },
              ],
            },
          ],
        },
        {
          slug: "distributed",
          title: "Distributed Systems",
          description: "Queues, limits, partitions — coordination under failure.",
          accent: "cyan",
          lessons: [
            {
              slug: "rate-limiting",
              moduleSlug: "distributed",
              title: "Rate Limiting",
              tagline:
                "A token bucket refills while you spike the traffic — watch requests spend tokens or bounce 429.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["load-balancing"],
              status: "available",
              sections: [
                { id: "why-limit", title: "Protecting the system from you", kind: "concept" },
                { id: "token-bucket", title: "The token bucket", kind: "interactive" },
                { id: "burst", title: "Survive the burst", kind: "interactive" },
              ],
            },
            {
              slug: "message-queues",
              moduleSlug: "distributed",
              title: "Message Queues & Backpressure",
              tagline:
                "Producers race consumers; pause the consumer mid-deploy and watch the queue absorb the burst.",
              difficulty: "intermediate",
              estimatedMinutes: 14,
              prerequisites: ["rate-limiting"],
              status: "available",
              sections: [
                { id: "decouple", title: "Decoupling with a buffer", kind: "concept" },
                { id: "race", title: "Producer vs consumer", kind: "interactive" },
                { id: "deploy", title: "The mid-deploy pause", kind: "interactive" },
              ],
            },
            {
              slug: "delivery-guarantees",
              moduleSlug: "distributed",
              title: "Delivery Guarantees & Idempotency",
              tagline:
                "The consumer crashes after charging the card but before acking — what happens on redelivery?",
              difficulty: "advanced",
              estimatedMinutes: 15,
              prerequisites: ["message-queues", "retries-timeouts"],
              status: "available",
              sections: [
                { id: "at-least-once", title: "The ack decides", kind: "concept" },
                { id: "crash-consumer", title: "Crash the consumer", kind: "interactive" },
                { id: "idempotency", title: "Idempotency keys", kind: "interactive" },
              ],
            },
            {
              slug: "fanout",
              moduleSlug: "distributed",
              title: "Fan-out: Push vs Pull",
              tagline:
                "A five-million-follower account posts once — and the write storm that follows is a choice.",
              difficulty: "advanced",
              estimatedMinutes: 14,
              prerequisites: ["sharding", "message-queues"],
              status: "available",
              sections: [
                { id: "push-vs-pull", title: "Push vs pull", kind: "concept" },
                { id: "celebrity", title: "The celebrity posts", kind: "interactive" },
                { id: "hybrid", title: "The hybrid fix", kind: "interactive" },
              ],
            },
            {
              slug: "cap-theorem",
              moduleSlug: "distributed",
              title: "The CAP Theorem",
              tagline:
                "Drag a partition through the system, then choose: reject writes (CP) or diverge (AP).",
              difficulty: "advanced",
              estimatedMinutes: 16,
              prerequisites: ["replication", "message-queues"],
              status: "available",
              sections: [
                { id: "the-choice", title: "Partition tolerance isn't optional", kind: "concept" },
                { id: "partition", title: "Split the network", kind: "interactive" },
                { id: "cp-vs-ap", title: "CP or AP — you decide", kind: "interactive" },
              ],
            },
            {
              slug: "leader-election",
              moduleSlug: "distributed",
              title: "Leader Election",
              tagline:
                "Kill the leader and watch five nodes vote — then keep killing until no majority remains.",
              difficulty: "advanced",
              estimatedMinutes: 16,
              prerequisites: ["replication", "cap-theorem"],
              status: "available",
              sections: [
                { id: "why-a-leader", title: "Why elect anyone?", kind: "concept" },
                { id: "kill-the-leader", title: "Kill the leader", kind: "interactive" },
                { id: "quorum", title: "No majority, no leader", kind: "interactive" },
              ],
            },
            {
              slug: "gossip",
              moduleSlug: "distributed",
              title: "Gossip Protocols",
              tagline:
                "No leader, no broadcast — every node tells a few friends, and the rumor still reaches everyone.",
              difficulty: "advanced",
              estimatedMinutes: 13,
              prerequisites: ["leader-election"],
              status: "available",
              sections: [
                { id: "epidemic", title: "Epidemics as infrastructure", kind: "concept" },
                { id: "spread-it", title: "Spread a rumor", kind: "interactive" },
                { id: "lose-nodes", title: "Losing nodes mid-rumor", kind: "interactive" },
              ],
            },
            {
              slug: "two-phase-commit",
              moduleSlug: "distributed",
              title: "Two-Phase Commit",
              tagline:
                "Every participant voted yes — then the coordinator died. Now nobody can move.",
              difficulty: "advanced",
              estimatedMinutes: 14,
              prerequisites: ["cap-theorem"],
              status: "available",
              sections: [
                { id: "all-or-nothing", title: "All or nothing", kind: "concept" },
                { id: "run-a-commit", title: "Run a commit", kind: "interactive" },
                { id: "coordinator-dies", title: "Kill the coordinator", kind: "interactive" },
              ],
            },
            {
              slug: "geo-replication",
              moduleSlug: "distributed",
              title: "Geo-Replication",
              tagline:
                "Two regions, one dataset — every write chooses between the speed of light and a conflict.",
              difficulty: "advanced",
              estimatedMinutes: 15,
              prerequisites: ["replication", "cap-theorem"],
              status: "available",
              sections: [
                { id: "speed-of-light", title: "The speed of light is a dependency", kind: "concept" },
                { id: "two-regions", title: "Write in two regions", kind: "interactive" },
                { id: "conflict-or-wait", title: "Conflict or wait — pick one", kind: "interactive" },
                { id: "region-failover", title: "Region failover", kind: "concept" },
              ],
            },
                      {
              slug: "quorums",
              moduleSlug: "distributed",
              title: "Quorums",
              tagline:
                "Ask fewer replicas and you answer faster — until a read and a write pick sets that never touch.",
              difficulty: "advanced",
              estimatedMinutes: 14,
              prerequisites: ["replication"],
              status: "available",
              sections: [
                { id: "why-majority", title: "Why a majority is the unit", kind: "concept" },
                { id: "write-quorum", title: "Waiting for W acks", kind: "interactive" },
                { id: "read-quorum", title: "Reading from R replicas", kind: "interactive" },
                { id: "tuning", title: "Trading latency for certainty", kind: "concept" },
              ],
            },
                      {
              slug: "outbox-pattern",
              moduleSlug: "distributed",
              title: "The Outbox Pattern",
              tagline:
                "Two writes with no transaction between them. Lose the event, or make it part of the commit.",
              difficulty: "advanced",
              estimatedMinutes: 13,
              prerequisites: ["delivery-guarantees"],
              status: "available",
              sections: [
                { id: "two-writes", title: "Two writes and no transaction", kind: "concept" },
                { id: "dual-write", title: "Losing the event", kind: "interactive" },
                { id: "outbox", title: "One transaction then a relay", kind: "interactive" },
                { id: "at-least-once", title: "What the relay guarantees", kind: "concept" },
              ],
            },
                      {
              slug: "distributed-locks",
              moduleSlug: "distributed",
              title: "Distributed Locks & Clock Skew",
              tagline:
                "A lease says who holds the lock. Only a fencing token says whose write is allowed to land.",
              difficulty: "advanced",
              estimatedMinutes: 15,
              prerequisites: ["leader-election"],
              status: "available",
              sections: [
                { id: "across-machines", title: "A lock that spans machines", kind: "concept" },
                { id: "lease-expiry", title: "The pause that outlives the lease", kind: "interactive" },
                { id: "fencing", title: "Fencing the stale holder", kind: "interactive" },
                { id: "clocks", title: "Why the clock is not the answer", kind: "concept" },
              ],
            },
          ],
        },
      ],
    },

    /* ================================================================ *
     * Track 02 — Concurrency
     *
     * The first track built on archetype B (the discrete-step player), so its
     * lessons declare `engine: "steps"` and export an `AlgoDef` instead of a
     * `LessonSim`. Seeded interleaving is what makes this teachable: a race
     * replays identically and can be stepped BACKWARD, which the packet
     * engine cannot do.
     * ================================================================ */
    {
      slug: "concurrency",
      title: "Concurrency",
      description:
        "Two threads, one variable, and the orders you never chose — races made reproducible.",
      accent: "violet",
      modules: [
        {
          slug: "shared-state",
          title: "Shared State",
          description: "What goes wrong when work overlaps.",
          lessons: [
            {
              slug: "data-races",
              moduleSlug: "shared-state",
              title: "Data Races",
              tagline:
                "`counter++` is three operations, and the scheduler is allowed to cut between any of them.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: [],
              status: "available",
              engine: "steps",
              sections: [
                { id: "three-operations", title: "One line, three operations", kind: "concept" },
                { id: "interleave-it", title: "Interleave it yourself", kind: "interactive" },
                { id: "mutual-exclusion", title: "Serialising the middle", kind: "concept" },
              ],
            },
            {
              slug: "deadlock",
              moduleSlug: "shared-state",
              title: "Deadlock",
              tagline:
                "Both threads locked correctly. They just locked in different orders, and now neither can move.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["data-races"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "circular-wait", title: "Correct locks, wrong order", kind: "concept" },
                { id: "watch-it-hang", title: "Watch it hang", kind: "interactive" },
                { id: "break-the-cycle", title: "Breaking the cycle", kind: "concept" },
              ],
            },
            {
              slug: "atomic-operations",
              moduleSlug: "shared-state",
              title: "Atomics & Compare-and-Swap",
              tagline:
                "Don't stop other threads from writing — make your write fail when they already did.",
              difficulty: "intermediate",
              estimatedMinutes: 13,
              prerequisites: ["data-races"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "indivisible", title: "Conditional, not exclusive", kind: "concept" },
                { id: "swap-or-retry", title: "Swap, or lose and retry", kind: "interactive" },
                { id: "contention-cost", title: "What optimism costs", kind: "concept" },
              ],
            },
            {
              slug: "producer-consumer",
              moduleSlug: "shared-state",
              title: "Producer/Consumer & Backpressure",
              tagline:
                "A bounded buffer lets two threads run at different speeds — until it fills, and the slow end starts setting the pace.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["data-races"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "handoff", title: "Waiting on a condition, not a lock", kind: "concept" },
                { id: "watch-the-buffer", title: "Watch the buffer fill", kind: "interactive" },
                { id: "backpressure", title: "When the slow end sets the pace", kind: "concept" },
              ],
            },
            {
              slug: "lock-granularity",
              moduleSlug: "shared-state",
              title: "Lock Granularity",
              tagline:
                "One lock is easiest to reason about, and makes threads that share nothing wait for each other.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["data-races", "deadlock"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "one-lock-for-everything", title: "One lock for everything", kind: "concept" },
                { id: "contention", title: "Contention grows with the square", kind: "interactive" },
                { id: "splitting-the-lock", title: "Splitting along the data", kind: "concept" },
              ],
            },
            {
              slug: "read-write-locks",
              moduleSlug: "shared-state",
              title: "Read-Write Locks",
              tagline:
                "Readers don't conflict with readers — so a lock that excludes them from each other is answering the wrong question.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["lock-granularity"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "too-strong", title: "Stronger than the work needs", kind: "concept" },
                { id: "sharing-reads", title: "Many readers, one writer", kind: "interactive" },
                { id: "what-it-costs", title: "What exclusivity costs", kind: "concept" },
              ],
            },
            {
              slug: "memory-visibility",
              moduleSlug: "shared-state",
              title: "Memory Visibility & Reordering",
              tagline:
                "No race, no shared variable, no bug you can point at — and two threads that disagree about what happened first.",
              difficulty: "advanced",
              estimatedMinutes: 12,
              prerequisites: ["data-races", "atomic-operations"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "writes-take-time", title: "A write is not instant", kind: "concept" },
                { id: "both-miss", title: "Both threads read zero", kind: "interactive" },
                { id: "fences", title: "Buying an order everyone agrees on", kind: "concept" },
              ],
            },
            {
              slug: "false-sharing",
              moduleSlug: "shared-state",
              title: "False Sharing",
              tagline:
                "Two threads, two separate counters, no shared data — and they still fight, because the variables are neighbours.",
              difficulty: "advanced",
              estimatedMinutes: 10,
              prerequisites: ["memory-visibility"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "nothing-is-shared", title: "Contention without sharing", kind: "concept" },
                { id: "the-ping-pong", title: "Watch the line ping-pong", kind: "interactive" },
                { id: "padding", title: "Fixing it with space", kind: "concept" },
              ],
            },
            {
              slug: "thread-pools",
              moduleSlug: "shared-state",
              title: "Thread Pools & Queueing",
              tagline:
                "Past the limit of the resource behind them, extra threads buy queueing rather than throughput.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["producer-consumer"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "a-thread-each", title: "A thread for every request", kind: "concept" },
                { id: "threads-that-wait", title: "Threads that exist to wait", kind: "interactive" },
                { id: "sizing-to-the-resource", title: "Sizing to the resource", kind: "concept" },
              ],
            },
          ],
        },
      ],
    },

    /* ================================================================ *
     * Track 03 — Databases & Transactions
     *
     * Also archetype B. A transaction interleaving is the same scheduler as
     * concurrency, but the reader needs to see ROWS — specifically the gap
     * between what is committed and what a transaction has written but not yet
     * committed, which is where every read anomaly lives. Hence `TableView`.
     * ================================================================ */
    {
      slug: "databases",
      title: "Databases & Transactions",
      description:
        "What a transaction actually guarantees, and what it quietly does not.",
      accent: "green",
      modules: [
        {
          slug: "transactions",
          title: "Transactions",
          description: "Atomicity, isolation, and the anomalies in between.",
          lessons: [
            {
              slug: "dirty-reads",
              moduleSlug: "transactions",
              title: "Dirty Reads and Read Committed",
              tagline:
                "The table is correct before and after. A reader looked in between, and filed a report on a number that never existed.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: [],
              status: "available",
              engine: "steps",
              sections: [
                { id: "uncommitted", title: "Reading what was never true", kind: "concept" },
                { id: "watch-the-rollback", title: "Watch the rollback", kind: "interactive" },
                { id: "read-committed", title: "What read committed costs", kind: "concept" },
              ],
            },
                      {
              slug: "non-repeatable-reads",
              moduleSlug: "transactions",
              title: "Non-Repeatable Reads",
              tagline:
                "Every value it read was committed. It still added up two numbers that were never true at the same time.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["dirty-reads"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "read-twice", title: "Read the same row twice", kind: "concept" },
                { id: "watch-it-change", title: "Watch it change underneath", kind: "interactive" },
                { id: "snapshots", title: "Reading from a snapshot", kind: "concept" },
              ],
            },
                      {
              slug: "write-skew",
              moduleSlug: "transactions",
              title: "Write Skew",
              tagline:
                "Two transactions, each correct against its own snapshot, together break a rule neither of them broke.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["non-repeatable-reads"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "each-is-correct", title: "Each transaction is correct", kind: "concept" },
                { id: "break-the-invariant", title: "Break the invariant", kind: "interactive" },
                { id: "serializable", title: "What serializable refuses", kind: "concept" },
              ],
            },
            {
              slug: "lost-update",
              moduleSlug: "transactions",
              title: "Lost Update",
              tagline:
                "Deposit 50, withdraw 30, and watch one of them stop having happened — with no error reported.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["write-skew"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "both-read-first", title: "Both read before either writes", kind: "concept" },
                { id: "watch-it-vanish", title: "Watch an update vanish", kind: "interactive" },
                { id: "retry", title: "Refused rather than fixed", kind: "concept" },
              ],
            },
            {
              slug: "two-phase-locking",
              moduleSlug: "transactions",
              title: "Two-Phase Locking",
              tagline:
                "Serializable is a guarantee, not a mechanism — you can reach it by aborting late or by waiting early.",
              difficulty: "advanced",
              estimatedMinutes: 12,
              prerequisites: ["lost-update"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "why-not-wait", title: "Why not just wait?", kind: "concept" },
                { id: "optimistic-cost", title: "What optimism discards", kind: "concept" },
                { id: "pessimistic", title: "Waiting instead", kind: "interactive" },
              ],
            },
          ],
        },
        {
          slug: "durability",
          title: "Durability & Recovery",
          description:
            "What survives losing power, and what it costs to make that promise.",
          lessons: [
            {
              slug: "write-ahead-logging",
              moduleSlug: "durability",
              title: "Write-Ahead Logging",
              tagline:
                "A commit that has not reached the disk is a promise. Losing power is how you find out whether it was kept.",
              difficulty: "advanced",
              estimatedMinutes: 14,
              prerequisites: ["dirty-reads"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "commit-promise", title: "What a commit promises", kind: "concept" },
                { id: "without-a-log", title: "Losing the promise", kind: "interactive" },
                { id: "with-a-log", title: "Logging the change first", kind: "interactive" },
                { id: "the-ordering-rule", title: "Why the order is the rule", kind: "concept" },
              ],
            },
                      {
              slug: "checkpoints",
              moduleSlug: "durability",
              title: "Checkpoints",
              tagline:
                "If restarting means replaying the whole log, then the longer a database runs without incident, the worse the incident is.",
              difficulty: "advanced",
              estimatedMinutes: 12,
              prerequisites: ["write-ahead-logging"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "log-grows", title: "Recovery has no floor", kind: "concept" },
                { id: "without-checkpoint", title: "Replaying from the beginning", kind: "interactive" },
                { id: "with-checkpoint", title: "Giving redo a floor", kind: "interactive" },
                { id: "two-bounds", title: "Why undo cannot start there", kind: "concept" },
              ],
            },
                      {
              slug: "group-commit",
              moduleSlug: "durability",
              title: "Group Commit",
              tagline:
                "One fsync can answer a hundred transactions. What it costs is not safety — it is the wait.",
              difficulty: "advanced",
              estimatedMinutes: 11,
              prerequisites: ["write-ahead-logging"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "one-each", title: "One force per transaction", kind: "concept" },
                { id: "forcing-each", title: "Answering immediately", kind: "interactive" },
                { id: "one-force", title: "One force for the batch", kind: "interactive" },
                { id: "latency-not-safety", title: "What was actually traded", kind: "concept" },
              ],
            },
          ],
        },
        {
          slug: "mvcc",
          title: "Multi-Version Concurrency Control",
          description:
            "How a reader looks at an older world while writers move on — the machinery behind the snapshot.",
          lessons: [
            {
              slug: "multi-version-reads",
              moduleSlug: "mvcc",
              title: "Multi-Version Reads",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "advanced",
              estimatedMinutes: 13,
              prerequisites: ["non-repeatable-reads", "lost-update"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "one-cell", title: "A row is not one cell", kind: "concept" },
                { id: "readers-dont-block", title: "Readers never block writers", kind: "interactive" },
                { id: "write-conflict", title: "When two writers collide", kind: "interactive" },
                { id: "what-it-costs", title: "What versions cost", kind: "concept" },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "testing",
      title: "Testing & Verification",
      description:
        "A green suite is evidence about the tests, not about the code. These lessons measure the difference.",
      accent: "cyan",
      modules: [
        {
          slug: "test-quality",
          title: "What a Suite Actually Checks",
          description:
            "Coverage says a line ran. Mutation testing says whether anything would have noticed.",
          lessons: [
            {
              slug: "coverage-vs-correctness",
              moduleSlug: "test-quality",
              title: "Coverage Is Not Correctness",
              tagline:
                "Both suites cover every line. Only one of them would notice if a line were wrong.",
              difficulty: "intermediate",
              estimatedMinutes: 13,
              prerequisites: [],
              status: "available",
              engine: "steps",
              sections: [
                { id: "green-suite", title: "What green actually proves", kind: "concept" },
                { id: "weak-assertions", title: "A suite that notices nothing", kind: "interactive" },
                { id: "strengthened", title: "Making the tests care", kind: "interactive" },
                { id: "reading-survivors", title: "Every survivor is a hole", kind: "concept" },
              ],
            },
                      {
              slug: "boundary-mutants",
              moduleSlug: "test-quality",
              title: "Boundaries and Off-By-One",
              tagline:
                "Exact assertions still miss the bug when every test input sits away from the edge.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["coverage-vs-correctness"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "near-the-edge", title: "Testing near the edge", kind: "concept" },
                { id: "far-tests", title: "Values that never probe", kind: "interactive" },
                { id: "at-the-edge", title: "Testing on the edge", kind: "interactive" },
                { id: "why-boundaries", title: "Why boundaries hide bugs", kind: "concept" },
              ],
            },
                      {
              slug: "equivalent-mutants",
              moduleSlug: "test-quality",
              title: "Not Every Survivor Is a Bug",
              tagline:
                "A perfect suite still leaves some mutants alive. Chasing 100% means writing tests that can never fail.",
              difficulty: "advanced",
              estimatedMinutes: 11,
              prerequisites: ["coverage-vs-correctness"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "chasing-100", title: "Why 100 percent is not the target", kind: "concept" },
                { id: "unkillable", title: "A mutant no test can kill", kind: "interactive" },
                { id: "real-holes", title: "The survivors that do matter", kind: "interactive" },
                { id: "reading-the-score", title: "What the number is for", kind: "concept" },
              ],
            },
                      {
              slug: "assertion-free-tests",
              moduleSlug: "test-quality",
              title: "Assertion-Free Tests",
              tagline:
                "Every line executes and CI turns green, but a suite without assertions only catches crashes.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["equivalent-mutants"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "line-coverage", title: "A suite that asserts nothing", kind: "concept" },
                { id: "smoke-suite", title: "The smoke test", kind: "interactive" },
                { id: "with-assertions", title: "Checking the outcome", kind: "interactive" },
                { id: "assertion-density", title: "What coverage missed", kind: "concept" },
              ],
            },
                      {
              slug: "brittle-mocks",
              moduleSlug: "test-quality",
              title: "Brittle Mocks vs State Verification",
              tagline:
                "Asserting how code executes breaks on safe refactors and sleeps through broken results.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["assertion-free-tests"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "mock-fragility", title: "Coupling to implementation", kind: "concept" },
                { id: "mock-suite", title: "The mock-heavy suite", kind: "interactive" },
                { id: "state-suite", title: "Testing the outcome", kind: "interactive" },
                { id: "state-vs-interaction", title: "Testing what vs how", kind: "concept" },
              ],
            },
          ],
        },
        {
          slug: "flakiness",
          title: "Tests That Lie",
          description:
            "A test that passes sometimes is worse than one that fails, because it teaches you to ignore it.",
          lessons: [
            {
              slug: "flaky-tests",
              moduleSlug: "flakiness",
              title: "Why Suites Go Flaky",
              tagline:
                "The same two tests come out green or red depending on an order nobody wrote down.",
              difficulty: "intermediate",
              estimatedMinutes: 13,
              prerequisites: ["coverage-vs-correctness"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "shared-state", title: "Anything two tests share", kind: "concept" },
                { id: "passing-order", title: "The order that passes", kind: "interactive" },
                { id: "failing-order", title: "The order that fails", kind: "interactive" },
                { id: "isolation", title: "What isolation costs", kind: "concept" },
              ],
            },
                      {
              slug: "test-pollution",
              moduleSlug: "flakiness",
              title: "Tests That Depend on Each Other",
              tagline:
                "One test leans on another's leftover state, so it passes only when that test runs first.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["flaky-tests"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "hidden-order", title: "The order you never wrote", kind: "concept" },
                { id: "polluted", title: "When one test needs another", kind: "interactive" },
                { id: "isolated", title: "Setting up your own state", kind: "interactive" },
                { id: "isolation-cost", title: "Isolation is the cure", kind: "concept" },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "version-control",
      title: "Version Control & Delivery",
      description:
        "The same work can leave two different shapes in history, and the shape is the thing you have to live with.",
      accent: "red",
      modules: [
        {
          slug: "history",
          title: "Shaping History",
          description:
            "What merge, rebase and fast-forward actually do to the commit graph.",
          lessons: [
            {
              slug: "merge-vs-rebase",
              moduleSlug: "history",
              title: "Merge vs Rebase",
              tagline:
                "Identical work, two shapes: one records the join, the other replaces your commits with copies.",
              difficulty: "intermediate",
              estimatedMinutes: 13,
              prerequisites: [],
              status: "available",
              engine: "steps",
              sections: [
                { id: "same-work", title: "Identical work two shapes", kind: "concept" },
                { id: "by-merge", title: "Integrating by merge", kind: "interactive" },
                { id: "by-rebase", title: "Integrating by rebase", kind: "interactive" },
                { id: "choosing", title: "What each shape costs", kind: "concept" },
              ],
            },
                      {
              slug: "fast-forward",
              moduleSlug: "history",
              title: "Fast-Forward",
              tagline:
                "The command you type does not decide whether you get a merge commit. Divergence does.",
              difficulty: "foundational",
              estimatedMinutes: 10,
              prerequisites: ["merge-vs-rebase"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "expecting-a-commit", title: "The merge commit you did not get", kind: "concept" },
                { id: "ff", title: "When it fast-forwards", kind: "interactive" },
                { id: "no-ff", title: "When it cannot", kind: "interactive" },
                { id: "divergence", title: "Divergence is the condition", kind: "concept" },
              ],
            },
                      {
              slug: "cherry-pick-revert",
              moduleSlug: "history",
              title: "Cherry-Pick and Revert",
              tagline:
                "Cherry-pick copies a commit and the copy returns at the next merge. Revert only adds, so it is safe on history others already have.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["merge-vs-rebase"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "one-commit", title: "You want one commit not the branch", kind: "concept" },
                { id: "cherry-pick", title: "Copying a commit across", kind: "interactive" },
                { id: "revert", title: "Inverting a commit in place", kind: "interactive" },
                { id: "duplicates", title: "Why the copy comes back", kind: "concept" },
              ],
            },
                      {
              slug: "reset",
              moduleSlug: "history",
              title: "Reset",
              tagline:
                "Revert undoes a commit and keeps it; reset moves the branch and discards whatever was ahead. One is safe to share, one takes a teammate's base out from under them.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["cherry-pick-revert"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "move-a-pointer", title: "Moving a branch pointer", kind: "concept" },
                { id: "discarding", title: "Discarding commits", kind: "interactive" },
                { id: "recovering", title: "When the work survives", kind: "interactive" },
                { id: "reset-vs-revert", title: "Reset versus revert", kind: "concept" },
              ],
            },
          ],
        },
        {
          slug: "delivery",
          title: "Shipping It",
          description:
            "Getting a change in front of users without betting the whole fleet on it.",
          lessons: [
            {
              slug: "canary-releases",
              moduleSlug: "delivery",
              title: "Canary Releases",
              tagline:
                "A bad deploy to everyone fails everyone. A bad deploy to a slice fails only the slice, and hands you a slider back.",
              difficulty: "intermediate",
              estimatedMinutes: 13,
              prerequisites: [],
              status: "available",
              sections: [
                { id: "all-at-once", title: "Shipping to everyone at once", kind: "concept" },
                { id: "canary", title: "A fraction of the traffic", kind: "interactive" },
                { id: "rollback", title: "Catching it and backing out", kind: "interactive" },
                { id: "blind-spots", title: "What a canary cannot see", kind: "concept" },
              ],
            },
                      {
              slug: "blue-green",
              moduleSlug: "delivery",
              title: "Blue-Green Deploys",
              tagline:
                "Flip the whole fleet at once: recovery as fast as the mistake, and every user exposed while it is wrong.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["canary-releases"],
              status: "available",
              sections: [
                { id: "two-fleets", title: "Paying for a second fleet", kind: "concept" },
                { id: "cutover", title: "Flipping every request at once", kind: "interactive" },
                { id: "revert", title: "Flipping back", kind: "interactive" },
                { id: "versus-canary", title: "What each one actually buys", kind: "concept" },
              ],
            },
                      {
              slug: "feature-flags",
              moduleSlug: "delivery",
              title: "Feature Flags",
              tagline:
                "Deploy puts the code on every server. Release is one runtime value — and every value you leave behind is a branch someone still has to test.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["canary-releases"],
              status: "available",
              sections: [
                { id: "deploy-vs-release", title: "Deploy and release are not the same", kind: "concept" },
                { id: "dark", title: "Shipped but dark", kind: "interactive" },
                { id: "releasing", title: "Releasing without deploying", kind: "interactive" },
                { id: "flag-debt", title: "What a flag costs to keep", kind: "concept" },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "networking",
      title: "Networking & the Web",
      description:
        "What a browser actually does to fetch a URL — names, connections, and the round trips you pay before the first byte.",
      accent: "cyan",
      modules: [
        {
          slug: "web-requests",
          title: "Making a Web Request",
          description:
            "Name it, connect to it, exchange bytes, and reuse the connection — the request lifecycle, one round trip at a time.",
          lessons: [
            {
              slug: "dns-resolution",
              moduleSlug: "web-requests",
              title: "DNS Resolution",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "foundational",
              estimatedMinutes: 12,
              prerequisites: [],
              status: "available",
              sections: [
                { id: "names-not-addresses", title: "A name is not an address", kind: "concept" },
                { id: "resolve-it", title: "Walk the hierarchy", kind: "interactive" },
                { id: "ttl-and-cache", title: "Caching and TTL", kind: "interactive" },
                { id: "when-it-goes-stale", title: "When the cache goes stale", kind: "concept" },
              ],
            },
                      {
              slug: "tcp-handshake",
              moduleSlug: "web-requests",
              title: "The TCP Handshake",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "foundational",
              estimatedMinutes: 12,
              prerequisites: ["dns-resolution"],
              status: "available",
              sections: [
                { id: "before-any-data", title: "Before any data", kind: "concept" },
                { id: "do-the-handshake", title: "Do the handshake", kind: "interactive" },
                { id: "lossy-links", title: "When a packet is lost", kind: "interactive" },
                { id: "cost-of-a-connection", title: "The cost of a connection", kind: "concept" },
              ],
            },
                      {
              slug: "http-request-response",
              moduleSlug: "web-requests",
              title: "HTTP Request & Response",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "foundational",
              estimatedMinutes: 12,
              prerequisites: ["tcp-handshake"],
              status: "available",
              sections: [
                { id: "one-connection", title: "One connection at a time", kind: "concept" },
                { id: "send-a-request", title: "Send some requests", kind: "interactive" },
                { id: "head-of-line", title: "Requests wait in line", kind: "interactive" },
                { id: "what-a-request-costs", title: "What a request really costs", kind: "concept" },
              ],
            },
                      {
              slug: "connection-reuse",
              moduleSlug: "web-requests",
              title: "Keep-Alive & Connection Reuse",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["http-request-response"],
              status: "available",
              sections: [
                { id: "paying-twice", title: "Paying the setup cost twice", kind: "concept" },
                { id: "reuse-it", title: "Reuse the connection", kind: "interactive" },
                { id: "pool-under-load", title: "A pool under load", kind: "interactive" },
                { id: "what-reuse-buys", title: "What reuse buys you", kind: "concept" },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "software-design",
      title: "Software Design & Architecture",
      description:
        "Structure as a measurable thing — refactorings that move complexity and coupling, watched on the code they rewrite.",
      accent: "green",
      modules: [
        {
          slug: "refactoring",
          title: "Refactoring by the Numbers",
          description:
            "Every refactoring changes a metric. Extract, inline, and de-duplicate, and watch cyclomatic complexity and coupling move on the AST itself.",
          lessons: [
            {
              slug: "extract-function",
              moduleSlug: "refactoring",
              title: "Extract Function",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: [],
              status: "available",
              engine: "steps",
              sections: [
                { id: "the-long-method", title: "The long method", kind: "concept" },
                { id: "extract-it", title: "Extract the block", kind: "interactive" },
                { id: "what-moved", title: "What the metric proves", kind: "concept" },
              ],
            },
                      {
              slug: "inline-and-rename",
              moduleSlug: "refactoring",
              title: "Inline & Rename",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "intermediate",
              estimatedMinutes: 11,
              prerequisites: ["extract-function"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "over-abstracted", title: "Over-abstracted", kind: "concept" },
                { id: "inline-it", title: "Inline and rename", kind: "interactive" },
                { id: "structure-is-a-dial", title: "Structure is a dial", kind: "concept" },
              ],
            },
                      {
              slug: "duplicated-logic",
              moduleSlug: "refactoring",
              title: "Duplicated Logic",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["extract-function"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "copy-paste", title: "The copy-paste smell", kind: "concept" },
                { id: "de-duplicate", title: "Extract the shared block", kind: "interactive" },
                { id: "what-moved", title: "Duplication as a number", kind: "concept" },
              ],
            },
                      {
              slug: "extract-class",
              moduleSlug: "refactoring",
              title: "Extract Class",
              tagline:
                "A class that calculates prices and formats receipts has two reasons to change and twice the coupling.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["extract-function"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "god-class", title: "The god class", kind: "concept" },
                { id: "extract-class", title: "Extract the class", kind: "interactive" },
                { id: "cohesion-metrics", title: "Lack of cohesion", kind: "concept" },
              ],
            },
            {
              slug: "replace-conditional",
              moduleSlug: "refactoring",
              title: "Replace Conditional with Polymorphism",
              tagline:
                "Every branch on a type code is a future edit waiting to happen — polymorphic dispatch trades one centralized hotspot for distributed, single-path collaborators.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["extract-class"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "switch-chains", title: "Cascading conditionals", kind: "concept" },
                { id: "polymorphic-dispatch", title: "Polymorphic dispatch", kind: "interactive" },
                { id: "complexity-distribution", title: "Distributing complexity", kind: "concept" },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "engineering-practice",
      title: "Engineering Practice",
      description:
        "The judgement calls — on-call decisions where a choice sets a real parameter of a running system and the outcome you measure follows from it.",
      accent: "violet",
      modules: [
        {
          slug: "on-call",
          title: "On-Call Decisions",
          description:
            "A choice is only a lesson if it changes a measured outcome. Each scenario sets a parameter of a real run and shows the numbers diverge by what you picked.",
          lessons: [
            {
              slug: "the-mutex-call",
              moduleSlug: "on-call",
              title: "The Mutex Call",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: [],
              status: "available",
              engine: "steps",
              sections: [
                { id: "the-page", title: "The page at 2am", kind: "concept" },
                { id: "make-the-call", title: "Make the call", kind: "interactive" },
                { id: "what-the-run-measured", title: "What the run measured", kind: "concept" },
              ],
            },
                      {
              slug: "retry-or-back-off",
              moduleSlug: "on-call",
              title: "Retry or Back Off",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["the-mutex-call"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "the-storm", title: "The retry storm", kind: "concept" },
                { id: "make-the-call", title: "Choose a retry policy", kind: "interactive" },
                { id: "what-diverged", title: "What diverged", kind: "concept" },
              ],
            },
                      {
              slug: "thread-pool-sizing",
              moduleSlug: "on-call",
              title: "Thread Pool vs Bounded Queue",
              tagline:
                "When downstream calls stall, expanding threads thrashes CPU and deep queues explode latency; only bounded pools with fast rejection preserve throughput.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["the-mutex-call"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "latency-spike", title: "Downstream latency spike", kind: "concept" },
                { id: "queue-vs-threads", title: "Tune pool and queue", kind: "interactive" },
                { id: "fail-fast", title: "Fast rejection preserves throughput", kind: "concept" },
              ],
            },
            {
              slug: "circuit-breaker-hysteresis",
              moduleSlug: "on-call",
              title: "Circuit Breaker Hysteresis",
              tagline:
                "Reopen too quickly and a fragile service collapses again; wait too long and healthy capacity sits idle.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["the-mutex-call"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "dependency-flapping", title: "The flapping dependency", kind: "concept" },
                { id: "probe-policy", title: "Choose recovery probing", kind: "interactive" },
                { id: "hysteresis", title: "Damped recovery", kind: "concept" },
              ],
            },
            {
              slug: "zero-downtime-migration",
              moduleSlug: "on-call",
              title: "Zero-Downtime Schema Migration",
              tagline:
                "A single ALTER TABLE drops hundreds of live writes behind an exclusive lock — unless you expand, dual-write, and contract.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["the-mutex-call"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "live-database", title: "Migrating under 1000 writes per sec", kind: "concept" },
                { id: "migration-sequence", title: "Pick the step sequence", kind: "interactive" },
                { id: "expand-contract", title: "The expand contract pattern", kind: "concept" },
              ],
            },
          ],
        },
        {
          slug: "resilience-engineering",
          title: "Resilience Engineering",
          description:
            "Hardening distributed systems against cascading failure, stampedes, and partition anomalies — where local protective actions must not amplify systemic collapse.",
          lessons: [
            {
              slug: "cascading-failure",
              moduleSlug: "resilience-engineering",
              title: "Cascading Failure and Thundering Herd",
              tagline:
                "When a cache node fails under 10k QPS, direct queries and blind retries crush the database; only singleflight coalescing collapses the thundering herd.",
              difficulty: "intermediate",
              estimatedMinutes: 12,
              prerequisites: ["the-mutex-call"],
              status: "available",
              engine: "steps",
              sections: [
                { id: "cache-failure", title: "Cache node failure", kind: "concept" },
                { id: "stampede-policy", title: "Handle the stampede", kind: "interactive" },
                { id: "singleflight-protection", title: "Request coalescing", kind: "concept" },
              ],
            },
          ],
        },
      ],
    },
  ],
};
