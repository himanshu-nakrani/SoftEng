import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type {
  SchedPolicy,
  SchedTaskChip,
  SchedulerState,
} from "./views/scheduler";

/**
 * CPU scheduling — a step producer for archetype B, over `SchedulerState`.
 *
 * Not a thread interleaver: the runnable set is a queue, and the policy
 * decides how long the occupant of the CPU may stay. Cooperative: a task
 * runs its whole burst. Preemptive: a task runs at most `quantum` then
 * goes to the back of the queue if it still has work.
 *
 * WHAT IS MODELLED. FIFO among ready tasks, a single CPU, fixed bursts,
 * no I/O. The convoy is visible because a long burst at the head of a
 * cooperative queue delays every short burst behind it; a quantum lets
 * those short bursts in.
 *
 * Also modelled, behind extra config:
 *   - `switchCost`: wall time charged on every dispatch after the first, so a
 *     short quantum's extra switches are a measured waste, not a slogan.
 *   - `mlfq`: three queues, quanta 1/2/4, demote after a full slice; optional
 *     `ageEvery` boosts everyone back to Q0.
 *
 * Deliberately absent: SJF, I/O blocking, affinity, and lock inheritance
 * (that is `priority.ts`).
 */

export interface SchedTask {
  id: string;
  burst: number;
}

export interface SchedConfig {
  policy: SchedPolicy;
  quantum: number;
  tasks: SchedTask[];
  /**
   * Wall steps charged on every dispatch after the first. Default 0, so the
   * convoy numbers the first scheduling lesson pinned stay put.
   */
  switchCost?: number;
  /** MLFQ only: boost every task to Q0 every this many steps. 0 = never. */
  ageEvery?: number;
}

export const SCHED_COUNTERS = {
  steps: "steps",
  switches: "switches",
  preemptions: "preemptions",
  completions: "completions",
  waste: "waste",
  demotions: "demotions",
} as const;

interface Runtime {
  id: string;
  burst: number;
  remaining: number;
  ran: number;
  status: SchedTaskChip["status"];
  finishedAt: number | null;
}

export function runScheduler(cfg: SchedConfig): AlgoStep<SchedulerState>[] {
  if (cfg.policy === "mlfq") return runMlfq(cfg);
  return runFifo(cfg);
}

