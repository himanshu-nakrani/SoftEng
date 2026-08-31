import { buildAlgoSteps } from "@/engine/algo/build";
import {
  cyclomatic,
  fanOut,
  REFACTOR_COUNTERS,
  runRefactor,
  type AstFn,
  type RefactorScript,
} from "@/engine/algo/refactor";
import type { AlgoDef } from "@/engine/algo/types";
import type { RefactorState } from "@/engine/algo/views/refactor";
import { RefactorView } from "@/engine/algo/views/RefactorView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

/**
 * A `handle` function with a branchy validate block inlined at the top — the
 * classic long-method smell. Extracting the first three statements into
 * `validate` sheds their decision points from `handle`.
 */
function extractScript(): RefactorScript {
  return {
    title: "Extract a validate block",
    module: {
      fns: [
        {
          name: "handle",
          body: [
            {
              kind: "branch",
              text: "if bad(a) || bad(b)",
              body: [
                { kind: "or", text: "|| bad(b)" },
                { kind: "plain", text: "return err" },
              ],
            },
            {
              kind: "branch",
              text: "if !ok(c) && !ok(d)",
              body: [
                { kind: "and", text: "&& !ok(d)" },
                { kind: "plain", text: "return err" },
              ],
            },
            {
              kind: "loop",
              text: "for f in fields",
              body: [{ kind: "call", text: "log(f)", callee: "log" }],
            },
            { kind: "branch", text: "if !auth", body: [{ kind: "call", text: "reject()", callee: "reject" }] },
            { kind: "call", text: "route(req)", callee: "route" },
            { kind: "plain", text: "return ok" },
          ],
        },
        { name: "log", body: [{ kind: "plain", text: "return" }] },
        { name: "reject", body: [{ kind: "plain", text: "return" }] },
        { name: "route", body: [{ kind: "call", text: "log(x)", callee: "log" }, { kind: "plain", text: "return" }] },
      ],
    },
    steps: [{ kind: "extract", from: "handle", start: 0, end: 3, into: "validate" }],
  };
}

/** A one-function module renamed, to exercise the rename transform and fan-out. */
function renameScript(): RefactorScript {
  return {
    title: "Rename fetchIt",
    module: {
      fns: [
        { name: "fetchIt", body: [{ kind: "plain", text: "return data" }] },
        { name: "page", body: [{ kind: "call", text: "fetchIt()", callee: "fetchIt" }, { kind: "plain", text: "render" }] },
      ],
    },
    steps: [{ kind: "rename", from: "fetchIt", to: "loadData" }],
  };
}

const last = (steps: { state: RefactorState; counters: Record<string, number> }[]) =>
  steps[steps.length - 1];
const fnOf = (state: RefactorState, name: string) => state.fns.find((f) => f.name === name);

describe("cyclomatic complexity (folded over the AST, never stored)", () => {
  it("is 1 for a straight-line function and 1 + decisions otherwise", () => {
    const straight: AstFn = { name: "s", body: [{ kind: "plain", text: "a" }, { kind: "plain", text: "b" }] };
    expect(cyclomatic(straight)).toBe(1);

    const branchy: AstFn = {
      name: "b",
      body: [
        { kind: "branch", text: "if x", body: [{ kind: "and", text: "&& y" }] },
        { kind: "loop", text: "while z", body: [] },
      ],
    };
    // 1 base + 1 branch + 1 && + 1 loop = 4.
    expect(cyclomatic(branchy)).toBe(4);
  });

  it("counts distinct callees for fan-out, not call sites", () => {
    const fn: AstFn = {
      name: "f",
      body: [
        { kind: "call", text: "a()", callee: "a" },
        { kind: "call", text: "a()", callee: "a" }, // same callee twice
        { kind: "branch", text: "if p", body: [{ kind: "call", text: "b()", callee: "b" }] },
      ],
    };
    expect(fanOut(fn)).toBe(2);
  });
});

