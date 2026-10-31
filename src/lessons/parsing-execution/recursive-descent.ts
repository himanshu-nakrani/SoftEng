import { PARSER_COUNTERS, runParse } from "@/engine/algo/parser";
import type { AlgoDef } from "@/engine/algo/types";
import type { ParserState } from "@/engine/algo/views/parser";

/**
 * Recursive Descent — archetype B (`engine: "steps"`).
 *
 * Two grammars, three sources. Flat treats + and * the same, left to
 * right: 1+2*3 is 9. Prec puts * in a tighter production: 1+2*3 is 7.
 * (1+2)*3 is 9 either way. 1*2+3 is 5 either way. THE CONTROL IS WHICH
 * EXPRESSION. 0–2, default 0:
 *
 *   0  1+2*3     → flat 9 / prec 7   (5 reductions either way)
 *   1  1*2+3     → 5 either way
 *   2  (1+2)*3   → 9 either way
 *
 * Seed is ignored: a parser is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Single-char tokens, digits, +, *,
 * and parentheses. Deliberately absent: unary minus, exponent, a real
 * lexer, a language. Those change the token set. They do not change
 * the argument: precedence is which production you call, counted.
 */

const PREC_CODE = [
  "add = mul {+ mul}",
  "mul = atom {* atom}",
  "atom = n | (add)",
];

const FLAT_CODE = [
  "expr = atom {op atom}",
  "op = + | *",
  "atom = n | (expr)",
];

const counters = [
  { key: PARSER_COUNTERS.reductions, label: "reductions" },
];

const sizeControl = {
  label: "expr",
  min: 0,
  max: 2,
  default: 0,
} as const;

/** * in a tighter production. Expr 0 is 1+2*3 → 7. */
export const recursiveDescentAlgo: AlgoDef<ParserState, number> = {
  id: "recursive-descent",
  title: "precedence",
  code: PREC_CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => size,
  run: (size) => runParse("prec", size),
};

/** Left to right, + and * the same rank. Expr 0 is 1+2*3 → 9. */
export const recursiveDescentFlatAlgo: AlgoDef<ParserState, number> = {
  id: "recursive-descent-flat",
  title: "left to right",
  code: FLAT_CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => size,
  run: (size) => runParse("flat", size),
};
