import {
  PRIO_COUNTERS,
  runPriority,
  type PrioConfig,
} from "@/engine/algo/priority";
import type { AlgoDef } from "@/engine/algo/types";
import type { PriorityState } from "@/engine/algo/views/priority";

/**
 * Priority Inversion — archetype B (`engine: "steps"`).
 *
 * Three tasks, one lock, one CPU. Low acquires the lock for its whole burst.
 * High needs that lock. Medium does not. A priority scheduler that does not
 * donate lets Medium run over Low, so High waits for both — inversion. With
 * inheritance, Low runs at High's priority until it releases, and Medium waits.
 *
 * Both figures run the Pathfinder shape: L burst 5 prio 0 arrive 0 (holder),
 * H burst 2 prio 2 arrive 1 (waiter), M burst 4 prio 1 arrive 2 (other).
 * Waiting time is completion minus burst. Measured: without inheritance
 * H waits 9, L waits 4, M waits 2, inversions 1, preemptions 1; with
 * inheritance H waits 5, L waits 0, M waits 7, inversions 1, boosts 1,
 * preemptions 0. Both do 11 cpu steps. High's extra 4 of waiting without
 * inheritance is Medium's whole burst.
 *
 * THE CONTRAST IS TWO FIGURES, not a slider. Inheritance is a policy, and
 * every arrival is part of the script — a size control would reshuffle the
 * shape instead of toggling the rule.
 *
 * MODELLING NOTE, and its limits. One CPU, one lock, Low holds it for the
 * whole burst. Deliberately absent: nested locks, a priority ceiling, a
 * timeout. Those change how you bound the wait. They do not change the
 * argument: a scheduler that does not donate lets Medium run over the lock
 * holder, and High waits for both.
 */

const PATHFINDER: PrioConfig["tasks"] = [
  { id: "L", burst: 5, priority: 0, arrive: 0, role: "holder" },
  { id: "H", burst: 2, priority: 2, arrive: 1, role: "waiter" },
  { id: "M", burst: 4, priority: 1, arrive: 2, role: "other" },
];

const CODE = [
  "arrive or dispatch",
  "block on lock",
  "preempt if higher",
  "run one step",
  "complete",
];

const counters = [
  { key: PRIO_COUNTERS.steps, label: "cpu steps" },
  { key: PRIO_COUNTERS.inversions, label: "inversions" },
  { key: PRIO_COUNTERS.boosts, label: "boosts" },
  { key: PRIO_COUNTERS.preemptions, label: "preemptions" },
];

export const priorityInversionAlgo: AlgoDef<PriorityState, PrioConfig> = {
  id: "priority-inversion",
  title: "no inheritance",
  code: CODE,
  counters,
  generateInput: () => ({ inherit: false, tasks: PATHFINDER }),
  run: (input) => runPriority(input),
};

export const priorityInversionInheritAlgo: AlgoDef<PriorityState, PrioConfig> = {
  id: "priority-inversion-inherit",
  title: "inheritance",
  code: CODE,
  counters,
  generateInput: () => ({ inherit: true, tasks: PATHFINDER }),
  run: (input) => runPriority(input),
};
