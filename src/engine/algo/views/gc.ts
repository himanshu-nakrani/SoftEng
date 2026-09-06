/**
 * GC view — a tiny heap of named objects.
 *
 * Refcount stores a number on each object. Mark-sweep stores a mark bit.
 * Incremental shows a pause chip. Generational splits young / old.
 */

export type GcKind = "refcount" | "mark" | "incremental" | "gen";

export interface GcObj {
  id: string;
  rc?: number;
  marked?: boolean;
  gen?: "young" | "old";
  ptr?: string | null;
  freed: boolean;
  lost: boolean;
  active: boolean;
}

export interface GcState {
  kind: GcKind;
  heap: GcObj[];
  roots: string[];
  cards?: string[];
  stamp: string;
}
