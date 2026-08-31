import { buildAlgoSteps } from "@/engine/algo/build";
import { CONCURRENCY_COUNTERS as C } from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";
import { describe, expect, it } from "vitest";

import { dataRacesAlgo, dataRacesGuardedAlgo } from "@/lessons/shared-state/data-races";
import { deadlockAlgo, deadlockOrderedAlgo } from "@/lessons/shared-state/deadlock";
import { casAlgo, spinLockAlgo } from "@/lessons/shared-state/atomic-operations";
import {
  backpressureAlgo,
  producerConsumerAlgo,
} from "@/lessons/shared-state/producer-consumer";
import { coarseLockAlgo, fineLockAlgo } from "@/lessons/shared-state/lock-granularity";
import { mutexAlgo, rwLockAlgo } from "@/lessons/shared-state/read-write-locks";
import { fencedAlgo, storeBufferAlgo } from "@/lessons/shared-state/memory-visibility";
import { falseSharingAlgo, paddedAlgo } from "@/lessons/shared-state/false-sharing";
import {
  threadPerRequestAlgo,
  threadPoolAlgo,
} from "@/lessons/shared-state/thread-pools";

/**
 * Track 02's prose states NUMBERS — "roughly half the interleavings complete",
 * "blocked turns go 1, 6, 15", "37% of runs", "exactly two transfers". Each was
 * measured before it was written, but a measurement is only true until the
 * scheduler changes, and nothing else in the suite would notice the prose
 * becoming wrong.
 *
 * So this file pins the CLAIMS, not the implementation. A failure here means a
 * lesson page now lies, and the message says which sentence to go and fix. That
 * is the archetype-B counterpart of `goldens.test.ts`, which does the same job
 * for the packet engine.
 *
 * Ranges are used where the exact value is not the teaching point; exact
 * assertions are used where the prose quotes a figure.
 */

/**
 * Generic in the input type on purpose. A shared
 * `AlgoDef<ConcurrencyState, unknown>` alias does not accept a def whose input is
 * concrete: `run`'s parameter is contravariant, so `AlgoDef<S, Program>` is not
 * an `AlgoDef<S, unknown>`. vitest would not notice (esbuild strips types) but
 * `tsc --noEmit` rightly does.
 */

/** Final state at a given size and seed. */
function run<I>(def: AlgoDef<ConcurrencyState, I>, size: number, seed: number) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1];
  return {
    steps,
    state: last.state,
    counter: (key: string) => last.counters[key] ?? 0,
  };
}

/** Mean of a counter across `seeds` runs. */
function meanCounter<I>(
  def: AlgoDef<ConcurrencyState, I>,
  size: number,
  key: string,
  seeds = 60,
): number {
  let total = 0;
  for (let seed = 0; seed < seeds; seed++) total += run(def, size, seed).counter(key);
  return total / seeds;
}

const defaultSize = <I,>(def: AlgoDef<ConcurrencyState, I>) => def.size?.default ?? 0;

describe("data-races: the lost update is visible and the mutex fixes it", () => {
  it("loses at least one update at the default seed, with 3 threads", () => {
    // The page asks "three threads each added one — did it reach 3?"
    const { state } = run(dataRacesAlgo, 3, 42);
    expect(state.memory.counter).toBeLessThan(3);
    expect(state.memory.counter).toBeGreaterThanOrEqual(1);
  });

  it("reaches the thread count on every seed once guarded", () => {
    for (let seed = 0; seed < 60; seed++) {
      expect(run(dataRacesGuardedAlgo, 3, seed).state.memory.counter).toBe(3);
    }
  });
});

describe("deadlock: about half the interleavings hang, ordering removes them all", () => {
  it("deadlocks at the default seed, so the learner sees it immediately", () => {
    expect(run(deadlockAlgo, 0, 42).state.deadlocked).toBe(true);
  });

  it("hangs on roughly half of 40 seeds — the page says 'roughly half'", () => {
    let dead = 0;
    for (let seed = 0; seed < 40; seed++) {
      if (run(deadlockAlgo, 0, seed).state.deadlocked) dead += 1;
    }
    expect(dead).toBeGreaterThan(12);
    expect(dead).toBeLessThan(28);
  });

  it("never deadlocks with a global lock order, and balances net to zero", () => {
    for (let seed = 0; seed < 40; seed++) {
      const { state } = run(deadlockOrderedAlgo, 0, seed);
      expect(state.deadlocked).toBe(false);
      expect(state.memory.A).toBe(100);
      expect(state.memory.B).toBe(100);
    }
  });
});

