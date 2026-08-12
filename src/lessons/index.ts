/**
 * `simBySlug` — every shipped lesson's `LessonSim`, keyed by lesson slug.
 *
 * The registry (`src/lib/curriculum.ts`) knows which lessons exist; it does not
 * know their simulations, because a `LessonSim` carries functions and lives in
 * the lesson layer. This file is the join between the two, and it exists for
 * the review deck (`/review`), which needs every lesson's `quiz` checkpoints —
 * question text, choices, `explain`, `at` — without mounting 22 figures.
 *
 * WHY A STATIC MAP: a template-literal `import("@/lessons/" + slug)` resolves
 * for neither `tsc` nor the bundler (and a static export has to bundle what it
 * ships), so the mapping is written out. Same reason, same shape, and
 * deliberately the same `widen()` idiom as the test harness's `SIM_BY_KEY` —
 * but kept separate from it: `src/engine/__tests__` is tooling, and product
 * code must not import from a test directory.
 *
 *   ADDING A LESSON? Add one line here (and one in the harness's `SIM_BY_KEY`).
 *
 * A slug the registry lists but this map lacks is NOT fatal: `getSim` returns
 * undefined and the review page skips that lesson — warning once in dev, silent
 * in production. That is the deliberate failure mode. A lesson mid-flight (page
 * and registry entry landed, sim still being authored) must not blank the
 * review route, and a missing checkpoint is a smaller lie than a crash.
 */

import type { LessonSim } from "@/engine/types";

import { cacheStampedeSim } from "@/lessons/data/cache-stampede";
import { cachingSim } from "@/lessons/data/caching";
import { cdnEdgeSim } from "@/lessons/data/cdn-edge";
import { consistentHashingSim } from "@/lessons/data/consistent-hashing";
import { replicationSim } from "@/lessons/data/replication";
import { shardingSim } from "@/lessons/data/sharding";
import { incidentTriageSim } from "@/lessons/observability/incident-triage";
import { metricsLogsTracesSim } from "@/lessons/observability/metrics-logs-traces";
import { slosErrorBudgetsSim } from "@/lessons/observability/slos-error-budgets";
import { capTheoremSim } from "@/lessons/distributed/cap-theorem";
import { deliveryGuaranteesSim } from "@/lessons/distributed/delivery-guarantees";
import { fanoutSim } from "@/lessons/distributed/fanout";
import { geoReplicationSim } from "@/lessons/distributed/geo-replication";
import { gossipSim } from "@/lessons/distributed/gossip";
import { leaderElectionSim } from "@/lessons/distributed/leader-election";
import { messageQueuesSim } from "@/lessons/distributed/message-queues";
import { rateLimitingSim } from "@/lessons/distributed/rate-limiting";
import { twoPhaseCommitSim } from "@/lessons/distributed/two-phase-commit";
import { circuitBreakerSim } from "@/lessons/resilience/circuit-breaker";
import { retriesTimeoutsSim } from "@/lessons/resilience/retries-timeouts";
import { tailLatencySim } from "@/lessons/resilience/tail-latency";
import { autoscalingSim } from "@/lessons/scaling/autoscaling";
import { clientServerSim } from "@/lessons/scaling/client-server";
import { loadBalancingSim } from "@/lessons/scaling/load-balancing";
import { realtimeDeliverySim } from "@/lessons/scaling/realtime-delivery";
import { scalingStrategiesSim } from "@/lessons/scaling/scaling-strategies";

/**
 * `LessonSim<L>` is invariant in `L` (covariant `init`, contravariant `step`),
 * so a heterogeneous collection of lesson sims has no common supertype. Widen
 * once here exactly the way `createRunner` does internally, then treat lesson
 * state as opaque — nothing downstream of this map reads `state.lesson`.
 */
function widen<L>(sim: LessonSim<L>): LessonSim<unknown> {
  return sim as unknown as LessonSim<unknown>;
}

/** Lesson slug → its simulation. Keys MUST equal the registry's lesson slugs. */
export const simBySlug: Record<string, LessonSim<unknown>> = {
  // scaling
  "client-server": widen(clientServerSim),
  "scaling-strategies": widen(scalingStrategiesSim),
  "load-balancing": widen(loadBalancingSim),
  autoscaling: widen(autoscalingSim),
  "realtime-delivery": widen(realtimeDeliverySim),
  // data
  caching: widen(cachingSim),
  "cache-stampede": widen(cacheStampedeSim),
  "cdn-edge": widen(cdnEdgeSim),
  replication: widen(replicationSim),
  sharding: widen(shardingSim),
  "consistent-hashing": widen(consistentHashingSim),
  // observability
  "metrics-logs-traces": widen(metricsLogsTracesSim),
  "slos-error-budgets": widen(slosErrorBudgetsSim),
  "incident-triage": widen(incidentTriageSim),
  // resilience
  "tail-latency": widen(tailLatencySim),
  "retries-timeouts": widen(retriesTimeoutsSim),
  "circuit-breaker": widen(circuitBreakerSim),
  // distributed
  "rate-limiting": widen(rateLimitingSim),
  "message-queues": widen(messageQueuesSim),
  "delivery-guarantees": widen(deliveryGuaranteesSim),
  fanout: widen(fanoutSim),
  "cap-theorem": widen(capTheoremSim),
  "leader-election": widen(leaderElectionSim),
  gossip: widen(gossipSim),
  "two-phase-commit": widen(twoPhaseCommitSim),
  "geo-replication": widen(geoReplicationSim),
};

/** Slugs already reported by `getSim`, so dev warns once per slug, not per render. */
const warned = new Set<string>();

/**
 * The sim for a lesson slug, or undefined when this map has no line for it.
 *
 * Warns once per slug in development — a registered lesson with no sim is
 * almost always a forgotten line above, and the review deck's silence about it
 * would otherwise be invisible.
 */
export function getSim(slug: string): LessonSim<unknown> | undefined {
  const sim = simBySlug[slug];
  if (!sim && process.env.NODE_ENV !== "production" && !warned.has(slug)) {
    warned.add(slug);
    console.warn(
      `[lessons] no sim registered for lesson "${slug}" — add a line to simBySlug in src/lessons/index.ts. Its checkpoints are missing from /review.`,
    );
  }
  return sim;
}
