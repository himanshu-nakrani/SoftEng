/**
 * Syscall view — a user/kernel mode switch per call, with a byte copy.
 *
 * The lesson is overhead: eight one-byte writes trap eight times; one
 * eight-byte write traps once.
 */

export type CpuMode = "user" | "kernel";

export interface SyscallState {
  mode: CpuMode;
  /** Bytes copied this run. */
  copied: number;
  last?: { kind: "trap" | "copy" | "return"; bytes?: number };
  stamp: string;
}
