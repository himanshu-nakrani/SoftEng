import { buildAlgoSteps } from "@/engine/algo/build";
import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Locals,
  type Memory,
  type Program,
  type Thread,
} from "@/engine/algo/concurrency";
import { mulberry32 } from "@/engine/rng";
import type { AlgoDef } from "@/engine/algo/types";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import type { ConcurrencyState } from "@/engine/algo/views/threads";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

/**
 * Archetype C — the seeded interleaving scheduler.
 *
 * The behaviour under test is the teachable claim itself: the same program and
 * seed reproduce an interleaving exactly, different seeds produce different but
 * equally legal ones, an unsynchronised increment loses updates under SOME of
 * those orders, and a mutex makes the outcome order-independent.
 */

/** read → add → write, non-atomic: the canonical lost update. */
function unsyncIncrementer(id: string, locked: boolean): Thread {
  const ops = [
    {
      label: "read counter",
      codeLine: locked ? 1 : 0,
      effect: (mem: Record<string, number>, locals: Record<string, number>) => {
        locals.tmp = mem.counter;
      },
    },
    {
      label: "tmp + 1",
      codeLine: locked ? 2 : 1,
      effect: (_mem: Record<string, number>, locals: Record<string, number>) => {
        locals.tmp += 1;
      },
    },
    {
      label: "write counter",
      codeLine: locked ? 3 : 2,
      effect: (mem: Record<string, number>, locals: Record<string, number>) => {
        mem.counter = locals.tmp;
      },
    },
  ];

  return {
    id,
    name: id,
    locals: { tmp: 0 },
    ops: locked
      ? [
          { label: "acquire lock", codeLine: 0, lock: { action: "acquire" as const, name: "mutex" } },
          ...ops,
          { label: "release lock", codeLine: 4, lock: { action: "release" as const, name: "mutex" } },
        ]
      : ops,
  };
}

function counterProgram(threads: number, locked: boolean): Program {
  return {
    memory: { counter: 0 },
    locks: locked ? ["mutex"] : [],
    threads: Array.from({ length: threads }, (_, i) =>
      unsyncIncrementer(`T${i + 1}`, locked),
    ),
  };
}

const finalCounter = (steps: { state: ConcurrencyState }[]): number =>
  steps[steps.length - 1].state.memory.counter;

