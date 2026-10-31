import { LOOP_COUNTERS, runEventLoop } from "@/engine/algo/eventloop";
import type { AlgoDef } from "@/engine/algo/types";
import type { EventLoopState } from "@/engine/algo/views/eventloop";

/**
 * The Event Loop — archetype B (`engine: "steps"`).
 *
 * One sync turn queues work; then micros drain fully (including micros
 * queued by micros); then one macro. THE CONTROL IS WHICH SCRIPT. 0–2,
 * default 0:
 *
 *   0  log 1, queue micro 2, queue macro 3, log 4     → 1,4,2,3
 *      (sync 2, micro 1, macro 1)
 *   1  log 1, two micros 2 and 3, macro 4, log 5      → 1,5,2,3,4
 *      (sync 2, micro 2, macro 1)
 *   2  log 1, micro A queues micro B, macro 2, log 3  → 1,3,A,B,2
 *      (sync 2, micro 2, macro 1)
 *
 * Two figures: the slider, and a nested-only run of script 2 with no
 * size control. Seed is ignored: a drain order is not a scheduler.
 *
 * MODELLING NOTE, and its limits. One turn, then one drain, then one
 * timer. Deliberately absent: rAF, nextTick vs then, multiple macros
 * with micros between. Those change how many turns you see. They do
 * not change the argument: sync, then every micro, then one macro.
 */

const CODE = ["console.log", "queueMicrotask", "setTimeout"];

const counters = [
  { key: LOOP_COUNTERS.sync, label: "sync" },
  { key: LOOP_COUNTERS.micro, label: "micro" },
  { key: LOOP_COUNTERS.macro, label: "macro" },
];

/** Slider 0–2, default 0. Script 0 is 1,4,2,3. */
export const eventLoopAlgo: AlgoDef<EventLoopState, number> = {
  id: "event-loop",
  title: "one micro, one macro",
  code: CODE,
  counters,
  size: { label: "script", min: 0, max: 2, default: 0 },
  generateInput: (_rng, size) => size,
  run: (size) => runEventLoop(size),
};

/** Script 2 only: a micro queues a micro. No slider. */
export const eventLoopNestedAlgo: AlgoDef<EventLoopState, number> = {
  id: "event-loop-nested",
  title: "a micro queues a micro",
  code: CODE,
  counters,
  generateInput: () => 2,
  run: () => runEventLoop(2),
};
