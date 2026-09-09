import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
  type Thread,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Atomics & CAS — archetype B (`engine: "steps"` in the registry).
 *
 * The third answer to the lost update. The first was "don't share" and the
 * second was "take a lock"; this one is "attempt the write, and detect that you
 * lost". Same three operations as `data-races`, but the write is conditional on
 * nothing having changed underneath — so a thread that loses the race learns
 * about it and can try again, instead of silently overwriting.
 *
 * The second figure closes the loop: a spin lock is nothing but one atomic
 * test-and-set plus a retry. Locks are not a primitive below atomics, they are
 * built out of them.
 */

// Lines stay within the 27-char code-panel budget, enforced by
// check-curriculum's `algo integrity` check.
const CAS_CODE = [
  "loop:",
  "  seen = counter",
  "  next = seen + 1",
  "  if CAS(seen, next): ok",
  "  else retry",
];

/** read → compare-and-swap, retrying whenever somebody else got there first. */
function casIncrementer(id: string): Thread {
  return {
    id,
    name: id,
    locals: { seen: 0, next: 0 },
    ops: [
      {
        label: "read counter",
        codeLine: 1,
        effect: (memory, locals) => {
          locals.seen = memory.counter;
          locals.next = locals.seen + 1;
        },
      },
      {
        label: "CAS counter",
        codeLine: 3,
        effect: (memory, locals) => {
          if (memory.counter !== locals.seen) {
            // Lost the race. Re-read and try again — this is the loop.
            locals.seen = memory.counter;
            locals.next = locals.seen + 1;
            return "retry";
          }
          memory.counter = locals.next;
        },
      },
    ],
  };
}

const SPIN_CODE = [
  "acquire:",
  "  while TAS(lock): spin",
  "  counter = counter + 1",
  "  lock = free",
];

/**
 * A spin lock, built from the same primitive. `test-and-set` atomically claims
 * the flag if it is free; a thread that finds it taken simply retries.
 */
function spinLockIncrementer(id: string): Thread {
  return {
    id,
    name: id,
    locals: { tmp: 0 },
    ops: [
      {
        label: "test-and-set lock",
        codeLine: 1,
        effect: (memory) => {
          if (memory.lock === 1) return "retry"; // held — spin
          memory.lock = 1;
        },
      },
      {
        label: "counter + 1",
        codeLine: 2,
        effect: (memory) => {
          memory.counter += 1;
        },
      },
      {
        label: "release lock",
        codeLine: 3,
        effect: (memory) => {
          memory.lock = 0;
        },
      },
    ],
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "ops executed" },
  { key: CONCURRENCY_COUNTERS.retries, label: "failed attempts" },
];

/**
 * Defaults to 4, not 2. At two threads the fixed default seed happens to produce
 * a run with barely any contention, so the learner would meet a CAS loop that
 * never actually loops — the one thing the figure exists to show. Four threads
 * makes a failed attempt near-certain at any seed.
 */
const size = { label: "threads", min: 2, max: 5, default: 4 };

export const casAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "atomic-operations",
  title: "compare-and-swap",
  code: CAS_CODE,
  counters,
  size,
  generateInput: (_rng, threads) => ({
    memory: { counter: 0 },
    threads: Array.from({ length: threads }, (_, i) => casIncrementer(`T${i + 1}`)),
  }),
  run: (input, rng) => interleave(input, rng),
};

export const spinLockAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "atomic-operations-spinlock",
  title: "spin lock from test-and-set",
  code: SPIN_CODE,
  counters,
  size,
  generateInput: (_rng, threads) => ({
    memory: { counter: 0, lock: 0 },
    threads: Array.from({ length: threads }, (_, i) =>
      spinLockIncrementer(`T${i + 1}`),
    ),
  }),
  run: (input, rng) => interleave(input, rng),
};