describe("interleave", () => {
  it("is deterministic for a given seed", () => {
    const a = interleave(counterProgram(3, false), mulberry32(7));
    const b = interleave(counterProgram(3, false), mulberry32(7));
    expect(a).toEqual(b);
  });

  it("produces different interleavings across seeds", () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const steps = interleave(counterProgram(3, false), mulberry32(seed));
      orders.add(steps.map((s) => s.state.active ?? "-").join(""));
    }
    // 3 threads × 3 ops has many legal orders; a scheduler that always picked
    // the same one (or ran threads to completion) would collapse this to 1.
    expect(orders.size).toBeGreaterThan(5);
  });

  it("starts before anything has run and executes every op exactly once", () => {
    const program = counterProgram(3, false);
    const steps = interleave(program, mulberry32(1));
    const totalOps = program.threads.reduce((n, t) => n + t.ops.length, 0);

    expect(steps[0].state.active).toBeNull();
    expect(steps[0].state.memory.counter).toBe(0);
    // One frame per executed op, plus the initial frame.
    expect(steps).toHaveLength(totalOps + 1);
    expect(steps[steps.length - 1].counters[CONCURRENCY_COUNTERS.steps]).toBe(
      totalOps,
    );
    for (const thread of steps[steps.length - 1].state.threads) {
      expect(thread.pc).toBe(thread.ops);
      expect(thread.status).toBe("done");
    }
  });

  it("advances exactly one thread's pc per frame", () => {
    const steps = interleave(counterProgram(3, false), mulberry32(3));
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1].state.threads;
      const curr = steps[i].state.threads;
      const advanced = curr.filter((t, j) => t.pc === prev[j].pc + 1);
      const unchanged = curr.filter((t, j) => t.pc === prev[j].pc);
      expect(advanced).toHaveLength(1);
      expect(unchanged).toHaveLength(curr.length - 1);
      expect(advanced[0].id).toBe(steps[i].state.active);
    }
  });

  it("loses updates on some orders — the race is real and reproducible", () => {
    const results = new Map<number, number[]>(); // final counter -> seeds
    for (let seed = 0; seed < 60; seed++) {
      const value = finalCounter(
        interleave(counterProgram(3, false), mulberry32(seed)),
      );
      results.set(value, [...(results.get(value) ?? []), seed]);
    }

    // Three increments can end anywhere in 1..3 depending on the order.
    expect(Math.max(...results.keys())).toBe(3);
    expect(Math.min(...results.keys())).toBeLessThan(3);
    expect(results.size).toBeGreaterThan(1);

    // And the losing order replays identically — the property a lesson needs
    // in order to say "watch it happen again".
    const badSeed = [...results.entries()].find(([v]) => v < 3)![1][0];
    const first = interleave(counterProgram(3, false), mulberry32(badSeed));
    const again = interleave(counterProgram(3, false), mulberry32(badSeed));
    expect(finalCounter(again)).toBe(finalCounter(first));
    expect(finalCounter(first)).toBeLessThan(3);
  });

  it("never loses an update once the critical section is locked", () => {
    for (let seed = 0; seed < 60; seed++) {
      const steps = interleave(counterProgram(3, true), mulberry32(seed));
      expect(
        finalCounter(steps),
        `mutex failed to serialise at seed ${seed}`,
      ).toBe(3);
      expect(steps[steps.length - 1].state.deadlocked).toBe(false);
    }
  });

  it("never lets two threads hold the same lock", () => {
    for (let seed = 0; seed < 20; seed++) {
      const steps = interleave(counterProgram(3, true), mulberry32(seed));
      for (const step of steps) {
        const owner = step.state.locks.mutex;
        if (owner === null) continue;
        // The owner is inside its critical section: it has acquired (pc > 0)
        // and not yet released (pc < ops).
        const holder = step.state.threads.find((t) => t.id === owner)!;
        expect(holder.pc).toBeGreaterThan(0);
        expect(holder.pc).toBeLessThan(holder.ops);
      }
    }
  });

  it("counts waits and context switches", () => {
    const locked = interleave(counterProgram(3, true), mulberry32(5));
    const last = locked[locked.length - 1].counters;
    // Three threads contending for one mutex must wait at least once.
    expect(last[CONCURRENCY_COUNTERS.waits]).toBeGreaterThan(0);
    expect(last[CONCURRENCY_COUNTERS.switches]).toBeGreaterThan(0);
  });

  it("detects deadlock instead of hanging", () => {
    // Classic AB/BA: each thread takes one lock then wants the other.
    // Both locks are released, so the ONLY way to reach a deadlock here is a
    // genuine circular wait — if a thread leaked a lock instead, the run would
    // also stall, but with one blocked thread and one finished, which is a
    // different bug wearing the same symptom.
    const program: Program = {
      memory: { x: 0 },
      locks: ["A", "B"],
      threads: [
        {
          id: "T1",
          name: "T1",
          ops: [
            { label: "lock A", lock: { action: "acquire", name: "A" } },
            { label: "lock B", lock: { action: "acquire", name: "B" } },
            { label: "release B", lock: { action: "release", name: "B" } },
            { label: "release A", lock: { action: "release", name: "A" } },
          ],
        },
        {
          id: "T2",
          name: "T2",
          ops: [
            { label: "lock B", lock: { action: "acquire", name: "B" } },
            { label: "lock A", lock: { action: "acquire", name: "A" } },
            { label: "release A", lock: { action: "release", name: "A" } },
            { label: "release B", lock: { action: "release", name: "B" } },
          ],
        },
      ],
    };

    // Some seeds interleave into the deadlock, others let one thread finish
    // first. Both are legal; the scheduler must terminate either way.
    let sawDeadlock = false;
    for (let seed = 0; seed < 40; seed++) {
      const steps = interleave(program, mulberry32(seed));
      const last = steps[steps.length - 1].state;
      expect(steps.length).toBeGreaterThan(1);
      if (last.deadlocked) {
        sawDeadlock = true;
        const blocked = last.threads.filter((t) => t.status === "blocked");
        expect(blocked.length).toBe(2);
        expect(blocked.map((t) => t.waitingOn).sort()).toEqual(["A", "B"]);
        // The counter must account for the waits the deadlock frame displays.
        // It read 0 beside two lanes labelled "waiting for …" until the deadlock
        // branch started counting them.
        expect(
          steps[steps.length - 1].counters[CONCURRENCY_COUNTERS.waits] ?? 0,
        ).toBeGreaterThanOrEqual(blocked.length);
      }
    }
    expect(sawDeadlock, "AB/BA never deadlocked in 40 seeds").toBe(true);
  });
});

