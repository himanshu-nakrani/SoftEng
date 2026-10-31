import { buildAlgoSteps } from "@/engine/algo/build";
import type { AlgoDef } from "@/engine/algo/types";
import {
  VTABLE_COUNTERS as C,
  VTABLE_OBJECTS,
  runItable,
  runStatic,
  runVtable,
} from "@/engine/algo/vtable";
import type { VtableState } from "@/engine/algo/views/vtable";
import {
  vtablesAlgo,
  vtablesItableAlgo,
  vtablesStaticAlgo,
} from "@/lessons/runtime-systems/vtables";
import { describe, expect, it } from "vitest";

/**
 * The vtables prose states numbers. A failure here means the page now
 * lies, and the message should name the sentence that became untrue.
 */

function run(def: AlgoDef<VtableState, number>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    lookups: last.counters[C.lookups] ?? 0,
    scans: last.counters[C.scans] ?? 0,
    calls: last.counters[C.calls] ?? 0,
    result: last.state.result,
    stamp: last.state.stamp,
    notes: steps.map((s) => s.note),
  };
}

describe("vtables: sliders and ids", () => {
  it("static and vtable are object 0–1 default 0; itable is speak slot 0–2 default 2", () => {
    expect(vtablesAlgo.id).toBe("vtables");
    expect(vtablesStaticAlgo.id).toBe("vtables-static");
    expect(vtablesItableAlgo.id).toBe("vtables-itable");
    expect(vtablesAlgo.size).toMatchObject({ min: 0, max: 1, default: 0, label: "object" });
    expect(vtablesStaticAlgo.size).toMatchObject({ min: 0, max: 1, default: 0, label: "object" });
    expect(vtablesItableAlgo.size).toMatchObject({
      min: 0,
      max: 2,
      default: 2,
      label: "speak slot",
    });
  });

  it("ignores the seed: a table is not a scheduler", () => {
    expect(buildAlgoSteps(vtablesAlgo, 0, 1)).toEqual(buildAlgoSteps(vtablesAlgo, 0, 99));
    expect(buildAlgoSteps(vtablesItableAlgo, 2, 1)).toEqual(
      buildAlgoSteps(vtablesItableAlgo, 2, 99),
    );
  });
});

describe("vtables: static is 0 lookups", () => {
  it("dog calls Dog_speak → woof with 0 lookups", () => {
    // "Leave object at 0. The first caption is Static Dog.speak. Lookups is 0."
    // "Call Dog_speak → woof. Calls is 1. The stamp reads woof. Lookups is still 0."
    const { notes, lookups, calls, result, stamp } = run(vtablesStaticAlgo, 0);
    expect(notes[0]).toBe("Static Dog.speak.");
    expect(notes[1]).toBe("Object is dog.");
    expect(notes[2]).toBe("Call Dog_speak → woof.");
    expect(lookups).toBe(0);
    expect(calls).toBe(1);
    expect(result).toBe("woof");
    expect(stamp).toBe("woof");
    expect(VTABLE_OBJECTS[0]!.result).toBe("woof");
  });

  it("cat is meow, still 0 lookups", () => {
    // "Drag to 1. Cat.speak → meow. Lookups still 0."
    const { lookups, result, notes } = run(vtablesStaticAlgo, 1);
    expect(notes[0]).toBe("Static Cat.speak.");
    expect(lookups).toBe(0);
    expect(result).toBe("meow");
    expect(buildAlgoSteps(vtablesStaticAlgo, 0, 42)).toEqual(runStatic(0));
  });
});

describe("vtables: a class vtable is 2 lookups", () => {
  it("dog: load vptr then slot 0, woof", () => {
    // "Load vptr → Dog_vt. Lookups becomes 1."
    // "Slot 0 is Dog_speak. Lookups is 2. Call Dog_speak → woof."
    const { notes, lookups, calls, result, steps } = run(vtablesAlgo, 0);
    expect(notes[0]).toBe("Dynamic dog.speak.");
    expect(notes[2]).toBe("Load vptr → Dog_vt.");
    expect(steps[2]!.counters[C.lookups]).toBe(1);
    expect(notes[3]).toBe("Slot 0 is Dog_speak.");
    expect(lookups).toBe(2);
    expect(calls).toBe(1);
    expect(result).toBe("woof");
    expect(buildAlgoSteps(vtablesAlgo, 0, 42)).toEqual(runVtable(0));
  });

  it("cat: same two loads, meow", () => {
    // "Drag to 1. Same two loads, Cat_vt, Cat_speak, meow."
    const { notes, lookups, result } = run(vtablesAlgo, 1);
    expect(notes).toContain("Load vptr → Cat_vt.");
    expect(notes).toContain("Slot 0 is Cat_speak.");
    expect(lookups).toBe(2);
    expect(result).toBe("meow");
  });
});

describe("vtables: an itable scans until speak", () => {
  it("default slot 2: scans 3, lookups 4, still woof", () => {
    // "Leave speak slot at 2."
    // "Slot 0 is draw, not speak. Slot 1 is clone, not speak. Slot 2 is speak.
    // Scans 3, lookups 4."
    const { notes, scans, lookups, result } = run(vtablesItableAlgo, 2);
    expect(notes[0]).toBe("Interface speak on dog. iid at slot 2.");
    expect(notes).toContain("Slot 0 is draw, not speak.");
    expect(notes).toContain("Slot 1 is clone, not speak.");
    expect(notes).toContain("Slot 2 is speak.");
    expect(notes.at(-1)).toBe("Call Dog_speak → woof.");
    expect(scans).toBe(3);
    expect(lookups).toBe(4);
    expect(result).toBe("woof");
    expect(buildAlgoSteps(vtablesItableAlgo, 2, 42)).toEqual(runItable(2));
  });

  it("slot 0 is 1 scan and 2 lookups; slot 1 is 2 scans and 3 lookups", () => {
    // "Drag to 0: scans 1, lookups 2 — the same two loads as a vtable.
    // Slot 1: scans 2, lookups 3."
    expect(run(vtablesItableAlgo, 0).scans).toBe(1);
    expect(run(vtablesItableAlgo, 0).lookups).toBe(2);
    expect(run(vtablesItableAlgo, 1).scans).toBe(2);
    expect(run(vtablesItableAlgo, 1).lookups).toBe(3);
  });
});
