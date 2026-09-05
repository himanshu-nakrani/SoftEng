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
 * Circuit Breaker Hysteresis — Archetype G (scenario producer over `ScenarioState`).
 *
 * Simulates a flapping downstream microservice dependency during an incident.
 * When the dependency restarts, it enters a fragile warm-up state where it can
 * handle canary/probe traffic (~5%), but crashes immediately if hit with full
 * 100% traffic (thundering herd / connection stampede).
 *
 * Three recovery policies are evaluated across 200 seeded incident runs:
 * - Choice A (Immediate full close): Reopens immediately on a single successful
 *   health check ping. Triggers a thundering herd crash every time the fragile
 *   service is hit, trapping the system in an unending flapping loop (0/200).
 * - Choice B (Fixed 60s cooldown): Waits out a rigid 60-second timeout. Avoids
 *   the flapping loop, but causes high artificial downtime whenever the dependency
 *   recovers earlier (meeting SLA in only 100/200 runs).
 * - Choice C (Half-open with exponential backoff & rate-ramping): Probes with 5%
 *   traffic, detects health smoothly, and ramps traffic gradually (5% -> 25% ->
 *   50% -> 100%) to allow caches and connection pools to warm up cleanly (200/200).
 */

type Policy = "immediate" | "cooldown" | "half-open";

export function simulateCircuitBreaker(seed: number, policy: Policy): RunResult {
  const rng = mulberry32(seed);
  // Dependency restart delay between 5 and 55 seconds
  const initialDown = 5 + Math.floor(rng() * 51);
  let depState: "down" | "warming" | "healthy" = "down";
  let depTimer = initialDown;
  let warmTicks = 0;
  let flaps = 0;

  let cbState: "open" | "half-open" | "closed" = "open";
  let cbTimer = policy === "cooldown" ? 60 : 2;
  let backoff = 2;
  let halfOpenSuccessTicks = 0;
  let traffic = 0;

  let readyAt = -1;
  let recoveredAt = -1;

  for (let t = 0; t <= 120; t++) {
    // 1. Circuit breaker action
    if (policy === "immediate") {
      if (cbState === "open") {
        traffic = 0;
        cbTimer--;
        if (cbTimer <= 0) {
          if (depState !== "down") {
            // Immediate full close upon 1 successful health check
            cbState = "closed";
            traffic = 1.0;
          } else {
            cbTimer = 2;
          }
        }
      } else if (cbState === "closed") {
        traffic = 1.0;
      }
    } else if (policy === "cooldown") {
      if (cbState === "open") {
        traffic = 0;
        cbTimer--;
        if (cbTimer <= 0) {
          cbState = "closed";
          traffic = 1.0;
        }
      } else if (cbState === "closed") {
        traffic = 1.0;
      }
    } else if (policy === "half-open") {
      if (cbState === "open") {
        traffic = 0;
        cbTimer--;
        if (cbTimer <= 0) {
          cbState = "half-open";
          halfOpenSuccessTicks = 0;
          traffic = 0.05;
        }
      } else if (cbState === "half-open") {
        if (halfOpenSuccessTicks < 3) {
          traffic = 0.05;
        } else if (halfOpenSuccessTicks === 3) {
          traffic = 0.25;
        } else if (halfOpenSuccessTicks === 4) {
          traffic = 0.50;
        } else {
          cbState = "closed";
          traffic = 1.0;
        }
      } else if (cbState === "closed") {
        traffic = 1.0;
      }
    }

    // 2. Dependency updates
    if (depState === "down") {
      depTimer--;
      if (depTimer <= 0) {
        depState = "warming";
        warmTicks = 0;
        if (readyAt === -1) readyAt = t;
      }
    } else if (depState === "warming") {
      if (traffic > 0.10 && warmTicks < 2) {
        // Crashes under high traffic
        depState = "down";
        depTimer = 3 + Math.floor(rng() * 3);
        flaps++;
        warmTicks = 0;
        if (cbState === "closed") {
          cbState = "open";
          cbTimer = policy === "cooldown" ? 60 : 2;
        }
      } else {
        if (traffic > 0) warmTicks++;
        if (traffic === 0) warmTicks += 0.25; // idle self-warm
        if (warmTicks >= 2) depState = "healthy";
      }
    }

    // 3. Half-open probe result
    if (cbState === "half-open") {
      if (depState === "down") {
        cbState = "open";
        backoff = Math.min(8, backoff * 2);
        cbTimer = backoff;
        halfOpenSuccessTicks = 0;
        traffic = 0;
      } else {
        halfOpenSuccessTicks++;
      }
    }

    if (cbState === "closed" && depState === "healthy" && recoveredAt === -1) {
      recoveredAt = t;
    }
  }

  const artificialDowntime = (readyAt !== -1 && recoveredAt !== -1)
    ? Math.max(0, recoveredAt - readyAt)
    : 120;

  // Recovery SLO: clean recovery without flapping and with <= 34s artificial downtime
  const ok = flaps === 0 && recoveredAt !== -1 && artificialDowntime <= 34;
  return { ok, value: ok ? 1 : 0 };
}

function scenario(): ScenarioSpec {
  return {
    prompt:
      "A critical microservice dependency flaps under full traffic — it recovers after a few seconds of light load, but crashes under a thundering herd. Your call on circuit breaker recovery.",
    parameter: "recovery probing and transition policy",
    sampleSize: 200,
    choices: [
      {
        id: "immediate",
        label: "Immediate full close upon 1 successful health check",
        readKey: "recovered",
        run: (seed) => simulateCircuitBreaker(seed, "immediate"),
      },
      {
        id: "cooldown",
        label: "Fixed 60-second cooldown timeout",
        readKey: "recovered",
        run: (seed) => simulateCircuitBreaker(seed, "cooldown"),
      },
      {
        id: "half-open",
        label: "Half-Open probing with exponential backoff & rate-ramping",
        readKey: "recovered",
        run: (seed) => simulateCircuitBreaker(seed, "half-open"),
      },
    ],
    verdict: (chosen, all) => {
      const others = all.filter((c) => c.id !== chosen.id);
      return `Your call recovered cleanly in ${chosen.outcome.value}/${chosen.outcome.outOf} runs; the other options achieved ${others.map((o) => `${o.outcome.value}/${o.outcome.outOf}`).join(" and ")}.`;
    },
  };
}

export const circuitBreakerHysteresisAlgo: AlgoDef<ScenarioState, ScenarioInput> = {
  id: "circuit-breaker-hysteresis",
  title: "circuit breaker hysteresis",
  code: [
    "trip open on failures",
    "half-open: probe at 5%",
    "back off if probe fails",
    "ramp traffic if healthy",
    "close when stable",
  ],
  counters: [
    { key: SCENARIO_COUNTERS.measured, label: "options measured" },
    { key: SCENARIO_COUNTERS.runs, label: "sub-runs" },
  ],
  size: scenarioSize(scenario()),
  generateInput: (_rng, size) => scenarioInput(scenario(), size),
  run: (input) => runScenario(input.spec, input.choiceIndex),
};
