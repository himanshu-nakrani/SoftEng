import { buildAlgoSteps } from "@/engine/algo/build";
import { LEXER_COUNTERS as C, LEX_SOURCES, runLexer } from "@/engine/algo/lexer";
import type { AlgoDef } from "@/engine/algo/types";
import type { LexerState } from "@/engine/algo/views/lexer";
import { lexicalAnalysisAlgo } from "@/lessons/parsing-execution/lexical-analysis";
import { describe, expect, it } from "vitest";

/**
 * The lexical-analysis prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * Toy scanner: letters, digits, `'...'` strings, single-char ops. Keyword
 * `let` is reserved only as a whole ident. A quoted string is one token
 * even with `=` inside. Whitespace is skipped, never emitted.
 */

function kindsOf(state: LexerState): string[] {
  return state.tokens.map((t) => `${t.kind}:${t.lexeme}`);
}

function run(
  def: AlgoDef<LexerState, string> = lexicalAnalysisAlgo,
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
    tokens: last.counters[C.tokens] ?? 0,
    skipped: last.counters[C.skipped] ?? 0,
    stamp: last.state.stamp,
    kinds: kindsOf(last.state),
  };
}

const SIZES = [0, 1, 2, 3] as const;

describe("lexical-analysis: the slider is which source, 0 through 3", () => {
  it("offers 0 through 3, default 0, labelled source", () => {
    // "The slider is which source, from 0 to 3. Default 0 is the measured run."
    expect(lexicalAnalysisAlgo.id).toBe("lexical-analysis");
    expect(lexicalAnalysisAlgo.size).toMatchObject({
      min: 0,
      max: 3,
      default: 0,
      label: "source",
    });
    expect(lexicalAnalysisAlgo.counters.map((c) => c.key)).toEqual([
      C.tokens,
      C.skipped,
    ]);
  });

  it("maps 0..3 onto the four LEX_SOURCES strings", () => {
    // "The four sources here are let n=2, let n = 2, let 'n=2', and letn=2."
    expect(LEX_SOURCES).toEqual(["let n=2", "let n = 2", "let 'n=2'", "letn=2"]);
    expect(lexicalAnalysisAlgo.generateInput(() => 0, 0)).toBe("let n=2");
    expect(lexicalAnalysisAlgo.generateInput(() => 0, 1)).toBe("let n = 2");
    expect(lexicalAnalysisAlgo.generateInput(() => 0, 2)).toBe("let 'n=2'");
    expect(lexicalAnalysisAlgo.generateInput(() => 0, 3)).toBe("letn=2");
    expect(lexicalAnalysisAlgo.generateInput(() => 0, 99)).toBe("let n=2");
  });

  it("ignores the seed: a scanner is not a scheduler", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(lexicalAnalysisAlgo, size, 1)).toEqual(
        buildAlgoSteps(lexicalAnalysisAlgo, size, 99),
      );
    }
  });

  it("the lesson def is the same run as runLexer on that source", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(lexicalAnalysisAlgo, size, 42)).toEqual(
        runLexer(LEX_SOURCES[size]),
      );
    }
  });
});

describe("lexical-analysis: first frame is empty tokens on every source", () => {
  it("opens with no tokens and a Scan N chars caption", () => {
    // "The first caption is "Scan 7 chars." Tokens is empty."
    for (const size of SIZES) {
      const { first } = run(lexicalAnalysisAlgo, size);
      expect(first.state.tokens).toEqual([]);
      expect(first.state.stamp).toBe("scan");
      expect(first.counters[C.tokens] ?? 0).toBe(0);
      expect(first.counters[C.skipped] ?? 0).toBe(0);
      expect(first.note).toBe(`Scan ${first.state.source.length} chars.`);
      expect(first.state.source).toBe(LEX_SOURCES[size]);
    }
  });
});

