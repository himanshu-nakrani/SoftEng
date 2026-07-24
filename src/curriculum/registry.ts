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
          ],
        },
      ],
    },
  ],
};