describe("atomics: CAS is always correct, and the spin lock costs more", () => {
  it("never loses an update at any thread count", () => {
    for (const n of [2, 3, 4, 5]) {
      for (let seed = 0; seed < 40; seed++) {
        expect(run(casAlgo, n, seed).state.memory.counter).toBe(n);
      }
    }
  });

  it("shows a failed attempt at the default, which is why the default is 4", () => {
    // At 3 threads and seed 42 there are zero retries — a CAS loop that never
    // loops. The default was moved to 4 for exactly this reason.
    expect(defaultSize(casAlgo)).toBe(4);
    expect(run(casAlgo, 4, 42).counter(C.retries)).toBeGreaterThan(0);
  });

  it("quotes 3 failed attempts for CAS and 11 for the spin lock", () => {
    expect(run(casAlgo, 4, 42).counter(C.retries)).toBe(3);
    expect(run(spinLockAlgo, 4, 42).counter(C.retries)).toBe(11);
  });

  it("retries grow roughly eightfold from 2 to 5 threads", () => {
    const two = meanCounter(casAlgo, 2, C.retries);
    const five = meanCounter(casAlgo, 5, C.retries);
    expect(five / two).toBeGreaterThan(5);
    expect(five / two).toBeLessThan(12);
  });

  it("never retries with a single thread — nobody to lose to", () => {
    expect(run(casAlgo, 1, 1).counter(C.retries)).toBe(0);
  });
});

describe("producer/consumer: capacity buys independence, not throughput", () => {
  it("blocks 7 times at capacity 1 and 3 at capacity 4 (seed 42)", () => {
    expect(run(producerConsumerAlgo, 1, 42).counter(C.waits)).toBe(7);
    expect(run(producerConsumerAlgo, 4, 42).counter(C.waits)).toBe(3);
  });

  it("delivers every item at every capacity, never exceeding the buffer", () => {
    for (const cap of [1, 2, 3, 4]) {
      for (let seed = 0; seed < 30; seed++) {
        const { steps, state } = run(producerConsumerAlgo, cap, seed);
        expect(state.memory.consumed).toBe(4);
        expect(state.deadlocked).toBe(false);
        for (const step of steps) {
          expect(step.state.memory.buffer).toBeLessThanOrEqual(cap);
        }
      }
    }
  });

  it("blocks the producer about twice as often as the consumer when it is slow", () => {
    let producer = 0;
    let consumer = 0;
    for (let seed = 0; seed < 60; seed++) {
      for (const step of run(backpressureAlgo, 0, seed).steps) {
        for (const t of step.state.threads) {
          if (t.status !== "blocked") continue;
          if (t.id === "producer") producer += 1;
          else consumer += 1;
        }
      }
    }
    expect(producer).toBeGreaterThan(consumer * 1.5);
  });
});

describe("lock granularity: contention is n(n-1)/2 in the threads sharing a lock", () => {
  it("blocks exactly 1, 6, 15 under one lock at 2, 4, 6 threads", () => {
    for (const [n, expected] of [
      [2, 1],
      [4, 6],
      [6, 15],
    ] as const) {
      expect(meanCounter(coarseLockAlgo, n, C.waits)).toBe(expected);
    }
  });

  it("blocks exactly 0, 2, 6 with a lock per counter", () => {
    for (const [n, expected] of [
      [2, 0],
      [4, 2],
      [6, 6],
    ] as const) {
      expect(meanCounter(fineLockAlgo, n, C.waits)).toBe(expected);
    }
  });

  it("executes identical op counts either way — only blocking differs", () => {
    for (const n of [2, 4, 6]) {
      expect(meanCounter(coarseLockAlgo, n, C.steps)).toBe(
        meanCounter(fineLockAlgo, n, C.steps),
      );
    }
  });
});

