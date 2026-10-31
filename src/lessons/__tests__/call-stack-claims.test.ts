import { buildAlgoSteps } from "@/engine/algo/build";
import {
  RUNTIME_COUNTERS as C,
  STACK_CAP,
  runCallStack,
} from "@/engine/algo/runtime";
import type { AlgoDef } from "@/engine/algo/types";
import type { RuntimeState } from "@/engine/algo/views/runtime";
import { callStackAlgo } from "@/lessons/parsing-execution/call-stack";
import { describe, expect, it } from "vitest";

/**
 * The call-stack prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * f(n) = n==0 ? 1 : n * f(n-1). Cap 4. Seed is ignored: a call stack
 * is not a scheduler.
 */

function run(
  def: AlgoDef<RuntimeState, number> = callStackAlgo,
  n = 3,
  seed = 42,
) {
  const steps = buildAlgoSteps(def, n, seed);
  const first = steps[0]!;
  const last = steps[steps.length - 1]!;
  return {
    steps,
    first,
    last,
    state: last.state,
    notes: steps.map((s) => s.note),
    result: last.state.result,
    stamp: last.state.stamp,
    overflowFlag: last.state.overflow,
    pushes: last.counters[C.pushes] ?? 0,
    depth: last.counters[C.depth] ?? 0,
    overflow: last.counters[C.overflow] ?? 0,
  };
}

const SIZES = [0, 1, 2, 3, 4] as const;

describe("call-stack: the slider is n, from 0 to 4", () => {
  it("offers 0 through 4, default 3, labelled n", () => {
    // "The slider is n, from 0 to 4. Default 3 is the measured run."
    expect(callStackAlgo.id).toBe("call-stack");
    expect(callStackAlgo.size).toMatchObject({
      min: 0,
      max: 4,
      default: 3,
      label: "n",
    });
    expect(callStackAlgo.counters.map((c) => c.key)).toEqual([
      C.pushes,
      C.depth,
      C.overflow,
    ]);
    expect(STACK_CAP).toBe(4);
  });

  it("maps the slider onto n itself", () => {
    // "The function here is f(n) = n==0 ? 1 : n * f(n-1)."
    expect(callStackAlgo.generateInput(() => 0, 0)).toBe(0);
    expect(callStackAlgo.generateInput(() => 0, 3)).toBe(3);
    expect(callStackAlgo.generateInput(() => 0, 4)).toBe(4);
  });

  it("ignores the seed: a call stack is not a scheduler", () => {
    for (const n of SIZES) {
      expect(buildAlgoSteps(callStackAlgo, n, 1)).toEqual(
        buildAlgoSteps(callStackAlgo, n, 99),
      );
    }
  });

  it("the lesson def is the same run as runCallStack on that n", () => {
    for (const n of SIZES) {
      expect(buildAlgoSteps(callStackAlgo, n, 42)).toEqual(runCallStack(n));
    }
  });

  it("code lines are enter / base / return / overflow, each ≤ 27 chars", () => {
    expect(callStackAlgo.code).toEqual([
      "enter f(n)",
      "n==0: return 1",
      "return n * f(n-1)",
      "overflow",
    ]);
    expect(callStackAlgo.code.every((line) => line.length <= 27)).toBe(true);
  });
});

describe("call-stack: n=0 is the base case", () => {
  it("result is 1, depth 1, overflow 0", () => {
    // "Drag to 0. Result is 1, depth 1, overflow 0."
    const c = run(callStackAlgo, 0);
    expect(c.result).toBe(1);
    expect(c.depth).toBe(1);
    expect(c.overflow).toBe(0);
    expect(c.pushes).toBe(1);
    expect(c.stamp).toBe("1");
    expect(c.overflowFlag).toBe(false);
    expect(c.last.note).toBe("f(0) = 1. depth 1.");
  });
});

