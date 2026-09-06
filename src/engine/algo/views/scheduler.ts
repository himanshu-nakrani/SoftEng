/**
 * CPU-scheduler view state — archetype B, for preemption vs cooperation.
 *
 * Pure data so a lesson `.ts` can drive a run queue without importing a view.
 * Each task is a burst remaining; the CPU holds at most one. Cooperative
 * policy runs until the burst ends. Preemptive policy runs at most `quantum`
 * then requeues.
 */

export type SchedPolicy = "cooperative" | "preemptive" | "mlfq";
export type TaskStatus = "ready" | "running" | "done";

export interface SchedTaskChip {
  id: string;
  burst: number;
  remaining: number;
  status: TaskStatus;
  /** CPU time this task has already received. */
  ran: number;
  /** Sim time at which remaining hit 0. Null until then. */
  finishedAt: number | null;
  /** MLFQ queue index, 0 = highest. */
  level?: number;
}

export interface SchedulerState {
  policy: SchedPolicy;
  quantum: number;
  cpu: string | null;
  queue: string[];
  /** MLFQ ready queues, highest first. Omitted for FIFO policies. */
  levels?: string[][];
  tasks: SchedTaskChip[];
  /** Wall of CPU steps so far. */
  time: number;
  stamp: string;
}
