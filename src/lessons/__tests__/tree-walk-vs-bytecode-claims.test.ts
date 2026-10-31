import { buildAlgoSteps } from "@/engine/algo/build";
import {
  EVAL_EXPRS,
  RUNTIME_COUNTERS as C,
  runBytecode,
  runWalk,
} from "@/engine/algo/runtime";
import type { AlgoDef } from "@/engine/algo/types";
import type { RuntimeState } from "@/engine/algo/views/runtime";
import {
  treeWalkVsBytecodeAlgo,
  treeWalkVsBytecodeBcAlgo,
} from "@/lessons/parsing-execution/tree-walk-vs-bytecode";
import { describe, expect, it } from "vitest";

/**
 * The tree-walk-vs-bytecode prose states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became untrue.
 *
 * Same tree, two machines. Walk visits every AST node. Bytecode is a
 * linear LOAD / MUL / ADD list plus a stack. Seed is ignored.
 */

function run(
  def: AlgoDef<RuntimeState, number>,
  size: number,
  seed = 42,
) {
  const steps = buildAlgoSteps(def, size, seed);
  const first = steps[0]!;
  const last = steps[steps.length - 1]!;
  return {
    steps,
    first,
    last,
    state: last.state,
    visits: last.counters[C.visits] ?? 0,
    ops: last.counters[C.ops] ?? 0,
    stack: last.counters[C.stack] ?? 0,
    result: last.state.result,
    stamp: last.state.stamp,
    notes: steps.map((s) => s.note),
  };
}

const SIZES = [0, 1, 2] as const;
const walk = treeWalkVsBytecodeAlgo;
const bc = treeWalkVsBytecodeBcAlgo;

describe("tree-walk-vs-bytecode: the slider is which expr, 0 through 2", () => {
  it("offers 0 through 2, default 1, labelled expr", () => {
    // "The slider is which expression, from 0 to 2. Default 1 is the
    // measured run."
    expect(walk.id).toBe("tree-walk-vs-bytecode");
    expect(bc.id).toBe("tree-walk-vs-bytecode-bc");
    expect(walk.size).toMatchObject({
      min: 0,
      max: 2,
      default: 1,
      label: "expr",
    });
    expect(bc.size).toMatchObject({
      min: 0,
      max: 2,
      default: 1,
      label: "expr",
    });
    expect(walk.counters.map((c) => c.key)).toEqual([C.visits]);
    expect(bc.counters.map((c) => c.key)).toEqual([C.ops, C.stack]);
  });

  it("maps 0..2 onto the three EVAL_EXPRS strings", () => {
    // "The three expressions here are 1+2, 1+2*3, and (1+2)*3. Default
    // expr 1 is 1+2*3."
    expect(EVAL_EXPRS).toEqual(["1+2", "1+2*3", "(1+2)*3"]);
    expect(walk.generateInput(() => 0, 0)).toBe(0);
    expect(walk.generateInput(() => 0, 1)).toBe(1);
    expect(walk.generateInput(() => 0, 2)).toBe(2);
    expect(bc.generateInput(() => 0, 1)).toBe(1);
  });

  it("ignores the seed: an evaluator is not a scheduler", () => {
    // "Seed is ignored: an evaluator is not a scheduler."
    for (const size of SIZES) {
      expect(buildAlgoSteps(walk, size, 1)).toEqual(
        buildAlgoSteps(walk, size, 99),
      );
      expect(buildAlgoSteps(bc, size, 1)).toEqual(
        buildAlgoSteps(bc, size, 99),
      );
    }
  });

  it("the lesson defs are the same run as runWalk / runBytecode", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(walk, size, 42)).toEqual(runWalk(size));
      expect(buildAlgoSteps(bc, size, 42)).toEqual(runBytecode(size));
    }
  });
});

describe("tree-walk-vs-bytecode: expr 0 is 1+2", () => {
  it("walk result 3, visits 3; bytecode ops 3, stack 2", () => {
    // "Drag to 0. Source is 1+2. Result 3, visits 3. Stamp 3."
    // "Drag to 0. 1+2 is 3 ops, stack max 2. Result 3."
    const w = run(walk, 0);
    const b = run(bc, 0);
    expect(w.result).toBe(3);
    expect(w.visits).toBe(3);
    expect(w.stamp).toBe("3");
    expect(w.last.note).toBe("1+2 = 3.");
    expect(b.result).toBe(3);
    expect(b.ops).toBe(3);
    expect(b.stack).toBe(2);
    expect(b.stamp).toBe("3");
    expect(b.last.note).toBe("1+2 = 3. stack max 2.");
  });
});

