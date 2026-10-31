/**
 * Priority-inversion view — three tasks, one lock, one CPU.
 *
 * Low holds the lock for its whole burst. High needs it. Medium does not.
 * Without inheritance Medium runs over Low, and High waits for both.
 * With inheritance Low is boosted to High's priority, Medium waits, High
 * only waits for Low.
 */

export type PrioStatus = "ready" | "running" | "blocked" | "done";

export interface PrioTaskChip {
  id: string;
  priority: number;
  effective: number;
  remaining: number;
  burst: number;
  status: PrioStatus;
  finishedAt: number | null;
}

export interface PriorityState {
  inherit: boolean;
  cpu: string | null;
  lockHolder: string | null;
  lockWaiter: string | null;
  tasks: PrioTaskChip[];
  time: number;
  stamp: string;
}
