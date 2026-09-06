/**
 * Event-loop view — a log, a microtask queue, a macrotask queue.
 *
 * Sync work runs now. Micros drain before the next macro. A micro that
 * queues another micro still beats the timer.
 */

export type LoopKind = "sync" | "micro" | "macro";

export interface LoopJob {
  kind: LoopKind;
  label: string;
  done: boolean;
  active: boolean;
}

export interface EventLoopState {
  log: string[];
  micro: LoopJob[];
  macro: LoopJob[];
  stamp: string;
}
