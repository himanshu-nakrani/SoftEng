import { buildAlgoSteps } from "@/engine/algo/build";
import {
  INJECT_COUNTERS as C,
  SQL_PAYLOADS,
  SQL_USERS,
  runSqli,
} from "@/engine/algo/inject";
import type { AlgoDef } from "@/engine/algo/types";
import type { InjectState } from "@/engine/algo/views/inject";
import {
  sqlInjectionAlgo,
  sqlInjectionParamAlgo,
} from "@/lessons/application-security/sql-injection";
import { describe, expect, it } from "vitest";

/**
 * The sql-injection prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * This is a toy of three string ids, not a SQL parser. Seed is ignored:
 * concat is not a scheduler.
 */

function run<I>(def: AlgoDef<InjectState, I>, payload: number, seed = 42) {
  const steps = buildAlgoSteps(def, payload, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    injected: last.counters[C.injected] ?? 0,
    rows: last.counters[C.rows] ?? 0,
    result: last.state.result,
    ok: last.state.ok,
    stamp: last.state.stamp,
    notes: steps.map((s) => s.note),
  };
}

const concat = (p: number) => run(sqlInjectionAlgo, p);
const param = (p: number) => run(sqlInjectionParamAlgo, p);

describe("sql-injection: the slider is the payload, 0 or 1", () => {
  it("offers 0 through 1, default 1, labelled payload", () => {
    // "Leave payload at 1."
    for (const def of [sqlInjectionAlgo, sqlInjectionParamAlgo]) {
      expect(def.size).toMatchObject({
        min: 0,
        max: 1,
        default: 1,
        label: "payload",
      });
    }
    expect(sqlInjectionAlgo.id).toBe("sql-injection");
    expect(sqlInjectionParamAlgo.id).toBe("sql-injection-param");
    expect(sqlInjectionAlgo.counters.map((c) => c.key)).toEqual([
      C.injected,
      C.rows,
    ]);
  });

  it("payload 0 is 7; payload 1 is 7 OR 1=1", () => {
    // "This is a toy: three string ids — 1, 7, and 9 — not a SQL parser."
    expect(SQL_USERS).toEqual(["1", "7", "9"]);
    expect(SQL_PAYLOADS).toEqual(["7", "7 OR 1=1"]);
    expect(sqlInjectionAlgo.generateInput(() => 0, 0)).toBe(0);
    expect(sqlInjectionAlgo.generateInput(() => 0, 1)).toBe(1);
  });

  it("ignores the seed: a concat is not a scheduler", () => {
    expect(buildAlgoSteps(sqlInjectionAlgo, 1, 1)).toEqual(
      buildAlgoSteps(sqlInjectionAlgo, 1, 99),
    );
    expect(buildAlgoSteps(sqlInjectionParamAlgo, 1, 1)).toEqual(
      buildAlgoSteps(sqlInjectionParamAlgo, 1, 99),
    );
  });

  it("the lesson defs agree with runSqli at both payloads", () => {
    for (const p of [0, 1]) {
      expect(buildAlgoSteps(sqlInjectionAlgo, p, 42)).toEqual(
        runSqli("concat", p),
      );
      expect(buildAlgoSteps(sqlInjectionParamAlgo, p, 42)).toEqual(
        runSqli("param", p),
      );
    }
  });
});

describe("sql-injection: concat payload 0 matches id 7", () => {
  it("rows 1, injected 0, result [7]", () => {
    // "Drag to payload 0. Concatenating 7 matches one row: 7 (injected 0, rows 1)."
    const c = concat(0);
    expect(c.rows).toBe(1);
    expect(c.injected).toBe(0);
    expect(c.result).toEqual(["7"]);
    expect(c.ok).toBe(true);
    expect(c.stamp).toBe("1 rows");
  });
});

describe("sql-injection: concat payload 1 injects OR 1=1", () => {
  it("injected 1, rows 3, result [1, 7, 9], ok false, OR is taint", () => {
    // "Concatenating 7 OR 1=1 adds an OR node and returns rows 1, 7,
    // and 9 (injected 1, rows 3)."
    const c = concat(1);
    expect(c.injected).toBe(1);
    expect(c.rows).toBe(3);
    expect(c.result).toEqual(["1", "7", "9"]);
    expect(c.ok).toBe(false);
    expect(c.stamp).toBe("3 rows");
    expect(
      c.state.nodes.some((n) => n.text === "OR" && n.role === "taint"),
    ).toBe(true);
  });

  it("walks WHERE id = 7 OR 1=1, then grows the AST, then matches all three", () => {
    // "The first caption is \"WHERE id = 7 OR 1=1.\""
    // "Concat adds OR 1=1 to the AST."
    // "Tautology matches 1, 7, and 9."
    const { notes, steps } = concat(1);
    expect(notes).toEqual([
      "WHERE id = 7 OR 1=1.",
      "Concat adds OR 1=1 to the AST.",
      "Tautology matches 1, 7, and 9.",
    ]);
    expect(steps[0]!.counters[C.injected] ?? 0).toBe(0);
    expect(steps[0]!.counters[C.rows] ?? 0).toBe(0);
    expect(steps[1]!.counters[C.injected]).toBe(1);
    expect(steps[2]!.counters[C.rows]).toBe(3);
  });
});

describe("sql-injection: param payload 0 still matches 7", () => {
  it("rows 1, injected 0", () => {
    // "Payload 0 is id=7 either way (injected 0, rows 1)."
    // "Binding 7 as a parameter does the same as concat at 0: one row, injected 0."
    const p = param(0);
    expect(p.rows).toBe(1);
    expect(p.injected).toBe(0);
    expect(p.result).toEqual(["7"]);
    expect(p.ok).toBe(true);
    expect(concat(0).rows).toBe(1);
    expect(concat(0).injected).toBe(0);
  });
});

describe("sql-injection: param payload 1 matches nobody", () => {
  it("injected 0, rows 0, result empty, ok true, literal chip 7 OR 1=1", () => {
    // "Binding the same string as a parameter matches nobody (injected
    // 0, rows 0)."
    // "Parameterization means the whole string is a leaf."
    const p = param(1);
    expect(p.injected).toBe(0);
    expect(p.rows).toBe(0);
    expect(p.result).toEqual([]);
    expect(p.ok).toBe(true);
    expect(p.stamp).toBe("0 rows");
    expect(
      p.state.nodes.some((n) => n.role === "lit" && n.text === "7 OR 1=1"),
    ).toBe(true);
  });
});
