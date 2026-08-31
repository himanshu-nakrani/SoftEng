import type { Program } from "@/engine/algo/concurrency";
import {
  runScenario,
  scenarioInput,
  scenarioSize,
  SCENARIO_COUNTERS,
  type ScenarioInput,
  type ScenarioSpec,
} from "@/engine/algo/scenario";
import type { AlgoDef } from "@/engine/algo/types";
import type { ScenarioState } from "@/engine/algo/views/scenario";

/**
 * The Mutex Call — archetype B (the branching-scenario producer, `algo/scenario.ts`).
 *
 * The lesson that opens track 11, and the one the G gate was run to justify. It
 * is a decision, not a quiz: your choice sets a REAL parameter of a real
 * `interleave()` run — whether the read-modify-write takes a mutex — and the
 * figure shows the MEASURED outcome of running it 200 times, not a paragraph
 * describing what would happen. The G spike (`scripts/spike-g-scenario.mts`)
 * proved the two choices' measured outcomes diverge before this shipped.
 *
 * MODELLING DECISION AND ITS LIMIT. The "system" is the smallest one that makes
 * the choice bite: two threads each incrementing a shared counter as read / add
 * / write. That is enough for a lost update to appear under some interleavings
 * and never under a lock, which is the entire decision. It deliberately does NOT
 * model the cost of the lock (contention, latency) — a later lesson does — so a
 * reader is not misled into thinking "always lock" is free. The point here is
 * only that the choice CHANGES A MEASURED OUTCOME, which a prose consequence
 * never could.
 */

function worker(id: string, guard: boolean): Program["threads"][number] {
  return {
    id,
    name: id,
    ops: [
      ...(guard ? [{ label: "lock", lock: { action: "acquire" as const, name: "m" } }] : []),
      { label: "read", effect: (m, l) => { l.tmp = m.counter; } },
      { label: "add", effect: (_m, l) => { l.tmp = l.tmp + 1; } },
      { label: "write", effect: (m, l) => { m.counter = l.tmp; } },
      ...(guard ? [{ label: "unlock", lock: { action: "release" as const, name: "m" } }] : []),
    ],
  };
}

const program = (guard: boolean) => (): Program => ({
  threads: [worker("T1", guard), worker("T2", guard)],
  memory: { counter: 0 },
  locks: guard ? ["m"] : [],
});

function scenario(): ScenarioSpec {
  return {
    prompt:
      "Metrics show a counter drifting low under load — two workers increment it, and sometimes an increment vanishes. Your call.",
    parameter: "mutex around the read-modify-write",
    sampleSize: 200,
    choices: [
      {
        id: "ship",
        label: "Leave it — the race window is tiny",
        program: program(false),
        ok: (m) => m.counter === 2,
        readKey: "counter",
      },
      {
        id: "lock",
        label: "Wrap the increment in a mutex",
        program: program(true),
        ok: (m) => m.counter === 2,
        readKey: "counter",
      },
    ],
    verdict: (chosen, all) => {
      const other = all.find((c) => c.id !== chosen.id)!;
      return `Your call kept the count correct in ${chosen.outcome.value}/${chosen.outcome.outOf} runs; the other option in ${other.outcome.value}/${other.outcome.outOf}.`;
    },
  };
}

export const theMutexCallAlgo: AlgoDef<ScenarioState, ScenarioInput> = {
  id: "the-mutex-call",
  title: "the mutex call",
  code: ["read counter", "add one", "write back", "your call"],
  counters: [
    { key: SCENARIO_COUNTERS.measured, label: "options measured" },
    { key: SCENARIO_COUNTERS.runs, label: "sub-runs" },
  ],
  size: scenarioSize(scenario()),
  generateInput: (_rng, size) => scenarioInput(scenario(), size),
  run: (input) => runScenario(input.spec, input.choiceIndex),
};
