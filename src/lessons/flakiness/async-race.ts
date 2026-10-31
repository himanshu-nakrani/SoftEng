import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Memory,
  type Program,
  type Thread,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Async Timing and Sleep Flakes — archetype B (`engine: "steps"` in the registry),
 * archetype C producer (`interleave`) rendered by `ThreadsView`.
 *
 * The third flakiness archetype: ASYNC TIMING RACES.
 *
 * In `flaky-tests`, two tests collided over a shared slot (symmetric).
 * In `test-pollution`, one test leaned on state seeded by another (asymmetric).
 * Here, a SINGLE test races against the asynchronous work it triggered.
 *
 * The anti-pattern is ubiquitous: code triggers an asynchronous background
 * worker, and because the test runner does not know when that worker will finish,
 * the author inserts an arbitrary delay: `sleep(50ms)`.
 *
 * On a fast local machine with an idle CPU, the worker reliably finishes in
 * 5ms, so `sleep(50ms)` passes every time. But in CI — under container CPU
 * limits, noisy neighbors, and heavy thread scheduling pressure — the scheduler
 * preempts the worker or delays its execution. The test wakes up from sleep,
 * evaluates `expect ready == 1` before the worker has updated `ready`, and fails.
 *
 * Reseeding flips the verdict without changing a single line of code.
 *
 * Both defs model the same pair of threads:
 *   - Thread 1 (Async Worker): performs background work and sets `ready = 1`.
 *   - Thread 2 (Test Runner): asserts `ready == 1`.
 *
 * Sleep def (`asyncRaceSleepAlgo`): The test runner executes an arbitrary sleep
 * before asserting. When the scheduler schedules the worker's completion first,
 * the test passes; when the test wakes up and asserts before the worker runs,
 * it reads `ready == 0` and fails. Across 1000 seeds, about half (517 of 1000,
 * 110 of 200) fail.
 *
 * Awaiting def (`asyncRaceAwaitingAlgo`): The test runner uses deterministic
 * condition awaiting (`await ready == 1`). The test thread is parked until the
 * worker's write actually lands. 100% of seeds pass (0 failures across 1000 runs).
 *
 * All code lines are <= 27 characters (the `algo integrity` check enforces it).
 */

const SLEEP_CODE = [
  "worker: do_work()",
  "worker: ready = 1",
  "test: sleep(50ms)",
  "test: expect ready == 1",
];

const AWAITING_CODE = [
  "worker: do_work()",
  "worker: ready = 1",
  "test: await ready == 1",
  "test: expect ready == 1",
];

function workerThread(): Thread {
  return {
    id: "worker",
    name: "async worker",
    ops: [
      {
        label: "do async work",
        codeLine: 0,
        effect: () => {},
      },
      {
        label: "ready = 1",
        codeLine: 1,
        effect: (memory: Memory) => {
          memory.ready = 1;
        },
      },
    ],
  };
}

function testRunnerSleep(): Thread {
  return {
    id: "test",
    name: "test runner",
    ops: [
      {
        label: "sleep(50ms)",
        codeLine: 2,
        effect: () => {},
      },
      {
        label: "expect ready == 1",
        codeLine: 3,
        effect: (memory: Memory) => {
          if (memory.ready === 1) memory.passed += 1;
          else memory.failed += 1;
        },
      },
    ],
  };
}

function testRunnerAwaiting(): Thread {
  return {
    id: "test",
    name: "test runner",
    ops: [
      {
        label: "await ready == 1",
        codeLine: 2,
        await: {
          label: "ready == 1",
          ready: (memory: Memory) => memory.ready === 1,
        },
      },
      {
        label: "expect ready == 1",
        codeLine: 3,
        effect: (memory: Memory) => {
          if (memory.ready === 1) memory.passed += 1;
          else memory.failed += 1;
        },
      },
    ],
  };
}

function program(mode: "sleep" | "awaiting"): Program {
  const memory: Memory = { ready: 0, passed: 0, failed: 0 };
  return {
    memory,
    threads: [
      workerThread(),
      mode === "sleep" ? testRunnerSleep() : testRunnerAwaiting(),
    ],
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "test steps run" },
  { key: CONCURRENCY_COUNTERS.switches, label: "order changes" },
];

/**
 * Arbitrary sleep. The test sleeps for a fixed duration, hoping the worker
 * completes before the sleep expires. Under scheduler contention, the test
 * wakes and asserts before the worker finishes ~50% of the time.
 */
export const asyncRaceSleepAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "async-race-sleep",
  title: "test runner · fixed sleep",
  code: SLEEP_CODE,
  counters,
  generateInput: () => program("sleep"),
  run: (input, rng) => interleave(input, rng),
};

/**
 * Deterministic condition wait. The test awaits until `ready == 1` before
 * asserting. Regardless of scheduler order or thread preemption, 100% of
 * seeds pass.
 */
export const asyncRaceAwaitingAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "async-race-awaiting",
  title: "test runner · await ready",
  code: AWAITING_CODE,
  counters,
  generateInput: () => program("awaiting"),
  run: (input, rng) => interleave(input, rng),
};

/** Primary def alias for backwards compatibility. */
export const asyncRaceAlgo = asyncRaceSleepAlgo;
