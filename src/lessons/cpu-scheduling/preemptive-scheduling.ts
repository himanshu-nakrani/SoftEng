import {
  SCHED_COUNTERS,
  runScheduler,
  type SchedConfig,
} from "@/engine/algo/scheduler";
import type { AlgoDef } from "@/engine/algo/types";
import type { SchedulerState } from "@/engine/algo/views/scheduler";

/**
 * Preemptive vs Cooperative Scheduling — archetype B (`engine: "steps"`).
 *
 * A long burst at the head of a cooperative FIFO queue is a convoy: every
 * short burst behind it waits the whole thing out. A timer changes the rule.
 * After at most `quantum` steps, if anyone else is ready, the occupant is
 * requeued. The same three tasks then finish in a different order, and the
 * short ones wait less.
 *
 * Both figures run A burst 8, B burst 2, C burst 2, all arriving at t=0.
 * Waiting time is completion minus burst. Measured: cooperative waits are
 * A=0, B=8, C=10 with zero preemptions; preemptive quantum 1 waits are A=4,
 * B=3, C=4 with four preemptions; quantum 2 lets B wait 2; quantum 8 is
 * identical to cooperative (B waits 8) because the timer never fires before
 * A is done.
 *
 * THE CONTROL IS THE QUANTUM on the preemptive figure. 1 / 2 / 8 are the
 * interesting stops: four preemptions and B waiting 3; B running to
 * completion on first dispatch; and the convoy returning. Cooperative has
 * no slider — the policy does not have a slice to size.
 *
 * MODELLING NOTE, and its limits. One CPU, FIFO among ready tasks, fixed
 * bursts, no I/O, nobody arrives late. Deliberately absent: SJF, MLFQ,
 * blocking. SJF would also let B in, but only by knowing the bursts. A
 * timer does not need to know.
 */

const CONVOY: SchedConfig["tasks"] = [
  { id: "A", burst: 8 },
  { id: "B", burst: 2 },
  { id: "C", burst: 2 },
];

const counters = [
  { key: SCHED_COUNTERS.steps, label: "cpu steps" },
  { key: SCHED_COUNTERS.switches, label: "switches" },
  { key: SCHED_COUNTERS.preemptions, label: "preemptions" },
  { key: SCHED_COUNTERS.completions, label: "completions" },
];

export const preemptiveSchedulingAlgo: AlgoDef<SchedulerState, SchedConfig> = {
  id: "preemptive-scheduling",
  title: "cooperative",
  code: ["dispatch head", "run one step", "complete"],
  counters,
  generateInput: () => ({
    policy: "cooperative",
    quantum: 1,
    tasks: CONVOY,
  }),
  run: (input) => runScheduler(input),
};

export const preemptiveSchedulingPreemptAlgo: AlgoDef<
  SchedulerState,
  SchedConfig
> = {
  id: "preemptive-scheduling-preempt",
  title: "preemptive",
  code: ["dispatch head", "run one step", "complete", "timer: requeue"],
  counters,
  size: { label: "quantum", min: 1, max: 8, default: 1 },
  generateInput: (_rng, size) => ({
    policy: "preemptive",
    quantum: size,
    tasks: CONVOY,
  }),
  run: (input) => runScheduler(input),
};
