import { buildAlgoSteps } from "@/engine/algo/build";
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
import { ScenarioView } from "@/engine/algo/views/ScenarioView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

/** The counter scenario: a choice sets whether the increment takes a mutex. */
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

function counterScenario(): ScenarioSpec {
  return {
    prompt: "A shared counter is double-incremented under load. How do you fix it?",
    parameter: "mutex around the read-modify-write",
    sampleSize: 200,
    choices: [
      { id: "ship", label: "Ship it — the window is tiny", program: program(false), ok: (m) => m.counter === 2, readKey: "counter" },
      { id: "lock", label: "Wrap it in a mutex", program: program(true), ok: (m) => m.counter === 2, readKey: "counter" },
    ],
    verdict: (chosen, all) => {
      const other = all.find((c) => c.id !== chosen.id)!;
      return `Your call held in ${chosen.outcome.value}/${chosen.outcome.outOf}; the other in ${other.outcome.value}/${other.outcome.outOf}.`;
    },
  };
}

const last = (steps: { state: ScenarioState }[]) => steps[steps.length - 1].state;

describe("runScenario", () => {
  it("is deterministic and opens with the situation and no choice", () => {
    expect(runScenario(counterScenario(), 0)).toEqual(runScenario(counterScenario(), 0));
    const first = runScenario(counterScenario(), 0)[0].state;
    expect(first.chosenId).toBeNull();
    expect(first.verdict).toBeUndefined();
    expect(first.options).toHaveLength(2);
  });

  it("HARD GATE: a choice mutates a real run's outcome, so the numbers diverge by choice", () => {
    // This is the whole reason the archetype ships. The two options are the SAME
    // program but for a lock parameter, and the MEASURED pass counts differ — a
    // quiz with prose consequences could not produce this.
    const ship = last(runScenario(counterScenario(), 0));
    const lock = last(runScenario(counterScenario(), 1));

    const shipChoice = ship.options.find((o) => o.chosen)!;
    const lockChoice = lock.options.find((o) => o.chosen)!;
    expect(shipChoice.id).toBe("ship");
    expect(lockChoice.id).toBe("lock");

    // Locking is always correct; shipping is not — measured, not asserted.
    expect(lockChoice.outcome.value).toBe(200);
    expect(shipChoice.outcome.value).toBeLessThan(200);
    expect(shipChoice.outcome.value).toBeGreaterThan(0);
    // The distributions genuinely differ.
    expect(shipChoice.outcome.value).not.toBe(lockChoice.outcome.value);
  });

  it("measures every option, not just the chosen one, so the comparison is real", () => {
    const state = last(runScenario(counterScenario(), 0));
    // The unchosen 'lock' option still carries its measured 200/200.
    const lock = state.options.find((o) => o.id === "lock")!;
    expect(lock.chosen).toBe(false);
    expect(lock.outcome.value).toBe(200);
  });

  it("clamps a slider position past the last option", () => {
    const state = last(runScenario(counterScenario(), 99));
    expect(state.chosenId).toBe("lock");
  });

  it("counts the honest cost: sampleSize sub-runs per option", () => {
    const steps = runScenario(counterScenario(), 0);
    const totals = steps[steps.length - 1].counters;
    expect(totals[SCENARIO_COUNTERS.runs]).toBe(200 * 2);
    expect(totals[SCENARIO_COUNTERS.measured]).toBe(2);
  });

  it("keeps counters monotonic and never aliases a frame", () => {
    const steps = runScenario(counterScenario(), 1);
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    const totals: Record<string, number> = {};
    for (const step of steps) {
      for (const [key, value] of Object.entries(step.counters)) {
        expect(value).toBeGreaterThanOrEqual(totals[key] ?? 0);
        totals[key] = value;
      }
    }
  });
});

/** The wiring tests drive `buildAlgoSteps`, with the slider position as size. */
const def: AlgoDef<ScenarioState, ScenarioInput> = {
  id: "double-increment-fix",
  title: "the counter fix",
  code: ["read", "add", "write", "choose"],
  counters: [
    { key: SCENARIO_COUNTERS.measured, label: "options measured" },
    { key: SCENARIO_COUNTERS.runs, label: "sub-runs" },
  ],
  size: scenarioSize(counterScenario()),
  generateInput: (_rng, size) => scenarioInput(counterScenario(), size),
  run: (input) => runScenario(input.spec, input.choiceIndex),
};

describe("branching scenario rides on archetype B", () => {
  it("threads the size slider through as the choice", () => {
    // size 0 chooses the first option, size 1 the second — the slider IS the
    // choice, exactly as WAL uses size as the crash point.
    expect(last(buildAlgoSteps(def, 0, 42)).chosenId).toBe("ship");
    expect(last(buildAlgoSteps(def, 1, 42)).chosenId).toBe("lock");
  });

  it("is reproducible per (size, seed)", () => {
    expect(buildAlgoSteps(def, 0, 42)).toEqual(buildAlgoSteps(def, 0, 7));
  });

  it("has a coherent size range: one position per option", () => {
    expect(def.size).toEqual({ label: "your call", min: 0, max: 1, default: 0 });
  });

  it("satisfies the view contract the figure requires", () => {
    const view: ComponentType<{ state: ScenarioState }> = ScenarioView;
    expect(view).toBe(ScenarioView);
  });
});