describe("control flow: retry and condition waits", () => {
  /**
   * Compare-and-swap: read, compute, then swap only if nobody changed the value
   * in between. On failure the op reports "retry" and runs again — the honest
   * shape, because the attempt count depends on contention and is unbounded.
   */
  function casIncrementer(id: string): Thread {
    return {
      id,
      name: id,
      locals: { seen: 0, next: 0 },
      ops: [
        {
          label: "read counter",
          effect: (mem, locals) => {
            locals.seen = mem.counter;
            locals.next = locals.seen + 1;
          },
        },
        {
          label: "CAS counter",
          effect: (mem, locals) => {
            if (mem.counter !== locals.seen) {
              // Somebody else won the race — re-read and try again.
              locals.seen = mem.counter;
              locals.next = locals.seen + 1;
              return "retry";
            }
            mem.counter = locals.next;
          },
        },
      ],
    };
  }

  const casProgram = (threads: number): Program => ({
    memory: { counter: 0 },
    threads: Array.from({ length: threads }, (_, i) => casIncrementer(`T${i + 1}`)),
  });

  it("never loses an update, unlike the unsynchronised version", () => {
    for (let seed = 0; seed < 40; seed++) {
      const steps = interleave(casProgram(3), mulberry32(seed));
      expect(finalCounter(steps), `CAS lost an update at seed ${seed}`).toBe(3);
      expect(steps[steps.length - 1].state.livelocked).toBe(false);
      expect(steps[steps.length - 1].state.deadlocked).toBe(false);
    }
  });

  it("counts retries, and only retries under real contention", () => {
    // One thread can never be beaten, so it must never retry.
    const solo = interleave(casProgram(1), mulberry32(1));
    expect(solo[solo.length - 1].counters[CONCURRENCY_COUNTERS.retries] ?? 0).toBe(0);
    expect(finalCounter(solo)).toBe(1);

    // Across many seeds with three threads, some interleaving must lose a CAS.
    let sawRetry = false;
    for (let seed = 0; seed < 40; seed++) {
      const steps = interleave(casProgram(3), mulberry32(seed));
      if ((steps[steps.length - 1].counters[CONCURRENCY_COUNTERS.retries] ?? 0) > 0) {
        sawRetry = true;
      }
    }
    expect(sawRetry, "3 CAS threads never contended in 40 seeds").toBe(true);
  });

  it("leaves the program counter put on a retry, and labels the frame", () => {
    // Find a run that retried, then check the retry frame did not advance.
    for (let seed = 0; seed < 40; seed++) {
      const steps = interleave(casProgram(3), mulberry32(seed));
      const i = steps.findIndex((s) => s.state.ranOp?.includes("(retry)"));
      if (i < 1) continue;
      const before = steps[i - 1].state.threads.find((t) => t.id === steps[i].state.active)!;
      const after = steps[i].state.threads.find((t) => t.id === steps[i].state.active)!;
      expect(after.pc).toBe(before.pc);
      return;
    }
    throw new Error("no retry frame found to inspect");
  });

  /** Bounded buffer of one: the producer waits for space, the consumer for an item. */
  function bufferProgram(items: number): Program {
    const producer: Thread = {
      id: "producer",
      name: "producer",
      locals: { sent: 0 },
      ops: Array.from({ length: items }, () => [
        {
          label: "wait for space",
          await: { label: "space", ready: (mem: Memory) => mem.buffer === 0 },
          effect: () => {},
        },
        {
          label: "put item",
          effect: (mem: Memory, locals: Locals) => {
            mem.buffer = 1;
            locals.sent += 1;
          },
        },
      ]).flat(),
    };
    const consumer: Thread = {
      id: "consumer",
      name: "consumer",
      locals: { got: 0 },
      ops: Array.from({ length: items }, () => [
        {
          label: "wait for item",
          await: { label: "item", ready: (mem: Memory) => mem.buffer === 1 },
          effect: () => {},
        },
        {
          label: "take item",
          effect: (mem: Memory, locals: Locals) => {
            mem.buffer = 0;
            locals.got += 1;
            mem.consumed += 1;
          },
        },
      ]).flat(),
    };
    return { memory: { buffer: 0, consumed: 0 }, threads: [producer, consumer] };
  }

  it("hands every item across a one-slot buffer without deadlocking", () => {
    for (let seed = 0; seed < 30; seed++) {
      const steps = interleave(bufferProgram(4), mulberry32(seed));
      const last = steps[steps.length - 1].state;
      expect(last.deadlocked, `deadlocked at seed ${seed}`).toBe(false);
      expect(last.livelocked, `livelocked at seed ${seed}`).toBe(false);
      expect(last.memory.consumed).toBe(4);
      // The buffer never holds more than its one slot.
      for (const step of steps) {
        expect(step.state.memory.buffer).toBeLessThanOrEqual(1);
        expect(step.state.memory.buffer).toBeGreaterThanOrEqual(0);
      }
      expect(last.threads.every((t) => t.status === "done")).toBe(true);
    }
  });

  it("shows a condition wait as a labelled block, costing no steps", () => {
    const steps = interleave(bufferProgram(3), mulberry32(2));
    // The consumer must have waited for an item at some point.
    const waiting = steps.find((s) =>
      s.state.threads.some((t) => t.waitingOn === "item"),
    );
    expect(waiting, "consumer never waited for an item").toBeDefined();
    expect(
      steps[steps.length - 1].counters[CONCURRENCY_COUNTERS.waits],
    ).toBeGreaterThan(0);
    // Parking is not busy-waiting: total steps equal the ops actually executed.
    const executed = steps[steps.length - 1].state.threads.reduce(
      (n, t) => n + t.ops,
      0,
    );
    expect(steps[steps.length - 1].counters[CONCURRENCY_COUNTERS.steps]).toBe(
      executed,
    );
  });

  it("reports livelock instead of spinning forever", () => {
    // A CAS that can never succeed: the effect always reports retry.
    const hopeless: Program = {
      memory: { x: 0 },
      threads: [
        {
          id: "T1",
          name: "T1",
          ops: [{ label: "CAS that never wins", effect: () => "retry" }],
        },
      ],
    };
    const steps = interleave(hopeless, mulberry32(1));
    const last = steps[steps.length - 1].state;
    expect(last.livelocked).toBe(true);
    expect(last.deadlocked).toBe(false);
    // Terminated rather than hung, and the retries were counted.
    expect(steps.length).toBeLessThan(200);
    expect(steps[steps.length - 1].counters[CONCURRENCY_COUNTERS.retries]).toBeGreaterThan(0);
  });

  it("reports deadlock when a condition can never become true", () => {
    const stuck: Program = {
      memory: { flag: 0 },
      threads: [
        {
          id: "T1",
          name: "T1",
          ops: [
            {
              label: "wait for a flag nobody sets",
              await: { label: "flag", ready: (mem) => mem.flag === 1 },
            },
          ],
        },
      ],
    };
    const last = interleave(stuck, mulberry32(1));
    const state = last[last.length - 1].state;
    // Not runnable at all ⇒ deadlock, not livelock.
    expect(state.deadlocked).toBe(true);
    expect(state.livelocked).toBe(false);
    expect(state.threads[0].waitingOn).toBe("flag");
  });
});

