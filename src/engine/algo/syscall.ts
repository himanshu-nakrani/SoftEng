import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { CpuMode, SyscallState } from "./views/syscall";

/**
 * System calls — a step producer over `SyscallState`.
 *
 * Each write is a trap into kernel, a copy of `bytes` from user, and a
 * return. `calls` writes of `bytes` each: naive looping one byte is
 * `size` traps; a single buffered write is one trap of `size` bytes.
 *
 * Deliberately absent: real syscall numbers, page copies vs registers,
 * vdso fast paths. The argument is that the mode switch is the cost, so
 * batching work into fewer calls is the lever.
 */

export interface SyscallConfig {
  /** How many write() calls. */
  calls: number;
  /** Bytes copied per call. */
  bytes: number;
}

export const SYSCALL_COUNTERS = {
  traps: "traps",
  copies: "copies",
  bytes: "bytes",
} as const;

export function runSyscall(cfg: SyscallConfig): AlgoStep<SyscallState>[] {
  let mode: CpuMode = "user";
  let copied = 0;
  let last: SyscallState["last"];
  const rec = new StepRecorder<SyscallState>(() => snapshot());

  function snapshot(): SyscallState {
    return {
      mode,
      copied,
      last,
      stamp: `${rec.count(SYSCALL_COUNTERS.traps)} trap${rec.count(SYSCALL_COUNTERS.traps) === 1 ? "" : "s"} · ${mode}`,
    };
  }

  rec.record({
    note: `${cfg.calls} write${cfg.calls === 1 ? "" : "s"} of ${cfg.bytes} byte${cfg.bytes === 1 ? "" : "s"} each.`,
  });

  for (let i = 0; i < cfg.calls; i++) {
    mode = "kernel";
    rec.bump(SYSCALL_COUNTERS.traps);
    last = { kind: "trap" };
    rec.record({
      codeLine: 0,
      note: `Trap into kernel (call ${i + 1}/${cfg.calls}).`,
    });
    rec.bump(SYSCALL_COUNTERS.copies);
    rec.bump(SYSCALL_COUNTERS.bytes, cfg.bytes);
    copied += cfg.bytes;
    last = { kind: "copy", bytes: cfg.bytes };
    rec.record({
      codeLine: 1,
      note: `Copy ${cfg.bytes} byte${cfg.bytes === 1 ? "" : "s"} from user.`,
    });
    mode = "user";
    last = { kind: "return" };
    rec.record({
      codeLine: 2,
      note: "Return to user mode.",
    });
  }

  return rec.steps;
}
