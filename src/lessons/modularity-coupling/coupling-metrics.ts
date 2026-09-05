import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Afferent & Efferent Coupling — archetype B (`engine: "steps"` in the registry).
 *
 * TODO: describe what this teaches, and WHY the figure shows it rather than
 * asserting it. Measure any number the prose will claim before writing it.
 *
 * Code lines must be <= 27 characters (the `algo integrity` check enforces it).
 */

const CODE = ["step one", "step two"];

function program(): Program {
  return {
    memory: { counter: 0 },
    threads: [
      {
        id: "T1",
        name: "T1",
        ops: [
          {
            label: "counter + 1",
            codeLine: 0,
            effect: (memory) => {
              memory.counter += 1;
            },
          },
        ],
      },
    ],
  };
}

export const couplingMetricsAlgo: AlgoDef<ConcurrencyState, Program> = {
  // The id must start with the lesson slug — check-curriculum enforces it.
  id: "coupling-metrics",
  title: "afferent & efferent coupling",
  code: CODE,
  counters: [{ key: CONCURRENCY_COUNTERS.steps, label: "ops executed" }],
  generateInput: () => program(),
  run: (input, rng) => interleave(input, rng),
};
