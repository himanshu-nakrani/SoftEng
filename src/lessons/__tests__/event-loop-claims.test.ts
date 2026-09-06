import { buildAlgoSteps } from "@/engine/algo/build";
import { LOOP_COUNTERS as C, runEventLoop } from "@/engine/algo/eventloop";
import type { AlgoDef } from "@/engine/algo/types";
import type { EventLoopState } from "@/engine/algo/views/eventloop";
import {
  eventLoopAlgo,
  eventLoopNestedAlgo,
} from "@/lessons/runtime-systems/event-loop";
import { describe, expect, it } from "vitest";

/**
 * The event-loop prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * A toy event loop: one sync turn, then micros drain fully, then one
 * macro. Seed is ignored: a drain order is not a scheduler.
 */

function run(
  def: AlgoDef<EventLoopState, number>,
  size = 0,
  seed = 42,
) {
  const steps = buildAlgoSteps(def, size, seed);
  const first = steps[0]!;
  const last = steps[steps.length - 1]!;
  return {
    steps,
    first,
    last,
    log: last.state.log.join(","),
    stamp: last.state.stamp,
    note: last.note,
    sync: last.counters[C.sync] ?? 0,
    micro: last.counters[C.micro] ?? 0,
    macro: last.counters[C.macro] ?? 0,
    notes: steps.map((s) => s.note),
  };
}

const SIZES = [0, 1, 2] as const;

describe("event-loop: the slider is which script, 0 through 2", () => {
  it("offers 0 through 2, default 0, labelled script", () => {
    // "The slider is which script, from 0 to 2. Default 0 is the measured run."
    expect(eventLoopAlgo.id).toBe("event-loop");
    expect(eventLoopAlgo.size).toMatchObject({
      min: 0,
      max: 2,
      default: 0,
      label: "script",
    });
    expect(eventLoopAlgo.counters.map((c) => c.key)).toEqual([
      C.sync,
      C.micro,
      C.macro,
    ]);
  });

  it("maps 0..2 onto runEventLoop(size)", () => {
    // "Leave script at 0." / "Drag to 1." / "Drag to 2."
    expect(eventLoopAlgo.generateInput(() => 0, 0)).toBe(0);
    expect(eventLoopAlgo.generateInput(() => 0, 1)).toBe(1);
    expect(eventLoopAlgo.generateInput(() => 0, 2)).toBe(2);
  });

  it("ignores the seed: a drain order is not a scheduler", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(eventLoopAlgo, size, 1)).toEqual(
        buildAlgoSteps(eventLoopAlgo, size, 99),
      );
    }
    expect(buildAlgoSteps(eventLoopNestedAlgo, 2, 1)).toEqual(
      buildAlgoSteps(eventLoopNestedAlgo, 2, 99),
    );
  });

  it("the lesson def is the same run as runEventLoop on that script", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(eventLoopAlgo, size, 42)).toEqual(
        runEventLoop(size),
      );
    }
  });
});

describe("event-loop: first frame is an empty log on every script", () => {
  it("opens with stamp loop and no work logged", () => {
    // "The first caption is "One micro, one macro." Stamp is loop."
    // "The first caption is "A micro queues another micro." Stamp is loop."
    const captions = [
      "One micro, one macro.",
      "Two micros, one macro.",
      "A micro queues another micro.",
    ] as const;
    for (const size of SIZES) {
      const { first } = run(eventLoopAlgo, size);
      expect(first.state.log).toEqual([]);
      expect(first.state.stamp).toBe("loop");
      expect(first.counters[C.sync] ?? 0).toBe(0);
      expect(first.counters[C.micro] ?? 0).toBe(0);
      expect(first.counters[C.macro] ?? 0).toBe(0);
      expect(first.note).toBe(captions[size]);
    }
  });
});

describe("event-loop: script 0 is 1,4,2,3 — micros beat the timer", () => {
  it("ends at stamp 1,4,2,3, sync 2, micro 1, macro 1", () => {
    // "Last caption "Log 1,4,2,3." Meters: sync 2, micro 1, macro 1. Stamp 1,4,2,3."
    // "Log 1, queue micro 2, queue macro 3, log 4 → 1,4,2,3."
    const c = run(eventLoopAlgo, 0);
    expect(c.log).toBe("1,4,2,3");
    expect(c.stamp).toBe("1,4,2,3");
    expect(c.sync).toBe(2);
    expect(c.micro).toBe(1);
    expect(c.macro).toBe(1);
    expect(c.note).toBe("Log 1,4,2,3.");
    expect(c.last.state.log).toEqual(["1", "4", "2", "3"]);
  });

  it("walks log 1, queue micro 2, queue macro 3, log 4, then micro then macro", () => {
    // "Step: "Log 1." "Queue micro 2." "Queue macro 3." "Log 4." Then "Micro 2." then "Macro 3.""
    // "The 4 printed before the queued 2, and 2 ran before the timer 3."
    const { notes, log } = run(eventLoopAlgo, 0);
    expect(notes).toEqual([
      "One micro, one macro.",
      "Log 1.",
      "Queue micro 2.",
      "Queue macro 3.",
      "Log 4.",
      "Micro 2.",
      "Macro 3.",
      "Log 1,4,2,3.",
    ]);
    expect(log.indexOf("4")).toBeLessThan(log.indexOf("2"));
    expect(log.indexOf("2")).toBeLessThan(log.indexOf("3"));
  });
});

