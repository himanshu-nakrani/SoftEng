/**
 * Parser view — tokens in, an AST of reductions, a value out.
 *
 * Flat treats + and * the same (left to right). Prec parses * in a
 * tighter production, so 1+2*3 is 7, not 9.
 */

export type ParseKind = "flat" | "prec";

export interface ParseChip {
  text: string;
  active: boolean;
  taint?: boolean;
}

export interface ParserState {
  kind: ParseKind;
  source: string;
  tokens: ParseChip[];
  nodes: ParseChip[];
  value: number | null;
  stamp: string;
}
