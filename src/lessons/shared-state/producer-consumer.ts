import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
  type Thread,
  type ThreadOp,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Producer/Consumer & Backpressure — archetype B (`engine: "steps"`).
 *
 * The first lesson built on condition waits (`op.await`) rather than locks. A
 * bounded buffer is the whole subject: it decouples two threads that run at
 * different speeds, and its CAPACITY is the dial between lockstep coordination
 * and independent progress.
 *
 * A blocking put/take is modelled as ONE op carrying both the condition and the
 * effect, which is what the real API does — `queue.put(x)` parks the caller until
 * there is room and then writes. Splitting them would invite an interleaving
 * where a thread has passed the check but not yet acted, which is a different
 * lesson (that is `data-races`).
 */

const ITEMS = 4;

// No inline comments: they would blow the 27-char code-panel budget (enforced by
// check-curriculum), and the blocking is already visible in the lanes.
const CODE = [
  "producer:",
  "  put(item)",
  "consumer:",
  "  take()",
  "  process()",
];

/** Produce `ITEMS` items, blocking whenever the buffer is full. */
function producer(capacity: number): Thread {
  const ops: ThreadOp[] = Array.from({ length: ITEMS }, (_, i) => ({
    label: `put #${i + 1}`,
    codeLine: 1,
    await: {
      label: "room",
      ready: (memory) => memory.buffer < capacity,
    },
    effect: (memory) => {
      memory.buffer += 1;
      memory.produced += 1;
    },
  }));
  return { id: "producer", name: "producer", ops };
}

/**
 * Consume `ITEMS` items, blocking whenever the buffer is empty.
 *
 * `work` is how many ops each item costs AFTER the take — the honest way to
 * model a slow consumer in a uniformly-scheduled world: not a slower clock, but
 * more work per item.
 */
function consumer(work: number): Thread {
  const ops: ThreadOp[] = Array.from({ length: ITEMS }, (_, i) => {
    const take: ThreadOp = {
      label: `take #${i + 1}`,
      codeLine: 3,
      await: {
        label: "an item",
        ready: (memory) => memory.buffer > 0,
      },
      effect: (memory) => {
        memory.buffer -= 1;
        memory.consumed += 1;
      },
    };
    const processing: ThreadOp[] = Array.from({ length: work }, () => ({
      label: `process #${i + 1}`,
      codeLine: 4,
      effect: () => {},
    }));
    return [take, ...processing];
  }).flat();
  return { id: "consumer", name: "consumer", ops };
}

function program(capacity: number, work: number): Program {
  return {
    memory: { buffer: 0, produced: 0, consumed: 0 },
    threads: [producer(capacity), consumer(work)],
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "ops executed" },
  { key: CONCURRENCY_COUNTERS.waits, label: "times blocked" },
];

/**
 * Capacity is the slider. At 1 the threads are forced into lockstep — every put
 * must be followed by a take before the next put; at 4 the producer can finish
 * without ever waiting.
 */
export const producerConsumerAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "producer-consumer",
  title: "bounded buffer",
  code: CODE,
  counters,
  size: { label: "buffer capacity", min: 1, max: 4, default: 1 },
  generateInput: (_rng, capacity) => program(capacity, 0),
  run: (input, rng) => interleave(input, rng),
};

/**
 * The same buffer, but each item costs the consumer three ops instead of one.
 * The producer now spends most of the run blocked: the queue is full, and the
 * whole pipeline runs at the consumer's pace. That is backpressure — the buffer
 * transmitting the slow end's limit back to the fast end.
 */
export const backpressureAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "producer-consumer-backpressure",
  title: "slow consumer · capacity 2",
  code: CODE,
  counters,
  generateInput: () => program(2, 2),
  run: (input, rng) => interleave(input, rng),
};
