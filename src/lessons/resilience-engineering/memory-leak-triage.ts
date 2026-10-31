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
 * Memory Leak and Buffer Bloat Triage — Archetype G (branching-scenario producer over \`ScenarioState\`).
 *
 * Under production load with uncollected event listeners and retention of unbounded
 * request buffers, pod heap usage steadily climbs to 94%, threatening cgroup OOM-kill.
 *
 * Three triage actions are evaluated across 200 seeded incident runs:
 * - Choice A (Restart all service pods at once): Terminates all pods simultaneously.
 *   Drops 350 to 500 in-flight requests and triggers a thundering cold start (0/200).
 * - Choice B (Wait for Kubernetes OOM-kill): Kernel cgroup killer sends uncatchable
 *   SIGKILL at 100% memory limit. TCP sockets reset mid-flight, surfacing 180 to 260
 *   502 Bad Gateway errors to callers (0/200).
 * - Choice C (Rolling drain, capture heap dump, and restart): Cordons the pod from
 *   the Service endpoints, captures live diagnostic heap snapshot, gracefully drains
 *   in-flight requests, and replaces pods rolling one by one (200/200).
 */

function simulate(
  choiceId: "restart-all" | "wait-oom" | "rolling-drain",
  seed: number,
): RunResult {
  const rng = mulberry32(seed);

  if (choiceId === "restart-all") {
    // Simultaneous restart drops all in-flight connections immediately.
    // Thundering herd on cold start drops 350 to 500 requests across seeds.
    const dropped = rng() < 0.5 ? 350 : 500;
    return {
      ok: false,
      value: dropped,
    };
  }

  if (choiceId === "wait-oom") {
    // Ungraceful SIGKILL from Linux kernel cgroup OOM killer.
    // Active connections are abruptly reset, causing 180 to 260 client 502 errors.
    const dropped = rng() < 0.5 ? 180 : 260;
    return {
      ok: false,
      value: dropped,
    };
  }

  // Rolling drain:
  // 1. Cordon pod from Service endpoints / target group
  // 2. Capture diagnostic heap dump / CPU profile while process is alive
  // 3. Graceful connection draining allows in-flight requests to complete
  // 4. Rolling restart replaces pods with 0 dropped requests
  return {
    ok: true,
    value: 0,
  };
}

function scenario(): ScenarioSpec {
  return {
    prompt:
      "Pod heap memory climbs to 94% under uncollected event listeners and buffer retention, nearing container OOM-kill. Your call on triage action.",
    parameter: "triage action and drain sequence",
    sampleSize: 200,
    choices: [
      {
        id: "restart-all",
        label: "Restart all service pods at once",
        readKey: "dropped requests",
        run: (seed) => simulate("restart-all", seed),
      },
      {
        id: "wait-oom",
        label: "Wait for Kubernetes OOM-kill",
        readKey: "dropped requests",
        run: (seed) => simulate("wait-oom", seed),
      },
      {
        id: "rolling-drain",
        label: "Rolling drain, capture heap dump, and restart",
        readKey: "dropped requests",
        run: (seed) => simulate("rolling-drain", seed),
      },
    ],
    verdict: (chosen, all) => {
      const others = all.filter((c) => c.id !== chosen.id);
      return `Your call held SLA in ${chosen.outcome.value}/${chosen.outcome.outOf} runs; alternatives held in ${others.map((o) => `${o.outcome.value}/${o.outcome.outOf}`).join(" and ")}.`;
    },
  };
}

export const memoryLeakTriageAlgo: AlgoDef<ScenarioState, ScenarioInput> = {
  id: "memory-leak-triage",
  title: "memory leak and buffer bloat",
  code: [
    "monitor heap watermark",
    "cordon pod from traffic",
    "capture live heap dump",
    "drain in-flight requests",
    "restart drained pod",
  ],
  counters: [
    { key: SCENARIO_COUNTERS.measured, label: "options measured" },
    { key: SCENARIO_COUNTERS.runs, label: "sub-runs" },
  ],
  size: scenarioSize(scenario()),
  generateInput: (_rng, size) => scenarioInput(scenario(), size),
  run: (input) => runScenario(input.spec, input.choiceIndex),
};
