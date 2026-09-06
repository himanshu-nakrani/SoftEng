/**
 * Runtime view — a tree walk, a bytecode stack, or call frames.
 *
 * Same expression, two machines: visits down a tree, or LOAD/MUL/ADD
 * against a stack. Call-stack frames are a third row: f(n) until the cap.
 */

export type RuntimeKind = "walk" | "bytecode" | "stack";

export interface RuntimeChip {
  label: string;
  value?: string;
  active: boolean;
  tone?: "idle" | "ok" | "warn" | "bad";
}

export interface RuntimeLane {
  name: string;
  chips: RuntimeChip[];
}

export interface RuntimeState {
  kind: RuntimeKind;
  lanes: RuntimeLane[];
  stamp: string;
  result?: number | null;
  overflow?: boolean;
}
