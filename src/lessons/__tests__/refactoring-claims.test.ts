import { buildAlgoSteps } from "@/engine/algo/build";
import type { RefactorState } from "@/engine/algo/views/refactor";
import type { AlgoDef } from "@/engine/algo/types";
import { describe, expect, it } from "vitest";

import { extractFunctionAlgo } from "@/lessons/refactoring/extract-function";
import { duplicatedLogicAlgo } from "@/lessons/refactoring/duplicated-logic";
import { inlineAndRenameAlgo } from "@/lessons/refactoring/inline-and-rename";
import { extractClassAlgo } from "@/lessons/refactoring/extract-class";
import {
  replaceConditionalAlgo,
  replaceConditionalPolymorphicAlgo,
} from "@/lessons/refactoring/replace-conditional";

/**
 * Track 10's prose states numbers folded from the toy AST — "complexity 7 to 2",
 * "duplication 0", "decision points 4 to 2", "fan-out drops to 0". Same contract
 * as the other claim suites: a failure here means a refactoring lesson page now
 * lies about a metric its own figure computes.
 *
 * Every number below is READ from `buildAlgoSteps` over the shipped def, not
 * restated — so it moves with the producer, and it has been PROVEN to fail (break
 * the metric in `algo/refactor.ts` and this suite goes red, as does the engine
 * suite).
 */
function run<I>(def: AlgoDef<RefactorState, I>) {
  const steps = buildAlgoSteps(def, 0, 42);
  return { steps, first: steps[0].state, last: steps[steps.length - 1].state };
}
const fn = (state: RefactorState, name: string) => state.fns.find((f) => f.name === name);

describe("extract-function — complexity moves as a consequence, decisions conserved", () => {
  const { first, last, steps } = run(extractFunctionAlgo);

  it("handle opens at cyclomatic complexity 7", () => {
    expect(fn(first, "handle")!.complexity).toBe(7);
  });

  it("handle falls to 2 and validate arrives at 6 after the extraction", () => {
    expect(fn(last, "handle")!.complexity).toBe(2);
    expect(fn(last, "validate")!.complexity).toBe(6);
  });

  it("the module's max complexity falls from 7 to 6", () => {
    expect(first.metrics.maxComplexity).toBe(7);
    expect(last.metrics.maxComplexity).toBe(6);
  });

  it("total decision points are conserved across the pure extraction", () => {
    for (const step of steps) {
      expect(step.state.metrics.totalDecisions).toBe(first.metrics.totalDecisions);
    }
  });
});

describe("duplicated-logic — duplication and decision points both fall", () => {
  const { first, last } = run(duplicatedLogicAlgo);

  it("opens with one duplicated block", () => {
    expect(first.metrics.duplication).toBe(1);
  });

  it("reaches zero duplication after the reuse", () => {
    expect(last.metrics.duplication).toBe(0);
  });

  it("total decision points drop from 4 to 2 — a copy was deleted, not moved", () => {
    expect(first.metrics.totalDecisions).toBe(4);
    expect(last.metrics.totalDecisions).toBe(2);
  });

  it("the second handler ends by calling the shared function, not holding a copy", () => {
    expect(fn(last, "updateUser")!.lines.some((l) => l.callee === "validate")).toBe(true);
  });
});

describe("inline-and-rename — inlining lowers fan-out, renaming moves nothing", () => {
  const { first, steps } = run(inlineAndRenameAlgo);
  const afterInline = steps[1].state;
  const afterRename = steps[2].state;

  it("render loses its coupling edge to getX when inlined", () => {
    expect(fn(first, "render")!.fanOut).toBe(1);
    expect(fn(afterInline, "render")!.fanOut).toBe(0);
    expect(fn(afterInline, "getX")).toBeUndefined();
  });

  it("the function count falls by one on the inline", () => {
    expect(afterInline.fns.length).toBe(first.fns.length - 1);
  });

  it("renaming moves no module metric", () => {
    expect(afterRename.metrics.maxComplexity).toBe(afterInline.metrics.maxComplexity);
    expect(afterRename.metrics.totalDecisions).toBe(afterInline.metrics.totalDecisions);
    expect(afterRename.metrics.maxFanOut).toBe(afterInline.metrics.maxFanOut);
    expect(fn(afterRename, "commit")).toBeDefined();
    expect(fn(afterRename, "doThing")).toBeUndefined();
  });
});

