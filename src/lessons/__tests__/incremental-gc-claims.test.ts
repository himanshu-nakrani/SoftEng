import { buildAlgoSteps } from "@/engine/algo/build";
import { GC_COUNTERS as C, runIncremental } from "@/engine/algo/gc";
import type { AlgoDef } from "@/engine/algo/types";
import type { GcState } from "@/engine/algo/views/gc";
import {
  incrementalGcAlgo,
  incrementalGcSlicedAlgo,
} from "@/lessons/memory-management/incremental-gc";
import { describe, expect, it } from "vitest";

/**
 * The incremental-gc prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * Four live objects a→b→c→d. Seed is ignored: a mark is not a scheduler.
 * pause is the max slice, not the total work.
 */

function at<I>(def: AlgoDef<GcState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const first = steps[0]!;
  const last = steps[steps.length - 1]!;
  return {
    steps,
    first,
    last,
    pause: last.counters[C.pause] ?? 0,
    slices: last.counters[C.slices] ?? 0,
    marked: last.counters[C.marked] ?? 0,
    stamp: last.state.stamp,
    note: last.note,
    state: last.state,
  };
}

const stw = () => at(incrementalGcAlgo, 1);
const sliced = (budget: number) => at(incrementalGcSlicedAlgo, budget);

describe("incremental-gc: two defs, STW has no slider", () => {
  it("ids start with incremental-gc; counters are pause, slices, marked", () => {
    expect(incrementalGcAlgo.id).toBe("incremental-gc");
    expect(incrementalGcSlicedAlgo.id).toBe("incremental-gc-sliced");
    expect(incrementalGcAlgo.counters.map((c) => c.key)).toEqual([
      C.pause,
      C.slices,
      C.marked,
    ]);
    expect(incrementalGcSlicedAlgo.counters).toEqual(incrementalGcAlgo.counters);
  });

  it("STW omits size; incremental is budget 1 through 4, default 1", () => {
    // "The slider is the budget, 1 through 4. Default 1 is four slices of one."
    expect(incrementalGcAlgo.size).toBeUndefined();
    expect(incrementalGcSlicedAlgo.size).toMatchObject({
      min: 1,
      max: 4,
      default: 1,
      label: "budget",
    });
  });

  it("ignores the seed: a mark is not a scheduler", () => {
    expect(buildAlgoSteps(incrementalGcAlgo, 1, 1)).toEqual(
      buildAlgoSteps(incrementalGcAlgo, 1, 99),
    );
    expect(buildAlgoSteps(incrementalGcSlicedAlgo, 1, 1)).toEqual(
      buildAlgoSteps(incrementalGcSlicedAlgo, 1, 99),
    );
    expect(buildAlgoSteps(incrementalGcSlicedAlgo, 4, 1)).toEqual(
      buildAlgoSteps(incrementalGcSlicedAlgo, 4, 99),
    );
  });

  it("STW ignores size: there is no slice to size", () => {
    expect(buildAlgoSteps(incrementalGcAlgo, 1, 42)).toEqual(
      buildAlgoSteps(incrementalGcAlgo, 12, 42),
    );
  });

  it("the lesson defs are the same run as runIncremental", () => {
    expect(buildAlgoSteps(incrementalGcAlgo, 1, 42)).toEqual(
      runIncremental(true, 1),
    );
    for (const budget of [1, 2, 3, 4] as const) {
      expect(buildAlgoSteps(incrementalGcSlicedAlgo, budget, 42)).toEqual(
        runIncremental(false, budget),
      );
    }
  });
});

