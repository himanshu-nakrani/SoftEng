import { buildAlgoSteps } from "@/engine/algo/build";
import { describe, expect, it } from "vitest";
import { stranglerFigAlgo } from "@/lessons/architecture-boundaries/strangler-fig";

/**
 * Track 07 Software Design — Architecture Boundaries claims test.
 *
 * Verifies that the Strangler Fig Pattern models zero-downtime, route-by-route
 * migration from a monolithic system to independent microservices across 5 discrete steps.
 *
 * Every number tested mirrors claims made in the lesson prose:
 *   - Step 0: Monolith handles 100% of all 4 routes (/catalog, /orders, /payments, /users),
 *             0% microservice traffic, 0/4 cutover count, 0 downtime.
 *   - Step 1: Interceptor facade proxy deployed in front of monolith.
 *             Monolith = 100%, Microservice = 0%, Migrated = 0/4, 0 downtime.
 *   - Step 2: Strangle /catalog route to new Catalog Service.
 *             Monolith = 75%, Microservice = 25%, Migrated = 1/4, 0 downtime.
 *   - Step 3: Strangle /orders and /payments routes to domain services.
 *             Monolith = 25%, Microservice = 75%, Migrated = 3/4, 0 downtime.
 *   - Step 4: Strangle /users route and decommission legacy monolith.
 *             Monolith = 0%, Microservice = 100%, Migrated = 4/4, 0 downtime.
 */
function run() {
  const steps = buildAlgoSteps(stranglerFigAlgo, 0, 42);
  return {
    steps,
    step0: steps[0],
    step1: steps[1],
    step2: steps[2],
    step3: steps[3],
    step4: steps[4],
  };
}

const findRow = (step: { state: { rows: Array<{ key: string; values?: Record<string, unknown> }> } }, route: string) => {
  const r = step.state.rows.find((row) => row.key === route);
  if (!r) throw new Error(`Route "${route}" not found in step rows`);
  return r;
};