describe("extract-class — god class decomposed: complexity and fan-out drop, decisions conserved", () => {
  const { first, last, steps } = run(extractClassAlgo);

  it("OrderProcessor opens at cyclomatic complexity 7 and fan-out 5", () => {
    expect(fn(first, "OrderProcessor")!.complexity).toBe(7);
    expect(fn(first, "OrderProcessor")!.fanOut).toBe(5);
  });

  it("OrderProcessor falls to complexity 3 and fan-out 3 after extraction", () => {
    expect(fn(last, "OrderProcessor")!.complexity).toBe(3);
    expect(fn(last, "OrderProcessor")!.fanOut).toBe(3);
  });

  it("ReceiptFormatter arrives with complexity 5 and fan-out 3", () => {
    expect(fn(last, "ReceiptFormatter")!.complexity).toBe(5);
    expect(fn(last, "ReceiptFormatter")!.fanOut).toBe(3);
  });

  it("module max complexity falls from 7 to 5", () => {
    expect(first.metrics.maxComplexity).toBe(7);
    expect(last.metrics.maxComplexity).toBe(5);
  });

  it("module max fan-out falls from 5 to 3", () => {
    expect(first.metrics.maxFanOut).toBe(5);
    expect(last.metrics.maxFanOut).toBe(3);
  });

  it("total decision points are conserved across the extraction", () => {
    for (const step of steps) {
      expect(step.state.metrics.totalDecisions).toBe(6);
      expect(step.state.metrics.totalDecisions).toBe(first.metrics.totalDecisions);
    }
  });

  it("holds identical metrics across multiple seeds", () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const s = buildAlgoSteps(extractClassAlgo, 0, seed);
      const f = s[0].state;
      const l = s[s.length - 1].state;
      expect(fn(f, "OrderProcessor")!.complexity).toBe(7);
      expect(fn(f, "OrderProcessor")!.fanOut).toBe(5);
      expect(fn(l, "OrderProcessor")!.complexity).toBe(3);
      expect(fn(l, "OrderProcessor")!.fanOut).toBe(3);
      expect(fn(l, "ReceiptFormatter")!.complexity).toBe(5);
      expect(fn(l, "ReceiptFormatter")!.fanOut).toBe(3);
      expect(f.metrics.maxFanOut).toBe(5);
      expect(l.metrics.maxFanOut).toBe(3);
      expect(l.metrics.totalDecisions).toBe(6);
    }
  });
});

describe("replace-conditional — polymorphic dispatch dissolves centralized complexity", () => {
  const { first, last, steps } = run(replaceConditionalAlgo);

  it("calcShipping opens at cyclomatic complexity 6 with 5 decision points", () => {
    expect(fn(first, "calcShipping")!.complexity).toBe(6);
    expect(first.metrics.totalDecisions).toBe(5);
    expect(first.metrics.maxComplexity).toBe(6);
  });

  it("complexity falls sequentially across each extracted strategy", () => {
    const expected = [6, 5, 4, 3, 2, 1];
    for (let i = 0; i < steps.length; i++) {
      expect(fn(steps[i].state, "calcShipping")!.complexity).toBe(expected[i]);
      expect(steps[i].state.metrics.maxComplexity).toBe(expected[i]);
    }
  });

  it("each extracted strategy method has cyclomatic complexity 1", () => {
    const strategies = [
      "StandardFee",
      "ExpressFee",
      "OvernightFee",
      "FreightFee",
      "IntlFee",
    ];
    for (const name of strategies) {
      expect(fn(last, name)!.complexity).toBe(1);
    }
  });

  it("ends with every method in the module at complexity 1 and 0 total decision points", () => {
    expect(last.metrics.maxComplexity).toBe(1);
    expect(last.metrics.totalDecisions).toBe(0);
    for (const f of last.fns) {
      expect(f.complexity).toBe(1);
    }
  });

  it("calcShipping delegates via dynamic dispatch in the final step", () => {
    expect(fn(last, "calcShipping")!.lines.some((l) => l.callee === "strategy")).toBe(true);
  });

  it("polymorphic extension (OCP) adds a strategy without modifying existing classes", () => {
    const { first: polyFirst, last: polyLast } = run(replaceConditionalPolymorphicAlgo);
    expect(polyFirst.metrics.maxComplexity).toBe(1);
    expect(polyLast.metrics.maxComplexity).toBe(1);
    expect(polyLast.fns.length).toBe(polyFirst.fns.length + 1);
    expect(fn(polyLast, "SameDayFee")!.complexity).toBe(1);
    expect(fn(polyFirst, "calcShipping")!.lines).toEqual(fn(polyLast, "calcShipping")!.lines);
  });
});
