import { buildAlgoSteps } from "@/engine/algo/build";
import { SYSCALL_COUNTERS as C, runSyscall } from "@/engine/algo/syscall";
import type { AlgoDef } from "@/engine/algo/types";
import type { SyscallState } from "@/engine/algo/views/syscall";
import {
  syscallsAlgo,
  syscallsBatchedAlgo,
} from "@/lessons/storage-io/syscalls";
import { describe, expect, it } from "vitest";

/**
 * The syscalls prose states numbers. A failure here means the page now
 * lies, and the message should name the sentence that became untrue.
 */

function run<I>(def: AlgoDef<SyscallState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    traps: last.counters[C.traps] ?? 0,
    copies: last.counters[C.copies] ?? 0,
    bytes: last.counters[C.bytes] ?? 0,
  };
}

describe("syscalls: the sliders are calls vs bytes, 1 through 8", () => {
  it("offers 1 through 8, default 8 on both figures", () => {
    expect(syscallsAlgo.size).toMatchObject({
      min: 1,
      max: 8,
      default: 8,
      label: "calls",
    });
    expect(syscallsBatchedAlgo.size).toMatchObject({
      min: 1,
      max: 8,
      default: 8,
      label: "bytes",
    });
  });

  it("naive size is one-byte calls; batched size is bytes of one call", () => {
    expect(syscallsAlgo.generateInput(() => 0, 8)).toEqual({
      calls: 8,
      bytes: 1,
    });
    expect(syscallsBatchedAlgo.generateInput(() => 0, 8)).toEqual({
      calls: 1,
      bytes: 8,
    });
  });

  it("at 1 the two figures are the same run", () => {
    // "Drag to 1: traps 1, copies 1, bytes 1 — the same run as the
    // one-byte figure at 1 call."
    expect(buildAlgoSteps(syscallsAlgo, 1, 42)).toEqual(
      buildAlgoSteps(syscallsBatchedAlgo, 1, 42),
    );
  });

  it("ignores the seed: a write is not a scheduler", () => {
    expect(buildAlgoSteps(syscallsAlgo, 8, 1)).toEqual(
      buildAlgoSteps(syscallsAlgo, 8, 99),
    );
    expect(buildAlgoSteps(syscallsBatchedAlgo, 8, 1)).toEqual(
      buildAlgoSteps(syscallsBatchedAlgo, 8, 99),
    );
  });
});

describe("syscalls: eight one-byte writes trap eight times", () => {
  it("8 calls of 1 byte: traps 8, bytes 8, copies 8", () => {
    // "Skip to the end. Meters: 8 traps, 8 copies, 8 bytes."
    const c = run(syscallsAlgo, 8);
    expect(c.traps).toBe(8);
    expect(c.copies).toBe(8);
    expect(c.bytes).toBe(8);
    expect(c.state.stamp).toBe("8 traps · user");
    expect(c.state.mode).toBe("user");
    expect(c.state.copied).toBe(8);
    expect(c.state.last).toEqual({ kind: "return" });
  });

  it("the producer agrees", () => {
    const last = runSyscall({ calls: 8, bytes: 1 }).at(-1)!;
    expect(last.counters[C.traps]).toBe(8);
    expect(last.counters[C.copies]).toBe(8);
    expect(last.counters[C.bytes]).toBe(8);
  });

  it("opens in user mode with nothing copied", () => {
    // "The stamp says 0 traps · user. The caption is '8 writes of 1 byte
    // each.' USER is lit; KERNEL is hollow. Copied is 0."
    const first = run(syscallsAlgo, 8).steps[0]!;
    expect(first.state.mode).toBe("user");
    expect(first.state.copied).toBe(0);
    expect(first.state.last).toBeUndefined();
    expect(first.state.stamp).toBe("0 traps · user");
    expect(first.note).toBe("8 writes of 1 byte each.");
    expect(first.counters[C.traps] ?? 0).toBe(0);
    expect(first.counters[C.copies] ?? 0).toBe(0);
    expect(first.counters[C.bytes] ?? 0).toBe(0);
  });

  it("the first trap has not copied yet", () => {
    // "Caption: 'Trap into kernel (call 1/8).' Stamp 1 trap · kernel.
    // Traps is 1; copied is still 0. The trap has not copied yet."
    const trap = run(syscallsAlgo, 8).steps[1]!;
    expect(trap.note).toBe("Trap into kernel (call 1/8).");
    expect(trap.codeLine).toBe(0);
    expect(trap.state.mode).toBe("kernel");
    expect(trap.state.last).toEqual({ kind: "trap" });
    expect(trap.state.stamp).toBe("1 trap · kernel");
    expect(trap.counters[C.traps]).toBe(1);
    expect(trap.counters[C.copies] ?? 0).toBe(0);
    expect(trap.state.copied).toBe(0);
  });

  it("then copies 1 byte and returns to user", () => {
    // "Next step copies. Caption: 'Copy 1 byte from user.' Copies 1,
    // bytes 1. Then 'Return to user mode.' Stamp 1 trap · user."
    const { steps } = run(syscallsAlgo, 8);
    const copy = steps[2]!;
    expect(copy.note).toBe("Copy 1 byte from user.");
    expect(copy.codeLine).toBe(1);
    expect(copy.state.mode).toBe("kernel");
    expect(copy.state.last).toEqual({ kind: "copy", bytes: 1 });
    expect(copy.counters[C.copies]).toBe(1);
    expect(copy.counters[C.bytes]).toBe(1);
    expect(copy.state.copied).toBe(1);

    const ret = steps[3]!;
    expect(ret.note).toBe("Return to user mode.");
    expect(ret.codeLine).toBe(2);
    expect(ret.state.mode).toBe("user");
    expect(ret.state.last).toEqual({ kind: "return" });
    expect(ret.state.stamp).toBe("1 trap · user");
  });

  it("sizes 1 through 8: traps, copies, and bytes all equal the call count", () => {
    // "Drag to 1: one trap, one copy, one byte. Drag to 4: four of each."
    // "Every extra call is one more mode switch."
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const c = run(syscallsAlgo, n);
      expect(c.traps).toBe(n);
      expect(c.copies).toBe(n);
      expect(c.bytes).toBe(n);
      expect(c.state.copied).toBe(n);
      expect(c.steps[0]!.note).toBe(
        `${n} write${n === 1 ? "" : "s"} of 1 byte each.`,
      );
    }
  });
});