describe("archetype C rides on archetype B", () => {
  /** A concurrency lesson is just an AlgoDef whose run schedules. */
  const lostUpdate: AlgoDef<ConcurrencyState, Program> = {
    id: "lost-update",
    title: "lost update",
    code: ["read counter", "tmp + 1", "write counter"],
    counters: [
      { key: CONCURRENCY_COUNTERS.steps, label: "steps" },
      { key: CONCURRENCY_COUNTERS.switches, label: "context switches" },
    ],
    size: { label: "threads", min: 2, max: 4, default: 3 },
    generateInput: (_rng, size) => counterProgram(size, false),
    run: (program, rng) => interleave(program, rng),
  };

  it("runs through buildAlgoSteps, reproducibly per seed", () => {
    const steps = buildAlgoSteps(lostUpdate, 3, 42);
    expect(steps).toEqual(buildAlgoSteps(lostUpdate, 3, 42));
    expect(steps[0].state.active).toBeNull();
    expect(finalCounter(steps)).toBeGreaterThanOrEqual(1);
    expect(finalCounter(steps)).toBeLessThanOrEqual(3);
  });

  it("honours the size control by adding threads", () => {
    for (const n of [2, 3, 4]) {
      const steps = buildAlgoSteps(lostUpdate, n, 42);
      expect(steps[0].state.threads).toHaveLength(n);
      expect(steps[steps.length - 1].counters[CONCURRENCY_COUNTERS.steps]).toBe(
        n * 3,
      );
    }
  });

  it("gets step-back for free: earlier frames are not mutated", () => {
    const steps = buildAlgoSteps(lostUpdate, 3, 42);
    expect(steps[0].state.memory.counter).toBe(0);
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
  });

  it("satisfies the view contract the figure requires", () => {
    // Compile-time proof that ThreadsView is a legal `view` prop for a def
    // whose state is ConcurrencyState — the seam AlgoFigure depends on.
    const view: ComponentType<{ state: ConcurrencyState }> = ThreadsView;
    expect(view).toBe(ThreadsView);
  });
});
