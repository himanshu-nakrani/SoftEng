import { buildAlgoSteps } from "@/engine/algo/build";
import {
  INJECT_COUNTERS as C,
  SSRF_ALLOW,
  SSRF_METADATA,
  SSRF_TARGETS,
  runSsrf,
} from "@/engine/algo/inject";
import type { AlgoDef } from "@/engine/algo/types";
import type { InjectState } from "@/engine/algo/views/inject";
import { ssrfAlgo, ssrfAllowAlgo } from "@/lessons/application-security/ssrf";
import { describe, expect, it } from "vitest";

/**
 * The ssrf prose states numbers. A failure here means the page now lies,
 * and the message should name the sentence that became untrue.
 *
 * Two hosts, no DNS rebinding, no real cloud. Seed is ignored.
 */

function run<I>(def: AlgoDef<InjectState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    fetched: last.counters[C.fetched] ?? 0,
    leaked: last.counters[C.leaked] ?? 0,
    blocked: last.counters[C.blocked] ?? 0,
    stamp: last.state.stamp,
    ok: last.state.ok,
    result: last.state.result,
    note: last.note,
    notes: steps.map((s) => s.note),
  };
}

describe("ssrf · two hosts, the slider is the target", () => {
  it("offers 0 through 1, default 1, labelled target", () => {
    // "The slider is the target, 0 or 1. Default 1 is the measured run."
    expect(ssrfAlgo.id).toBe("ssrf");
    expect(ssrfAllowAlgo.id).toBe("ssrf-allow");
    expect(ssrfAlgo.size).toMatchObject({
      min: 0,
      max: 1,
      default: 1,
      label: "target",
    });
    expect(ssrfAllowAlgo.size).toEqual(ssrfAlgo.size);
    expect(ssrfAlgo.counters.map((c) => c.key)).toEqual([
      C.fetched,
      C.leaked,
      C.blocked,
    ]);
  });

  it("the two hosts are api.example.com and 169.254.169.254", () => {
    // "Two hosts. Target 0 is api.example.com, the app host. Target 1
    // is 169.254.169.254, the well-known cloud metadata address."
    expect(SSRF_TARGETS).toEqual(["api.example.com", "169.254.169.254"]);
    expect(SSRF_ALLOW).toBe("api.example.com");
    expect(SSRF_METADATA).toBe("169.254.169.254");
    expect(ssrfAlgo.generateInput(() => 0, 0)).toBe(0);
    expect(ssrfAlgo.generateInput(() => 0, 1)).toBe(1);
  });

  it("ignores the seed: a host check is not a scheduler", () => {
    expect(buildAlgoSteps(ssrfAlgo, 1, 1)).toEqual(
      buildAlgoSteps(ssrfAlgo, 1, 99),
    );
    expect(buildAlgoSteps(ssrfAllowAlgo, 1, 1)).toEqual(
      buildAlgoSteps(ssrfAllowAlgo, 1, 99),
    );
  });

  it("the lesson defs are the same runs as runSsrf", () => {
    expect(buildAlgoSteps(ssrfAlgo, 0, 42)).toEqual(runSsrf(false, 0));
    expect(buildAlgoSteps(ssrfAlgo, 1, 42)).toEqual(runSsrf(false, 1));
    expect(buildAlgoSteps(ssrfAllowAlgo, 0, 42)).toEqual(runSsrf(true, 0));
    expect(buildAlgoSteps(ssrfAllowAlgo, 1, 42)).toEqual(runSsrf(true, 1));
  });
});

describe("ssrf · open 0 fetches the app host", () => {
  it("fetched 1, leaked 0, stamp fetched", () => {
    // "Drag to 0. fetched is 1, leaked is 0. The stamp reads fetched."
    // "Target 0 is an open fetch of api.example.com: fetched 1 leaked 0,
    // stamp fetched."
    const last = run(ssrfAlgo, 0);
    expect(last.fetched).toBe(1);
    expect(last.leaked).toBe(0);
    expect(last.blocked).toBe(0);
    expect(last.stamp).toBe("fetched");
    expect(last.ok).toBe(true);
    expect(last.result).toEqual(["api.example.com"]);
  });
});

describe("ssrf · open 1 leaks metadata", () => {
  it("fetched 1, leaked 1, result 169.254.169.254, ok false, stamp metadata", () => {
    // "An open fetch of 169.254.169.254 is fetched 1 leaked 1."
    // "The stamp reads metadata."
    // "The FETCH chip is 169.254.169.254. The run is marked fail."
    const last = run(ssrfAlgo, 1);
    expect(last.fetched).toBe(1);
    expect(last.leaked).toBe(1);
    expect(last.result).toEqual(["169.254.169.254"]);
    expect(last.result).toEqual([SSRF_METADATA]);
    expect(last.ok).toBe(false);
    expect(last.stamp).toBe("metadata");
  });

  it("notes are Fetch, Host, then the metadata read", () => {
    // "The first caption is "Fetch 169.254.169.254.""
    // "Host 169.254.169.254."
    // "Open fetch reads the metadata endpoint."
    const { notes } = run(ssrfAlgo, 1);
    expect(notes).toEqual([
      "Fetch 169.254.169.254.",
      "Host 169.254.169.254.",
      "Open fetch reads the metadata endpoint.",
    ]);
  });
});

describe("ssrf · allow 0 still fetches the app host", () => {
  it("fetched 1, leaked 0", () => {
    // "Drag to 0. fetched is 1, leaked is 0. The stamp reads fetched."
    // "api.example.com is fetched either way, leaked 0."
    const last = run(ssrfAllowAlgo, 0);
    expect(last.fetched).toBe(1);
    expect(last.leaked).toBe(0);
    expect(last.blocked).toBe(0);
    expect(last.stamp).toBe("fetched");
    expect(last.result).toEqual(["api.example.com"]);
    const open = run(ssrfAlgo, 0);
    expect(open.fetched).toBe(1);
    expect(open.leaked).toBe(0);
  });
});

describe("ssrf · allow 1 blocks metadata", () => {
  it("blocked 1, leaked 0, stamp blocked", () => {
    // "The same host against an allowlist of api.example.com is blocked
    // 1 leaked 0."
    // "The stamp reads blocked. FETCH reads none."
    const last = run(ssrfAllowAlgo, 1);
    expect(last.blocked).toBe(1);
    expect(last.leaked).toBe(0);
    expect(last.fetched).toBe(0);
    expect(last.stamp).toBe("blocked");
    expect(last.ok).toBe(true);
    expect(last.result).toEqual([]);
  });

  it("the last caption is Allowlist refuses that host", () => {
    // "Step to the last caption: "Allowlist refuses that host.""
    const last = run(ssrfAllowAlgo, 1);
    expect(last.note).toBe("Allowlist refuses that host.");
  });
});
