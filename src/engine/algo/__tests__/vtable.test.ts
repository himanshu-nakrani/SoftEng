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
import { VtableView } from "@/engine/algo/views/VtableView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const lastS = (i: number) => runStatic(i).at(-1)!;
const lastV = (i: number) => runVtable(i).at(-1)!;
const lastI = (slot: number) => runItable(slot).at(-1)!;

describe("runStatic / runVtable", () => {
  it("dog is woof and cat is meow either way", () => {
    expect(VTABLE_OBJECTS[0]!.result).toBe("woof");
    expect(lastS(0).state.result).toBe("woof");
    expect(lastV(0).state.result).toBe("woof");
    expect(lastS(1).state.result).toBe("meow");
    expect(lastV(1).state.result).toBe("meow");
  });

  it("static is 0 lookups; vtable is 2", () => {
    expect(lastS(0).counters[C.lookups] ?? 0).toBe(0);
    expect(lastS(0).counters[C.calls]).toBe(1);
    expect(lastV(0).counters[C.lookups]).toBe(2);
    expect(lastV(0).counters[C.calls]).toBe(1);
    expect(lastV(1).counters[C.lookups]).toBe(2);
  });
});

describe("runItable", () => {
  it("slot 0 scans 1 (lookups 2); slot 2 scans 3 (lookups 4)", () => {
    expect(lastI(0).counters[C.scans]).toBe(1);
    expect(lastI(0).counters[C.lookups]).toBe(2);
    expect(lastI(2).counters[C.scans]).toBe(3);
    expect(lastI(2).counters[C.lookups]).toBe(4);
    expect(lastI(2).state.result).toBe("woof");
  });
});

describe("vtable rides on archetype B", () => {
  const def: AlgoDef<VtableState, number> = {
    id: "vt",
    title: "vtable",
    code: ["object", "vptr", "slot", "call"],
    counters: [{ key: C.lookups, label: "lookups" }],
    size: { label: "object", min: 0, max: 1, default: 0 },
    generateInput: (_rng, size) => size,
    run: (size) => runVtable(size),
  };

  it("size changes the object and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 1, 1));
    const view: ComponentType<{ state: VtableState }> = VtableView;
    expect(view).toBe(VtableView);
  });
});
