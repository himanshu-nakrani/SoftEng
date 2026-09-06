import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type {
  ConcurrencyState,
  ThreadFrame,
  ThreadStatus,
} from "./views/threads";

/**
 * Archetype C — seeded thread interleaving.
 *
 * NOT a separate engine. An interleaving is exactly what archetype B already
 * models: a finite list of states, one per executed operation. The scheduler
 * chooses WHICH thread runs next; the step list records what happened. That
 * inheritance is the whole point — concurrency gets step-back, scrubbing, and
 * exact operation counts for free, and a race becomes something you can replay
 * identically and walk backwards through, which no textbook can offer.
 *
 * Determinism: every scheduling decision is a draw from the run's seeded RNG,
 * so `(program, seed)` reproduces an interleaving exactly. Change the seed and
 * you get a different — equally legal — interleaving. That pair of facts is the
 * teachable content: the bug is not in the code you read, it is in the order
 * you did not choose.
 */

/** Thread-local registers. Shared memory is a separate map. */
export type Locals = Record<string, number>;
export type Memory = Record<string, number>;

/**
 * What an op's effect reports back to the scheduler.
 *
 * `"retry"` means "I did not succeed; run me again later" — the program counter
 * does NOT advance. That is the honest shape of a compare-and-swap: whether it
 * succeeds depends on what other threads did in between, so the number of
 * attempts is unbounded by nature. Anything else advances normally.
 *
 * An object outcome `{ retry?: boolean; bump?: Record<string, number> }`
 * additionally allows reporting custom counter increments.
 */
export type OpOutcome =
  | void
  | "retry"
  | {
      retry?: boolean;
      bump?: Record<string, number>;
    };

/** One indivisible operation. Granularity is the author's choice — and the lesson. */
export interface ThreadOp {
  /** Shown in the thread lane and the step caption ("read balance"). */
  label: string;
  /** Active pseudocode line, if the def ships code. */
  codeLine?: number;
  /**
   * Static counter increments reported every time this op executes.
   * e.g. { lineTransfers: 1, cacheMisses: 1 }
   */
  bump?: Record<string, number>;
  /**
   * Acquire or release a named lock. An acquire on a lock held by ANOTHER
   * thread blocks this thread instead of executing; a thread may re-acquire a
   * lock it already owns (no-op) so authors cannot self-deadlock by accident.
   */
  lock?: { action: "acquire" | "release"; name: string };
  /**
   * Park until a condition holds — a condition wait, not a spin. The thread is
   * simply not runnable while `ready` is false, so it consumes no steps; this is
   * how a bounded buffer waits for space or for an item.
   */
  await?: {
    /** Shown as "waiting for <label>". */
    label: string;
    ready: (memory: Memory, locals: Locals) => boolean;
  };
  /**
   * Mutate shared memory and/or this thread's locals. Runs atomically.
   * May optionally accept a `bump(key, by?)` callback to report dynamic counter increments.
   */
  effect?: (
    memory: Memory,
    locals: Locals,
    bump: (key: string, by?: number) => void,
  ) => OpOutcome;
}

export interface Thread {
  id: string;
  /** Lane label ("T1", "transfer A→B"). */
  name: string;
  ops: ThreadOp[];
  /** Starting registers. */
  locals?: Locals;
}

export interface Program {
  threads: Thread[];
  /** Initial shared memory. */
  memory: Memory;
  /** Locks the program uses. Declared up front so the view can draw them. */
  locks?: string[];
}

/** Counter keys `interleave` maintains, for a def's `counters` declaration. */
export const CONCURRENCY_COUNTERS = {
  /** Ops executed (frames after the first). */
  steps: "steps",
  /** Times a thread found a lock held, or a condition unmet, and had to wait. */
  waits: "waits",
  /** Context switches — how "interleaved" this particular run was. */
  switches: "switches",
  /** Failed attempts that had to be re-run — the cost of optimistic retry. */
  retries: "retries",
} as const;

interface Runtime {
  thread: Thread;
  pc: number;
  locals: Locals;
  waitingOn?: string;
}

/**
 * Run a program to completion (or deadlock), choosing the next thread with
 * `rng` at every step.
 *
 * Fairness is uniform over RUNNABLE threads, which is the honest model for
 * teaching: it makes rare interleavings rare rather than impossible, and a
 * lesson can hunt for the bad one by reseeding.
 */
