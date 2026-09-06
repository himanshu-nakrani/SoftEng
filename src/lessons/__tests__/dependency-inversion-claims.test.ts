import { buildAlgoSteps } from "@/engine/algo/build";
import { describe, expect, it } from "vitest";
import { dependencyInversionAlgo } from "@/lessons/architecture-boundaries/dependency-inversion";

/**
 * Track 07 Software Design — Architecture Boundaries claims test.
 *
 * Verifies that the Dependency Inversion Principle (DIP) and Hexagonal Ports & Adapters
 * architectural metrics move deterministically across the 4 refactoring steps:
 *
 * 1. Step 0 (Direct Coupling): OrderService directly imports PostgresDB and Sendgrid.
 *    Domain fan-out = 2, isolated_tests = 0, OrderService direction = "Outward → Infra".
 * 2. Step 1 (Port Extraction): Domain declares OrderRepository & NotificationService ports.
 *    Domain fan-out drops to 0, isolated_tests = 0, OrderService points in-boundary to ports.
 * 3. Step 2 (Dependency Inversion): PostgresRepo and SendgridAdapter implement domain ports.
 *    Dependencies point inward toward domain contracts; domain fan-out = 0.
 * 4. Step 3 (Swappability & Test Isolation): Swap in InMemoryRepo and MockNotifier.
 *    Domain tests run with 0 DB/network dependencies; isolated_tests = 1, domain fan-out = 0.
 */
function run() {
  const steps = buildAlgoSteps(dependencyInversionAlgo, 0, 42);
  return {
    steps,
    step0: steps[0],
    step1: steps[1],
    step2: steps[2],
    step3: steps[3],
  };
}

const findRow = (
  step: { state: { rows: Array<{ key: string; values?: Record<string, number | string> }> } },
  key: string,
) => {
  const row = step.state.rows.find((r) => r.key === key);
  if (!row) throw new Error(`Row "${key}" not found in step rows`);
  return row;
};

