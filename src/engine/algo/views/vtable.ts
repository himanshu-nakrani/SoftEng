/**
 * Vtable view — one object, a table of slots, a named result.
 *
 * Static has no table: the call site is the function. A class vtable
 * is an index. An itable is a scan until the iid matches.
 */

export type VtableKind = "static" | "vtable" | "itable";

export interface VtableSlot {
  name: string;
  fn: string;
  active: boolean;
  matched: boolean;
}

export interface VtableState {
  kind: VtableKind;
  obj: string | null;
  cls: string | null;
  table: VtableSlot[];
  stamp: string;
  result?: string;
}
