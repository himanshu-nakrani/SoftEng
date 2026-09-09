import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
  type Thread,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Lock Granularity — archetype B (`engine: "steps"`).
 *
 * The question the previous three lessons set up but never answered: HOW MANY
 * locks? A race needs at least one, a second one introduces ordering risk, and
 * the choice between them is contention.
 *
 * The program is deliberately trivial and, crucially, PARTITIONED: half the
 * threads only ever touch counter `a`, the other half only `b`. They share no
 * data at all. Whether they block each other is therefore purely an artefact of
 * how the locking was drawn, which is the entire point.
 */

const COARSE_CODE = [
  "lock(all)",
  "  counter += 1",
  "unlock(all)",
];

const FINE_CODE = [
  "lock(mine)",
  "  counter += 1",
  "unlock(mine)",
];

/** One increment of `counter`, guarded by `lockName`. */
function worker(id: string, counter: string, lockName: string): Thread {
  return {
    id,
    name: `${id} → ${counter}`,
    ops: [
      { label: `lock ${lockName}`, codeLine: 0, lock: { action: "acquire", name: lockName } },
      {
        label: `${counter} + 1`,
        codeLine: 1,
        effect: (memory) => {
          memory[counter] += 1;
        },
      },
      { label: `unlock ${lockName}`, codeLine: 2, lock: { action: "release", name: lockName } },
    ],
  };
}

/**
 * `threads` workers split evenly between counters `a` and `b`.
 *
 * `coarse` decides whether one lock covers both counters or each gets its own —
 * the only difference between the two figures.
 */
function program(threads: number, coarse: boolean): Program {
  return {
    memory: { a: 0, b: 0 },
    locks: coarse ? ["all"] : ["lock-a", "lock-b"],
    threads: Array.from({ length: threads }, (_, i) => {
      const counter = i % 2 === 0 ? "a" : "b";
      return worker(
        `T${i + 1}`,
        counter,
        coarse ? "all" : `lock-${counter}`,
      );
    }),
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "ops executed" },
  { key: CONCURRENCY_COUNTERS.waits, label: "times blocked" },
];

const size = { label: "threads", min: 2, max: 6, default: 4 };

/** One lock over everything: threads that share nothing still queue up. */
export const coarseLockAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "lock-granularity",
  title: "one lock for both counters",
  code: COARSE_CODE,
  counters,
  size,
  generateInput: (_rng, threads) => program(threads, true),
  run: (input, rng) => interleave(input, rng),
};

/** A lock per counter: only threads touching the same counter contend. */
export const fineLockAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "lock-granularity-fine",
  title: "a lock per counter",
  code: FINE_CODE,
  counters,
  size,
  generateInput: (_rng, threads) => program(threads, false),
  run: (input, rng) => interleave(input, rng),
};
