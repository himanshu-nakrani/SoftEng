import { buildAlgoSteps } from "@/engine/algo/build";
import {
  PARSER_COUNTERS as C,
  PARSE_EXPRS,
  runParse,
} from "@/engine/algo/parser";
import type { AlgoDef } from "@/engine/algo/types";
import type { ParserState } from "@/engine/algo/views/parser";
import {
  recursiveDescentAlgo,
  recursiveDescentFlatAlgo,
} from "@/lessons/parsing-execution/recursive-descent";
import { describe, expect, it } from "vitest";

/**
 * The recursive-descent prose states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became
 * untrue.
 *
 * Toy parser: single-char tokens, digits, +, *, parentheses. Flat
 * treats + and * the same. Prec puts * in a tighter production. Seed
 * is ignored: a parser is not a scheduler.
 */

function run(
  def: AlgoDef<ParserState, number>,
  size = 0,
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
    value: last.state.value,
    stamp: last.state.stamp,
    reductions: last.counters[C.reductions] ?? 0,
    notes: steps.map((s) => s.note),
    nodes: last.state.nodes.map((n) => n.text),
  };
}

const prec = (size: number) => run(recursiveDescentAlgo, size);
const flat = (size: number) => run(recursiveDescentFlatAlgo, size);

const SIZES = [0, 1, 2] as const;

describe("recursive-descent: the slider is which expression, 0 through 2", () => {
  it("offers 0 through 2, default 0, labelled expr", () => {
    // "The slider is which expression, from 0 to 2. Default 0 is the
    // measured run."
    expect(recursiveDescentAlgo.id).toBe("recursive-descent");
    expect(recursiveDescentFlatAlgo.id).toBe("recursive-descent-flat");
    for (const def of [recursiveDescentAlgo, recursiveDescentFlatAlgo]) {
      expect(def.size).toMatchObject({
        min: 0,
        max: 2,
        default: 0,
        label: "expr",
      });
      expect(def.counters.map((c) => c.key)).toEqual([C.reductions]);
    }
  });

  it("maps 0..2 onto 1+2*3, 1*2+3, and (1+2)*3", () => {
    // "The three expressions here are 1+2*3, 1*2+3, and (1+2)*3."
    // "Default expr 0 is 1+2*3."
    expect(PARSE_EXPRS).toEqual(["1+2*3", "1*2+3", "(1+2)*3"]);
    expect(recursiveDescentAlgo.generateInput(() => 0, 0)).toBe(0);
    expect(recursiveDescentAlgo.generateInput(() => 0, 1)).toBe(1);
    expect(recursiveDescentAlgo.generateInput(() => 0, 2)).toBe(2);
    expect(prec(0).state.source).toBe("1+2*3");
    expect(flat(0).state.source).toBe("1+2*3");
    expect(prec(1).state.source).toBe("1*2+3");
    expect(flat(2).state.source).toBe("(1+2)*3");
  });

  it("ignores the seed: a parser is not a scheduler", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(recursiveDescentAlgo, size, 1)).toEqual(
        buildAlgoSteps(recursiveDescentAlgo, size, 99),
      );
      expect(buildAlgoSteps(recursiveDescentFlatAlgo, size, 1)).toEqual(
        buildAlgoSteps(recursiveDescentFlatAlgo, size, 99),
      );
    }
  });

  it("the lesson defs are the same run as runParse on that expr", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(recursiveDescentAlgo, size, 42)).toEqual(
        runParse("prec", size),
      );
      expect(buildAlgoSteps(recursiveDescentFlatAlgo, size, 42)).toEqual(
        runParse("flat", size),
      );
    }
  });
});

describe("recursive-descent: first frame is empty reductions", () => {
  it("opens with no reductions and a Parse caption", () => {
    // "The first caption is "Parse 1+2*3." Reductions is empty."
    const a = flat(0);
    const b = prec(0);
    expect(a.first.note).toBe("Parse 1+2*3.");
    expect(b.first.note).toBe("Parse 1+2*3.");
    expect(a.first.state.nodes).toEqual([]);
    expect(b.first.state.nodes).toEqual([]);
    expect(a.first.counters[C.reductions] ?? 0).toBe(0);
    expect(b.first.counters[C.reductions] ?? 0).toBe(0);
    expect(a.first.state.value).toBeNull();
    expect(b.first.state.value).toBeNull();
    expect(a.first.state.stamp).toBe("flat");
    expect(b.first.state.stamp).toBe("prec");
  });
});

