import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { PriorityState, PrioStatus } from "./views/priority";

/**
 * Priority inversion — a step producer over `PriorityState`.
 *
 * Three actors, one lock, one CPU. Low acquires the lock for its whole burst.
 * High needs that lock. Medium does not. A priority scheduler that does not
 * donate lets Medium run over Low, so High waits for both — inversion. With
 * inheritance, Low runs at High's priority until it releases, and Medium waits.
 *
 * Arrivals are part of the script: Low at 0, High shortly after, Medium after
 * that. That order is the Pathfinder shape, reduced to three bursts.
 */

export interface PrioTask {
  id: string;
  burst: number;
  /** Higher number = more important. */
  priority: number;
  arrive: number;
  /** "holder" acquires the lock on first dispatch; "waiter" needs it. */
  role: "holder" | "waiter" | "other";
}

export interface PrioConfig {
  inherit: boolean;
  tasks: PrioTask[];
}

export const PRIO_COUNTERS = {
  steps: "steps",
  inversions: "inversions",
  boosts: "boosts",
  preemptions: "preemptions",
} as const;

interface Runtime {
  spec: PrioTask;
  remaining: number;
  status: PrioStatus;
  finishedAt: number | null;
  arrived: boolean;
}

export function runPriority(cfg: PrioConfig): AlgoStep<PriorityState>[] {
  const tasks: Runtime[] = cfg.tasks.map((spec) => ({
    spec,
    remaining: spec.burst,
    status: "ready" as const,
    finishedAt: null,
    arrived: spec.arrive <= 0,
  }));
  let cpu: string | null = null;
  let lockHolder: string | null = null;
  let time = 0;

  const rec = new StepRecorder<PriorityState>(() => snapshot());
  const byId = (id: string) => tasks.find((t) => t.spec.id === id)!;

  function waiter(): Runtime | undefined {
    return tasks.find((t) => t.spec.role === "waiter" && t.arrived && t.status !== "done");
  }

  function effective(t: Runtime): number {
    if (
      cfg.inherit &&
      lockHolder === t.spec.id &&
      waiter()?.status === "blocked"
    ) {
      return Math.max(t.spec.priority, waiter()!.spec.priority);
    }
    return t.spec.priority;
  }

  function snapshot(): PriorityState {
    const w = waiter();
    return {
      inherit: cfg.inherit,
      cpu,
      lockHolder,
      lockWaiter: w?.status === "blocked" ? w.spec.id : null,
      tasks: tasks.map((t) => ({
        id: t.spec.id,
        priority: t.spec.priority,
        effective: effective(t),
        remaining: t.remaining,
        burst: t.spec.burst,
        status: t.arrived ? t.status : "ready",
        finishedAt: t.finishedAt,
      })),
      time,
      stamp:
        time === 0
          ? cfg.inherit
            ? "inheritance on"
            : "no inheritance"
          : `t=${time}`,
    };
  }

  function runnable(): Runtime[] {
    return tasks.filter((t) => {
      if (!t.arrived || t.status === "done") return false;
      if (t.spec.role === "waiter" && lockHolder && lockHolder !== t.spec.id) {
        return false;
      }
      return true;
    });
  }

  function pick(): Runtime | undefined {
    const r = runnable();
    if (r.length === 0) return undefined;
    return r.reduce((a, b) => (effective(b) > effective(a) ? b : a));
  }

  rec.record({
    note: cfg.inherit
      ? "Inheritance on: the lock holder runs at the waiter's priority."
      : "No inheritance: a medium task can run over the lock holder.",
  });

  const horizon = 64;
  while (tasks.some((t) => t.status !== "done") && time < horizon) {
    for (const t of tasks) {
      if (!t.arrived && t.spec.arrive <= time) {
        t.arrived = true;
        t.status = "ready";
        rec.record({
          codeLine: 0,
          note: `${t.spec.id} arrives (prio ${t.spec.priority}).`,
        });
      }
    }

    const w = waiter();
    if (w && lockHolder && lockHolder !== w.spec.id) {
      if (w.status !== "blocked") {
        w.status = "blocked";
        rec.bump(PRIO_COUNTERS.inversions);
        if (cfg.inherit) rec.bump(PRIO_COUNTERS.boosts);
        rec.record({
          codeLine: 1,
          note: `${w.spec.id} blocks on the lock held by ${lockHolder}.`,
        });
      }
    } else if (w && w.status === "blocked") {
      w.status = "ready";
    }

    // boosts is counted when High first blocks, not every tick.

    const best = pick();
    if (cpu && best && best.spec.id !== cpu && effective(best) > effective(byId(cpu))) {
      rec.bump(PRIO_COUNTERS.preemptions);
      byId(cpu).status = "ready";
      rec.record({
        codeLine: 2,
        note: `${best.spec.id} preempts ${cpu}.`,
      });
      cpu = null;
    }

    if (cpu === null) {
      const next = pick();
      if (!next) {
        time += 1;
        rec.bump(PRIO_COUNTERS.steps);
        rec.record({ note: `Idle at t=${time}.` });
        continue;
      }
      cpu = next.spec.id;
      next.status = "running";
      if (next.spec.role === "holder" && lockHolder === null) {
        lockHolder = cpu;
        rec.record({
          codeLine: 0,
          note: `Dispatch ${cpu}; it takes the lock.`,
        });
      } else {
        rec.record({
          codeLine: 0,
          note: `Dispatch ${cpu}.`,
        });
      }
    }

    const t = byId(cpu);
    t.remaining -= 1;
    time += 1;
    rec.bump(PRIO_COUNTERS.steps);
    rec.record({
      codeLine: 3,
      note: `${cpu} runs (remaining ${t.remaining}).`,
    });

    if (t.remaining === 0) {
      t.status = "done";
      t.finishedAt = time;
      if (lockHolder === cpu) lockHolder = null;
      rec.record({
        codeLine: 4,
        note: `${cpu} completes at t=${time}.`,
      });
      cpu = null;
    }
  }

  return rec.steps;
}

export function prioWait(state: PriorityState, id: string): number {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || t.finishedAt === null) return Number.NaN;
  return t.finishedAt - t.burst;
}