function runFifo(cfg: SchedConfig): AlgoStep<SchedulerState>[] {
  const tasks: Runtime[] = cfg.tasks.map((t) => ({
    id: t.id,
    burst: t.burst,
    remaining: t.burst,
    ran: 0,
    status: "ready" as const,
    finishedAt: null,
  }));
  const queue = tasks.map((t) => t.id);
  let cpu: string | null = null;
  let slice = 0;
  let time = 0;

  const rec = new StepRecorder<SchedulerState>(() => snapshot());
  const byId = (id: string) => tasks.find((t) => t.id === id)!;

  function snapshot(): SchedulerState {
    return {
      policy: cfg.policy,
      quantum: cfg.quantum,
      cpu,
      queue: [...queue],
      tasks: tasks.map((t) => ({
        id: t.id,
        burst: t.burst,
        remaining: t.remaining,
        status: t.status,
        ran: t.ran,
        finishedAt: t.finishedAt,
      })),
      time,
      stamp: stampOf(),
    };
  }

  function stampOf(): string {
    const done = tasks.filter((t) => t.status === "done").length;
    if (time === 0) {
      return cfg.policy === "cooperative"
        ? "cooperative · run to completion"
        : `preemptive · quantum ${cfg.quantum}`;
    }
    return `t=${time} · ${done} done`;
  }

  rec.record({
    note:
      cfg.policy === "cooperative"
        ? "Cooperative: the running task keeps the CPU until its burst ends."
        : `Preemptive: a timer fires every ${cfg.quantum} step${cfg.quantum === 1 ? "" : "s"}.`,
  });

  while (tasks.some((t) => t.status !== "done")) {
    if (cpu === null) {
      const next = queue.shift();
      if (!next) break;
      cpu = next;
      slice = 0;
      byId(cpu).status = "running";
      rec.bump(SCHED_COUNTERS.switches);
      const cost = cfg.switchCost ?? 0;
      if (cost > 0 && rec.count(SCHED_COUNTERS.switches) > 1) {
        rec.bump(SCHED_COUNTERS.waste, cost);
        time += cost;
        rec.record({
          codeLine: 0,
          note: `Dispatch ${cpu} — switch costs ${cost}.`,
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
    t.ran += 1;
    slice += 1;
    time += 1;
    rec.bump(SCHED_COUNTERS.steps);
    rec.record({
      codeLine: 1,
      note: `${cpu} runs (remaining ${t.remaining}).`,
    });

    if (t.remaining === 0) {
      t.status = "done";
      t.finishedAt = time;
      rec.bump(SCHED_COUNTERS.completions);
      rec.record({
        codeLine: 2,
        note: `${cpu} completes at t=${time}.`,
      });
      cpu = null;
      continue;
    }

    if (cfg.policy === "preemptive" && slice >= cfg.quantum && queue.length > 0) {
      rec.bump(SCHED_COUNTERS.preemptions);
      t.status = "ready";
      queue.push(cpu);
      rec.record({
        codeLine: 3,
        note: `Timer: preempt ${cpu}, requeue.`,
      });
      cpu = null;
    }
  }

  return rec.steps;
}

const MLFQ_QUANTA = [1, 2, 4];

function runMlfq(cfg: SchedConfig): AlgoStep<SchedulerState>[] {
  const tasks: Runtime[] = cfg.tasks.map((t) => ({
    id: t.id,
    burst: t.burst,
    remaining: t.burst,
    ran: 0,
    status: "ready" as const,
    finishedAt: null,
  }));
  const levels: string[][] = [[], [], []];
  const levelOf = new Map<string, number>();
  for (const t of tasks) {
    levels[0]!.push(t.id);
    levelOf.set(t.id, 0);
  }
  let cpu: string | null = null;
  let slice = 0;
  let time = 0;
  let lastAge = 0;

  const rec = new StepRecorder<SchedulerState>(() => snapshot());
  const byId = (id: string) => tasks.find((t) => t.id === id)!;

  function snapshot(): SchedulerState {
    const queue = levels.flat();
    return {
      policy: "mlfq",
      quantum: cpu ? MLFQ_QUANTA[levelOf.get(cpu)!]! : MLFQ_QUANTA[0]!,
      cpu,
      queue,
      levels: levels.map((q) => [...q]),
      tasks: tasks.map((t) => ({
        id: t.id,
        burst: t.burst,
        remaining: t.remaining,
        status: t.status,
        ran: t.ran,
        finishedAt: t.finishedAt,
        level: levelOf.get(t.id),
      })),
      time,
      stamp: stampOf(),
    };
  }

  function stampOf(): string {
    const done = tasks.filter((t) => t.status === "done").length;
    if (time === 0) return "mlfq · Q0/Q1/Q2 · quanta 1/2/4";
    return `t=${time} · ${done} done`;
  }

  function pull(): string | undefined {
    for (const q of levels) {
      if (q.length > 0) return q.shift();
    }
    return undefined;
  }

  function age(): void {
    const every = cfg.ageEvery ?? 0;
    if (every <= 0 || time - lastAge < every) return;
    lastAge = time;
    const rest = [...levels[1]!, ...levels[2]!];
    levels[1] = [];
    levels[2] = [];
    for (const id of rest) {
      if (byId(id).status === "done") continue;
      levelOf.set(id, 0);
      if (id !== cpu) levels[0]!.push(id);
    }
    if (cpu) levelOf.set(cpu, 0);
    rec.record({
      codeLine: 4,
      note: `Aging: everyone returns to Q0.`,
    });
  }

  rec.record({
    note: `MLFQ: three queues, quanta ${MLFQ_QUANTA.join("/")}. A full slice demotes.`,
  });

  while (tasks.some((t) => t.status !== "done")) {
    age();
    if (cpu === null) {
      const next = pull();
      if (!next) break;
      cpu = next;
      slice = 0;
      byId(cpu).status = "running";
      rec.bump(SCHED_COUNTERS.switches);
      rec.record({
        codeLine: 0,
        note: `Dispatch ${cpu} from Q${levelOf.get(cpu)}.`,
      });
    }

    const t = byId(cpu);
    const q = MLFQ_QUANTA[levelOf.get(cpu)!]!;
    t.remaining -= 1;
    t.ran += 1;
    slice += 1;
    time += 1;
    rec.bump(SCHED_COUNTERS.steps);
    rec.record({
      codeLine: 1,
      note: `${cpu} runs in Q${levelOf.get(cpu)} (remaining ${t.remaining}).`,
    });

    if (t.remaining === 0) {
      t.status = "done";
      t.finishedAt = time;
      rec.bump(SCHED_COUNTERS.completions);
      rec.record({
        codeLine: 2,
        note: `${cpu} completes at t=${time}.`,
      });
      cpu = null;
      continue;
    }

    if (slice >= q) {
      rec.bump(SCHED_COUNTERS.preemptions);
      const lvl = levelOf.get(cpu)!;
      const nextLvl = Math.min(lvl + 1, 2);
      if (nextLvl !== lvl) rec.bump(SCHED_COUNTERS.demotions);
      levelOf.set(cpu, nextLvl);
      t.status = "ready";
      levels[nextLvl]!.push(cpu);
      rec.record({
        codeLine: 3,
        note:
          nextLvl === lvl
            ? `Timer: ${cpu} stays in Q${lvl}.`
            : `Timer: ${cpu} demoted Q${lvl} → Q${nextLvl}.`,
      });
      cpu = null;
    }
  }

  return rec.steps;
}

/** Waiting time: completion minus burst. All tasks arrive at 0. */
export function waitTime(state: SchedulerState, id: string): number {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.finishedAt === null) return Number.NaN;
  return task.finishedAt - task.burst;
}
