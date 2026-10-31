import {
  SCHED_COUNTERS,
  runScheduler,
  type SchedConfig,
} from "@/engine/algo/scheduler";
import type { AlgoDef } from "@/engine/algo/types";
import type { SchedulerState } from "@/engine/algo/views/scheduler";

/**
 * Multi-Level Feedback Queues — archetype B (`engine: "steps"`).
 *
 * One quantum treats every burst the same. Three queues, with quanta 1/2/4,
 * guess which jobs are interactive by watching who burns a full slice: a full
 * slice demotes, finishing inside the slice does not. Q0 is always pulled
 * first, so a short burst that stays there runs ahead of a long burst that
 * sank.
 *
 * Both figures run LONG burst 8 and SHORT burst 1, arriving together at t=0.
 * The scheduler is not told those lengths. Measured with no aging: SHORT
 * finishes at t=2 and stays in Q0; LONG is demoted twice (Q0→Q1 at t=1,
 * Q1→Q2 at t=4) and finishes at t=9 in Q2. Demotions 2, preemptions 3 (the
 * extra is a Q2 slice with nowhere lower to go), switches 5, waits 1 and 1.
 * Cooperative FIFO on the same pair finishes SHORT at t=9 after waiting 8.
 *
 * THE CONTROL IS AGE-EVERY on the second figure. 0 never boosts (identical
 * to the first figure). 4 lifts LONG off Q2 at t=4 and again at t=8, so it
 * finishes in Q0 after 4 demotions. 8 still demotes twice but finishes in
 * Q0 — the boost catches the last leftover step. 9 through 12 never fire:
 * the run is 9 steps. Finish times do not move. Aging resets the queue, not
 * the amount of work.
 *
 * MODELLING NOTE, and its limits. One CPU, no I/O, nobody arrives late, so
 * this pair cannot starve: SHORT is done at t=2 and LONG gets the processor.
 * What aging prevents is a classification that never expires. A later
 * interactive arrival — which this model does not send — would skip a job
 * left in Q2. Deliberately absent: per-queue round-robin of more than these
 * two, and a rule that I/O wait promotes rather than a timer.
 */

const PAIR: SchedConfig["tasks"] = [
  { id: "LONG", burst: 8 },
  { id: "SHORT", burst: 1 },
];

const counters = [
  { key: SCHED_COUNTERS.steps, label: "cpu steps" },
  { key: SCHED_COUNTERS.switches, label: "switches" },
  { key: SCHED_COUNTERS.preemptions, label: "preemptions" },
  { key: SCHED_COUNTERS.demotions, label: "demotions" },
];

const CODE = [
  "dispatch highest Q",
  "run one step",
  "complete",
  "timer: demote",
];

export const mlfqAlgo: AlgoDef<SchedulerState, SchedConfig> = {
  id: "mlfq",
  title: "no aging",
  code: CODE,
  counters,
  generateInput: () => ({
    policy: "mlfq",
    quantum: 1,
    tasks: PAIR,
    ageEvery: 0,
  }),
  run: (input) => runScheduler(input),
};

export const mlfqAgingAlgo: AlgoDef<SchedulerState, SchedConfig> = {
  id: "mlfq-aging",
  title: "aging",
  code: [...CODE, "age: boost to Q0"],
  counters,
  size: { label: "age every", min: 0, max: 12, default: 4 },
  generateInput: (_rng, size) => ({
    policy: "mlfq",
    quantum: 1,
    tasks: PAIR,
    ageEvery: size,
  }),
  run: (input) => runScheduler(input),
};