describe("recursive-descent: flat 0 is 1+2*3 = 9", () => {
  it("ends at value 9, stamp 9, 5 reductions", () => {
    // "Step to the end: meters read 5 reductions. The stamp reads 9.
    // The last caption is "1+2*3 = 9.""
    // "Flat left-to-right parses 1+2*3 as 9."
    const c = flat(0);
    expect(c.value).toBe(9);
    expect(c.stamp).toBe("9");
    expect(c.reductions).toBe(5);
    expect(c.last.note).toBe("1+2*3 = 9.");
    expect(c.nodes).toEqual(["n1", "n2", "+3", "n3", "*9"]);
  });

  it("adds first: Atom 1, Atom 2, + → 3, Atom 3, * → 9", () => {
    // "Notes go "Atom 1.", "Atom 2.", "+ → 3.", "Atom 3.", "* → 9.""
    // "Plus and star have the same rank, so 1+2 ran first."
    expect(flat(0).notes).toEqual([
      "Parse 1+2*3.",
      "Atom 1.",
      "Atom 2.",
      "+ → 3.",
      "Atom 3.",
      "* → 9.",
      "1+2*3 = 9.",
    ]);
  });
});

describe("recursive-descent: prec 0 is 1+2*3 = 7", () => {
  it("ends at value 7, stamp 7, 5 reductions", () => {
    // "The stamp reads 7. Reductions still 5."
    // "Precedence puts * in a tighter production and gets 7. Same five
    // reductions as the flat run."
    const c = prec(0);
    expect(c.value).toBe(7);
    expect(c.stamp).toBe("7");
    expect(c.reductions).toBe(5);
    expect(c.last.note).toBe("1+2*3 = 7.");
    expect(c.nodes).toEqual(["n1", "n2", "n3", "*6", "+7"]);
    expect(flat(0).reductions).toBe(5);
  });

  it("multiplies first: Parse, Atom 1/2/3, * → 6, + → 7, 1+2*3 = 7", () => {
    // "Notes: "Parse 1+2*3." / "Atom 1." / "Atom 2." / "Atom 3." /
    // "* → 6." / "+ → 7." / "1+2*3 = 7.""
    expect(prec(0).notes).toEqual([
      "Parse 1+2*3.",
      "Atom 1.",
      "Atom 2.",
      "Atom 3.",
      "* → 6.",
      "+ → 7.",
      "1+2*3 = 7.",
    ]);
  });
});

describe("recursive-descent: both 1 is 1*2+3 = 5", () => {
  it("value 5 either way", () => {
    // "Drag to 1. Source is 1*2+3. Value 5, stamp 5."
    // "Both figures give value 5. 1*2+3 is 5 either way."
    const a = flat(1);
    const b = prec(1);
    expect(a.state.source).toBe("1*2+3");
    expect(b.state.source).toBe("1*2+3");
    expect(a.value).toBe(5);
    expect(b.value).toBe(5);
    expect(a.stamp).toBe("5");
    expect(b.stamp).toBe("5");
    expect(a.last.note).toBe("1*2+3 = 5.");
    expect(b.last.note).toBe("1*2+3 = 5.");
  });
});

describe("recursive-descent: both 2 is (1+2)*3 = 9", () => {
  it("value 9 either way", () => {
    // "Drag to 2. Source is (1+2)*3. Value 9, stamp 9."
    // "Both figures give value 9. (1+2)*3 is 9 either way."
    const a = flat(2);
    const b = prec(2);
    expect(a.state.source).toBe("(1+2)*3");
    expect(b.state.source).toBe("(1+2)*3");
    expect(a.value).toBe(9);
    expect(b.value).toBe(9);
    expect(a.stamp).toBe("9");
    expect(b.stamp).toBe("9");
    expect(a.last.note).toBe("(1+2)*3 = 9.");
    expect(b.last.note).toBe("(1+2)*3 = 9.");
  });
});
