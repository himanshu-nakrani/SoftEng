import { describe, expect, it } from "vitest";

import { autoscalingSim } from "@/lessons/scaling/autoscaling";
import { clientServerSim } from "@/lessons/scaling/client-server";
import { loadBalancingSim } from "@/lessons/scaling/load-balancing";
import { realtimeDeliverySim } from "@/lessons/scaling/realtime-delivery";
import { scalingStrategiesSim } from "@/lessons/scaling/scaling-strategies";
import { cacheStampedeSim } from "@/lessons/data/cache-stampede";
import { cachingSim } from "@/lessons/data/caching";
import { cdnEdgeSim } from "@/lessons/data/cdn-edge";
import { consistentHashingSim } from "@/lessons/data/consistent-hashing";
import { replicationSim } from "@/lessons/data/replication";
import { shardingSim } from "@/lessons/data/sharding";
import { circuitBreakerSim } from "@/lessons/resilience/circuit-breaker";
import { retriesTimeoutsSim } from "@/lessons/resilience/retries-timeouts";
import { tailLatencySim } from "@/lessons/resilience/tail-latency";
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

const ALL_SIMS = [
  clientServerSim,
  scalingStrategiesSim,
  loadBalancingSim,
  autoscalingSim,
  realtimeDeliverySim,
  cachingSim,
  cacheStampedeSim,
  cdnEdgeSim,
  replicationSim,
  shardingSim,
  consistentHashingSim,
  tailLatencySim,
  retriesTimeoutsSim,
  circuitBreakerSim,
  metricsLogsTracesSim,
  slosErrorBudgetsSim,
  incidentTriageSim,
  rateLimitingSim,
  messageQueuesSim,
  deliveryGuaranteesSim,
  fanoutSim,
  capTheoremSim,
  gossipSim,
  leaderElectionSim,
  twoPhaseCommitSim,
  geoReplicationSim,
] as const;

const CAUSAL_PHASES = new Set(["baseline", "change", "impact", "resolution"]);

describe("Causal Learning Workbench contracts", () => {
  it.each(ALL_SIMS)("%s ships a complete causal workbench", (sim) => {
    const workbench = sim.workbench;
    expect(workbench, `${sim.id} needs a causal workbench`).toBeDefined();
    if (!workbench) return;

    const focusIds = new Set(workbench.focuses.map((focus) => focus.id));
    const nodeIds = new Set(sim.topology.nodes.map((node) => node.id));
    const edgeIds = new Set(sim.topology.edges.map((edge) => edge.id));
    const metricIds = new Set(sim.meters.map((meter) => meter.metricKey));
    const paramIds = new Set(sim.params.map((param) => param.key));

    expect(workbench.focuses).toHaveLength(4);
    expect(new Set(workbench.focuses).size).toBe(workbench.focuses.length);
    expect(focusIds.size).toBe(workbench.focuses.length);
    expect(new Set(workbench.focuses.map((focus) => focus.phase))).toEqual(CAUSAL_PHASES);

    for (const focus of workbench.focuses) {
      expect(focus.summary.trim()).not.toHaveLength(0);
      expect(focus.nextAction?.trim(), `${sim.id}:${focus.id} needs a next action`).not.toHaveLength(0);
      for (const nodeId of focus.nodes ?? []) expect(nodeIds).toContain(nodeId);
      for (const edgeId of focus.edges ?? []) expect(edgeIds).toContain(edgeId);
      for (const metricId of focus.metrics ?? []) expect(metricIds).toContain(metricId);
      if (focus.trigger) expect(paramIds).toContain(focus.trigger.id);
    }

    const experiment = workbench.experiment;
    expect(experiment, `${sim.id} needs a first guided experiment`).toBeDefined();
    if (!experiment) return;
    expect(focusIds).toContain(experiment.focusId);
    if (experiment.action.kind === "button" || experiment.action.kind === "param") {
      expect(paramIds).toContain(experiment.action.id);
    }
  });
});
