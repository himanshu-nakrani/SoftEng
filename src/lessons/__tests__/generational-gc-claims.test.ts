import { buildAlgoSteps } from "@/engine/algo/build";
import { GC_COUNTERS as C, runGenerational } from "@/engine/algo/gc";
import type { AlgoDef } from "@/engine/algo/types";
import type { GcState } from "@/engine/algo/views/gc";
import {
  generationalGcAlgo,
  generationalGcBarrierAlgo,
} from "@/lessons/memory-management/generational-gc";
import { describe, expect, it } from "vitest";

/**
 * The generational-gc prose states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became
 * untrue.
 *
 * Seed is ignored: a collector is not a scheduler.
 */

function obj(state: GcState, id: string) {
  const found = state.heap.find((o) => o.id === id);
  expect(found, `missing ${id}`).toBeDefined();
  return found!;
}

function at(def: AlgoDef<GcState, boolean>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    first: steps[0]!,
    last,
    state: last.state,
    counters: last.counters,
    stamp: last.state.stamp,
    note: last.note,
    lost: last.counters[C.lost] ?? 0,
    swept: last.counters[C.swept] ?? 0,
    cards: last.counters[C.cards] ?? 0,
    marked: last.counters[C.marked] ?? 0,
    obj: (id: string) => obj(last.state, id),
  };
}

const none = (size: number) => at(generationalGcAlgo, size);
const barrier = (size: number) => at(generationalGcBarrierAlgo, size);
const SIZES = [0, 1] as const;

describe("generational-gc · the slider is the old-to-young store, 0 or 1", () => {
  it("offers 0 through 1, default 1, labelled old-to-young", () => {
    // "The slider is the old-to-young store, 0 or 1. Default 1 is O0.p = Y1."
    expect(generationalGcAlgo.id).toBe("generational-gc");
    expect(generationalGcBarrierAlgo.id).toBe("generational-gc-barrier");
    expect(generationalGcAlgo.size).toMatchObject({
      min: 0,
      max: 1,
      default: 1,
      label: "old-to-young",
    });
    expect(generationalGcBarrierAlgo.size).toEqual(generationalGcAlgo.size);
    expect(generationalGcAlgo.counters.map((c) => c.key)).toEqual([
      C.lost,
      C.swept,
      C.cards,
      C.marked,
    ]);
    expect(generationalGcBarrierAlgo.counters).toEqual(
      generationalGcAlgo.counters,
    );
  });

  it("maps 1 onto O0.p = Y1 and 0 onto no store", () => {
    // "Default 1 is O0.p = Y1."
    expect(generationalGcAlgo.generateInput(() => 0, 1)).toBe(true);
    expect(generationalGcAlgo.generateInput(() => 0, 0)).toBe(false);
    expect(generationalGcBarrierAlgo.generateInput(() => 0, 1)).toBe(true);
    expect(generationalGcBarrierAlgo.generateInput(() => 0, 0)).toBe(false);
  });

  it("ignores the seed: a collector is not a scheduler", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(generationalGcAlgo, size, 1)).toEqual(
        buildAlgoSteps(generationalGcAlgo, size, 99),
      );
      expect(buildAlgoSteps(generationalGcBarrierAlgo, size, 1)).toEqual(
        buildAlgoSteps(generationalGcBarrierAlgo, size, 99),
      );
    }
  });

  it("the lesson defs are the same runs as runGenerational", () => {
    expect(buildAlgoSteps(generationalGcAlgo, 1, 42)).toEqual(
      runGenerational(false, true),
    );
    expect(buildAlgoSteps(generationalGcAlgo, 0, 42)).toEqual(
      runGenerational(false, false),
    );
    expect(buildAlgoSteps(generationalGcBarrierAlgo, 1, 42)).toEqual(
      runGenerational(true, true),
    );
    expect(buildAlgoSteps(generationalGcBarrierAlgo, 0, 42)).toEqual(
      runGenerational(true, false),
    );
  });
});

describe("generational-gc · the heap is Y0, Y1, O0", () => {
  it("is three objects: Y0 (young, rooted), Y1 (young), O0 (old, rooted)", () => {
    // "The heap is three objects: Y0 (young, rooted), Y1 (young), O0
    // (old, rooted). Y0 survives every run. O0 is old and is never
    // swept. Y1 is the question."
    for (const def of [generationalGcAlgo, generationalGcBarrierAlgo]) {
      for (const size of SIZES) {
        const run = at(def, size);
        expect(run.first.state.heap.map((o) => o.id)).toEqual([
          "Y0",
          "Y1",
          "O0",
        ]);
        expect(run.first.state.roots).toEqual(["Y0", "O0"]);
        expect(obj(run.first.state, "Y0").gen).toBe("young");
        expect(obj(run.first.state, "Y1").gen).toBe("young");
        expect(obj(run.first.state, "O0").gen).toBe("old");
        expect(run.obj("Y0").freed).toBe(false);
        expect(run.obj("O0").freed).toBe(false);
      }
    }
  });
});

