/**
 * Lexer view — a cursor walking source, emitting token chips.
 *
 * Whitespace is skipped, not tokenised. A keyword is an ident that
 * matches the reserved set; `letn` is one ident, not `let` plus `n`.
 * A quoted string is one token even when it contains operators.
 */

export type TokenKind = "kw" | "ident" | "num" | "str" | "op";

export interface TokenChip {
  kind: TokenKind;
  lexeme: string;
  active: boolean;
}

export interface LexerState {
  source: string;
  cursor: number;
  tokens: TokenChip[];
  stamp: string;
}