describe("runRefactor", () => {
  it("is deterministic and starts from the untouched module", () => {
    expect(runRefactor(extractScript())).toEqual(runRefactor(extractScript()));
    const first = runRefactor(extractScript())[0].state;
    expect(first.transform).toBeUndefined();
    expect(fnOf(first, "handle")!.complexity).toBe(7);
    expect(first.fns.every((f) => !f.isNew && !f.changed)).toBe(true);
  });

  it("never aliases a frame, so stepping back shows the module as it was", () => {
    const steps = runRefactor(extractScript());
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    expect(new Set(steps.map((s) => s.state.fns)).size).toBe(steps.length);
    // handle's complexity differs between the first and last frame — proof the
    // frames are independent snapshots, not references to the final module.
    expect(fnOf(steps[0].state, "handle")!.complexity).not.toBe(
      fnOf(last(steps).state, "handle")!.complexity,
    );
  });

  it("keeps counters monotonic and moves the metric as a consequence of the transform", () => {
    const steps = runRefactor(extractScript());
    const before = fnOf(steps[0].state, "handle")!.complexity;
    const after = fnOf(last(steps).state, "handle")!.complexity;
    // The claim the lesson rests on: extraction LOWERS the hot function's cc.
    expect(before).toBe(7);
    expect(after).toBe(2);
    expect(fnOf(last(steps).state, "validate")!.complexity).toBe(6);
    expect(last(steps).state.metrics.maxComplexity).toBe(6);
    // Counter monotonicity across the run.
    const totals: Record<string, number> = {};
    for (const step of steps) {
      for (const [key, value] of Object.entries(step.counters)) {
        expect(value).toBeGreaterThanOrEqual(totals[key] ?? 0);
        totals[key] = value;
      }
    }
    expect(last(steps).counters[REFACTOR_COUNTERS.extracted]).toBe(1);
  });

  it("CONSERVES total decision points across a pure extraction — the honesty law", () => {
    // If a metric could be hand-authored, this could not hold: extraction only
    // MOVES decision points between functions, it never invents or deletes them.
    const steps = runRefactor(extractScript());
    const first = steps[0].state.metrics.totalDecisions;
    for (const step of steps) {
      expect(step.state.metrics.totalDecisions).toBe(first);
    }
  });

  it("renames every call site and the definition together", () => {
    const steps = runRefactor(renameScript());
    const end = last(steps).state;
    expect(fnOf(end, "fetchIt")).toBeUndefined();
    expect(fnOf(end, "loadData")).toBeDefined();
    // page still calls the function — under its new name.
    expect(fnOf(end, "page")!.fanOut).toBe(1);
    expect(fnOf(end, "page")!.lines.some((l) => l.callee === "loadData")).toBe(true);
  });

  it("removes duplication by reusing an existing function, dropping decision points", () => {
    const guard = () => ({
      kind: "branch" as const,
      text: "if !valid(u) || old(u)",
      body: [{ kind: "or" as const, text: "|| old(u)" }, { kind: "plain" as const, text: "reject" }],
    });
    const script: RefactorScript = {
      title: "dedupe",
      module: {
        fns: [
          { name: "create", body: [guard(), { kind: "call", text: "save()", callee: "save" }] },
          { name: "update", body: [guard(), { kind: "call", text: "patch()", callee: "patch" }] },
          { name: "save", body: [{ kind: "plain", text: "return" }] },
          { name: "patch", body: [{ kind: "plain", text: "return" }] },
        ],
      },
      steps: [
        { kind: "extract", from: "create", start: 0, end: 1, into: "validate" },
        { kind: "dedupe", from: "update", start: 0, end: 1, into: "validate" },
      ],
    };
    const steps = runRefactor(script);
    // Duplication starts at 1 (the shared guard), and reaches 0 after the reuse.
    expect(steps[0].state.metrics.duplication).toBe(1);
    expect(last(steps).state.metrics.duplication).toBe(0);
    // De-duplication DELETES a copy, so total decision points genuinely fall —
    // the opposite of a pure extraction, which conserves them.
    expect(last(steps).state.metrics.totalDecisions).toBeLessThan(
      steps[0].state.metrics.totalDecisions,
    );
    // update now calls the shared validate rather than inlining the guard.
    expect(fnOf(last(steps).state, "update")!.lines.some((l) => l.callee === "validate")).toBe(true);
  });

  it("inlines a callee back into its caller, removing the callee", () => {
    const script: RefactorScript = {
      title: "Inline a helper",
      module: {
        fns: [
          { name: "caller", body: [{ kind: "call", text: "help()", callee: "help" }, { kind: "plain", text: "done" }] },
          { name: "help", body: [{ kind: "branch", text: "if q", body: [{ kind: "plain", text: "x" }] }] },
        ],
      },
      steps: [{ kind: "inline", caller: "caller", callee: "help" }],
    };
    const steps = runRefactor(script);
    const end = last(steps).state;
    expect(fnOf(end, "help")).toBeUndefined();
    // caller absorbed help's branch, so its complexity rises to 2.
    expect(fnOf(end, "caller")!.complexity).toBe(2);
  });
});

/** The distribution/wiring tests drive `buildAlgoSteps`, matching the lesson. */
const extractDef: AlgoDef<RefactorState, RefactorScript> = {
  id: "extract-function",
  title: "extract function",
  code: ["validate block", "extract it", "call it"],
  counters: [
    { key: REFACTOR_COUNTERS.transforms, label: "transforms" },
    { key: REFACTOR_COUNTERS.extracted, label: "functions extracted" },
  ],
  generateInput: () => extractScript(),
  run: (input) => runRefactor(input),
};

describe("extract-function rides on archetype B", () => {
  it("runs through buildAlgoSteps, reproducibly", () => {
    expect(buildAlgoSteps(extractDef, 0, 42)).toEqual(buildAlgoSteps(extractDef, 0, 42));
  });

  it("ignores the size and RNG arguments — a refactor script is fixed", () => {
    expect(buildAlgoSteps(extractDef, 0, 42)).toEqual(buildAlgoSteps(extractDef, 12, 7));
  });

  it("satisfies the view contract the figure requires", () => {
    const view: ComponentType<{ state: RefactorState }> = RefactorView;
    expect(view).toBe(RefactorView);
  });

  it("runs a non-array-of-two state shape too", () => {
    // A module with a single function still produces a coherent metric strip —
    // no code path assumes more than one function exists.
    const solo: RefactorScript = {
      title: "single fn",
      module: { fns: [{ name: "only", body: [{ kind: "branch", text: "if p", body: [] }] }] },
      steps: [],
    };
    const steps = runRefactor(solo);
    expect(steps).toHaveLength(1);
    expect(steps[0].state.metrics.maxComplexity).toBe(2);
    expect(steps[0].state.fns).toHaveLength(1);
  });
});
