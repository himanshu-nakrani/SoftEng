import { LEXER_COUNTERS, LEX_SOURCES, runLexer } from "@/engine/algo/lexer";
import type { AlgoDef } from "@/engine/algo/types";
import type { LexerState } from "@/engine/algo/views/lexer";

/**
 * Lexical Analysis — archetype B (`engine: "steps"`).
 *
 * Source is characters. A scanner groups them into tokens, the only thing
 * a parser will see. THE CONTROL IS WHICH OF FOUR STRINGS TO SCAN. 0–3,
 * default 0:
 *
 *   0  let n=2     → kw let, ident n, op =, num 2     (4 tokens, 1 skipped)
 *   1  let n = 2   → the same four tokens             (4 tokens, 3 skipped)
 *   2  let 'n=2'   → kw let, str 'n=2'                (2 tokens, 1 skipped)
 *   3  letn=2      → ident letn, op =, num 2          (3 tokens, 0 skipped)
 *
 * `let` is a keyword only as a whole ident. A quoted string is one token
 * even when it contains `=`. Whitespace is skipped, never emitted. Seed
 * is ignored: a scanner is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Letters, digits, `'...'` strings, and
 * single-char ops. Deliberately absent: comments, Unicode, nested quotes,
 * a parser. Those change the token set. They do not change the argument:
 * the scanner groups, and the groups are what the next stage consumes.
 */

const CODE = ["skip ws", "string", "keyword", "ident", "number", "op"];

export const lexicalAnalysisAlgo: AlgoDef<LexerState, string> = {
  id: "lexical-analysis",
  title: "scan",
  code: CODE,
  counters: [
    { key: LEXER_COUNTERS.tokens, label: "tokens" },
    { key: LEXER_COUNTERS.skipped, label: "skipped" },
  ],
  size: { label: "source", min: 0, max: 3, default: 0 },
  generateInput: (_rng, size) => LEX_SOURCES[size] ?? LEX_SOURCES[0],
  run: (src) => runLexer(src),
};
