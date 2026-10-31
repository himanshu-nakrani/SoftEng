import { buildAlgoSteps } from "@/engine/algo/build";
import { GC_COUNTERS as C, runMarkSweep, runRefcount } from "@/engine/algo/gc";
import type { GcState } from "@/engine/algo/views/gc";
import { markAndSweepAlgo } from "@/lessons/memory-management/mark-and-sweep";
import { describe, expect, it } from "vitest";

/**
 * The mark-and-sweep prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * Four named objects. 0 always points at 1. The slider is which heap.
 * Seed is ignored: a mark walk is not a scheduler.
 */

function run(size = 0, seed = 42) {
  const steps = buildAlgoSteps(markAndSweepAlgo, size, seed);
  const first = steps[0]!;
  const last = steps[steps.length - 1]!;
  return {
    steps,
    first,
    last,
    state: last.state,
    marked: last.counters[C.marked] ?? 0,
    swept: last.counters[C.swept] ?? 0,
    stamp: last.state.stamp,
  };
}

function obj(state: GcState, id: string) {
  const found = state.heap.find((o) => o.id === id);
  expect(found, `missing object ${id}`).toBeDefined();
  return found!;
}

const HEAPS = [0, 1, 2] as const;

describe("mark-and-sweep: the slider is which heap, 0 through 2", () => {
  it("offers 0 through 2, default 0, labelled heap", () => {
    // "The slider is which heap, from 0 to 2. Default 0 is the measured run."
    expect(markAndSweepAlgo.id).toBe("mark-and-sweep");
    expect(markAndSweepAlgo.size).toMatchObject({
      min: 0,
      max: 2,
      default: 0,
      label: "heap",
    });
    expect(markAndSweepAlgo.counters.map((c) => c.key)).toEqual([
      C.marked,
      C.swept,
    ]);
  });

  it("maps 0..2 onto runMarkSweep(size)", () => {
    for (const size of HEAPS) {
      expect(markAndSweepAlgo.generateInput(() => 0, size)).toBe(size);
      expect(buildAlgoSteps(markAndSweepAlgo, size, 42)).toEqual(
        runMarkSweep(size),
      );
    }
  });

  it("ignores the seed: a mark walk is not a scheduler", () => {
    for (const size of HEAPS) {
      expect(buildAlgoSteps(markAndSweepAlgo, size, 1)).toEqual(
        buildAlgoSteps(markAndSweepAlgo, size, 99),
      );
    }
  });
});

describe("mark-and-sweep: four objects, 0→1 always", () => {
  it("every heap is objects 0, 1, 2, 3, and 0 always points at 1", () => {
    // "Four heap objects: 0, 1, 2, and 3. 0→1 always."
    for (const size of HEAPS) {
      const { first, last } = run(size);
      expect(first.state.heap.map((o) => o.id)).toEqual(["0", "1", "2", "3"]);
      expect(obj(first.state, "0").ptr).toBe("1");
      expect(obj(last.state, "0").ptr).toBe("1");
    }
  });
});

describe("mark-and-sweep: heap 0 is root 0, 2 and 3 garbage", () => {
  it("opens with root 0, stamp mark, and 2 and 3 unmarked", () => {
    // "Leave heap at 0. The first caption is "Root 0→1. 2 and 3 are garbage.""
    // "Default heap 0 has one root: 0. 2 and 3 have no path from that root,
    // so they are garbage."
    const { first } = run(0);
    expect(first.note).toBe("Root 0→1. 2 and 3 are garbage.");
    expect(first.state.stamp).toBe("mark");
    expect(first.state.roots).toEqual(["0"]);
    expect(first.counters[C.marked] ?? 0).toBe(0);
    expect(first.counters[C.swept] ?? 0).toBe(0);
    expect(obj(first.state, "2").ptr).toBeNull();
    expect(obj(first.state, "3").ptr).toBeNull();
    expect(obj(first.state, "2").marked).toBe(false);
    expect(obj(first.state, "3").marked).toBe(false);
  });

  it("steps Mark 0, Mark 1, Sweep 2, Sweep 3", () => {
    // "Step: Mark 0, then Mark 1, then Sweep 2, then Sweep 3."
    const notes = run(0).steps.map((s) => s.note);
    expect(notes).toEqual([
      "Root 0→1. 2 and 3 are garbage.",
      "Mark 0.",
      "Mark 1.",
      "Sweep 2.",
      "Sweep 3.",
      "2 marked, 2 swept.",
    ]);
  });

  it("ends at 2 marked, 2 swept, stamp 2 marked 2 swept", () => {
    // "Meters read 2 marked, 2 swept. The stamp reads 2 marked 2 swept."
    const c = run(0);
    expect(c.marked).toBe(2);
    expect(c.swept).toBe(2);
    expect(c.stamp).toBe("2 marked 2 swept");
    expect(c.last.note).toBe("2 marked, 2 swept.");
    expect(obj(c.state, "0").marked).toBe(true);
    expect(obj(c.state, "1").marked).toBe(true);
    expect(obj(c.state, "2").freed).toBe(true);
    expect(obj(c.state, "3").freed).toBe(true);
    expect(obj(c.state, "0").freed).toBe(false);
    expect(obj(c.state, "1").freed).toBe(false);
  });
});