describe("event-loop: script 1 is two micros then a timer", () => {
  it("ends at stamp 1,5,2,3,4, sync 2, micro 2, macro 1", () => {
    // "Drag to 1. First caption: "Two micros, one macro.""
    // "Last caption "Log 1,5,2,3,4." Stamp 1,5,2,3,4. Meters: sync 2, micro 2, macro 1."
    const c = run(eventLoopAlgo, 1);
    expect(c.log).toBe("1,5,2,3,4");
    expect(c.stamp).toBe("1,5,2,3,4");
    expect(c.sync).toBe(2);
    expect(c.micro).toBe(2);
    expect(c.macro).toBe(1);
    expect(c.note).toBe("Log 1,5,2,3,4.");
    expect(c.notes[0]).toBe("Two micros, one macro.");
  });
});

describe("event-loop: script 2 is a nested micro that still beats the timer", () => {
  it("ends at stamp 1,3,A,B,2, micro 2, macro 1", () => {
    // "A micro that queues micro B still beats the timer: 1,3,A,B,2."
    // "Last caption "Log 1,3,A,B,2." Meters: sync 2, micro 2, macro 1. Stamp 1,3,A,B,2."
    // "Nested micro still beats the timer."
    const c = run(eventLoopAlgo, 2);
    expect(c.log).toBe("1,3,A,B,2");
    expect(c.stamp).toBe("1,3,A,B,2");
    expect(c.sync).toBe(2);
    expect(c.micro).toBe(2);
    expect(c.macro).toBe(1);
    expect(c.note).toBe("Log 1,3,A,B,2.");
    expect(c.log.indexOf("B")).toBeLessThan(c.log.indexOf("2"));
  });

  it("A queues B after A runs, and B still drains before the timer", () => {
    // "Then "Micro A." A queues B: "Queue micro B." B is new work, still a micro, so it drains before the timer."
    const { notes } = run(eventLoopAlgo, 2);
    expect(notes).toEqual([
      "A micro queues another micro.",
      "Log 1.",
      "Queue micro A.",
      "Queue macro 2.",
      "Log 3.",
      "Micro A.",
      "Queue micro B.",
      "Micro B.",
      "Macro 2.",
      "Log 1,3,A,B,2.",
    ]);
  });
});

describe("event-loop-nested: script 2, no slider", () => {
  it("has no size control and always runs script 2", () => {
    // "This figure is script 2, no slider."
    // "The next figure is that run, with no slider."
    expect(eventLoopNestedAlgo.id).toBe("event-loop-nested");
    expect(eventLoopNestedAlgo.size).toBeUndefined();
    expect(eventLoopNestedAlgo.generateInput(() => 0, 0)).toBe(2);
    expect(eventLoopNestedAlgo.generateInput(() => 0, 99)).toBe(2);
    expect(buildAlgoSteps(eventLoopNestedAlgo, 0, 42)).toEqual(runEventLoop(2));
    expect(buildAlgoSteps(eventLoopNestedAlgo, 12, 42)).toEqual(
      runEventLoop(2),
    );
    expect(buildAlgoSteps(eventLoopNestedAlgo, 2, 42)).toEqual(
      buildAlgoSteps(eventLoopAlgo, 2, 42),
    );
  });

  it("last frame matches script 2 on the slider def", () => {
    // "Nested micro still beats the timer. The micro queue drains fully, including work it just queued. Then one macrotask."
    const nested = run(eventLoopNestedAlgo);
    const slider = run(eventLoopAlgo, 2);
    expect(nested.log).toBe("1,3,A,B,2");
    expect(nested.stamp).toBe(slider.stamp);
    expect(nested.micro).toBe(2);
    expect(nested.macro).toBe(1);
    expect(nested.sync).toBe(2);
    expect(nested.note).toBe("Log 1,3,A,B,2.");
    expect(nested.first.note).toBe("A micro queues another micro.");
  });
});
