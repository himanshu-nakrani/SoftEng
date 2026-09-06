/**
 * Inject view — SQL concatenated into the AST, a script in HTML, and a
 * server-side fetch to a host the caller chose.
 *
 * The chips are the parsed pieces. A tainted chip is input that became
 * syntax (or a script, or a metadata host), not a value.
 */

export type InjectKind = "sqli" | "xss" | "ssrf";

export type InjectRole = "kw" | "id" | "lit" | "op" | "taint" | "host" | "text";

export interface InjectChip {
  text: string;
  role: InjectRole;
  active: boolean;
}

export interface InjectState {
  kind: InjectKind;
  input: string;
  nodes: InjectChip[];
  /** Matched rows, rendered output, or fetched host. */
  result: string[];
  stamp: string;
  ok?: boolean;
}