describe("generational-gc · no barrier, old-to-young on (size 1)", () => {
  it("opens on O0.p = Y1. Minor GC, with the store not yet written", () => {
    // "Leave old-to-young at 1. The first caption is "O0.p = Y1. Minor GC.""
    const run = none(1);
    expect(run.first.note).toBe("O0.p = Y1. Minor GC.");
    expect(run.first.state.stamp).toBe("no barrier");
    expect(obj(run.first.state, "O0").ptr).toBeNull();
    expect(run.first.counters[C.lost] ?? 0).toBe(0);
    expect(run.first.counters[C.swept] ?? 0).toBe(0);
  });

  it("stores without a barrier, marks only Y0, then sweeps live Y1", () => {
    // "Step: "Store O0.p = Y1. No barrier." Then "Minor mark Y0." Then
    // "Sweep Y1. Live pointer from old missed.""
    const notes = none(1).steps.map((s) => s.note);
    expect(notes).toContain("Store O0.p = Y1. No barrier.");
    expect(notes).toContain("Minor mark Y0.");
    expect(notes).toContain("Sweep Y1. Live pointer from old missed.");
    expect(notes).not.toContain("Minor mark Y1.");
  });

  it("ends at lost 1, swept 1, stamp lost Y1", () => {
    // "The stamp reads lost Y1. lost is 1, swept is 1. The last
    // caption: "Y1 was live and got swept.""
    const run = none(1);
    expect(run.lost).toBe(1);
    expect(run.swept).toBe(1);
    expect(run.stamp).toBe("lost Y1");
    expect(run.note).toBe("Y1 was live and got swept.");
    expect(run.obj("Y1").lost).toBe(true);
    expect(run.obj("Y1").freed).toBe(true);
    expect(run.obj("O0").ptr).toBe("Y1");
    expect(run.marked).toBe(1);
    expect(run.cards).toBe(0);
    expect(run.state.cards).toEqual([]);
  });
});

describe("generational-gc · barrier, old-to-young on (size 1)", () => {
  it("dirties card O0, then marks Y0 and Y1", () => {
    // "Leave old-to-young at 1. The write barrier dirties card O0.
    // cards is 1."
    // "Then "Minor mark Y0." then "Minor mark Y1." marked is 2,
    // swept is 0."
    const run = barrier(1);
    expect(run.first.note).toBe("O0.p = Y1. Minor GC.");
    const notes = run.steps.map((s) => s.note);
    expect(notes).toContain("Write barrier dirties card O0.");
    expect(notes).toContain("Minor mark Y0.");
    expect(notes).toContain("Minor mark Y1.");
    const dirty = run.steps.find(
      (s) => s.note === "Write barrier dirties card O0.",
    )!;
    expect(dirty.counters[C.cards]).toBe(1);
    expect(dirty.state.cards).toEqual(["O0"]);
    expect(run.cards).toBe(1);
    expect(run.marked).toBe(2);
    expect(run.swept).toBe(0);
  });

  it("ends at lost 0, cards 1, marked 2, swept 0, stamp held", () => {
    // "The stamp reads held. lost is 0. The last caption: "Young live
    // set held.""
    // "lost 0, cards 1, marked 2, swept 0, stamp held."
    const run = barrier(1);
    expect(run.lost).toBe(0);
    expect(run.cards).toBe(1);
    expect(run.marked).toBe(2);
    expect(run.swept).toBe(0);
    expect(run.stamp).toBe("held");
    expect(run.note).toBe("Young live set held.");
    expect(run.obj("Y1").lost).toBe(false);
    expect(run.obj("Y1").freed).toBe(false);
    expect(run.obj("Y1").marked).toBe(true);
    expect(run.obj("Y0").marked).toBe(true);
    expect(run.obj("O0").ptr).toBe("Y1");
    expect(run.state.cards).toEqual(["O0"]);
  });
});

describe("generational-gc · no old-to-young pointer (size 0)", () => {
  it("sweeps Y1 as garbage, lost 0, swept 1", () => {
    // "Drag to 0. The first caption is "No old-to-young pointer. Minor
    // GC." Y1 is garbage and got swept, lost 0, swept 1. The stamp
    // reads 1 swept."
    const run = none(0);
    expect(run.first.note).toBe("No old-to-young pointer. Minor GC.");
    expect(run.lost).toBe(0);
    expect(run.swept).toBe(1);
    expect(run.stamp).toBe("1 swept");
    expect(run.note).toBe("Y1 was garbage and got swept.");
    expect(run.obj("Y1").freed).toBe(true);
    expect(run.obj("Y1").lost).toBe(false);
    expect(run.obj("O0").ptr).toBeNull();
  });

  it("Y1 is garbage either way: barrier size 0 is lost 0, swept 1, cards 0", () => {
    // "Drag to 0. Y1 is garbage either way. lost 0, swept 1, cards 0."
    const run = barrier(0);
    expect(run.first.note).toBe("No old-to-young pointer. Minor GC.");
    expect(run.lost).toBe(0);
    expect(run.swept).toBe(1);
    expect(run.cards).toBe(0);
    expect(run.note).toBe("Y1 was garbage and got swept.");
    expect(run.obj("Y1").freed).toBe(true);
    expect(run.obj("Y1").lost).toBe(false);
    expect(run.state.cards).toEqual([]);
  });
});