describe("tree-walk-vs-bytecode: expr 1 is 1+2*3, both yield 7", () => {
  it("walk visits 5, stamp 7, with the named leaf and combine notes", () => {
    // "Both yield 7. The walk visits 5 nodes."
    // "Leave expr at 1. The first caption is "Walk 1+2*3." The stamp
    // reads walk. Step: Leaf 1, Leaf 2, Leaf 3, then "2 * 3 = 6.", then
    // "1 + 6 = 7." Meters read 5 visits. The stamp reads 7."
    const w = run(walk, 1);
    expect(w.first.note).toBe("Walk 1+2*3.");
    expect(w.first.state.stamp).toBe("walk");
    expect(w.notes).toContain("Leaf 1.");
    expect(w.notes).toContain("Leaf 2.");
    expect(w.notes).toContain("Leaf 3.");
    expect(w.notes).toContain("2 * 3 = 6.");
    expect(w.notes).toContain("1 + 6 = 7.");
    expect(w.result).toBe(7);
    expect(w.visits).toBe(5);
    expect(w.stamp).toBe("7");
    expect(w.last.note).toBe("1+2*3 = 7.");
  });

  it("bytecode is 5 ops with stack max 3, last notes MUL / ADD / max 3", () => {
    // "Bytecode is 5 ops (LOAD 1, LOAD 2, LOAD 3, MUL, ADD) with stack
    // max 3."
    // "Leave expr at 1. The first caption is "Compile 1+2*3 → 5 ops."
    // Next: "LOAD 1, LOAD 2, LOAD 3, MUL, ADD.""
    // "Step the dispatch. The last notes are "MUL. stack [1 6].",
    // "ADD. stack [7].", and "1+2*3 = 7. stack max 3." Meters: 5 ops,
    // stack 3. Stamp 7."
    const b = run(bc, 1);
    expect(b.first.note).toBe("Compile 1+2*3 → 5 ops.");
    expect(b.notes).toContain("LOAD 1, LOAD 2, LOAD 3, MUL, ADD.");
    expect(b.notes.slice(-3)).toEqual([
      "MUL. stack [1 6].",
      "ADD. stack [7].",
      "1+2*3 = 7. stack max 3.",
    ]);
    expect(b.result).toBe(7);
    expect(b.ops).toBe(5);
    expect(b.stack).toBe(3);
    expect(b.stamp).toBe("7");
  });

  it("both machines get 7 for 1+2*3", () => {
    // "Same tree, two machines. Both get 7 for 1+2*3."
    // "Same 1+2*3, same 7. The walk's 5 is nodes; bytecode's 5 is ops."
    expect(run(walk, 1).result).toBe(7);
    expect(run(bc, 1).result).toBe(7);
    expect(run(walk, 1).visits).toBe(5);
    expect(run(bc, 1).ops).toBe(5);
  });
});

describe("tree-walk-vs-bytecode: expr 2 is (1+2)*3", () => {
  it("both result 9; bytecode stack max 2", () => {
    // "Drag to 2. Source is (1+2)*3. Result 9. Stamp 9. Visits still 5
    // — three leaves and two ops, same as expr 1."
    // "Drag to 2. (1+2)*3 is 9 with stack max 2."
    // "The peak stack moved: 3 for 1+2*3, 2 for (1+2)*3."
    const w = run(walk, 2);
    const b = run(bc, 2);
    expect(w.result).toBe(9);
    expect(w.stamp).toBe("9");
    expect(w.visits).toBe(5);
    expect(b.result).toBe(9);
    expect(b.stamp).toBe("9");
    expect(b.stack).toBe(2);
    expect(b.last.note).toBe("(1+2)*3 = 9. stack max 2.");
  });

  it("ADD happens before the third LOAD, so the stack never holds three", () => {
    // "The code is LOAD 1, LOAD 2, ADD, LOAD 3, MUL — ADD happens
    // before the third LOAD, so the stack never holds three values."
    const b = run(bc, 2);
    expect(b.notes).toContain("LOAD 1, LOAD 2, ADD, LOAD 3, MUL.");
    const depths = b.steps
      .map((s) => s.state.lanes.find((l) => l.name === "stack")?.chips.length ?? 0);
    expect(Math.max(...depths)).toBe(2);
    expect(b.stack).toBe(2);
  });
});
