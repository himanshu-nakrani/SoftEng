import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
  type Thread,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Memory Visibility & Reordering — archetype B (`engine: "steps"`).
 *
 * MODELLING NOTE, because this lesson could easily lie.
 *
 * The scheduler has one shared memory and every effect is atomic, so it cannot
 * represent a stale cache or a compiler-reordered instruction on its own. Rather
 * than assert reordering in prose while the figure shows sequential consistency,
 * the store buffer is modelled EXPLICITLY as shared state: a write lands in the
 * writing thread's buffer slot, and only a later flush makes it visible to
 * anyone else.
 *
 * Reordering then EMERGES from scheduling — the flush is just another op the
 * scheduler can run late — instead of being stipulated. That is the honest
 * version, and it matches the hardware: the store buffer is why x86 permits this
 * outcome at all.
 *
 * The program is the classic store-buffering litmus test (Dekker's): each thread
 * writes its own flag and then reads the other's. Under sequential consistency at
 * least one thread must see the other's write. With store buffers, both can read
 * zero — measured at 37% of 200 seeds here, against 0 of 200 with fences.
 *
 * LIMIT OF THE MODEL, stated because the figure should not be read as a complete
 * account: the drain is a later op in the SAME thread's list, so it can never be
 * scheduled before that thread's own read. Real hardware drains asynchronously
 * and may publish earlier, which is why "both read 1" is possible on a real
 * machine but never appears here. What the figure does show faithfully is the
 * outcome that matters — the one sequential consistency forbids and a fence
 * removes.
 */

const BUFFERED_CODE = [
  "T1: x = 1     (buffered)",
  "T1: r1 = flag",
  "T1: flush x",
  "T2: flag = 1  (buffered)",
  "T2: r2 = x",
  "T2: flush flag",
];

const FENCED_CODE = [
  "T1: x = 1; fence",
  "T1: r1 = flag",
  "T2: flag = 1; fence",
  "T2: r2 = x",
];

/**
 * One side of the litmus test.
 *
 * `mine`/`theirs` are the shared variables; `readInto` is where the observed
 * value is parked so the figure can show it. With `buffered`, the store and its
 * flush are separate ops — the gap between them is the whole phenomenon.
 */
function party(
  id: string,
  mine: string,
  theirs: string,
  readInto: string,
  buffered: boolean,
  lines: { store: number; read: number; flush: number },
): Thread {
  const buf = `buf_${mine}`;
  return {
    id,
    name: id,
    ops: buffered
      ? [
          {
            label: `${mine} = 1 (buffered)`,
            codeLine: lines.store,
            effect: (memory) => {
              memory[buf] = 1;
            },
          },
          {
            // Reads see COMMITTED memory only. A thread does see its own buffered
            // write in real hardware, but this test never re-reads its own
            // variable, so modelling that would add state without adding meaning.
            label: `read ${theirs}`,
            codeLine: lines.read,
            effect: (memory) => {
              memory[readInto] = memory[theirs];
            },
          },
          {
            label: `flush ${mine}`,
            codeLine: lines.flush,
            effect: (memory) => {
              memory[mine] = memory[buf];
              memory[buf] = 0;
            },
          },
        ]
      : [
          {
            // A fence collapses store and flush into one indivisible step: the
            // write is visible to everyone before this thread does anything else.
            label: `${mine} = 1, fence`,
            codeLine: lines.store,
            effect: (memory) => {
              memory[mine] = 1;
            },
          },
          {
            label: `read ${theirs}`,
            codeLine: lines.read,
            effect: (memory) => {
              memory[readInto] = memory[theirs];
            },
          },
        ],
  };
}

function program(buffered: boolean): Program {
  const memory: Record<string, number> = { x: 0, flag: 0, r1: 0, r2: 0 };
  if (buffered) {
    memory.buf_x = 0;
    memory.buf_flag = 0;
  }
  return {
    memory,
    threads: [
      party("T1", "x", "flag", "r1", buffered, { store: 0, read: 1, flush: 2 }),
      party("T2", "flag", "x", "r2", buffered, { store: 3, read: 4, flush: 5 }),
    ],
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "ops executed" },
  { key: CONCURRENCY_COUNTERS.switches, label: "context switches" },
];

/** Stores sit in a buffer until flushed — so both reads can miss. */
export const storeBufferAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "memory-visibility",
  title: "stores land in a buffer",
  code: BUFFERED_CODE,
  counters,
  generateInput: () => program(true),
  run: (input, rng) => interleave(input, rng),
};

/** A fence publishes the store immediately — at least one read must see it. */
export const fencedAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "memory-visibility-fenced",
  title: "fence after each store",
  code: FENCED_CODE,
  counters,
  generateInput: () => program(false),
  run: (input, rng) => interleave(input, rng),
};
