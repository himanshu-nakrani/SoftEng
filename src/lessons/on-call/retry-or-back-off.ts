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
 * Lock Ordering — archetype B (the branching-scenario producer).
 *
 * The second track-11 scenario, and the one that shows the archetype is not a
 * one-outcome trick: here a choice sets the ORDER two threads take their locks,
 * and the measured outcome is a genuine DISTRIBUTION — same order never
 * deadlocks, opposite orders deadlock under many interleavings. The reader is
 * choosing between a policy that always completes and one that gambles, and the
 * figure runs the real `interleave()` 200 times per option to show the odds
 * rather than assert them.
 *
 * MODELLING DECISION AND ITS LIMIT. Two threads, two locks, the smallest system
 * where a lock-ordering deadlock exists at all. The scheduler is the seeded one
 * archetype C already ships, so a deadlock here is the same recorded outcome the
 * concurrency lessons show, counted across seeds. It does NOT model lock
 * timeouts or deadlock detection — those are the fixes a later lesson would
 * weigh — because the decision here is only whether a consistent global lock
 * ORDER is worth imposing, and the measured deadlock rate is the argument.
 *
 * The lesson keeps the file slug `retry-or-back-off` for its route; the subject
 * is lock ordering, framed as the same kind of 2am judgement call.
 */

function thread(id: string, first: string, second: string): Program["threads"][number] {
  return {
    id,
    name: id,
    ops: [
      { label: `lock ${first}`, lock: { action: "acquire", name: first } },
      { label: `lock ${second}`, lock: { action: "acquire", name: second } },
      { label: "work", effect: (m) => { m.done = (m.done ?? 0) + 1; } },
      { label: `free ${second}`, lock: { action: "release", name: second } },
      { label: `free ${first}`, lock: { action: "release", name: first } },
    ],
  };
}

const sameOrder = (): Program => ({
  threads: [thread("T1", "A", "B"), thread("T2", "A", "B")],
  memory: { done: 0 },
  locks: ["A", "B"],
});
const oppositeOrder = (): Program => ({
  threads: [thread("T1", "A", "B"), thread("T2", "B", "A")],
  memory: { done: 0 },
  locks: ["A", "B"],
});

function scenario(): ScenarioSpec {
  return {
    prompt:
      "Two services each need locks A and B before doing work. One team acquires them A-then-B, another wants B-then-A. Do you enforce one order?",
    parameter: "global lock acquisition order",
    sampleSize: 200,
    choices: [
      {
        id: "same",
        label: "Enforce one order — everyone takes A then B",
        program: sameOrder,
        ok: (m) => m.done === 2,
        readKey: "done",
      },
      {
        id: "opposite",
        label: "Let each team take locks in its own order",
        program: oppositeOrder,
        ok: (m) => m.done === 2,
        readKey: "done",
      },
    ],
    verdict: (chosen, all) => {
      const other = all.find((c) => c.id !== chosen.id)!;
      return `Your call completed cleanly in ${chosen.outcome.value}/${chosen.outcome.outOf} runs; the other in ${other.outcome.value}/${other.outcome.outOf} — the rest deadlocked.`;
    },
  };
}

export const retryOrBackOffAlgo: AlgoDef<ScenarioState, ScenarioInput> = {
  id: "retry-or-back-off",
  title: "lock ordering",
  code: ["lock first", "lock second", "do work", "your call"],
  counters: [
    { key: SCENARIO_COUNTERS.measured, label: "options measured" },
    { key: SCENARIO_COUNTERS.runs, label: "sub-runs" },
  ],
  size: scenarioSize(scenario()),
  generateInput: (_rng, size) => scenarioInput(scenario(), size),
  run: (input) => runScenario(input.spec, input.choiceIndex),
};