describe("read-write locks: blocking stays flat as readers are added", () => {
  it("holds around 1.5 blocked turns from 2 to 5 readers", () => {
    for (const n of [2, 3, 4, 5]) {
      const mean = meanCounter(rwLockAlgo, n, C.waits);
      expect(mean).toBeGreaterThan(1);
      expect(mean).toBeLessThan(2.5);
    }
  });

  it("lets every reader in at once", () => {
    for (const n of [2, 3, 4, 5]) {
      let max = 0;
      for (let seed = 0; seed < 30; seed++) {
        for (const step of run(rwLockAlgo, n, seed).steps) {
          max = Math.max(max, step.state.memory.readers);
        }
      }
      expect(max).toBe(n);
    }
  });

  it("grows as 3, 6, 10, 15 under one exclusive lock", () => {
    for (const [n, expected] of [
      [2, 3],
      [3, 6],
      [4, 10],
      [5, 15],
    ] as const) {
      expect(meanCounter(mutexAlgo, n, C.waits)).toBe(expected);
    }
  });
});

describe("memory visibility: both threads read zero, and a fence forbids it", () => {
  it("reaches the sequentially-impossible outcome in roughly a third of runs", () => {
    let bothZero = 0;
    for (let seed = 0; seed < 200; seed++) {
      const { state } = run(storeBufferAlgo, 0, seed);
      if (state.memory.r1 === 0 && state.memory.r2 === 0) bothZero += 1;
    }
    // The page says "roughly one run in three".
    expect(bothZero / 200).toBeGreaterThan(0.25);
    expect(bothZero / 200).toBeLessThan(0.45);
  });

  it("never reaches it once each store is fenced — 0 of 200 seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const { state } = run(fencedAlgo, 0, seed);
      expect(state.memory.r1 === 0 && state.memory.r2 === 0).toBe(false);
    }
  });
});

describe("false sharing: padding pins transfers, sharing does not", () => {
  it("costs exactly 2 transfers when padded, on every seed", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(run(paddedAlgo, 0, seed).counter(C.retries)).toBe(2);
    }
  });

  it("averages far more when the counters share a line, up to 16", () => {
    let max = 0;
    for (let seed = 0; seed < 200; seed++) {
      max = Math.max(max, run(falseSharingAlgo, 0, seed).counter(C.retries));
    }
    expect(meanCounter(falseSharingAlgo, 0, C.retries, 200)).toBeGreaterThan(4);
    expect(max).toBeGreaterThanOrEqual(12);
  });

  it("quotes 10 transfers / 16 ops shared against 2 / 8 padded at seed 42", () => {
    const shared = run(falseSharingAlgo, 0, 42);
    const padded = run(paddedAlgo, 0, 42);
    expect(shared.counter(C.retries)).toBe(10);
    expect(shared.counter(C.steps)).toBe(16);
    expect(padded.counter(C.retries)).toBe(2);
    expect(padded.counter(C.steps)).toBe(8);
  });

  it("stays correct in both — this is a performance defect, not a bug", () => {
    for (const def of [falseSharingAlgo, paddedAlgo]) {
      for (let seed = 0; seed < 60; seed++) {
        const { state } = run(def, 0, seed);
        expect(state.memory.a).toBe(3);
        expect(state.memory.b).toBe(3);
      }
    }
  });
});

describe("thread pools: a pool sized to the resource never blocks", () => {
  it("blocks exactly zero times at every request count", () => {
    for (const n of [4, 6, 8]) {
      expect(meanCounter(threadPoolAlgo, n, C.waits)).toBe(0);
    }
  });

  it("blocks more and more without a pool: 4, 6, 8 requests", () => {
    const means = [4, 6, 8].map((n) => meanCounter(threadPerRequestAlgo, n, C.waits));
    expect(means[0]).toBeGreaterThan(1);
    expect(means[1]).toBeGreaterThan(means[0]);
    expect(means[2]).toBeGreaterThan(means[1]);
  });

  it("executes identical op counts either way — the page says 18 at 6 requests", () => {
    for (const n of [4, 6, 8]) {
      expect(meanCounter(threadPerRequestAlgo, n, C.steps)).toBe(
        meanCounter(threadPoolAlgo, n, C.steps),
      );
    }
    expect(run(threadPoolAlgo, 6, 42).counter(C.steps)).toBe(18);
  });

  it("never exceeds the connection limit, and returns every connection", () => {
    for (const def of [threadPerRequestAlgo, threadPoolAlgo]) {
      for (let seed = 0; seed < 30; seed++) {
        const { steps, state } = run(def, 6, seed);
        expect(state.memory.served).toBe(6);
        expect(state.memory.free).toBe(2);
        for (const step of steps) {
          expect(step.state.memory.free).toBeGreaterThanOrEqual(0);
          expect(step.state.memory.free).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});
