import {
  SYSCALL_COUNTERS,
  runSyscall,
  type SyscallConfig,
} from "@/engine/algo/syscall";
import type { AlgoDef } from "@/engine/algo/types";
import type { SyscallState } from "@/engine/algo/views/syscall";

/**
 * System Calls — archetype B (`engine: "steps"`).
 *
 * User mode cannot talk to devices. A write() is a trap into the kernel, a
 * copy of the payload from user memory, and a return. The mode switch is
 * the cost; the bytes are the work. Eight one-byte writes trap eight times
 * and copy eight times for eight bytes. One eight-byte write traps once,
 * copies once, and still moves eight bytes.
 *
 * Two defs, two sliders. The naive figure's control is how many one-byte
 * calls (1–8, default 8): every extra call is one more trap. The batched
 * figure's control is how many bytes that one call copies (1–8, default 8):
 * traps stay at 1. At size 1 they are the same run.
 *
 * MODELLING NOTE, and its limits. One write, no fd table, no errors. A copy
 * is one per call, not one per byte — that is why the copies meter and the
 * bytes meter diverge once a call carries more than one byte. Deliberately
 * absent: real syscall numbers, page copies vs registers, vdso fast paths.
 * write() still traps; batching calls is the lever, not making the trap
 * cheaper.
 */

const counters = [
  { key: SYSCALL_COUNTERS.traps, label: "traps" },
  { key: SYSCALL_COUNTERS.copies, label: "copies" },
  { key: SYSCALL_COUNTERS.bytes, label: "bytes" },
];

/** One-byte write() in a loop. The slider is how many calls. */
export const syscallsAlgo: AlgoDef<SyscallState, SyscallConfig> = {
  id: "syscalls",
  title: "one-byte writes",
  code: ["write(fd, p, 1)", "copy 1 byte", "return to user"],
  counters,
  size: { label: "calls", min: 1, max: 8, default: 8 },
  generateInput: (_rng, size) => ({ calls: size, bytes: 1 }),
  run: (input) => runSyscall(input),
};

/** One write() of n bytes. The slider is the payload. */
export const syscallsBatchedAlgo: AlgoDef<SyscallState, SyscallConfig> = {
  id: "syscalls-batched",
  title: "one write",
  code: ["write(fd, buf, n)", "copy n bytes", "return to user"],
  counters,
  size: { label: "bytes", min: 1, max: 8, default: 8 },
  generateInput: (_rng, size) => ({ calls: 1, bytes: size }),
  run: (input) => runSyscall(input),
};