describe("call-stack: n=3 returns 6 at depth 4", () => {
  it("result 6, pushes 4, depth 4, overflow 0, last note f(3) = 6. depth 4.", () => {
    // "Leave n at 3. The first caption is "f(3). cap 4." Step to the end:
    // the last note is "f(3) = 6. depth 4." Meters read 4 pushes, 4 depth,
    // 0 overflow. The stamp reads 6. Result is 6."
    const c = run(callStackAlgo, 3);
    expect(c.first.note).toBe("f(3). cap 4.");
    expect(c.last.note).toBe("f(3) = 6. depth 4.");
    expect(c.result).toBe(6);
    expect(c.pushes).toBe(4);
    expect(c.depth).toBe(4);
    expect(c.overflow).toBe(0);
    expect(c.stamp).toBe("6");
    expect(c.overflowFlag).toBe(false);
  });

  it("f(3) returns 6 at depth 4, pushes 4, overflow 0", () => {
    // "f(3) returns 6 at depth 4, pushes 4, overflow 0."
    const c = run(callStackAlgo, 3);
    expect(c.result).toBe(6);
    expect(c.depth).toBe(4);
    expect(c.pushes).toBe(4);
    expect(c.overflow).toBe(0);
  });

  it("after f(3) returns the chips are gone and the depth meter still reads 4", () => {
    // "After f(3) returns the chips are gone and the depth meter still
    // reads 4 — four frames sat at once."
    const c = run(callStackAlgo, 3);
    expect(c.state.lanes[0]?.chips ?? []).toEqual([]);
    expect(c.depth).toBe(4);
  });

  it("peak is four frames f(3) through f(0)", () => {
    const c = run(callStackAlgo, 3);
    const peak = c.steps.find((s) => s.note === "Enter f(0). depth 4.");
    expect(peak?.state.lanes[0]?.chips.map((chip) => chip.label)).toEqual([
      "f(3)",
      "f(2)",
      "f(1)",
      "f(0)",
    ]);
  });
});

describe("call-stack: n=4 overflows the cap of 4 at f(0)", () => {
  it("overflow 1, result null, stamp overflow, pushes 4, depth 4", () => {
    // "f(4) overflows the cap of 4 at f(0) — result is null."
    // "Drag to 4. The stamp reads overflow. Result is null. Overflow is 1.
    // ... Pushes stay 4, depth stays 4."
    // "Meters: 4 pushes, 4 depth, 1 overflow. Result is null. Stamp overflow."
    const c = run(callStackAlgo, 4);
    expect(c.overflow).toBe(1);
    expect(c.result).toBeNull();
    expect(c.stamp).toBe("overflow");
    expect(c.overflowFlag).toBe(true);
    expect(c.pushes).toBe(4);
    expect(c.depth).toBe(4);
    expect(c.first.note).toBe("f(4). cap 4.");
  });

  it("notes include Overflow at f(0). cap 4. then Unwind f(1) through f(4)", () => {
    // "Notes include "Overflow at f(0). cap 4." then Unwind f(1) through f(4)."
    // "Then four Unwind notes: Unwind f(1), Unwind f(2), Unwind f(3), Unwind f(4)."
    const { notes } = run(callStackAlgo, 4);
    const i = notes.indexOf("Overflow at f(0). cap 4.");
    expect(i).toBeGreaterThan(-1);
    expect(notes.slice(i)).toEqual([
      "Overflow at f(0). cap 4.",
      "Unwind f(1).",
      "Unwind f(2).",
      "Unwind f(3).",
      "Unwind f(4).",
    ]);
  });

  it("f(0) is the fifth frame and there is no fifth slot", () => {
    // "Four frames fill with f(4), f(3), f(2), f(1). f(0) is the fifth
    // frame and there is no fifth slot."
    // "f(0) never entered."
    const { steps } = run(callStackAlgo, 4);
    const overflowStep = steps.find((s) => s.note === "Overflow at f(0). cap 4.");
    expect(overflowStep).toBeDefined();
    expect(overflowStep!.state.lanes[0]?.chips.map((chip) => chip.label)).toEqual([
      "f(4)",
      "f(3)",
      "f(2)",
      "f(1)",
    ]);
    expect(
      overflowStep!.state.lanes[0]?.chips.every((chip) => chip.tone === "bad"),
    ).toBe(true);
    expect(overflowStep!.state.overflow).toBe(true);
    expect(overflowStep!.state.result).toBeNull();
    expect(steps.some((s) => s.note === "Enter f(0). depth 5.")).toBe(false);
  });
});