describe("strangler-fig — incremental migration via routing facade proxy", () => {
  const { steps, step0, step1, step2, step3, step4 } = run();

  it("produces exactly 5 discrete steps in the migration progression", () => {
    expect(steps.length).toBe(5);
  });

  it("defines the 5 required table columns", () => {
    const cols = step0.state.columns ?? [];
    expect(cols.map((c) => c.key)).toEqual([
      "route",
      "target",
      "monolithTraffic",
      "microserviceTraffic",
      "status",
    ]);
  });

  describe("Step 0 — Monolith Baseline", () => {
    it("monolith handles 100% of traffic, microservice 0%, 0/4 routes migrated, 0 downtime", () => {
      expect(step0.counters.monolithTraffic).toBe(100);
      expect(step0.counters.microserviceTraffic).toBe(0);
      expect(step0.counters.migratedRoutes).toBe(0);
      expect(step0.counters.downtime).toBe(0);
    });

    it("all 4 routes target monolith core directly", () => {
      const routes = ["/catalog", "/orders", "/payments", "/users"];
      for (const route of routes) {
        const row = findRow(step0, route);
        expect(row.values?.monolithTraffic).toBe("100%");
        expect(row.values?.microserviceTraffic).toBe("0%");
        expect(row.values?.target).toBe("Monolith Core");
        expect(row.values?.status).toBe("Legacy Monolith");
      }
    });
  });

  describe("Step 1 — Deploy Facade Proxy", () => {
    it("proxy intercepts ingress with zero traffic shift and 0 downtime", () => {
      expect(step1.counters.monolithTraffic).toBe(100);
      expect(step1.counters.microserviceTraffic).toBe(0);
      expect(step1.counters.migratedRoutes).toBe(0);
      expect(step1.counters.downtime).toBe(0);
    });

    it("routes requests through the facade proxy to the monolith", () => {
      const routes = ["/catalog", "/orders", "/payments", "/users"];
      for (const route of routes) {
        const row = findRow(step1, route);
        expect(row.values?.monolithTraffic).toBe("100%");
        expect(row.values?.microserviceTraffic).toBe("0%");
        expect(row.values?.target).toBe("Facade -> Monolith");
        expect(row.values?.status).toBe("Proxied (100% Monolith)");
      }
    });
  });

  describe("Step 2 — Strangle Route 1 (/catalog)", () => {
    it("migrates /catalog: monolith drops to 75%, microservice rises to 25%, 1/4 routes cut over", () => {
      expect(step2.counters.monolithTraffic).toBe(75);
      expect(step2.counters.microserviceTraffic).toBe(25);
      expect(step2.counters.migratedRoutes).toBe(1);
      expect(step2.counters.downtime).toBe(0);
    });

    it("/catalog is served by Catalog Service, remaining 3 routes stay on monolith", () => {
      const catalog = findRow(step2, "/catalog");
      expect(catalog.values?.target).toBe("Catalog Service");
      expect(catalog.values?.monolithTraffic).toBe("0%");
      expect(catalog.values?.microserviceTraffic).toBe("100%");
      expect(catalog.values?.status).toBe("Migrated to Microservice");

      for (const route of ["/orders", "/payments", "/users"]) {
        const row = findRow(step2, route);
        expect(row.values?.target).toBe("Facade -> Monolith");
        expect(row.values?.monolithTraffic).toBe("100%");
        expect(row.values?.microserviceTraffic).toBe("0%");
      }
    });

    it("highlights /catalog as the active row", () => {
      expect(step2.state.active).toBe("/catalog");
    });
  });

  describe("Step 3 — Strangle Route 2 & 3 (/orders and /payments)", () => {
    it("migrates orders and payments: monolith drops to 25%, microservice rises to 75%, 3/4 cut over", () => {
      expect(step3.counters.monolithTraffic).toBe(25);
      expect(step3.counters.microserviceTraffic).toBe(75);
      expect(step3.counters.migratedRoutes).toBe(3);
      expect(step3.counters.downtime).toBe(0);
    });

    it("/catalog, /orders, /payments served by microservices, only /users on monolith", () => {
      for (const route of ["/catalog", "/orders", "/payments"]) {
        const row = findRow(step3, route);
        expect(row.values?.monolithTraffic).toBe("0%");
        expect(row.values?.microserviceTraffic).toBe("100%");
        expect(row.values?.status).toBe("Migrated to Microservice");
      }

      const users = findRow(step3, "/users");
      expect(users.values?.target).toBe("Facade -> Monolith");
      expect(users.values?.monolithTraffic).toBe("100%");
      expect(users.values?.microserviceTraffic).toBe("0%");
    });
  });

  describe("Step 4 — Complete Monolith Decommissioning (/users)", () => {
    it("migrates all routes: monolith traffic drops to 0%, microservice reaches 100%, 4/4 cut over", () => {
      expect(step4.counters.monolithTraffic).toBe(0);
      expect(step4.counters.microserviceTraffic).toBe(100);
      expect(step4.counters.migratedRoutes).toBe(4);
      expect(step4.counters.downtime).toBe(0);
    });

    it("all 4 routes are served by independent domain microservices", () => {
      const routes = ["/catalog", "/orders", "/payments", "/users"];
      for (const route of routes) {
        const row = findRow(step4, route);
        expect(row.values?.monolithTraffic).toBe("0%");
        expect(row.values?.microserviceTraffic).toBe("100%");
        expect(row.values?.status).toBe("Migrated to Microservice");
      }
    });

    it("highlights /users as active during final cutover", () => {
      expect(step4.state.active).toBe("/users");
    });
  });

  describe("System invariants across all steps", () => {
    it("incurs exactly zero downtime across the entire migration lifecycle", () => {
      for (const step of steps) {
        expect(step.counters.downtime).toBe(0);
      }
    });

    it("conserves total traffic: monolith traffic + microservice traffic === 100%", () => {
      for (const step of steps) {
        const total = step.counters.monolithTraffic + step.counters.microserviceTraffic;
        expect(total).toBe(100);
      }
    });

    it("migrated route count monotonically increases from 0 to 4", () => {
      const counts = steps.map((s) => s.counters.migratedRoutes);
      expect(counts).toEqual([0, 0, 1, 3, 4]);
    });
  });
});
