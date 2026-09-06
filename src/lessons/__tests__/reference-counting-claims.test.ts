import { buildAlgoSteps } from "@/engine/algo/build";
import { GC_COUNTERS as C, runRefcount } from "@/engine/algo/gc";
import type { AlgoDef } from "@/engine/algo/types";
import type { GcState } from "@/engine/algo/views/gc";
import {
  referenceCountingAlgo,
  referenceCountingCycleAlgo,
} from "@/lessons/memory-management/reference-counting";
import { describe, expect, it } from "vitest";

/**
 * The reference-counting prose states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became
 * untrue.
 *
 * Two named objects, A and B. Seed is ignored: a count is not a
 * scheduler.
 */

function last(def: AlgoDef<GcState, boolean>, seed = 42) {
  const steps = buildAlgoSteps(def, 0, seed);
  const final = steps[steps.length - 1]!;
  return {
    steps,
    notes: steps.map((s) => s.note),
    state: final.state,
    counters: final.counters,
    note: final.note,
    stamp: final.state.stamp,
    allocs: final.counters[C.allocs] ?? 0,
    freed: final.counters[C.freed] ?? 0,
    leaked: final.counters[C.leaked] ?? 0,
  };
}

function obj(state: GcState, id: string) {
  const found = state.heap.find((o) => o.id === id);
  expect(found, `missing object ${id}`).toBeDefined();
  return found!;
}

const acyclic = (seed = 42) => last(referenceCountingAlgo, seed);
const cyclic = (seed = 42) => last(referenceCountingCycleAlgo, seed);

describe("reference-counting · two figures, no slider", () => {
  it("has no size slider — the cycle is a second figure, not a control", () => {
    // "There is no size slider — the cycle is a second figure, not a
    // control."
    expect(referenceCountingAlgo.size).toBeUndefined();
    expect(referenceCountingCycleAlgo.size).toBeUndefined();
    expect(referenceCountingAlgo.id).toBe("reference-counting");
    expect(referenceCountingCycleAlgo.id).toBe("reference-counting-cycle");
    expect(referenceCountingAlgo.generateInput(() => 0, 0)).toBe(false);
    expect(referenceCountingCycleAlgo.generateInput(() => 0, 0)).toBe(true);
    expect(referenceCountingAlgo.counters.map((c) => c.key)).toEqual([
      C.allocs,
      C.freed,
      C.leaked,
    ]);
    expect(referenceCountingCycleAlgo.counters.map((c) => c.key)).toEqual(
      referenceCountingAlgo.counters.map((c) => c.key),
    );
  });

  it("ignores the seed: a count is not a scheduler", () => {
    // "Seed is ignored: a count is not a scheduler."
    expect(buildAlgoSteps(referenceCountingAlgo, 0, 1)).toEqual(
      buildAlgoSteps(referenceCountingAlgo, 0, 99),
    );
    expect(buildAlgoSteps(referenceCountingCycleAlgo, 0, 1)).toEqual(
      buildAlgoSteps(referenceCountingCycleAlgo, 0, 99),
    );
  });

  it("size is unused — both defs ignore the size argument", () => {
    expect(buildAlgoSteps(referenceCountingAlgo, 0, 42)).toEqual(
      buildAlgoSteps(referenceCountingAlgo, 99, 42),
    );
    expect(buildAlgoSteps(referenceCountingCycleAlgo, 0, 42)).toEqual(
      buildAlgoSteps(referenceCountingCycleAlgo, 99, 42),
    );
  });

  it("every code line fits the 27-character panel", () => {
    for (const def of [referenceCountingAlgo, referenceCountingCycleAlgo]) {
      expect(def.code.length).toBeGreaterThan(0);
      for (const line of def.code) {
        expect(line.length).toBeLessThanOrEqual(27);
      }
    }
  });
});

