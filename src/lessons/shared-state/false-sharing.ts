import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
  type Thread,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * False Sharing — archetype B (`engine: "steps"`).
 *
 * MODELLING NOTE. Caches are not in the engine, so the cache LINE is modelled as
 * shared state: a slot holding which core currently owns it for writing. A write
 * you do not own the line for costs an extra step to take ownership first —
 * expressed with the retry hatch, so a coherence transfer is literally a failed
 * attempt that must be redone.
 *
 * That makes the phenomenon visible rather than asserted, and it maps onto what
 * the hardware does: exclusive ownership per line, transferred on demand. What it
 * does not model is latency — a real transfer costs tens of nanoseconds, not one
 * step — so read the transfer COUNT, not the step count, as the cost.
 *
 * The point of the lesson: `a` and `b` are different variables. No thread reads
 * the other's. There is no race, no lock, and nothing to synchronise — and the
 * two threads still fight, purely because the two variables sit close together.
 */

const SHARED_CODE = [
  "// a, b: same line",
  "T1: a += 1",
  "T2: b += 1",
];

const PADDED_CODE = [
  "// a, b: padded apart",
  "T1: a += 1",
  "T2: b += 1",
];

const WRITES = 3;

/**
 * A thread doing `WRITES` increments of its own counter.
 *
 * `owner` is the key holding the line's current owner. A write only lands if this
 * thread owns the line; otherwise it takes ownership and retries, which is the
 * coherence transfer.
 */
function writer(id: string, tid: number, counter: string, owner: string): Thread {
  return {
    id,
    name: `${id} → ${counter}`,
    ops: Array.from({ length: WRITES }, (_, i) => ({
      label: `${counter} += 1 (#${i + 1})`,
      codeLine: tid,
      effect: (memory: Record<string, number>) => {
        if (memory[owner] !== tid) {
          memory[owner] = tid;
          return "retry" as const;
        }
        memory[counter] += 1;
      },
    })),
  };
}

/** `shared` puts both counters on one line; otherwise each gets its own. */
function program(shared: boolean): Program {
  return {
    memory: shared
      ? { a: 0, b: 0, line: 0 }
      : { a: 0, b: 0, line_a: 0, line_b: 0 },
    threads: [
      writer("T1", 1, "a", shared ? "line" : "line_a"),
      writer("T2", 2, "b", shared ? "line" : "line_b"),
    ],
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "ops executed" },
  { key: CONCURRENCY_COUNTERS.retries, label: "line transfers" },
];

/** One line under both counters: every alternation costs a transfer. */
export const falseSharingAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "false-sharing",
  title: "both counters on one line",
  code: SHARED_CODE,
  counters,
  generateInput: () => program(true),
  run: (input, rng) => interleave(input, rng),
};

/** Padded apart: each thread owns its line for the whole run. */
export const paddedAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "false-sharing-padded",
  title: "padded onto separate lines",
  code: PADDED_CODE,
  counters,
  generateInput: () => program(false),
  run: (input, rng) => interleave(input, rng),
};