describe("dependency-inversion claims — architectural boundary metrics across steps", () => {
  const { steps, step0, step1, step2, step3 } = run();

  it("produces exactly 4 discrete steps in the refactoring progression", () => {
    expect(steps.length).toBe(4);
  });

  describe("Step 0 — Direct Coupling (monolithic layered anti-pattern)", () => {
    it("measures domain fan-out = 2 and isolated_tests = 0", () => {
      expect(step0.counters.domain_fan_out).toBe(2);
      expect(step0.counters.isolated_tests).toBe(0);
    });

    it("flags architectural violation in anomaly banner", () => {
      expect(step0.state.anomaly).toContain("Violation");
      expect(step0.state.anomaly).toContain("2 infrastructure drivers");
    });

    it("OrderService points outward into concrete infrastructure", () => {
      const order = findRow(step0, "OrderService");
      expect(order.values?.layer).toBe("Domain");
      expect(order.values?.direction).toBe("Outward → Infra");
      expect(order.values?.dependency).toContain("PostgresDB");
      expect(order.values?.dependency).toContain("Sendgrid");
      expect(order.values?.coupling).toContain("Fan-out: 2");
    });

    it("driven adapters are direct concrete callees of the domain", () => {
      const db = findRow(step0, "PostgresRepo");
      expect(db.values?.layer).toBe("Infra / Driven");
      expect(db.values?.direction).toBe("Callee ← Domain");
      expect(db.values?.coupling).toBe("Concrete target");

      const notifier = findRow(step0, "SendgridNotifier");
      expect(notifier.values?.layer).toBe("Infra / Driven");
      expect(notifier.values?.direction).toBe("Callee ← Domain");
      expect(notifier.values?.coupling).toBe("Concrete target");
    });

    it("driving adapter points inward into domain", () => {
      const controller = findRow(step0, "HTTPController");
      expect(controller.values?.layer).toBe("Infra / Driving");
      expect(controller.values?.direction).toBe("Inward → Domain");
    });
  });

  describe("Step 1 — Port Extraction (defining domain boundaries)", () => {
    it("domain fan-out drops to 0 while isolated_tests remains 0", () => {
      expect(step1.counters.domain_fan_out).toBe(0);
      expect(step1.counters.isolated_tests).toBe(0);
    });

    it("OrderService depends only on ports declared inside domain boundary", () => {
      const order = findRow(step1, "OrderService");
      expect(order.values?.layer).toBe("Domain");
      expect(order.values?.direction).toBe("In-Boundary (Ports)");
      expect(order.values?.dependency).toBe("OrderRepo, Notifier");
      expect(order.values?.coupling).toBe("Abstract (Ports)");
    });

    it("infrastructure adapters await interface implementation", () => {
      const db = findRow(step1, "PostgresRepo");
      expect(db.values?.direction).toBe("Pending Inversion");
      expect(db.values?.coupling).toBe("Unbound concrete");

      const notifier = findRow(step1, "SendgridNotifier");
      expect(notifier.values?.direction).toBe("Pending Inversion");
      expect(notifier.values?.coupling).toBe("Unbound concrete");
    });

    it("anomaly banner confirms port extraction inside domain boundary", () => {
      expect(step1.state.anomaly).toContain("Port Extraction");
      expect(step1.state.anomaly).toContain("fan-out reduced to 0");
    });
  });

  describe("Step 2 — Dependency Inversion (adapters implement domain ports)", () => {
    it("maintains domain fan-out = 0 with dependencies pointing inward", () => {
      expect(step2.counters.domain_fan_out).toBe(0);
      expect(step2.counters.isolated_tests).toBe(0);
    });

    it("PostgresRepo and SendgridNotifier invert direction to implement domain contracts", () => {
      const db = findRow(step2, "PostgresRepo");
      expect(db.values?.layer).toBe("Infra / Driven");
      expect(db.values?.direction).toBe("Inward → OrderRepo");
      expect(db.values?.dependency).toBe("OrderRepo (implements)");
      expect(db.values?.coupling).toBe("Inverted Adapter");

      const notifier = findRow(step2, "SendgridNotifier");
      expect(notifier.values?.layer).toBe("Infra / Driven");
      expect(notifier.values?.direction).toBe("Inward → Notifier");
      expect(notifier.values?.dependency).toBe("Notifier (implements)");
      expect(notifier.values?.coupling).toBe("Inverted Adapter");
    });

    it("OrderService acts as high-level core policy targeted by adapters", () => {
      const order = findRow(step2, "OrderService");
      expect(order.values?.direction).toBe("Core (Inward target)");
      expect(order.values?.coupling).toBe("Inverted (DIP)");
    });

    it("anomaly banner confirms inversion complete", () => {
      expect(step2.state.anomaly).toContain("Dependency Inversion");
      expect(step2.state.anomaly).toContain("Adapters depend on domain abstractions");
    });
  });

  describe("Step 3 — Swappability & Test Isolation (in-memory doubles)", () => {
    it("achieves isolated_tests = 1 and maintains domain fan-out = 0", () => {
      expect(step3.counters.domain_fan_out).toBe(0);
      expect(step3.counters.isolated_tests).toBe(1);
    });

    it("swaps concrete infrastructure for zero-I/O test doubles", () => {
      const db = findRow(step3, "PostgresRepo");
      expect(db.values?.layer).toBe("Test / Driven");
      expect(db.values?.direction).toBe("Inward → OrderRepo");
      expect(db.values?.dependency).toBe("OrderRepo (in-memory)");
      expect(db.values?.coupling).toBe("Test Double (Swapped)");

      const notifier = findRow(step3, "SendgridNotifier");
      expect(notifier.values?.layer).toBe("Test / Driven");
      expect(notifier.values?.direction).toBe("Inward → Notifier");
      expect(notifier.values?.dependency).toBe("Notifier (in-memory)");
      expect(notifier.values?.coupling).toBe("Test Double (Swapped)");
    });

    it("driving layer is swapped with a fast in-process unit test harness", () => {
      const harness = findRow(step3, "HTTPController");
      expect(harness.values?.layer).toBe("Test / Driving");
      expect(harness.values?.direction).toBe("Inward → Domain");
      expect(harness.values?.coupling).toBe("Unit Test Harness");
    });

    it("OrderService executes in total test isolation with 0 I/O", () => {
      const order = findRow(step3, "OrderService");
      expect(order.values?.direction).toBe("Core (Isolated)");
      expect(order.values?.coupling).toBe("Isolated (0 I/O)");
    });

    it("anomaly banner verifies complete test isolation", () => {
      expect(step3.state.anomaly).toContain("Swappability Verified");
      expect(step3.state.anomaly).toContain("isolated_tests = 1");
    });
  });
});
