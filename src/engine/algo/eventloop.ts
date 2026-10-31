import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { EventLoopState, LoopJob } from "./views/eventloop";

/**
 * A toy event loop. One sync turn queues work; then micros drain fully
 * (including micros queued by micros); then one macro.
 *
 *   0: log 1, queue micro 2, queue macro 3, log 4     → 1,4,2,3
 *   1: log 1, two micros 2 and 3, macro 4, log 5      → 1,5,2,3,4
 *   2: log 1, micro A queues micro B, macro 2, log 3  → 1,3,A,B,2
 *
 * Deliberately absent: rAF, nextTick vs then, multiple macros with
 * micros between. The argument is the drain order.
 */

export const LOOP_COUNTERS = {
  sync: "sync",
  micro: "micro",
  macro: "macro",
} as const;

function cloneJobs(jobs: LoopJob[]): LoopJob[] {
  return jobs.map((j) => ({ ...j }));
}

export function runEventLoop(size: number): AlgoStep<EventLoopState>[] {
  const log: string[] = [];
  const micro: LoopJob[] = [];
  const macro: LoopJob[] = [];
  const extras = new Map<LoopJob, () => void>();
  let stamp: string = "loop";
  const rec = new StepRecorder<EventLoopState>(() => ({
    log: [...log],
    micro: cloneJobs(micro),
    macro: cloneJobs(macro),
    stamp,
  }));

  function emit(kind: LoopJob["kind"], label: string, line: number, note: string): void {
    for (const j of [...micro, ...macro]) j.active = false;
    rec.bump(LOOP_COUNTERS[kind]);
    log.push(label);
    rec.record({ codeLine: line, note });
  }
  function queue(kind: "micro" | "macro", label: string, extra?: () => void): void {
    const job: LoopJob = { kind, label, done: false, active: true };
    (kind === "micro" ? micro : macro).push(job);
    if (extra) extras.set(job, extra);
    rec.record({
      codeLine: kind === "micro" ? 1 : 2,
      note: `Queue ${kind} ${label}.`,
    });
    job.active = false;
  }

  rec.record({
    note:
      size === 2
        ? "A micro queues another micro."
        : size === 1
          ? "Two micros, one macro."
          : "One micro, one macro.",
  });

  if (size === 0) {
    emit("sync", "1", 0, "Log 1.");
    queue("micro", "2");
    queue("macro", "3");
    emit("sync", "4", 0, "Log 4.");
  } else if (size === 1) {
    emit("sync", "1", 0, "Log 1.");
    queue("micro", "2");
    queue("micro", "3");
    queue("macro", "4");
    emit("sync", "5", 0, "Log 5.");
  } else {
    emit("sync", "1", 0, "Log 1.");
    queue("micro", "A", () => queue("micro", "B"));
    queue("macro", "2");
    emit("sync", "3", 0, "Log 3.");
  }

  while (micro.some((j) => !j.done) || macro.some((j) => !j.done)) {
    const nextMicro = micro.find((j) => !j.done);
    if (nextMicro) {
      nextMicro.done = true;
      nextMicro.active = true;
      const extra = extras.get(nextMicro);
      emit("micro", nextMicro.label, 1, `Micro ${nextMicro.label}.`);
      if (extra) extra();
      nextMicro.active = false;
      continue;
    }
    const nextMacro = macro.find((j) => !j.done);
    if (nextMacro) {
      nextMacro.done = true;
      nextMacro.active = true;
      emit("macro", nextMacro.label, 2, `Macro ${nextMacro.label}.`);
      nextMacro.active = false;
    }
  }

  stamp = log.join(",");
  rec.record({ note: `Log ${log.join(",")}.` });
  return rec.steps;
}
