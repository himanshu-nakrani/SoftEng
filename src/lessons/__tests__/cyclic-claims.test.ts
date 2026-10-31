import { buildAlgoSteps } from "@/engine/algo/build";
import {
  cyclicDependenciesAlgo,
  detectCycle,
  topologicalSort,
} from "@/lessons/modularity-coupling/cyclic-dependencies";
import { describe, expect, it } from "vitest";

describe("cyclic-dependencies claims", () => {
  const steps = buildAlgoSteps(cyclicDependenciesAlgo, 0, 42);
  const first = steps[0];
  const cycleStep = steps[1];
  const dipStep = steps[2];
  const finalStep = steps[steps.length - 1];

  it("opens with a circular dependency cycle (has_cycle = 1)", () => {
    expect(first.counters.has_cycle).toBe(1);
    expect(first.state.anomaly).toContain("Cycle");
  });

  it("runs cycle detection and flags topological sort failure", () => {
    expect(cycleStep.counters.has_cycle).toBe(1);
    expect(cycleStep.state.txns[0].status).toBe("aborted");
    expect(cycleStep.state.anomaly).toContain("Cycle detected");
  });

  it("applies DIP and breaks the cycle (has_cycle = 0)", () => {
    expect(dipStep.counters.has_cycle).toBe(0);
    expect(dipStep.state.anomaly).toBeUndefined();
  });

  it("computes linear topological release order [Billing, Users, Orders]", () => {
    expect(finalStep.counters.has_cycle).toBe(0);
    expect(finalStep.state.txns[0].status).toBe("committed");
    expect(finalStep.state.ranStatement).toBe("[Billing, Users, Orders]");
    expect(finalStep.state.rows.map((r) => r.key)).toEqual([
      "Billing",
      "Users",
      "Orders",
    ]);
  });

  it("algorithmic detectCycle identifies circular dependencies", () => {
    const cyclicGraph = {
      Users: ["Orders"],
      Orders: ["Billing"],
      Billing: ["Users"],
    };
    const cycle = detectCycle(cyclicGraph);
    expect(cycle).not.toBeNull();
    expect(cycle).toEqual(["Users", "Orders", "Billing", "Users"]);
  });

  it("topologicalSort fails on cyclic graph and succeeds on inverted DAG", () => {
    const cyclicGraph = {
      Users: ["Orders"],
      Orders: ["Billing"],
      Billing: ["Users"],
    };
    const cyclicResult = topologicalSort(cyclicGraph);
    expect(cyclicResult.hasCycle).toBe(true);
    expect(cyclicResult.order).toEqual([]);

    const acyclicGraph = {
      Billing: ["Users"],
      Users: ["Orders"],
      Orders: [],
    };
    const acyclicResult = topologicalSort(acyclicGraph);
    expect(acyclicResult.hasCycle).toBe(false);
    expect(acyclicResult.order).toEqual(["Billing", "Users", "Orders"]);
  });
});