describe("syscalls: one eight-byte write traps once", () => {
  it("1 call of 8 bytes: traps 1, bytes 8, copies 1", () => {
    // "Meters: 1 trap, 1 copy, 8 bytes."
    const c = run(syscallsBatchedAlgo, 8);
    expect(c.traps).toBe(1);
    expect(c.copies).toBe(1);
    expect(c.bytes).toBe(8);
    expect(c.state.stamp).toBe("1 trap · user");
    expect(c.state.mode).toBe("user");
    expect(c.state.copied).toBe(8);
    expect(c.state.last).toEqual({ kind: "return" });
  });

  it("the producer agrees", () => {
    const last = runSyscall({ calls: 1, bytes: 8 }).at(-1)!;
    expect(last.counters[C.traps]).toBe(1);
    expect(last.counters[C.copies]).toBe(1);
    expect(last.counters[C.bytes]).toBe(8);
  });

  it("opens as one write of 8 bytes, still in user mode", () => {
    // "The caption is '1 write of 8 bytes each.' Stamp still 0 traps · user."
    const first = run(syscallsBatchedAlgo, 8).steps[0]!;
    expect(first.note).toBe("1 write of 8 bytes each.");
    expect(first.state.mode).toBe("user");
    expect(first.state.stamp).toBe("0 traps · user");
    expect(first.state.copied).toBe(0);
  });

  it("three steps: trap, copy 8, return", () => {
    // "Three steps: trap (call 1/1), 'Copy 8 bytes from user,' return."
    const { steps } = run(syscallsBatchedAlgo, 8);
    expect(steps).toHaveLength(4);
    expect(steps[1]!.note).toBe("Trap into kernel (call 1/1).");
    expect(steps[1]!.state.mode).toBe("kernel");
    expect(steps[2]!.note).toBe("Copy 8 bytes from user.");
    expect(steps[2]!.state.last).toEqual({ kind: "copy", bytes: 8 });
    expect(steps[2]!.counters[C.bytes]).toBe(8);
    expect(steps[2]!.counters[C.copies]).toBe(1);
    expect(steps[3]!.note).toBe("Return to user mode.");
    expect(steps[3]!.state.mode).toBe("user");
  });

  it("traps stay at 1 while bytes follow the slider, 1 through 8", () => {
    // "Drag to 4. Still one trap, one copy; bytes drop to 4."
    // "A copy is one per call, not one per byte. That is why the copies
    // meter stays at 1 while the bytes meter follows the slider."
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const c = run(syscallsBatchedAlgo, n);
      expect(c.traps).toBe(1);
      expect(c.copies).toBe(1);
      expect(c.bytes).toBe(n);
      expect(c.state.copied).toBe(n);
    }
  });

  it("same eight bytes as the naive loop, seven fewer traps", () => {
    // "Same eight bytes. Seven fewer traps."
    const naive = run(syscallsAlgo, 8);
    const batched = run(syscallsBatchedAlgo, 8);
    expect(naive.bytes).toBe(8);
    expect(batched.bytes).toBe(8);
    expect(naive.traps - batched.traps).toBe(7);
    expect(naive.copies - batched.copies).toBe(7);
  });
});
