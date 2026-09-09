import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
  type Thread,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Data Races — archetype B (`engine: "steps"` in the registry).
 *
 * The lesson is the op GRANULARITY. `counter++` reads as one thing, so it is
 * split into the three operations it actually compiles to; once the learner can
 * see the three, the lost update stops being mysterious and becomes obvious.
 *
 * Interleaving is chosen by the run's seeded RNG, so shuffling the seed hunts
 * for a different — equally legal — order, and any order the learner lands on
 * replays exactly. That is the whole pedagogical trick: the bug is not in the
 * code you are reading, it is in the order you did not choose.
 */

/** Line indices into `code` below, named so the ops cannot drift from it. */
const LINE = {
  lock: 0,
  read: 1,
  add: 2,
  write: 3,
  unlock: 4,
} as const;

/**
 * One thread doing `counter++` as read → add → write.
 *
 * Not atomic, and that is the point: between any two of these the scheduler may
 * run somebody else. `locked` wraps the three in a mutex so the same three ops
 * become uninterruptible as a group.
 */
function incrementer(id: string, locked: boolean): Thread {
  const body = [
    {
      label: "read counter",
      codeLine: LINE.read,
      effect: (memory: Record<string, number>, locals: Record<string, number>) => {
        locals.tmp = memory.counter;
      },
    },
    {
      label: "tmp + 1",
      codeLine: LINE.add,
      effect: (_memory: Record<string, number>, locals: Record<string, number>) => {
        locals.tmp += 1;
      },
    },
    {
      label: "write counter",
      codeLine: LINE.write,
      effect: (memory: Record<string, number>, locals: Record<string, number>) => {
        memory.counter = locals.tmp;
      },
    },
  ];

  return {
    id,
    name: id,
    locals: { tmp: 0 },
    ops: locked
      ? [
          { label: "lock", codeLine: LINE.lock, lock: { action: "acquire" as const, name: "mutex" } },
          ...body,
          { label: "unlock", codeLine: LINE.unlock, lock: { action: "release" as const, name: "mutex" } },
        ]
      : body,
  };
}

function program(threads: number, locked: boolean): Program {
  return {
    memory: { counter: 0 },
    locks: locked ? ["mutex"] : [],
    threads: Array.from({ length: threads }, (_, i) =>
      incrementer(`T${i + 1}`, locked),
    ),
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "ops executed" },
  { key: CONCURRENCY_COUNTERS.switches, label: "context switches" },
];

/**
 * Pseudocode for the panel. Every line is within the 27-character budget the
 * `algo integrity` check enforces — past that the panel clips silently.
 */
const code = [
  "lock()          // guarded",
  "tmp = counter   // read",
  "tmp = tmp + 1   // add",
  "counter = tmp   // write",
  "unlock()",
];

/**
 * The unguarded run. N threads each add 1; the final counter is anywhere from
 * 1 to N depending on where the scheduler cut.
 */
export const dataRacesAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "data-races",
  title: "counter++ · unguarded",
  code,
  counters,
  size: { label: "threads", min: 2, max: 4, default: 3 },
  generateInput: (_rng, size) => program(size, false),
  run: (input, rng) => interleave(input, rng),
};

/**
 * The same three operations inside a mutex. Same threads, same seeds — but the
 * critical section can no longer be cut, so the result is N every time.
 */
export const dataRacesGuardedAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "data-races-guarded",
  title: "counter++ · mutex",
  code,
  counters: [
    ...counters,
    { key: CONCURRENCY_COUNTERS.waits, label: "lock waits" },
  ],
  size: { label: "threads", min: 2, max: 4, default: 3 },
  generateInput: (_rng, size) => program(size, true),
  run: (input, rng) => interleave(input, rng),
};
