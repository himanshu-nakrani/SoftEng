import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { ParseChip, ParseKind, ParserState } from "./views/parser";

/**
 * A tiny expression parser. Tokens are single characters: digits, +, *,
 * and parentheses. Two grammars:
 *
 *   flat: left-to-right, + and * the same. 1+2*3 is 9.
 *   prec: * in a tighter production. 1+2*3 is 7.
 *
 * (1+2)*3 is 9 either way. The slider picks the source.
 *
 * Deliberately absent: unary minus, left vs right ^, a real lexer.
 * The argument is that precedence is which production you call, counted.
 */

export const PARSER_COUNTERS = {
  reductions: "reductions",
} as const;

export const PARSE_EXPRS = ["1+2*3", "1*2+3", "(1+2)*3"] as const;

function clone(chips: ParseChip[]): ParseChip[] {
  return chips.map((c) => ({ ...c }));
}

export function runParse(kind: ParseKind, exprIndex: number): AlgoStep<ParserState>[] {
  const source = PARSE_EXPRS[exprIndex] ?? PARSE_EXPRS[0]!;
  const tokens: ParseChip[] = [...source].map((text) => ({ text, active: false }));
  let i = 0;
  const nodes: ParseChip[] = [];
  let value: number | null = null;
  let stamp: string = kind;
  const rec = new StepRecorder<ParserState>(() => ({
    kind,
    source,
    tokens: clone(tokens),
    nodes: clone(nodes),
    value,
    stamp,
  }));

  rec.record({ note: `Parse ${source}.` });

  function peek(): string | undefined {
    return tokens[i]?.text;
  }
  function eat(): string {
    const t = tokens[i];
    if (!t) return "";
    for (const c of tokens) c.active = false;
    t.active = true;
    i += 1;
    return t.text;
  }
  function reduce(label: string, v: number, note: string, line: number): void {
    for (const n of nodes) n.active = false;
    rec.bump(PARSER_COUNTERS.reductions);
    nodes.push({ text: `${label}${v}`, active: true });
    rec.record({ codeLine: line, note });
  }
  function atom(): number {
    if (peek() === "(") {
      eat();
      const inner = kind === "prec" ? add() : flat();
      eat();
      return inner;
    }
    const n = Number(eat());
    reduce("n", n, `Atom ${n}.`, 2);
    return n;
  }
  function mul(): number {
    let acc = atom();
    while (peek() === "*") {
      eat();
      const rhs = atom();
      acc = acc * rhs;
      reduce("*", acc, `* → ${acc}.`, 1);
    }
    return acc;
  }
  function add(): number {
    let acc = mul();
    while (peek() === "+") {
      eat();
      const rhs = mul();
      acc = acc + rhs;
      reduce("+", acc, `+ → ${acc}.`, 0);
    }
    return acc;
  }
  function flat(): number {
    let acc = atom();
    while (peek() === "+" || peek() === "*") {
      const op = eat();
      const rhs = atom();
      acc = op === "+" ? acc + rhs : acc * rhs;
      reduce(op, acc, `${op} → ${acc}.`, 0);
    }
    return acc;
  }

  value = kind === "prec" ? add() : flat();
  stamp = String(value);
  rec.record({ note: `${source} = ${value}.` });
  return rec.steps;
}
