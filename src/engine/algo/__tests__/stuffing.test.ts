import { buildAlgoSteps } from "@/engine/algo/build";
import {
  STUFFING_COUNTERS as C,
  STUFF_ATTEMPTS,
  STUFF_CAP,
  runStuffing,
  stuffingPolicy,
} from "@/engine/algo/stuffing";
import type { AlgoDef } from "@/engine/algo/types";
import type { StuffingState } from "@/engine/algo/views/stuffing";
import { StuffingView } from "@/engine/algo/views/StuffingView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const last = (policy: "none" | "ip" | "user") => runStuffing(policy).at(-1)!;

describe("runStuffing", () => {
  it("no limit: six attempts, the fifth succeeds", () => {
    expect(STUFF_ATTEMPTS).toHaveLength(6);
    expect(STUFF_ATTEMPTS[4]!.password).toBe("ok");
    const { counters, state } = last("none");
    expect(counters[C.attempts]).toBe(6);
    expect(counters[C.stolen]).toBe(1);
    expect(counters[C.blocked] ?? 0).toBe(0);
    expect(state.attempts[4]!.result).toBe("ok");
  });

  it("IP cap 3 with three addresses lets the rotation through", () => {
    expect(STUFF_CAP).toBe(3);
    const { counters } = last("ip");
    expect(counters[C.stolen]).toBe(1);
    expect(counters[C.blocked] ?? 0).toBe(0);
    expect(counters[C.attempts]).toBe(6);
  });

  it("username cap 3 blocks from attempt 4, so the password never runs", () => {
    const { counters, state } = last("user");
    expect(counters[C.stolen] ?? 0).toBe(0);
    expect(counters[C.blocked]).toBe(3);
    expect(state.attempts.slice(3).every((a) => a.result === "block")).toBe(true);
  });

  it("slider 0/1/2 is none/ip/user", () => {
    expect(stuffingPolicy(0)).toBe("none");
    expect(stuffingPolicy(1)).toBe("ip");
    expect(stuffingPolicy(2)).toBe("user");
  });
});

describe("stuffing rides on archetype B", () => {
  const def: AlgoDef<StuffingState, "none" | "ip" | "user"> = {
    id: "stuff",
    title: "stuffing",
    code: ["try", "bucket", "match"],
    counters: [{ key: C.stolen, label: "stolen" }],
    size: { label: "policy", min: 0, max: 2, default: 0 },
    generateInput: (_rng, size) => stuffingPolicy(size),
    run: (policy) => runStuffing(policy),
  };

  it("size changes the policy and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 2, 1));
    const view: ComponentType<{ state: StuffingState }> = StuffingView;
    expect(view).toBe(StuffingView);
  });
});
