import { buildAlgoSteps } from "@/engine/algo/build";
import { LEXER_COUNTERS as C, LEX_SOURCES, runLexer } from "@/engine/algo/lexer";
import type { AlgoDef } from "@/engine/algo/types";
import type { LexerState } from "@/engine/algo/views/lexer";
import { LexerView } from "@/engine/algo/views/LexerView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const last = (src: string) => runLexer(src).at(-1)!;
const kinds = (src: string) => last(src).state.tokens.map((t) => `${t.kind}:${t.lexeme}`);

describe("runLexer", () => {
  it("let n=2 is four tokens with the one space skipped", () => {
    expect(LEX_SOURCES[0]).toBe("let n=2");
    const { counters, state } = last("let n=2");
    expect(kinds("let n=2")).toEqual(["kw:let", "ident:n", "op:=", "num:2"]);
    expect(counters[C.tokens]).toBe(4);
    expect(counters[C.skipped]).toBe(1);
    expect(state.stamp).toBe("4 tokens");
  });

  it("let n = 2 is the same four tokens with three spaces skipped", () => {
    expect(kinds("let n = 2")).toEqual(["kw:let", "ident:n", "op:=", "num:2"]);
    expect(last("let n = 2").counters[C.tokens]).toBe(4);
    expect(last("let n = 2").counters[C.skipped]).toBe(3);
  });

  it("a quoted string is one token even with an operator inside", () => {
    expect(kinds("let 'n=2'")).toEqual(["kw:let", "str:'n=2'"]);
    expect(last("let 'n=2'").counters[C.tokens]).toBe(2);
    expect(last("let 'n=2'").counters[C.skipped]).toBe(1);
  });

  it("letn is one ident, not the keyword let", () => {
    expect(kinds("letn=2")).toEqual(["ident:letn", "op:=", "num:2"]);
    expect(last("letn=2").counters[C.tokens]).toBe(3);
    expect(last("letn=2").counters[C.skipped] ?? 0).toBe(0);
  });

  it("never aliases and starts with no tokens", () => {
    const steps = runLexer("let n=2");
    expect(steps[0]!.state.tokens).toEqual([]);
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
  });
});

describe("lexer rides on archetype B", () => {
  const def: AlgoDef<LexerState, string> = {
    id: "lex",
    title: "scan",
    code: ["skip ws", "string", "keyword", "ident", "number", "op"],
    counters: [{ key: C.tokens, label: "tokens" }],
    size: { label: "source", min: 0, max: 3, default: 0 },
    generateInput: (_rng, size) => LEX_SOURCES[size] ?? LEX_SOURCES[0],
    run: (src) => runLexer(src),
  };

  it("size changes the source and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 3, 1));
    const view: ComponentType<{ state: LexerState }> = LexerView;
    expect(view).toBe(LexerView);
  });
});
