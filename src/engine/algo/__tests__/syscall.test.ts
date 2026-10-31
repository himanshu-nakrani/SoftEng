import { buildAlgoSteps } from "@/engine/algo/build";
import { SYSCALL_COUNTERS, runSyscall } from "@/engine/algo/syscall";
import type { AlgoDef } from "@/engine/algo/types";
import type { SyscallState } from "@/engine/algo/views/syscall";
import { SyscallView } from "@/engine/algo/views/SyscallView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const C = SYSCALL_COUNTERS;
const last = (calls: number, bytes: number) => runSyscall({ calls, bytes }).at(-1)!;

describe("runSyscall", () => {
  it("eight one-byte writes trap eight times", () => {
    const { counters } = last(8, 1);
    expect(counters[C.traps]).toBe(8);
    expect(counters[C.bytes]).toBe(8);
  });

  it("one eight-byte write traps once", () => {
    const { counters } = last(1, 8);
    expect(counters[C.traps]).toBe(1);
    expect(counters[C.bytes]).toBe(8);
    expect(counters[C.copies]).toBe(1);
  });

  it("never aliases and starts in user mode", () => {
    const steps = runSyscall({ calls: 3, bytes: 1 });
    expect(steps[0]!.state.mode).toBe("user");
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
  });
});

describe("syscall rides on archetype B", () => {
  const def: AlgoDef<SyscallState, { calls: number; bytes: number }> = {
    id: "sys",
    title: "write",
    code: ["trap", "copy", "return"],
    counters: [{ key: C.traps, label: "traps" }],
    size: { label: "calls", min: 1, max: 8, default: 8 },
    generateInput: (_rng, size) => ({ calls: size, bytes: 1 }),
    run: (input) => runSyscall(input),
  };

  it("size changes traps and the view contract holds", () => {
    expect(buildAlgoSteps(def, 8, 1).at(-1)!.counters[C.traps]).toBe(8);
    const view: ComponentType<{ state: SyscallState }> = SyscallView;
    expect(view).toBe(SyscallView);
  });
});
