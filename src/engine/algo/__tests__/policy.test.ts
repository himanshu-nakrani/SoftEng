import { buildAlgoSteps } from "@/engine/algo/build";
import { POLICY_COUNTERS as C, POLICY_SUBJECTS, runPolicy } from "@/engine/algo/policy";
import type { AlgoDef } from "@/engine/algo/types";
import type { PolicyState } from "@/engine/algo/views/policy";
import { PolicyView } from "@/engine/algo/views/PolicyView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const last = (kind: "rbac" | "abac", i: number) => runPolicy(kind, i).at(-1)!;

describe("runPolicy", () => {
  it("alice and bob are allowed under both", () => {
    expect(POLICY_SUBJECTS[0]!.id).toBe("alice");
    expect(last("rbac", 0).counters[C.allowed]).toBe(1);
    expect(last("abac", 0).counters[C.allowed]).toBe(1);
    expect(last("rbac", 1).counters[C.allowed]).toBe(1);
    expect(last("abac", 1).counters[C.allowed]).toBe(1);
    expect(last("rbac", 0).counters[C.escalation] ?? 0).toBe(0);
    expect(last("abac", 1).counters[C.escalation] ?? 0).toBe(0);
  });

  it("mallory writes under RBAC and is denied under ABAC", () => {
    expect(last("rbac", 2).counters[C.allowed]).toBe(1);
    expect(last("rbac", 2).counters[C.escalation]).toBe(1);
    expect(last("rbac", 2).state.stamp).toBe("escalation");
    expect(last("abac", 2).counters[C.allowed] ?? 0).toBe(0);
    expect(last("abac", 2).counters[C.escalation] ?? 0).toBe(0);
    expect(last("abac", 2).state.stamp).toBe("deny");
    expect(last("abac", 2).state.allowed).toBe(false);
  });

  it("never aliases", () => {
    const steps = runPolicy("rbac", 2);
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
  });
});

describe("policy rides on archetype B", () => {
  const def: AlgoDef<PolicyState, number> = {
    id: "rbac",
    title: "rbac",
    code: ["subject", "match", "decide"],
    counters: [{ key: C.allowed, label: "allowed" }],
    size: { label: "subject", min: 0, max: 2, default: 2 },
    generateInput: (_rng, size) => size,
    run: (size) => runPolicy("rbac", size),
  };

  it("size changes the subject and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 2, 1));
    const view: ComponentType<{ state: PolicyState }> = PolicyView;
    expect(view).toBe(PolicyView);
  });
});
