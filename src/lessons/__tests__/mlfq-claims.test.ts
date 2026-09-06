import { buildAlgoSteps } from "@/engine/algo/build";
import {
  SCHED_COUNTERS as C,
  runScheduler,
  waitTime,
  type SchedConfig,
} from "@/engine/algo/scheduler";
import type { AlgoDef } from "@/engine/algo/types";
import type { SchedulerState } from "@/engine/algo/views/scheduler";
import { mlfqAgingAlgo, mlfqAlgo } from "@/lessons/cpu-scheduling/mlfq";
import { describe, expect, it } from "vitest";

/**
 * The mlfq prose states numbers. A failure here means the page now lies,
 * and the message should name the sentence that became untrue.
 */

function last(def: AlgoDef<SchedulerState, SchedConfig>, size: number) {
  const steps = buildAlgoSteps(def, size, 42);
  const final = steps[steps.length - 1]!;
  const { state, counters } = final;
  return {
    steps,
    state,
    counters,
    wait: (id: string) => waitTime(state, id),
    task: (id: string) => state.tasks.find((t) => t.id === id)!,
    finished: (id: string) =>
      state.tasks.find((t) => t.id === id)?.finishedAt ?? null,
    ages: steps.filter((s) => s.note?.startsWith("Aging")).length,
  };
}

const none = () => last(mlfqAlgo, 1);
const aged = (every: number) => last(mlfqAgingAlgo, every);

describe("mlfq · no aging", () => {
  it("starts both in Q0, bursts 8 and 1, quanta 1/2/4", () => {
    // "Three queues, with quanta 1 / 2 / 4"
    // "LONG needs 8 CPU steps; SHORT needs 1. ... Both start in Q0"
    const first = none().steps[0]!;
    expect(first.state.stamp).toBe("mlfq · Q0/Q1/Q2 · quanta 1/2/4");
    expect(first.state.levels?.[0]).toEqual(["LONG", "SHORT"]);
    expect(first.state.tasks.map((t) => ({
      id: t.id,
      burst: t.burst,
      level: t.level,
    }))).toEqual([
      { id: "LONG", burst: 8, level: 0 },
      { id: "SHORT", burst: 1, level: 0 },
    ]);
  });

  it("SHORT finishes at t=2 and stays in Q0; LONG finishes at t=9 in Q2", () => {
    // "SHORT completes at t=2. Its chip still says Q0."
    // "LONG is done@9 in Q2."
    const run = none();
    expect(run.finished("SHORT")).toBe(2);
    expect(run.task("SHORT").level).toBe(0);
    expect(run.finished("LONG")).toBe(9);
    expect(run.task("LONG").level).toBe(2);
  });

  it("demotes twice, with a third preemption that cannot sink further", () => {
    // "Demotions is 2. Preemptions is 3 — the last timer found nowhere
    // lower to go."
    const run = none();
    expect(run.counters[C.demotions]).toBe(2);
    expect(run.counters[C.preemptions]).toBe(3);
    const demotes = run.steps.filter((s) => s.note?.includes("demoted"));
    expect(demotes.map((s) => s.note)).toEqual([
      "Timer: LONG demoted Q0 → Q1.",
      "Timer: LONG demoted Q1 → Q2.",
    ]);
    expect(demotes[0]!.state.time).toBe(1);
    expect(demotes[1]!.state.time).toBe(4);
    expect(run.steps.some((s) => s.note === "Timer: LONG stays in Q2.")).toBe(
      true,
    );
  });

  it("SHORT waited 1 and LONG waited 1", () => {
    // "SHORT waited 1 — LONG's first quantum. LONG waited 1 — SHORT's burst."
    const run = none();
    expect(run.wait("SHORT")).toBe(1);
    expect(run.wait("LONG")).toBe(1);
  });

  it("does 9 cpu steps with 5 switches", () => {
    // "Cpu steps end at 9, the same work either policy would do. Switches
    // is 5: LONG was dispatched four times, SHORT once."
    const run = none();
    expect(run.counters[C.steps]).toBe(9);
    expect(run.counters[C.switches]).toBe(5);
  });

  it("the first timer is the Q0 demotion, then SHORT is dispatched", () => {
    // "Step until the first timer: LONG is demoted Q0 → Q1, and SHORT is
    // dispatched from Q0. Demotions reads 1."
    const { steps } = none();
    const firstDemote = steps.find((s) => s.note?.includes("demoted"))!;
    expect(firstDemote.note).toBe("Timer: LONG demoted Q0 → Q1.");
    expect(firstDemote.counters[C.demotions]).toBe(1);
    expect(firstDemote.state.time).toBe(1);
    const after = steps.slice(steps.indexOf(firstDemote) + 1);
    expect(after[0]!.note).toBe("Dispatch SHORT from Q0.");
  });

  it("has no size slider — aging is a different figure", () => {
    expect(mlfqAlgo.size).toBeUndefined();
  });
});

