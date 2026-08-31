import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
  type Thread,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Read-Write Locks — archetype B (`engine: "steps"`).
 *
 * Mutual exclusion is stronger than most workloads need. Two threads that only
 * READ cannot corrupt anything, so excluding them from each other buys nothing
 * and costs contention.
 *
 * There is no shared-mode lock primitive in the engine, and there does not need
 * to be: a read-write lock IS a small protocol over shared state — a reader
 * count and a writer flag, with each side waiting on the other's condition. So
 * the figure shows the mechanism rather than hiding it behind a lock name, which
 * is the more useful thing to see.
 */

const RW_CODE = [
  "read:",
  "  wait !writing",
  "  readers += 1",
  "  ... read ...",
  "  readers -= 1",
  "write:",
  "  wait no readers",
  "  writing = 1",
  "  ... write ...",
  "  writing = 0",
];

const MUTEX_CODE = [
  "lock(mutex)",
  "  ... read/write ...",
  "unlock(mutex)",
];

/** A reader under the read-write protocol: shares with other readers. */
function sharedReader(id: string): Thread {
  return {
    id,
    name: `${id} read`,
    locals: { seen: 0 },
    ops: [
      {
        label: "enter (no writer)",
        codeLine: 1,
        await: { label: "no writer", ready: (memory) => memory.writing === 0 },
        effect: (memory) => {
          memory.readers += 1;
        },
      },
      {
        label: "read data",
        codeLine: 3,
        effect: (memory, locals) => {
          locals.seen = memory.data;
        },
      },
      {
        label: "leave",
        codeLine: 4,
        effect: (memory) => {
          memory.readers -= 1;
        },
      },
    ],
  };
}

/** The writer: needs the data to itself, so it waits for every reader to leave. */
function exclusiveWriter(id: string): Thread {
  return {
    id,
    name: `${id} write`,
    ops: [
      {
        label: "enter (nobody reading)",
        codeLine: 6,
        await: {
          label: "an empty room",
          ready: (memory) => memory.readers === 0 && memory.writing === 0,
        },
        effect: (memory) => {
          memory.writing = 1;
        },
      },
      {
        label: "write data",
        codeLine: 8,
        effect: (memory) => {
          memory.data += 1;
        },
      },
      {
        label: "leave",
        codeLine: 9,
        effect: (memory) => {
          memory.writing = 0;
        },
      },
    ],
  };
}

/** The same work under one exclusive lock: readers block each other too. */
function mutexUser(id: string, write: boolean): Thread {
  return {
    id,
    name: `${id} ${write ? "write" : "read"}`,
    locals: { seen: 0 },
    ops: [
      { label: "lock", codeLine: 0, lock: { action: "acquire", name: "mutex" } },
      {
        label: write ? "write data" : "read data",
        codeLine: 1,
        effect: (memory, locals) => {
          if (write) memory.data += 1;
          else locals.seen = memory.data;
        },
      },
      { label: "unlock", codeLine: 2, lock: { action: "release", name: "mutex" } },
    ],
  };
}

/** `readers` readers plus one writer — the read-heavy shape locks are chosen for. */
function program(readers: number, shared: boolean): Program {
  const threads: Thread[] = [];
  for (let i = 0; i < readers; i++) {
    threads.push(shared ? sharedReader(`R${i + 1}`) : mutexUser(`R${i + 1}`, false));
  }
  threads.push(shared ? exclusiveWriter("W") : mutexUser("W", true));
  return {
    memory: shared ? { data: 0, readers: 0, writing: 0 } : { data: 0 },
    locks: shared ? [] : ["mutex"],
    threads,
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "ops executed" },
  { key: CONCURRENCY_COUNTERS.waits, label: "times blocked" },
];

const size = { label: "readers", min: 2, max: 5, default: 3 };

export const rwLockAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "read-write-locks",
  title: "shared reads, exclusive write",
  code: RW_CODE,
  counters,
  size,
  generateInput: (_rng, readers) => program(readers, true),
  run: (input, rng) => interleave(input, rng),
};

export const mutexAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "read-write-locks-mutex",
  title: "one exclusive lock for both",
  code: MUTEX_CODE,
  counters,
  size,
  generateInput: (_rng, readers) => program(readers, false),
  run: (input, rng) => interleave(input, rng),
};
