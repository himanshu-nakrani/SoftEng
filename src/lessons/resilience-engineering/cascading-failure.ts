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
import { mulberry32 } from "@/engine/rng";

/**
 * Cascading Failure and Thundering Herd — Archetype G (scenario producer over ScenarioState).
 *
 * Models a catastrophic cache tier failure under 10k QPS incoming traffic.
 * When a hot cache node goes down, requests that normally enjoy a 99% cache hit
 * rate miss simultaneously, thundering down to the primary relational database.
 *
 * Three mitigation policies are evaluated across 200 incident seeds:
 * - Choice A ("Direct DB passthrough"):
 *   All 10k QPS bypasses the cache directly to the DB. The database connection
 *   pool (100 connections) is instantly saturated, queries queue and timeout,
 *   cascading HTTP 500s across downstream services. Holds SLA in 0/200 runs.
 * - Choice B ("Aggressive retries without backoff"):
 *   Clients receive 500 errors and retry immediately without exponential backoff
 *   or jitter. Traffic multiplies 3x to 30k QPS, triggering thread starvation,
 *   connection drops, and a total system collapse. Holds SLA in 0/200 runs.
 * - Choice C ("Singleflight request coalescing + circuit breaker"):
 *   Concurrent requests for identical keys are collapsed via a singleflight group
 *   into a single in-flight DB query. The circuit breaker prevents upstream
 *   saturation. DB CPU stays well below 40% (32% to 38%), holding SLA in all
 *   200/200 runs.
 *
 * All pseudocode lines in CODE are <= 27 characters.
 */

const CODE = [
  "receive 10k QPS request",
  "check cache node",
  "coalesce inflight key",
  "query db or wait leader",
  "populate cache and return",
];

export type CascadingFailurePolicy =
  | "direct-db"
  | "aggressive-retries"
  | "singleflight";

export function simulateCascadingFailure(
  seed: number,
  policy: CascadingFailurePolicy,
): RunResult {
  if (policy === "direct-db") {
    // 10k QPS hits primary database without cache.
    // Database connection pool (100 connections) is exhausted immediately.
    // Queries queue until connection timeout, cascading 500s downstream.
    // CPU pegged at 100%; holds SLA in 0 of 200 runs.
    return { ok: false, value: 100 };
  }

  if (policy === "aggressive-retries") {
    // Downstream clients retry 500s immediately without backoff.
    // Inbound traffic multiplies 3x to 30k QPS, drowning connection backlogs.
    // System crashes completely; holds SLA in 0 of 200 runs.
    return { ok: false, value: 100 };
  }

  // policy === "singleflight"
  // Singleflight deduplicates concurrent in-flight requests for identical keys.
  // Only 1 DB query executes per key; other concurrent callers wait and share the result.
  // Database CPU stays under 40% (ranging 32% to 38%); SLA held in all 200 runs.
  const rng = mulberry32(seed);
  const value = rng() < 0.5 ? 32 : 38;
  return { ok: true, value };
}

function scenario(): ScenarioSpec {
  return {
    prompt:
      "A primary cache node crashes under 10k QPS, exposing cold keys to the database. How do you protect the system from a thundering herd?",
    parameter: "stampede mitigation policy",
    sampleSize: 200,
    choices: [
      {
        id: "direct-db",
        label: "Direct DB passthrough",
        readKey: "db cpu (%)",
        run: (seed) => simulateCascadingFailure(seed, "direct-db"),
      },
      {
        id: "aggressive-retries",
        label: "Aggressive retries without backoff",
        readKey: "db cpu (%)",
        run: (seed) => simulateCascadingFailure(seed, "aggressive-retries"),
      },
      {
        id: "singleflight",
        label: "Singleflight request coalescing + circuit breaker",
        readKey: "db cpu (%)",
        run: (seed) => simulateCascadingFailure(seed, "singleflight"),
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

export const cascadingFailureAlgo: AlgoDef<ScenarioState, ScenarioInput> = {
  id: "cascading-failure",
  title: "cascading failure and thundering herd",
  code: CODE,
  counters: [
    { key: SCENARIO_COUNTERS.measured, label: "options measured" },
    { key: SCENARIO_COUNTERS.runs, label: "sub-runs" },
  ],
  size: scenarioSize(scenario()),
  generateInput: (_rng, size) => scenarioInput(scenario(), size),
  run: (input) => runScenario(input.spec, input.choiceIndex),
};
