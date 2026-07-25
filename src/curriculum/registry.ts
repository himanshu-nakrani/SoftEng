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
          ],
        },
      ],
    },
  ],
};
