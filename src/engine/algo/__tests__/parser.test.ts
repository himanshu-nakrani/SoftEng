import { buildAlgoSteps } from "@/engine/algo/build";
import { PARSER_COUNTERS as C, PARSE_EXPRS, runParse } from "@/engine/algo/parser";
import type { AlgoDef } from "@/engine/algo/types";
import type { ParserState } from "@/engine/algo/views/parser";
import { ParserView } from "@/engine/algo/views/ParserView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const last = (kind: "flat" | "prec", i: number) => runParse(kind, i).at(-1)!;

describe("runParse", () => {
  it("flat 1+2*3 is 9; prec is 7", () => {
    expect(PARSE_EXPRS[0]).toBe("1+2*3");
    expect(last("flat", 0).state.value).toBe(9);
    expect(last("prec", 0).state.value).toBe(7);
    expect(last("flat", 0).state.stamp).toBe("9");
    expect(last("prec", 0).state.stamp).toBe("7");
  });

  it("1*2+3 is 5 either way; (1+2)*3 is 9 either way", () => {
    expect(last("flat", 1).state.value).toBe(5);
    expect(last("prec", 1).state.value).toBe(5);
    expect(last("flat", 2).state.value).toBe(9);
    expect(last("prec", 2).state.value).toBe(9);
  });

  it("never aliases", () => {
    const steps = runParse("prec", 0);
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    expect(steps[0]!.state.nodes).toEqual([]);
  });
});

describe("parser rides on archetype B", () => {
  const def: AlgoDef<ParserState, number> = {
    id: "parse",
    title: "prec",
    code: ["add", "mul", "atom"],
    counters: [{ key: C.reductions, label: "reductions" }],
    size: { label: "expr", min: 0, max: 2, default: 0 },
    generateInput: (_rng, size) => size,
    run: (size) => runParse("prec", size),
  };

  it("size changes the expr and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 2, 1));
    const view: ComponentType<{ state: ParserState }> = ParserView;
    expect(view).toBe(ParserView);
  });
});