describe("reference-counting · acyclic A.p=B", () => {
  it("opens A.p=B, then drop both, stamp acyclic, meters at 0", () => {
    // "The first caption is \"A.p=B, then drop both.\" Stamp acyclic.
    // Allocs, freed, and leaked are still 0."
    const { steps } = acyclic();
    expect(steps[0]!.note).toBe("A.p=B, then drop both.");
    expect(steps[0]!.state.stamp).toBe("acyclic");
    expect(steps[0]!.counters[C.allocs] ?? 0).toBe(0);
    expect(steps[0]!.counters[C.freed] ?? 0).toBe(0);
    expect(steps[0]!.counters[C.leaked] ?? 0).toBe(0);
    expect(steps[0]!.state.heap).toEqual([]);
  });

  it("allocs A then B, then A.p=B raises B to rc 2", () => {
    // "Step: \"Alloc A rc=1.\" then \"Alloc B rc=1.\" Allocs 2."
    // "\"A.p = B. B rc=2.\" B now has two names: the root and A's field."
    const { steps } = acyclic();
    expect(steps[1]!.note).toBe("Alloc A rc=1.");
    expect(steps[2]!.note).toBe("Alloc B rc=1.");
    expect(steps[2]!.counters[C.allocs]).toBe(2);
    expect(steps[3]!.note).toBe("A.p = B. B rc=2.");
    expect(obj(steps[3]!.state, "B").rc).toBe(2);
    expect(obj(steps[3]!.state, "A").ptr).toBe("B");
  });

  it("drop A frees A and drops B from 2 to 1; drop B frees B", () => {
    // "Drop A: \"Free A.\" then \"Drop A. rc=0.\" Freed 1. B's count
    // has fallen from 2 to 1 — A's pointer is gone."
    // "Drop B: \"Free B.\" then \"Drop B. rc=0.\""
    const { notes, steps } = acyclic();
    expect(notes).toContain("Free A.");
    expect(notes).toContain("Drop A. rc=0.");
    const dropA = steps.find((s) => s.note === "Drop A. rc=0.")!;
    expect(dropA.counters[C.freed]).toBe(1);
    expect(obj(dropA.state, "A").freed).toBe(true);
    expect(obj(dropA.state, "B").rc).toBe(1);
    expect(obj(dropA.state, "B").freed).toBe(false);
    expect(notes).toContain("Free B.");
    expect(notes).toContain("Drop B. rc=0.");
  });

  it("ends Both freed with stamp 2 freed: allocs 2, freed 2, leaked 0", () => {
    // "Skip to the end. Allocs 2, freed 2, leaked 0. The last caption
    // is \"Both freed.\" Stamp 2 freed."
    // "A.p=B then drop both: freed 2, leaked 0."
    const run = acyclic();
    expect(run.allocs).toBe(2);
    expect(run.freed).toBe(2);
    expect(run.leaked).toBe(0);
    expect(run.note).toBe("Both freed.");
    expect(run.stamp).toBe("2 freed");
    expect(obj(run.state, "A").freed).toBe(true);
    expect(obj(run.state, "B").freed).toBe(true);
    expect(obj(run.state, "A").rc).toBe(0);
    expect(obj(run.state, "B").rc).toBe(0);
  });

  it("the acyclic figure is runRefcount(false)", () => {
    expect(buildAlgoSteps(referenceCountingAlgo, 0, 42)).toEqual(
      runRefcount(false),
    );
  });
});

describe("reference-counting · cycle A↔B", () => {
  it("opens Cycle A.p=B, B.p=A, stamp cycle", () => {
    // "The first caption is \"Cycle A.p=B, B.p=A.\" Stamp cycle."
    const { steps } = cyclic();
    expect(steps[0]!.note).toBe("Cycle A.p=B, B.p=A.");
    expect(steps[0]!.state.stamp).toBe("cycle");
    expect(steps[0]!.state.heap).toEqual([]);
  });

  it("links both ways so each count is 2", () => {
    // "After both links: \"A.p = B. B rc=2.\" then \"B.p = A. A rc=2.\""
    const { notes, steps } = cyclic();
    expect(notes).toContain("A.p = B. B rc=2.");
    expect(notes).toContain("B.p = A. A rc=2.");
    const linked = steps.find((s) => s.note === "B.p = A. A rc=2.")!;
    expect(obj(linked.state, "A").rc).toBe(2);
    expect(obj(linked.state, "B").rc).toBe(2);
    expect(obj(linked.state, "A").ptr).toBe("B");
    expect(obj(linked.state, "B").ptr).toBe("A");
  });

  it("drop A then drop B never frees: each drop leaves rc 1", () => {
    // "Drop A: \"Drop A. rc=1.\" No free. Drop B: \"Drop B. rc=1.\"
    // Still no free."
    const { notes, steps } = cyclic();
    expect(notes).toContain("Drop A. rc=1.");
    expect(notes).toContain("Drop B. rc=1.");
    expect(notes.some((n) => n?.startsWith("Free "))).toBe(false);
    const dropA = steps.find((s) => s.note === "Drop A. rc=1.")!;
    expect(obj(dropA.state, "A").rc).toBe(1);
    expect(obj(dropA.state, "A").freed).toBe(false);
    expect(obj(dropA.state, "B").rc).toBe(2);
    const dropB = steps.find((s) => s.note === "Drop B. rc=1.")!;
    expect(obj(dropB.state, "A").rc).toBe(1);
    expect(obj(dropB.state, "B").rc).toBe(1);
    expect(obj(dropB.state, "A").freed).toBe(false);
    expect(obj(dropB.state, "B").freed).toBe(false);
  });

  it("ends Leaked 2. rc never hit 0. with stamp 2 leaked", () => {
    // "Skip to the end. Allocs 2, freed 0, leaked 2. The last caption
    // is \"Leaked 2. rc never hit 0.\" Stamp 2 leaked."
    // "A.p=B and B.p=A then drop both: freed 0, leaked 2 — rc stays 1."
    const run = cyclic();
    expect(run.allocs).toBe(2);
    expect(run.freed).toBe(0);
    expect(run.leaked).toBe(2);
    expect(run.note).toBe("Leaked 2. rc never hit 0.");
    expect(run.stamp).toBe("2 leaked");
    expect(obj(run.state, "A").rc).toBe(1);
    expect(obj(run.state, "B").rc).toBe(1);
    expect(obj(run.state, "A").freed).toBe(false);
    expect(obj(run.state, "B").freed).toBe(false);
    expect(obj(run.state, "A").ptr).toBe("B");
    expect(obj(run.state, "B").ptr).toBe("A");
  });

  it("the cycle figure is runRefcount(true)", () => {
    expect(buildAlgoSteps(referenceCountingCycleAlgo, 0, 42)).toEqual(
      runRefcount(true),
    );
  });
});