describe("incremental-gc: four live objects a→b→c→d", () => {
  it("both figures open on the same rooted chain, unmarked", () => {
    // "Four live objects: a→b→c→d, rooted at a."
    // "Nothing is swept — the heap is all live."
    for (const run of [stw(), sliced(1)]) {
      expect(run.first.state.heap.map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
      expect(run.first.state.heap.map((o) => o.ptr)).toEqual(["b", "c", "d", null]);
      expect(run.first.state.roots).toEqual(["a"]);
      expect(run.first.state.kind).toBe("incremental");
      expect(run.first.state.heap.every((o) => !o.marked && !o.freed)).toBe(true);
      expect(run.first.counters[C.pause] ?? 0).toBe(0);
      expect(run.first.counters[C.slices] ?? 0).toBe(0);
      expect(run.first.counters[C.marked] ?? 0).toBe(0);
    }
  });

  it("the work is the same 4 marks either way", () => {
    // "The work is the same 4 marks; the pause is the slice."
    expect(stw().marked).toBe(4);
    for (const budget of [1, 2, 3, 4] as const) {
      const run = sliced(budget);
      expect(run.marked).toBe(4);
      expect(run.state.heap.every((o) => o.marked && !o.freed)).toBe(true);
    }
  });
});

describe("incremental-gc: stop-the-world is one pause of 4", () => {
  it("pause 4, slices 1, marked 4, stamp pause 4", () => {
    // "Skip to the end. pause 4, slices 1, marked 4."
    // "The last caption is \"One pause of 4.\" The stamp reads pause 4."
    const run = stw();
    expect(run.pause).toBe(4);
    expect(run.slices).toBe(1);
    expect(run.marked).toBe(4);
    expect(run.note).toBe("One pause of 4.");
    expect(run.stamp).toBe("pause 4");
  });

  it("opens on Stop-the-world mark of 4, meters still 0", () => {
    // "The first caption is \"Stop-the-world mark of 4.\""
    // "pause, slices, and marked are still 0."
    const { first } = stw();
    expect(first.note).toBe("Stop-the-world mark of 4.");
    expect(first.state.stamp).toBe("stw");
    expect(first.counters[C.pause] ?? 0).toBe(0);
    expect(first.counters[C.slices] ?? 0).toBe(0);
    expect(first.counters[C.marked] ?? 0).toBe(0);
  });
});

describe("incremental-gc: budget 1 is four slices, pause 1", () => {
  it("pause 1, slices 4, marked 4, stamp max 1 × 4", () => {
    // "Leave budget at 1. Skip to the end: pause 1, slices 4, marked 4."
    // "The stamp reads max 1 × 4. The last caption is \"4 slices, budget 1.\""
    const run = sliced(1);
    expect(run.pause).toBe(1);
    expect(run.slices).toBe(4);
    expect(run.marked).toBe(4);
    expect(run.stamp).toBe("max 1 × 4");
    expect(run.note).toBe("4 slices, budget 1.");
  });

  it("opens on Incremental mark, budget 1", () => {
    const { first } = sliced(1);
    expect(first.note).toBe("Incremental mark, budget 1.");
    expect(first.state.stamp).toBe("budget 1");
  });
});

describe("incremental-gc: budget 4 is the same as STW", () => {
  it("pause 4, slices 1 — the same as STW", () => {
    // "Drag to 4. pause 4, slices 1 — the same as STW."
    // "Budget 4 is one slice of four."
    const run = sliced(4);
    const stop = stw();
    expect(run.pause).toBe(4);
    expect(run.slices).toBe(1);
    expect(run.marked).toBe(4);
    expect(run.pause).toBe(stop.pause);
    expect(run.slices).toBe(stop.slices);
    expect(run.marked).toBe(stop.marked);
  });
});

describe("incremental-gc: pause is the max slice, not the total work", () => {
  it("budget 3 marks 3 then 1: pause stays 3, slices 2, marked 4", () => {
    // "The pause meter is the longest slice, not the total work."
    // "Drag to 3. It marks 3, then 1. pause stays 3, slices 2, marked 4."
    // "The pause is the max slice, not the sum."
    const run = sliced(3);
    expect(run.pause).toBe(3);
    expect(run.slices).toBe(2);
    expect(run.marked).toBe(4);
    expect(run.pause).not.toBe(3 + 1);
    expect(run.stamp).toBe("max 3 × 2");
    expect(run.note).toBe("2 slices, budget 3.");
  });

  it("budget 2 is pause 2, not 4", () => {
    const run = sliced(2);
    expect(run.pause).toBe(2);
    expect(run.slices).toBe(2);
    expect(run.marked).toBe(4);
  });
});