describe("mlfq · cooperative contrast", () => {
  it("cooperative FIFO on this pair finishes SHORT at t=9 after waiting 8", () => {
    // "Cooperative FIFO on this pair would finish SHORT at t=9 — waiting
    // the whole of LONG's burst."
    const steps = runScheduler({
      policy: "cooperative",
      quantum: 1,
      tasks: [
        { id: "LONG", burst: 8 },
        { id: "SHORT", burst: 1 },
      ],
    });
    const state = steps[steps.length - 1]!.state;
    expect(state.tasks.find((t) => t.id === "SHORT")!.finishedAt).toBe(9);
    expect(waitTime(state, "SHORT")).toBe(8);
  });
});

describe("mlfq · aging", () => {
  it("offers age-every 0 through 12, default 4", () => {
    expect(mlfqAgingAlgo.size).toMatchObject({
      min: 0,
      max: 12,
      default: 4,
    });
  });

  it("at 4, LONG is lifted off Q2 at t=4 and again at t=8, finishes in Q0 after 4 demotions", () => {
    // "Step to t=4: LONG has just landed in Q2, then the caption reads
    // 'Aging: everyone returns to Q0.'"
    // "A second boost at t=8 catches LONG on the CPU. It is done@9 in Q0.
    // Demotions read 4 — it sank twice. SHORT is still done@2 in Q0."
    const run = aged(4);
    const ageNotes = run.steps.filter((s) => s.note?.startsWith("Aging"));
    expect(ageNotes).toHaveLength(2);
    expect(ageNotes[0]!.state.time).toBe(4);
    expect(ageNotes[0]!.note).toBe("Aging: everyone returns to Q0.");
    const beforeFirstAge = run.steps[run.steps.indexOf(ageNotes[0]!) - 1]!;
    expect(beforeFirstAge.note).toBe("Timer: LONG demoted Q1 → Q2.");
    expect(ageNotes[1]!.state.time).toBe(8);
    expect(run.finished("LONG")).toBe(9);
    expect(run.task("LONG").level).toBe(0);
    expect(run.counters[C.demotions]).toBe(4);
    expect(run.finished("SHORT")).toBe(2);
    expect(run.task("SHORT").level).toBe(0);
  });

  it("at 0 matches the no-aging figure: LONG ends in Q2 with 2 demotions", () => {
    // "Drag to 0: LONG ends in Q2 with 2 demotions, same as the figure above."
    const off = aged(0);
    const baseline = none();
    expect(off.finished("LONG")).toBe(9);
    expect(off.task("LONG").level).toBe(2);
    expect(off.counters[C.demotions]).toBe(2);
    expect(off.counters[C.preemptions]).toBe(baseline.counters[C.preemptions]);
    expect(off.counters[C.switches]).toBe(baseline.counters[C.switches]);
    expect(off.ages).toBe(0);
  });

  it("at 8 still demotes twice, but LONG finishes in Q0", () => {
    // "Drag to 8: still 2 demotions, but LONG finishes in Q0 — the boost
    // caught it after the Q2 slice."
    const run = aged(8);
    expect(run.counters[C.demotions]).toBe(2);
    expect(run.task("LONG").level).toBe(0);
    expect(run.finished("LONG")).toBe(9);
  });

  it("a period of 9 or more never fires, so 12 is identical to 0", () => {
    // "Drag to 12: identical to 0. The run is 9 steps, so a period of 9
    // or more never fires."
    for (const every of [9, 10, 11, 12]) {
      const run = aged(every);
      expect(run.ages).toBe(0);
      expect(run.task("LONG").level).toBe(2);
      expect(run.counters[C.demotions]).toBe(2);
      expect(run.finished("LONG")).toBe(9);
    }
  });

  it("did not make LONG finish earlier: both runs end at t=9", () => {
    // "Aging did not make LONG finish earlier. Both runs end at t=9."
    expect(none().finished("LONG")).toBe(9);
    expect(aged(4).finished("LONG")).toBe(9);
    expect(none().counters[C.steps]).toBe(9);
    expect(aged(4).counters[C.steps]).toBe(9);
  });
});
