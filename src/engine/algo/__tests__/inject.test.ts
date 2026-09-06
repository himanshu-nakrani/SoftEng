import { buildAlgoSteps } from "@/engine/algo/build";
import {
  INJECT_COUNTERS as C,
  SQL_USERS,
  SSRF_METADATA,
  runSqli,
  runSsrf,
  runXss,
} from "@/engine/algo/inject";
import type { AlgoDef } from "@/engine/algo/types";
import type { InjectState } from "@/engine/algo/views/inject";
import { InjectView } from "@/engine/algo/views/InjectView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const lastSql = (mode: "concat" | "param", p: number) => runSqli(mode, p).at(-1)!;
const lastXss = (encode: boolean, p: number) => runXss(encode, p).at(-1)!;
const lastSsrf = (allow: boolean, t: number) => runSsrf(allow, t).at(-1)!;

describe("runSqli", () => {
  it("concat 7 matches one row", () => {
    const { counters, state } = lastSql("concat", 0);
    expect(counters[C.rows]).toBe(1);
    expect(counters[C.injected] ?? 0).toBe(0);
    expect(state.result).toEqual(["7"]);
    expect(SQL_USERS).toEqual(["1", "7", "9"]);
  });

  it("concat OR 1=1 matches all three and counts as injected", () => {
    const { counters, state } = lastSql("concat", 1);
    expect(counters[C.injected]).toBe(1);
    expect(counters[C.rows]).toBe(3);
    expect(state.result).toEqual(["1", "7", "9"]);
    expect(state.ok).toBe(false);
    expect(state.nodes.some((n) => n.text === "OR" && n.role === "taint")).toBe(true);
  });

  it("parameter 7 OR 1=1 matches nobody", () => {
    const { counters, state } = lastSql("param", 1);
    expect(counters[C.injected] ?? 0).toBe(0);
    expect(counters[C.rows] ?? 0).toBe(0);
    expect(state.result).toEqual([]);
    expect(state.ok).toBe(true);
    expect(state.nodes.some((n) => n.role === "lit" && n.text === "7 OR 1=1")).toBe(true);
  });
});

describe("runXss", () => {
  it("Ada is text either way", () => {
    expect(lastXss(false, 0).counters[C.scripts] ?? 0).toBe(0);
    expect(lastXss(true, 0).counters[C.scripts] ?? 0).toBe(0);
  });

  it("raw script becomes a script node; encoded stays text", () => {
    expect(lastXss(false, 1).counters[C.scripts]).toBe(1);
    expect(lastXss(false, 1).state.ok).toBe(false);
    expect(lastXss(true, 1).counters[C.scripts] ?? 0).toBe(0);
    expect(lastXss(true, 1).state.ok).toBe(true);
    expect(lastXss(true, 1).state.result[0]).toBe("&lt;script&gt;");
  });
});

describe("runSsrf", () => {
  it("open fetch of metadata leaks", () => {
    const { counters, state } = lastSsrf(false, 1);
    expect(counters[C.fetched]).toBe(1);
    expect(counters[C.leaked]).toBe(1);
    expect(state.result).toEqual([SSRF_METADATA]);
    expect(state.ok).toBe(false);
  });

  it("allowlist refuses metadata and still fetches the app host", () => {
    expect(lastSsrf(true, 1).counters[C.blocked]).toBe(1);
    expect(lastSsrf(true, 1).counters[C.leaked] ?? 0).toBe(0);
    expect(lastSsrf(true, 0).counters[C.fetched]).toBe(1);
    expect(lastSsrf(true, 0).counters[C.leaked] ?? 0).toBe(0);
  });
});

describe("inject rides on archetype B", () => {
  const def: AlgoDef<InjectState, number> = {
    id: "sqli",
    title: "concat",
    code: ["parse", "match"],
    counters: [{ key: C.rows, label: "rows" }],
    size: { label: "payload", min: 0, max: 1, default: 0 },
    generateInput: (_rng, size) => size,
    run: (size) => runSqli("concat", size),
  };

  it("size changes the payload and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 1, 1));
    const view: ComponentType<{ state: InjectState }> = InjectView;
    expect(view).toBe(InjectView);
  });
});
