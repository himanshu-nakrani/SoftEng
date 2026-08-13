import { describe, expect, it } from "vitest";

import { consistentHashingSim } from "@/lessons/data/consistent-hashing";
import { gossipSim } from "@/lessons/distributed/gossip";
import { metricsLogsTracesSim } from "@/lessons/observability/metrics-logs-traces";
import { clientServerSim } from "@/lessons/scaling/client-server";

const PILOTS = [
  clientServerSim,
  consistentHashingSim,
  metricsLogsTracesSim,
  gossipSim,
] as const;

describe("Causal Learning Workbench contracts", () => {
  it.each(PILOTS)("%s references only authored simulation entities", (sim) => {
    const workbench = sim.workbench;
    expect(workbench, `${sim.id} needs a pilot workbench`).toBeDefined();
    if (!workbench) return;

    const focusIds = new Set(workbench.focuses.map((focus) => focus.id));
    const nodeIds = new Set(sim.topology.nodes.map((node) => node.id));
    const edgeIds = new Set(sim.topology.edges.map((edge) => edge.id));
    const metricIds = new Set(sim.meters.map((meter) => meter.metricKey));
    const paramIds = new Set(sim.params.map((param) => param.key));

    expect(new Set(workbench.focuses).size).toBe(workbench.focuses.length);
    expect(new Set(workbench.focuses.map((focus) => focus.id)).size).toBe(
      workbench.focuses.length,
    );

    for (const focus of workbench.focuses) {
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
