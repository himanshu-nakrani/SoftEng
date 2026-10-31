import { buildAlgoSteps } from "@/engine/algo/build";
import { LOOP_COUNTERS as C, runEventLoop } from "@/engine/algo/eventloop";
import type { AlgoDef } from "@/engine/algo/types";
import type { EventLoopState } from "@/engine/algo/views/eventloop";
import { EventLoopView } from "@/engine/algo/views/EventLoopView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const last = (size: number) => runEventLoop(size).at(-1)!;

describe("runEventLoop", () => {
  it("classic: 1,4,2,3 — micros beat the timer", () => {
    expect(last(0).state.log.join(",")).toBe("1,4,2,3");
    expect(last(0).state.stamp).toBe("1,4,2,3");
    expect(last(0).counters[C.sync]).toBe(2);
    expect(last(0).counters[C.micro]).toBe(1);
    expect(last(0).counters[C.macro]).toBe(1);
  });

  it("two micros then a macro: 1,5,2,3,4", () => {
    expect(last(1).state.log.join(",")).toBe("1,5,2,3,4");
  });

  it("a micro that queues a micro still beats the macro: 1,3,A,B,2", () => {
    expect(last(2).state.log.join(",")).toBe("1,3,A,B,2");
    expect(last(2).counters[C.micro]).toBe(2);
    expect(last(2).counters[C.macro]).toBe(1);
  });
});

describe("eventloop rides on archetype B", () => {
  const def: AlgoDef<EventLoopState, number> = {
    id: "loop",
    title: "loop",
    code: ["sync", "queue micro", "queue macro"],
    counters: [{ key: C.micro, label: "micros" }],
    size: { label: "script", min: 0, max: 2, default: 0 },
    generateInput: (_rng, size) => size,
    run: (size) => runEventLoop(size),
  };

  it("size changes the script and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 2, 1));
    const view: ComponentType<{ state: EventLoopState }> = EventLoopView;
    expect(view).toBe(EventLoopView);
  });
});
