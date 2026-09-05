import {
  runScenario,
  scenarioInput,
  scenarioSize,
  SCENARIO_COUNTERS,
  type RunResult,
  type ScenarioInput,
  type ScenarioSpec,
} from "@/engine/algo/scenario";
import type { AlgoDef } from "@/engine/algo/types";
import type { ScenarioState } from "@/engine/algo/views/scenario";

/**
 * Thread Pool vs Bounded Queue — archetype G (branching-scenario producer, `algo/scenario.ts`).
 *
 * The third on-call scenario: downstream API latency spikes 40x from 10ms to 400ms.
 * At 80 req/s incoming traffic, Little's Law dictates that 16 threads can only
 * sustain 16 / 0.4s = 40 req/s. The reader chooses how to handle the excess:
 *
 *   1. "Expand thread pool to 200": Spawns threads to meet concurrency. Context
 *      switching and memory thrashing inflate latency to 1600–2400ms, meeting SLA
 *      in only 29 of 200 seeds.
 *   2. "Buffer requests in deep unbounded queue": Buffers requests. Queue delay
 *      explodes to 30s; client timeouts fire at 1s, wasting downstream capacity on
 *      abandoned requests (0 of 200 runs meet SLA).
 *   3. "Keep pool bounded (16 threads) and shed excess (fast rejection / 503)":
 *      Limits queue to 4 slots and rejects excess immediately with 503. Admitted
 *      requests finish in 400ms; system throughput is protected in all 200 runs.
 *
 * Pseudocode lines are kept <= 27 characters.
 */

const CODE = [
  "receive request",
  "check queue depth",
  "dispatch or shed",
  "call downstream",
  "return response",
];

function simulate(
  seed: number,
  policy: "expand-pool" | "unbounded-queue" | "bounded-pool",
): RunResult {
  if (policy === "bounded-pool") {
    // 16 threads, bounded queue of 4. Excess shed via 503 fast rejection.
    // Admitted requests queue at most 4 * (400ms / 16) = 100ms.
    // Admitted latency holds at 400ms; SLA met in all runs.
    return { ok: true, value: 400 };
  }

  if (policy === "unbounded-queue") {
    // 16 threads, unbounded queue.
    // 80 req/s incoming traffic vs 40 req/s service capacity.
    // Queue accumulates backlog across the incident window, reaching 30s.
    // Client timeouts fire at 1s; SLA fails across all runs.
    return { ok: false, value: 30000 };
  }

  // policy === "expand-pool"
  // Thread pool expanded to 200.
  // 200 OS threads thrash CPU cores with context switches and trigger GC pauses.
  let a = (seed + 0x6d2b79f5) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;

  // In ~14% of seeds (quiet scheduling windows), latency reaches 1600ms;
  // in ~86% of seeds, heavy context thrashing and GC pauses push latency to 2400ms.
  const ok = rand < 0.14;
  const value = rand < 0.5 ? 1600 : 2400;
  return { ok, value };
}

function scenario(): ScenarioSpec {
  return {
    prompt:
      "Downstream API latency spikes from 10ms to 400ms. Inbound traffic keeps coming at 80 req/s. How do you configure your service?",
    parameter: "concurrency and queue policy",
    sampleSize: 200,
    choices: [
      {
        id: "expand-pool",
        label: "Expand thread pool to 200",
        readKey: "p99 latency (ms)",
        run: (seed) => simulate(seed, "expand-pool"),
      },
      {
        id: "unbounded-queue",
        label: "Buffer requests in deep unbounded queue",
        readKey: "p99 latency (ms)",
        run: (seed) => simulate(seed, "unbounded-queue"),
      },
      {
        id: "bounded-pool",
        label: "Keep pool bounded (16 threads) and shed excess (fast rejection / 503)",
        readKey: "p99 latency (ms)",
        run: (seed) => simulate(seed, "bounded-pool"),
      },
    ],
    verdict: (chosen, all) => {
      const others = all.filter((c) => c.id !== chosen.id);
      const summary = others
        .map((c) => `${c.outcome.value}/${c.outcome.outOf}`)
        .join(" and ");
      return `Your call held SLA in ${chosen.outcome.value}/${chosen.outcome.outOf} runs; other options held in ${summary}.`;
    },
  };
}

export const threadPoolSizingAlgo: AlgoDef<ScenarioState, ScenarioInput> = {
  id: "thread-pool-sizing",
  title: "thread pool vs bounded queue",
  code: CODE,
  counters: [
    { key: SCENARIO_COUNTERS.measured, label: "options measured" },
    { key: SCENARIO_COUNTERS.runs, label: "sub-runs" },
  ],
  size: scenarioSize(scenario()),
  generateInput: (_rng, size) => scenarioInput(scenario(), size),
  run: (input) => runScenario(input.spec, input.choiceIndex),
};