describe("lexical-analysis: source 0 is let n=2, four tokens", () => {
  it("let n=2 is 7 characters", () => {
    // "Default source 0 is let n=2: 7 characters."
    expect("let n=2".length).toBe(7);
    expect(run(lexicalAnalysisAlgo, 0).first.note).toBe("Scan 7 chars.");
  });

  it("ends at 4 tokens, 1 skipped, stamp 4 tokens", () => {
    // "meters read 4 tokens, 1 skipped. The chips are kw let, ident n,
    // op =, num 2. The stamp reads 4 tokens."
    const c = run(lexicalAnalysisAlgo, 0);
    expect(c.tokens).toBe(4);
    expect(c.skipped).toBe(1);
    expect(c.kinds).toEqual(["kw:let", "ident:n", "op:=", "num:2"]);
    expect(c.stamp).toBe("4 tokens");
    expect(c.last.note).toBe("4 tokens, 1 skipped.");
  });
});

describe("lexical-analysis: source 1 is the same four tokens with three spaces skipped", () => {
  it("let n = 2 is 4 tokens, 3 skipped, same kinds as source 0", () => {
    // "The same four tokens, three spaces skipped. Meters: 4 tokens, 3
    // skipped. Stamp still 4 tokens."
    // "Source 0 and source 1 emit the same four chips; only the skipped
    // meter moved, from 1 to 3."
    const a = run(lexicalAnalysisAlgo, 0);
    const b = run(lexicalAnalysisAlgo, 1);
    expect(b.tokens).toBe(4);
    expect(b.skipped).toBe(3);
    expect(b.kinds).toEqual(a.kinds);
    expect(b.kinds).toEqual(["kw:let", "ident:n", "op:=", "num:2"]);
    expect(b.stamp).toBe("4 tokens");
    expect(b.last.note).toBe("4 tokens, 3 skipped.");
    expect(a.skipped).toBe(1);
  });
});

describe("lexical-analysis: a quoted string is one token even with = inside", () => {
  it("let 'n=2' is kw let plus one string, 2 tokens, 1 skipped", () => {
    // "Two tokens: kw let and the string 'n=2', which keeps the = inside.
    // Meters: 2 tokens, 1 skipped. Stamp 2 tokens."
    // "Quotes wrap n=2 into one string. The = inside is characters of
    // that string, not an operator. Two tokens, not four."
    const c = run(lexicalAnalysisAlgo, 2);
    expect(c.tokens).toBe(2);
    expect(c.skipped).toBe(1);
    expect(c.kinds).toEqual(["kw:let", "str:'n=2'"]);
    expect(c.stamp).toBe("2 tokens");
    expect(c.last.note).toBe("2 tokens, 1 skipped.");
    expect(c.kinds.some((k) => k.startsWith("op:"))).toBe(false);
  });
});

describe("lexical-analysis: letn is one ident, not let plus n", () => {
  it("letn=2 is 3 tokens, 0 skipped", () => {
    // "Source 3 is six characters and no spaces: letn=2."
    // "Three tokens: ident letn, op =, num 2. Nothing skipped. Stamp 3 tokens."
    // "The run ends at 3 tokens, 0 skipped — not four, because there was
    // never a separate n."
    expect("letn=2".length).toBe(6);
    const c = run(lexicalAnalysisAlgo, 3);
    expect(c.first.note).toBe("Scan 6 chars.");
    expect(c.tokens).toBe(3);
    expect(c.skipped).toBe(0);
    expect(c.kinds).toEqual(["ident:letn", "op:=", "num:2"]);
    expect(c.stamp).toBe("3 tokens");
    expect(c.last.note).toBe("3 tokens, 0 skipped.");
    expect(c.kinds).not.toContain("kw:let");
    expect(c.kinds).not.toContain("ident:n");
  });
});

describe("lexical-analysis: whitespace is skipped, never emitted", () => {
  it("skipped equals the space count, and no token is a space", () => {
    // "Whitespace is skipped, never emitted."
    for (const size of SIZES) {
      const src = LEX_SOURCES[size];
      const spaces = [...src].filter((ch) => ch === " ").length;
      const c = run(lexicalAnalysisAlgo, size);
      expect(c.skipped).toBe(spaces);
      expect(c.state.tokens.every((t) => t.lexeme !== " ")).toBe(true);
    }
  });
});
