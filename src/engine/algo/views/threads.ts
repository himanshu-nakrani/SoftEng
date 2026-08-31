/**
 * The threads view's state contract — archetype C's frame.
 *
 * Pure data (no JSX) so lesson `.ts` files can build programs against it
 * without pulling a component into their module graph.
 */

export type ThreadStatus = "ready" | "blocked" | "done";

/** One thread as of this frame. */
export interface ThreadFrame {
  id: string;
  name: string;
  /** Index of the NEXT op to run — i.e. how far this thread has got. */
  pc: number;
  /** Total ops in the thread, so a view can draw progress without the program. */
  ops: number;
  status: ThreadStatus;
  /** The op label this thread is about to run, or undefined when done. */
  next?: string;
  /** Thread-local registers. */
  locals: Record<string, number>;
  /** Lock this thread is waiting to acquire, if blocked. */
  waitingOn?: string;
}

export interface ConcurrencyState {
  threads: ThreadFrame[];
  /** Shared memory — the thing races corrupt. */
  memory: Record<string, number>;
  /** Lock name → owning thread id (null when free). */
  locks: Record<string, string | null>;
  /** Thread that executed the op producing this frame; null on the first. */
  active: string | null;
  /** Label of the op that just ran. */
  ranOp?: string;
  /**
   * Every runnable thread is blocked and nothing can progress. The run stops
   * here — a deadlock is a legitimate outcome to show, not an error to hide.
   */
  deadlocked: boolean;
  /**
   * Threads are still RUNNING but the step budget ran out without the program
   * finishing — optimistic retries that keep knocking each other back. Distinct
   * from deadlock, where nothing is runnable at all.
   */
  livelocked: boolean;
}
