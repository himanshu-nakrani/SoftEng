import { buildAlgoSteps } from "@/engine/algo/build";
import { describe, expect, it } from "vitest";
import { couplingMetricsAlgo } from "@/lessons/modularity-coupling/coupling-metrics";

/**
 * Track 07 Software Design — Modularity & Coupling claims test.
 *
 * Verifies that afferent (Ca) and efferent (Ce) coupling metrics move
 * deterministically across the 4-package refactoring sequence (api, billing, orders, db).
 *
 * Every number tested below mirrors claims made in the lesson prose:
 *   - Initial state: billing Ce = 3, db Ca = 3.
 *   - Step 1: billing Ce drops to 2, db Ca drops to 2 after boundary extraction.
 *   - Step 2: billing Ce drops to 1, api Ca drops to 0 after dependency injection.
 *   - Step 3: Total coupling drops from 12 to 8, edge conservation sum(Ca) === sum(Ce) holds.
 */
function run() {
  const steps = buildAlgoSteps(couplingMetricsAlgo, 0, 42);
  return {
    steps,
    step0: steps[0].state,
    step1: steps[1].state,
    step2: steps[2].state,
    step3: steps[3].state,
  };
}

const pkg = (state: { packages?: Array<{ name: string; ca: number; ce: number; total: number }> }, name: string) => {
  const p = state.packages?.find((item) => item.name === name);
  if (!p) throw new Error(`Package "${name}" not found in state`);
  return p;
};

describe("coupling-metrics — afferent and efferent coupling move deterministically", () => {
  const { steps, step0, step1, step2, step3 } = run();

  it("produces exactly 4 discrete steps in the refactoring sequence", () => {
    expect(steps.length).toBe(4);
  });

  describe("Initial State (Step 0) — tightly coupled monolith", () => {
    it("billing directly imports api, orders, and db with Ce = 3 and Ca = 0", () => {
      const billing = pkg(step0, "billing");
      expect(billing.ce).toBe(3);
      expect(billing.ca).toBe(0);
      expect(billing.total).toBe(3);
    });

    it("db has Ca = 3 and Ce = 0", () => {
      const db = pkg(step0, "db");
      expect(db.ca).toBe(3);
      expect(db.ce).toBe(0);
      expect(db.total).toBe(3);
    });

    it("orders has Ca = 2 and Ce = 1", () => {
      const orders = pkg(step0, "orders");
      expect(orders.ca).toBe(2);
      expect(orders.ce).toBe(1);
      expect(orders.total).toBe(3);
    });

    it("api has Ca = 1 and Ce = 2", () => {
      const api = pkg(step0, "api");
      expect(api.ca).toBe(1);
      expect(api.ce).toBe(2);
      expect(api.total).toBe(3);
    });

    it("conserves total edges: sum of Ca equals sum of Ce", () => {
      const sumCa = step0.packages!.reduce((acc, p) => acc + p.ca, 0);
      const sumCe = step0.packages!.reduce((acc, p) => acc + p.ce, 0);
      expect(sumCa).toBe(6);
      expect(sumCe).toBe(6);
    });
  });

  describe("Step 1 — Extract domain interface / repository boundary", () => {
    it("billing Ce drops from 3 to 2 after decoupling from concrete db", () => {
      expect(pkg(step1, "billing").ce).toBe(2);
      expect(pkg(step1, "billing").ca).toBe(0);
      expect(pkg(step1, "billing").total).toBe(2);
    });

    it("db Ca drops from 3 to 2 as billing stops directly importing it", () => {
      expect(pkg(step1, "db").ca).toBe(2);
      expect(pkg(step1, "db").ce).toBe(0);
      expect(pkg(step1, "db").total).toBe(2);
    });

    it("api and orders metrics remain unchanged in step 1", () => {
      expect(pkg(step1, "api").ca).toBe(1);
      expect(pkg(step1, "api").ce).toBe(2);
      expect(pkg(step1, "orders").ca).toBe(2);
      expect(pkg(step1, "orders").ce).toBe(1);
    });
  });

  describe("Step 2 — Inject dependencies into billing", () => {
    it("reduces Ce of billing from 3 to 1", () => {
      expect(pkg(step2, "billing").ce).toBe(1);
      expect(pkg(step2, "billing").ca).toBe(0);
      expect(pkg(step2, "billing").total).toBe(1);
    });

    it("api Ca drops from 1 to 0 because billing no longer imports api", () => {
      expect(pkg(step2, "api").ca).toBe(0);
      expect(pkg(step2, "api").ce).toBe(2);
      expect(pkg(step2, "api").total).toBe(2);
    });

    it("orders and db metrics remain stable in step 2", () => {
      expect(pkg(step2, "orders").ca).toBe(2);
      expect(pkg(step2, "orders").ce).toBe(1);
      expect(pkg(step2, "db").ca).toBe(2);
      expect(pkg(step2, "db").ce).toBe(0);
    });
  });

  describe("Step 3 — Quantify deterministic movement across all packages", () => {
    it("verifies final package metrics", () => {
      expect(pkg(step3, "billing").ce).toBe(1);
      expect(pkg(step3, "db").ca).toBe(2);
      expect(pkg(step3, "api").ca).toBe(0);
      expect(pkg(step3, "orders").ca).toBe(2);
    });

    it("proves total system coupling fell from 12 to 8", () => {
      const initialTotal = step0.packages!.reduce((acc, p) => acc + p.total, 0);
      const finalTotal = step3.packages!.reduce((acc, p) => acc + p.total, 0);
      expect(initialTotal).toBe(12);
      expect(finalTotal).toBe(8);
    });

    it("maintains edge conservation across every single step", () => {
      for (const step of steps) {
        const sumCa = step.state.packages!.reduce((acc, p) => acc + p.ca, 0);
        const sumCe = step.state.packages!.reduce((acc, p) => acc + p.ce, 0);
        expect(sumCa).toBe(sumCe);
      }
    });
  });
});
