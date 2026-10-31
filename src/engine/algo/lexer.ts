import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { LexerState, TokenChip, TokenKind } from "./views/lexer";

/**
 * A tiny scanner. Source is one of four strings; the slider picks which.
 *
 *   let n=2      → kw let, ident n, op =, num 2          (4 tokens, 1 skipped)
 *   let n = 2    → same four tokens, three spaces skipped
 *   let 'n=2'    → kw let, str 'n=2'                     (2 tokens, 1 skipped)
 *   letn=2       → ident letn, op =, num 2               (3 tokens, 0 skipped)
 *
 * `let` is a keyword only as a whole ident. A quoted string is one token
 * even when it contains `=`. Whitespace is skipped, never emitted.
 *
 * Deliberately absent: Unicode, comments, nested quotes, a parser.
 * The argument is what the scanner groups, counted as chips.
 */

export const LEXER_COUNTERS = {
  tokens: "tokens",
  skipped: "skipped",
} as const;

export const LEX_SOURCES = ["let n=2", "let n = 2", "let 'n=2'", "letn=2"] as const;

const KEYWORDS = new Set(["let"]);

function isLetter(c: string): boolean {
  return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";
}

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

export function runLexer(source: string): AlgoStep<LexerState>[] {
  let cursor = 0;
  const tokens: TokenChip[] = [];
  let stamp: string = "scan";
  const rec = new StepRecorder<LexerState>(() => ({
    source,
    cursor,
    tokens: tokens.map((t) => ({ ...t })),
    stamp,
  }));

  rec.record({ note: `Scan ${source.length} chars.` });

  while (cursor < source.length) {
    const c = source[cursor]!;
    if (c === " ") {
      rec.bump(LEXER_COUNTERS.skipped);
      cursor += 1;
      rec.record({ codeLine: 0, note: "Skip whitespace." });
      continue;
    }
    for (const t of tokens) t.active = false;

    if (c === "'") {
      let j = cursor + 1;
      while (j < source.length && source[j] !== "'") j += 1;
      const lexeme = source.slice(cursor, Math.min(j + 1, source.length));
      cursor = Math.min(j + 1, source.length);
      emit("str", lexeme, 1, `String ${lexeme}.`);
      continue;
    }
    if (isLetter(c)) {
      let j = cursor + 1;
      while (j < source.length && (isLetter(source[j]!) || isDigit(source[j]!))) j += 1;
      const lexeme = source.slice(cursor, j);
      cursor = j;
      const kind: TokenKind = KEYWORDS.has(lexeme) ? "kw" : "ident";
      emit(kind, lexeme, kind === "kw" ? 2 : 3, kind === "kw" ? `Keyword ${lexeme}.` : `Ident ${lexeme}.`);
      continue;
    }
    if (isDigit(c)) {
      let j = cursor + 1;
      while (j < source.length && isDigit(source[j]!)) j += 1;
      const lexeme = source.slice(cursor, j);
      cursor = j;
      emit("num", lexeme, 4, `Number ${lexeme}.`);
      continue;
    }
    cursor += 1;
    emit("op", c, 5, `Op ${c}.`);
  }

  for (const t of tokens) t.active = false;
  stamp = `${rec.count(LEXER_COUNTERS.tokens)} tokens`;
  rec.record({
    note: `${rec.count(LEXER_COUNTERS.tokens)} tokens, ${rec.count(LEXER_COUNTERS.skipped)} skipped.`,
  });
  return rec.steps;

  function emit(kind: TokenKind, lexeme: string, codeLine: number, note: string): void {
    rec.bump(LEXER_COUNTERS.tokens);
    tokens.push({ kind, lexeme, active: true });
    rec.record({ codeLine, note });
  }
}