describe("mark-and-sweep: heap 1 is an unrooted cycle still swept", () => {
  it("adds 2↔3, still marks 2 and sweeps 2", () => {
    // "Drag to 1. An unrooted cycle 2↔3 appears. Same counts: 2 marked,
    // 2 swept. The cycle is still swept. Stamp still 2 marked 2 swept."
    // "Heap 1 is the same 0→1 chain plus an unrooted 2↔3 cycle. Mark
    // still paints 0 and 1, then sweeps 2 and 3. Meters stay at 2 marked,
    // 2 swept — the same counts as heap 0."
    const c = run(1);
    expect(c.first.note).toBe("Root 0. Cycle 2↔3 is garbage.");
    expect(c.first.state.roots).toEqual(["0"]);
    expect(obj(c.first.state, "2").ptr).toBe("3");
    expect(obj(c.first.state, "3").ptr).toBe("2");
    expect(c.marked).toBe(2);
    expect(c.swept).toBe(2);
    expect(c.stamp).toBe("2 marked 2 swept");
    expect(c.last.note).toBe("2 marked, 2 swept.");
    expect(obj(c.state, "2").freed).toBe(true);
    expect(obj(c.state, "3").freed).toBe(true);
    expect(obj(c.state, "2").marked).toBe(false);
    expect(obj(c.state, "3").marked).toBe(false);
    expect(c.marked).toBe(run(0).marked);
    expect(c.swept).toBe(run(0).swept);
  });

  it("refcount on a cycle leaked 2; mark-sweep swept them", () => {
    // "The last lesson leaked both ends of a cycle: A↔B then drop both
    // left rc at 1, leaked 2. Mark-sweep does not care that 2 and 3
    // point at each other. Unreachable is unmarked, so both get swept."
    const leaked = runRefcount(true).at(-1)!;
    expect(leaked.counters[C.leaked]).toBe(2);
    expect(leaked.counters[C.freed] ?? 0).toBe(0);
    const cycle = run(1);
    expect(cycle.marked).toBe(2);
    expect(cycle.swept).toBe(2);
  });
});

describe("mark-and-sweep: heap 2 roots 0 and 2, nothing swept", () => {
  it("marks all four, sweeps none, stamp 4 marked 0 swept", () => {
    // "Drag to 2. Roots 0 and 2. Cycle 2↔3 is live. Meters: 4 marked,
    // 0 swept. Stamp 4 marked 0 swept."
    // "Heap 2 adds root 2. Now the cycle is live. All four objects
    // mark; nothing sweeps. 4 marked, 0 swept."
    const c = run(2);
    expect(c.first.note).toBe("Roots 0 and 2. Cycle 2↔3 is live.");
    expect(c.first.state.roots).toEqual(["0", "2"]);
    expect(obj(c.first.state, "2").ptr).toBe("3");
    expect(obj(c.first.state, "3").ptr).toBe("2");
    expect(c.marked).toBe(4);
    expect(c.swept).toBe(0);
    expect(c.stamp).toBe("4 marked 0 swept");
    expect(c.last.note).toBe("4 marked, 0 swept.");
    expect(c.state.heap.every((o) => o.marked)).toBe(true);
    expect(c.state.heap.every((o) => !o.freed)).toBe(true);
  });
});