export function interleave(
  program: Program,
  rng: () => number,
): AlgoStep<ConcurrencyState>[] {
  const memory: Memory = { ...program.memory };
  const locks: Record<string, string | null> = {};
  for (const name of program.locks ?? []) locks[name] = null;

  const runtimes: Runtime[] = program.threads.map((thread) => ({
    thread,
    pc: 0,
    locals: { ...(thread.locals ?? {}) },
  }));

  let active: string | null = null;
  let ranOp: string | undefined;
  let deadlocked = false;
  let livelocked = false;

  const statusOf = (rt: Runtime): ThreadStatus => {
    if (rt.pc >= rt.thread.ops.length) return "done";
    return rt.waitingOn ? "blocked" : "ready";
  };

  const frame = (): ConcurrencyState => ({
    threads: runtimes.map<ThreadFrame>((rt) => ({
      id: rt.thread.id,
      name: rt.thread.name,
      pc: rt.pc,
      ops: rt.thread.ops.length,
      status: statusOf(rt),
      next: rt.thread.ops[rt.pc]?.label,
      locals: { ...rt.locals },
      waitingOn: rt.waitingOn,
    })),
    memory: { ...memory },
    locks: { ...locks },
    active,
    ranOp,
    deadlocked,
    livelocked,
  });

  const rec = new StepRecorder<ConcurrencyState>(frame);
  rec.record({ note: "before any thread runs" });

  /** What this thread is waiting for right now, or undefined if it can run. */
  const blockedOn = (rt: Runtime): string | undefined => {
    const op = rt.thread.ops[rt.pc];
    if (!op) return undefined;
    if (op.await && !op.await.ready(memory, rt.locals)) return op.await.label;
    if (op.lock?.action === "acquire") {
      const owner = locks[op.lock.name] ?? null;
      if (owner !== null && owner !== rt.thread.id) return op.lock.name;
    }
    return undefined;
  };

  /** Can this thread execute its next op right now? */
  const runnable = (rt: Runtime): boolean =>
    rt.pc < rt.thread.ops.length && blockedOn(rt) === undefined;

  /**
   * Step ceiling.
   *
   * Without retries, every iteration advances a program counter, so total ops is
   * already unreachable. Retries break that: a compare-and-swap may fail any
   * number of times, so the budget has to allow genuine contention while still
   * terminating. Exceeding it is reported as a LIVELOCK — threads running,
   * nothing progressing — which is a real outcome worth showing rather than an
   * internal error to hide.
   */
  const totalOps = program.threads.reduce((sum, t) => sum + t.ops.length, 0);
  const budget = totalOps * 12 + 64;

  for (let guard = 0; guard <= budget; guard++) {
    const ready = runtimes.filter(runnable);

    if (ready.length === 0) {
      const unfinished = runtimes.filter((rt) => statusOf(rt) !== "done");
      if (unfinished.length === 0) break; // all threads ran to completion

      // Everyone left is waiting for something nobody will provide.
      deadlocked = true;
      for (const rt of unfinished) {
        const waiting = blockedOn(rt);
        if (waiting === undefined) continue;
        // Count the wait we are about to display. Without this the figure showed
        // "waiting for B" on both lanes beside a lock-waits counter reading 0,
        // because the main loop only counts waits for threads it passed over —
        // and at a deadlock there is no chosen thread to pass anyone over.
        if (rt.waitingOn !== waiting) rec.bump(CONCURRENCY_COUNTERS.waits);
        rt.waitingOn = waiting;
      }
      active = null;
      ranOp = undefined;
      rec.record({ note: "deadlock — every remaining thread is waiting" });
      break;
    }

    if (guard === budget) {
      livelocked = true;
      active = null;
      ranOp = undefined;
      rec.record({
        note: "livelock — threads are still running but nothing is progressing",
      });
      break;
    }

    const chosen = ready[Math.floor(rng() * ready.length)];

    // Anything ready that ISN'T chosen was passed over; if the previous op
    // belonged to a different thread, this frame is a context switch.
    if (active !== null && active !== chosen.thread.id) {
      rec.bump(CONCURRENCY_COUNTERS.switches);
    }

    // Refresh what everyone else is waiting for, counting each new wait once.
    for (const rt of runtimes) {
      if (rt === chosen) {
        rt.waitingOn = undefined;
        continue;
      }
      const waiting = blockedOn(rt);
      if (waiting !== undefined && rt.waitingOn !== waiting) {
        rec.bump(CONCURRENCY_COUNTERS.waits);
      }
      rt.waitingOn = waiting;
    }

    const op = chosen.thread.ops[chosen.pc];
    if (op.lock) {
      locks[op.lock.name] =
        op.lock.action === "acquire" ? chosen.thread.id : null;
    }

    if (op.bump) {
      for (const [key, count] of Object.entries(op.bump)) {
        rec.bump(key, count);
      }
    }

    const opBump = (key: string, by = 1) => {
      rec.bump(key, by);
    };

    const outcome = op.effect?.(memory, chosen.locals, opBump);
    let isRetry = false;
    if (outcome === "retry") {
      isRetry = true;
      rec.bump(CONCURRENCY_COUNTERS.retries);
    } else if (outcome && typeof outcome === "object") {
      if (outcome.retry) {
        isRetry = true;
        rec.bump(CONCURRENCY_COUNTERS.retries);
      }
      if (outcome.bump) {
        for (const [key, count] of Object.entries(outcome.bump)) {
          rec.bump(key, count);
        }
      }
    }

    if (!isRetry) {
      chosen.pc += 1;
    }

    active = chosen.thread.id;
    ranOp = isRetry ? `${op.label} (retry)` : op.label;
    rec.bump(CONCURRENCY_COUNTERS.steps);
    rec.record({
      codeLine: op.codeLine,
      note: `${chosen.thread.name}: ${ranOp}`,
    });
  }

  return rec.steps;
}
