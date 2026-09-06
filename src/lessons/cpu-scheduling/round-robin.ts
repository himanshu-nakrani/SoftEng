import {
  SCHED_COUNTERS,
  runScheduler,
  type SchedConfig,
} from "@/engine/algo/scheduler";
import type { AlgoDef } from "@/engine/algo/types";
import type { SchedulerState } from "@/engine/algo/views/scheduler";

/**
 * Round-Robin and Time Slices — archetype B (`engine: "steps"`).
 *
 * The previous lesson showed that a 1-step quantum cuts B's wait from 8 to 3.
 * That run charged nothing to switch. This one charges 1 wall step on every
 * dispatch after the first, so extra preemptions are measured waste. The same
 * convoy then finishes on a longer clock, and the short slice that used to
 * help B now hurts it.
 *
 * One figure, A burst 8, B burst 2, C burst 2, all arriving at t=0,
 * `switchCost: 1`. Waiting time is completion minus burst. Wall time is CPU
 * steps plus waste. Measured: quantum 1 wastes 6, B waits 7, time 18,
 * switches 7, steps 12; quantum 2 wastes 3, B waits 3, time 15, switches 4;
 * quantum 8 wastes 2, B waits 9, time 14, switches 3. Cpu steps stay 12.
 * Without switchCost, quantum 1 B wait is 3.
 *
 * THE CONTROL IS THE QUANTUM. 1 / 2 / 8 are the interesting stops: many
 * switches eating the clock; a slice that matches B's burst; and the convoy
 * plus two dispatch charges. 2 through 7 all waste 3 — only the first slice
 * of A grows, so B waits longer while the extra switches stay put.
 *
 * MODELLING NOTE, and its limits. One CPU, FIFO among ready tasks, fixed
 * bursts, no I/O, nobody arrives late. A real kernel's switch is not always
 * 1. The argument does not need it to be: once a dispatch costs something, a
 * 1-step quantum is a policy you can measure, not a kindness you can assume.
 */

const CONVOY: SchedConfig["tasks"] = [
  { id: "A", burst: 8 },
  { id: "B", burst: 2 },
  { id: "C", burst: 2 },
];

export const roundRobinAlgo: AlgoDef<SchedulerState, SchedConfig> = {
  id: "round-robin",
  title: "round-robin",
  code: ["dispatch head", "run one step", "complete", "timer: requeue"],
  counters: [
    { key: SCHED_COUNTERS.steps, label: "cpu steps" },
    { key: SCHED_COUNTERS.switches, label: "switches" },
    { key: SCHED_COUNTERS.preemptions, label: "preemptions" },
    { key: SCHED_COUNTERS.waste, label: "waste" },
    { key: SCHED_COUNTERS.completions, label: "completions" },
  ],
  size: { label: "quantum", min: 1, max: 8, default: 1 },
  generateInput: (_rng, size) => ({
    policy: "preemptive",
    quantum: size,
    switchCost: 1,
    tasks: CONVOY,
  }),
  run: (input) => runScheduler(input),
};
