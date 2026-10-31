import { buildAlgoSteps } from "@/engine/algo/build";
import {
  propertyShrinkingAlgo,
  SHRINK_COUNTERS,
} from "@/lessons/property-testing/property-shrinking";
import { describe, expect, it } from "vitest";

/**
 * Property Shrinking claims tests.
 *
 * Pins the educational claims made in the lesson page:
 * - A random 10-element array violating `all(x < 50)` shrinks to `[50]`.
 * - Bisection halves chunks (10 -> 5 -> 2).
 * - Element deletion drops non-essential elements (2 -> 1).
 * - Value decrementing steps scalar values down to the boundary threshold 50.
 * - All code lines stay within the 27-character code panel limit.
 */
describe("property shrinking claims", () => {
  it("fits all code lines within the 27-character budget", () => {
    for (const [i, line] of propertyShrinkingAlgo.code.entries()) {
      expect(
        line.length,
        `Line ${i} "${line}" exceeds 27 chars (${line.length})`,
      ).toBeLessThanOrEqual(27);
    }
  });

  it("reproduces the exact shrink steps under seed 42", () => {
    const steps = buildAlgoSteps(propertyShrinkingAlgo, 10, 42);
    expect(steps.length).toBeGreaterThanOrEqual(15);

    // Initial frame: 10 elements, fails property due to element 92
    const initial = steps[0];
    expect(initial.state.array).toEqual([
      31, 25, 39, 33, 16, 28, 92, 31, 40, 26,
    ]);
    expect(initial.state.array.some((x) => x >= 50)).toBe(true);

    // Verify bisection cuts: length drops to 5, then to 2
    const bisectionCut5 = steps.find((s) => s.state.array.length === 5);
    expect(bisectionCut5).toBeDefined();
    expect(bisectionCut5?.state.array).toEqual([28, 92, 31, 40, 26]);

    const bisectionCut2 = steps.find((s) => s.state.array.length === 2);
    expect(bisectionCut2).toBeDefined();
    expect(bisectionCut2?.state.array).toEqual([28, 92]);

    // Verify deletion cut: element 28 dropped, leaving only [92]
    const deletionCut1 = steps.find(
      (s) => s.state.array.length === 1 && s.state.array[0] === 92,
    );
    expect(deletionCut1).toBeDefined();

    // Verify scalar value decrementing to 50
    const finalStep = steps[steps.length - 1];
    expect(finalStep.state.array).toEqual([50]);
    expect(finalStep.state.highlight.sorted).toEqual([0]);

    // Verify final counters match the prose: 12 tests run, 7 shrinks accepted
    expect(finalStep.counters[SHRINK_COUNTERS.tests]).toBe(12);
    expect(finalStep.counters[SHRINK_COUNTERS.shrinks]).toBe(7);
  });

  it("shrinks from initial length >= 6 down to minimal length 1 across various seeds", () => {
    const testSeeds = [0, 1, 7, 42, 99, 500, 1337];

    for (const seed of testSeeds) {
      const steps = buildAlgoSteps(propertyShrinkingAlgo, 10, seed);
      const initial = steps[0].state.array;
      const final = steps[steps.length - 1].state.array;

      expect(initial.length).toBe(10);
      expect(initial.some((x) => x >= 50)).toBe(true);

      // Final state must always be the minimal 1-element counterexample [50]
      expect(final.length).toBe(1);
      expect(final[0]).toBe(50);

      // Property invariant: final violates invariant, but decrementing by 1 passes
      expect(final.some((x) => x >= 50)).toBe(true);
      expect([final[0] - 1].some((x) => x >= 50)).toBe(false);

      // Monotonic shrinking: array length must never increase
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].state.array.length).toBeLessThanOrEqual(
          steps[i - 1].state.array.length,
        );
      }
    }
  });

  it("handles custom input sizes cleanly", () => {
    for (const size of [6, 8, 12, 16]) {
      const steps = buildAlgoSteps(propertyShrinkingAlgo, size, 42);
      expect(steps[0].state.array.length).toBe(size);
      const final = steps[steps.length - 1].state.array;
      expect(final).toEqual([50]);
    }
  });
});
