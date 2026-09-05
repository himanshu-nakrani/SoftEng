import { buildAlgoSteps } from "@/engine/algo/build";
import type { PackageTableState } from "@/engine/algo/views/table";
import { describe, expect, it } from "vitest";

import { instabilityAbstractnessAlgo } from "@/lessons/modularity-coupling/instability-abstractness";

/**
 * Claims test for Instability & Abstractness:
 * Verifies that the AlgoDef produces exact architectural metric values:
 * 1. Concrete core package sitting in the Zone of Pain (A = 0, I = 0, D = 1.0).
 * 2. Refactoring introduces abstract interfaces: A rises from 0 to 0.5.
 * 3. Distance D drops from 1.0 down to 0.5 towards the Main Sequence.
 * 4. Other packages in the system sit balanced on the Main Sequence (D = 0).
 */

describe("instability-abstractness — package metrics and main sequence claims", () => {
  const steps = buildAlgoSteps(instabilityAbstractnessAlgo, 0, 42);
  const first = steps[0].state as PackageTableState;
  const last = steps[steps.length - 1].state as PackageTableState;

  const pkg = (state: PackageTableState, name: string) =>
    state.packages.find((p) => p.name === name);

  describe("pre-refactoring state (Zone of Pain)", () => {
    it("identifies core as maximally stable with Ca=4 and Ce=0", () => {
      const core = pkg(first, "core")!;
      expect(core).toBeDefined();
      expect(core.ca).toBe(4);
      expect(core.ce).toBe(0);
      expect(core.i).toBe(0.0);
    });

    it("identifies core as completely concrete with A=0", () => {
      const core = pkg(first, "core")!;
      expect(core.a).toBe(0.0);
    });

    it("places core at maximum distance D=1.0 in the Zone of Pain", () => {
      const core = pkg(first, "core")!;
      // D = |A + I - 1| = |0 + 0 - 1| = 1.0
      expect(core.d).toBe(1.0);
      expect(core.zone).toBe("Zone of Pain");
      expect(core.highlight).toBe(true);
    });
  });

  describe("post-refactoring state (Moving towards Main Sequence)", () => {
    it("maintains core stability at I=0 with unchanged coupling", () => {
      const core = pkg(last, "core")!;
      expect(core).toBeDefined();
      expect(core.ca).toBe(4);
      expect(core.ce).toBe(0);
      expect(core.i).toBe(0.0);
    });

    it("raises abstractness A to 0.50 after introducing interfaces", () => {
      const core = pkg(last, "core")!;
      expect(core.a).toBe(0.5);
    });

    it("drops distance D from 1.0 to 0.50 towards the Main Sequence", () => {
      const firstCore = pkg(first, "core")!;
      const lastCore = pkg(last, "core")!;

      expect(lastCore.d).toBe(0.5);
      expect(lastCore.d).toBeLessThan(firstCore.d);
      expect(lastCore.zone).toBe("Main Sequence");
    });

    it("increments interfacesAdded and distanceReduction counters monotonically", () => {
      expect(steps[0].counters.interfacesAdded).toBe(0);
      expect(steps[steps.length - 1].counters.interfacesAdded).toBe(2);

      expect(steps[0].counters.distanceReduction).toBe(0);
      expect(steps[steps.length - 1].counters.distanceReduction).toBe(50);

      // Verify non-decreasing counters
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].counters.steps).toBeGreaterThanOrEqual(steps[i - 1].counters.steps);
        expect(steps[i].counters.interfacesAdded).toBeGreaterThanOrEqual(steps[i - 1].counters.interfacesAdded);
        expect(steps[i].counters.distanceReduction).toBeGreaterThanOrEqual(steps[i - 1].counters.distanceReduction);
      }
    });
  });

  describe("companion packages on the Main Sequence", () => {
    it("web-api sits at (A=0, I=1, D=0) as a volatile client package", () => {
      const web = pkg(first, "web-api")!;
      expect(web).toBeDefined();
      expect(web.i).toBe(1.0);
      expect(web.a).toBe(0.0);
      expect(web.d).toBe(0.0);
      expect(web.zone).toBe("Main Sequence");
    });

    it("plugin-spi sits at (A=1, I=0, D=0) as a pure abstract interface package", () => {
      const spi = pkg(first, "plugin-spi")!;
      expect(spi).toBeDefined();
      expect(spi.i).toBe(0.0);
      expect(spi.a).toBe(1.0);
      expect(spi.d).toBe(0.0);
      expect(spi.zone).toBe("Main Sequence");
    });

    it("billing-service sits at (A=0.33, I=0.67, D=0) as a balanced domain package", () => {
      const billing = pkg(first, "billing-service")!;
      expect(billing).toBeDefined();
      expect(billing.i).toBe(0.67);
      expect(billing.a).toBe(0.33);
      expect(billing.d).toBe(0.0);
      expect(billing.zone).toBe("Main Sequence");
    });
  });

  describe("code budget and integrity", () => {
    it("every line in code panel fits within 27 characters", () => {
      for (const line of instabilityAbstractnessAlgo.code) {
        expect(line.length).toBeLessThanOrEqual(27);
        expect(line.trim().length).toBeGreaterThan(0);
      }
    });

    it("every step points to a valid codeLine index", () => {
      for (const step of steps) {
        if (step.codeLine !== undefined) {
          expect(step.codeLine).toBeGreaterThanOrEqual(0);
          expect(step.codeLine).toBeLessThan(instabilityAbstractnessAlgo.code.length);
        }
      }
    });
  });
});
