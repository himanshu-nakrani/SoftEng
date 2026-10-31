import { buildAlgoSteps } from "@/engine/algo/build";
import {
  POLICY_COUNTERS as C,
  POLICY_RESOURCE,
  POLICY_SUBJECTS,
  runPolicy,
} from "@/engine/algo/policy";
import type { AlgoDef } from "@/engine/algo/types";
import type { PolicyKind, PolicyState } from "@/engine/algo/views/policy";
import {
  rbacVsAbacAlgo,
  rbacVsAbacAttrAlgo,
} from "@/lessons/defense-in-depth/rbac-vs-abac";
import { describe, expect, it } from "vitest";

/**
 * The rbac-vs-abac prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * Both figures drive `runPolicy` with the subject index as the SIZE
 * argument. Seed is ignored: a policy is not a scheduler.
 */

function last(def: AlgoDef<PolicyState, number>, subject: number, seed = 42) {
  const steps = buildAlgoSteps(def, subject, seed);
  const final = steps[steps.length - 1]!;
  return {
    steps,
    state: final.state,
    counters: final.counters,
    allowed: final.counters[C.allowed] ?? 0,
    escalation: final.counters[C.escalation] ?? 0,
    stamp: final.state.stamp,
    note: final.note,
    ok: final.state.allowed,
  };
}

const SUBJECTS = [0, 1, 2] as const;

describe("rbac-vs-abac · the slider is the subject, 0 through 2", () => {
  it("offers 0 through 2, default 2 (mallory)", () => {
    // "The slider is which of those three is asking — 0, 1, or 2.
    // Default 2 is mallory, because that is the subject the two
    // policies disagree on."
    for (const def of [rbacVsAbacAlgo, rbacVsAbacAttrAlgo]) {
      expect(def.size).toMatchObject({
        min: 0,
        max: 2,
        default: 2,
        label: "subject",
      });
    }
    expect(rbacVsAbacAlgo.id).toBe("rbac-vs-abac");
    expect(rbacVsAbacAttrAlgo.id).toBe("rbac-vs-abac-attr");
    expect(rbacVsAbacAlgo.counters.map((c) => c.key)).toEqual([
      C.allowed,
      C.escalation,
    ]);
    expect(rbacVsAbacAttrAlgo.counters.map((c) => c.key)).toEqual([
      C.allowed,
      C.escalation,
    ]);
  });

  it("maps 0, 1, 2 onto alice, bob, mallory writing bob's doc1", () => {
    // "The action is one write: doc1, owned by bob."
    // "alice is an admin and does not own the doc. bob is an editor
    // and owns it. mallory is an editor and does not."
    expect(POLICY_SUBJECTS.map((s) => s.id)).toEqual([
      "alice",
      "bob",
      "mallory",
    ]);
    expect(POLICY_SUBJECTS[0]).toMatchObject({
      id: "alice",
      role: "admin",
      owner: false,
    });
    expect(POLICY_SUBJECTS[1]).toMatchObject({
      id: "bob",
      role: "editor",
      owner: true,
    });
    expect(POLICY_SUBJECTS[2]).toMatchObject({
      id: "mallory",
      role: "editor",
      owner: false,
    });
    expect(POLICY_RESOURCE).toEqual({ id: "doc1", owner: "bob" });
  });

  it("ignores the seed: a policy is not a scheduler", () => {
    for (const def of [rbacVsAbacAlgo, rbacVsAbacAttrAlgo]) {
      for (const s of SUBJECTS) {
        expect(buildAlgoSteps(def, s, 1)).toEqual(buildAlgoSteps(def, s, 99));
      }
    }
  });

  it("the lesson defs are the same run as runPolicy at every subject", () => {
    for (const s of SUBJECTS) {
      expect(buildAlgoSteps(rbacVsAbacAlgo, s, 42)).toEqual(
        runPolicy("rbac", s),
      );
      expect(buildAlgoSteps(rbacVsAbacAttrAlgo, s, 42)).toEqual(
        runPolicy("abac", s),
      );
    }
  });
});

describe("rbac-vs-abac · all six last frames (2 kinds × 3 subjects)", () => {
  it("RBAC 0 alice: allowed 1, escalation 0, stamp allow", () => {
    // "Drag to 0 (alice) and 1 (bob). Both allow. allowed 1,
    // escalation 0, stamp allow."
    const run = last(rbacVsAbacAlgo, 0);
    expect(run.allowed).toBe(1);
    expect(run.escalation).toBe(0);
    expect(run.stamp).toBe("allow");
    expect(run.ok).toBe(true);
    expect(run.note).toBe("alice is allowed.");
  });

  it("RBAC 1 bob: allowed 1, escalation 0, stamp allow", () => {
    // "Drag to 0 (alice) and 1 (bob). Both allow. allowed 1,
    // escalation 0, stamp allow."
    const run = last(rbacVsAbacAlgo, 1);
    expect(run.allowed).toBe(1);
    expect(run.escalation).toBe(0);
    expect(run.stamp).toBe("allow");
    expect(run.ok).toBe(true);
    expect(run.note).toBe("bob is allowed.");
  });

  it("RBAC 2 mallory: allowed 1, escalation 1, stamp escalation", () => {
    // "Last frame: 'mallory writes a doc they do not own.' The stamp
    // reads escalation. allowed is 1, escalation is 1."
    const run = last(rbacVsAbacAlgo, 2);
    expect(run.allowed).toBe(1);
    expect(run.escalation).toBe(1);
    expect(run.stamp).toBe("escalation");
    expect(run.ok).toBe(true);
    expect(run.note).toBe("mallory writes a doc they do not own.");
  });

  it("ABAC 0 alice: allowed 1, escalation 0", () => {
    // "Alice (admin) and bob (owner) are allowed under both. allowed
    // 1, escalation 0."
    const run = last(rbacVsAbacAttrAlgo, 0);
    expect(run.allowed).toBe(1);
    expect(run.escalation).toBe(0);
    expect(run.stamp).toBe("allow");
    expect(run.ok).toBe(true);
    expect(run.note).toBe("alice is allowed.");
  });

  it("ABAC 1 bob: allowed 1, escalation 0", () => {
    // "Alice (admin) and bob (owner) are allowed under both. allowed
    // 1, escalation 0."
    const run = last(rbacVsAbacAttrAlgo, 1);
    expect(run.allowed).toBe(1);
    expect(run.escalation).toBe(0);
    expect(run.stamp).toBe("allow");
    expect(run.ok).toBe(true);
    expect(run.note).toBe("bob is allowed.");
  });

  it("ABAC 2 mallory: allowed 0, escalation 0, stamp deny, allowed false", () => {
    // "Last frame: 'mallory is denied.' The stamp reads deny.
    // allowed is 0, escalation is 0."
    const run = last(rbacVsAbacAttrAlgo, 2);
    expect(run.allowed).toBe(0);
    expect(run.escalation).toBe(0);
    expect(run.stamp).toBe("deny");
    expect(run.ok).toBe(false);
    expect(run.note).toBe("mallory is denied.");
  });
});

describe("rbac-vs-abac · mallory under RBAC is the escalation", () => {
  it("the four captions at subject 2 are the ones the TryThis names", () => {
    // "Leave subject at 2. The first caption is 'mallory writes doc1.'"
    // "Step. 'mallory role=editor owner=no.' Then 'RBAC: editor writes.'"
    // "Last frame: 'mallory writes a doc they do not own.'"
    const notes = last(rbacVsAbacAlgo, 2).steps.map((s) => s.note);
    expect(notes).toEqual([
      "mallory writes doc1.",
      "mallory role=editor owner=no.",
      "RBAC: editor writes.",
      "mallory writes a doc they do not own.",
    ]);
  });

  it("ABAC at the same subject fires no rule and denies", () => {
    // "Same first captions: 'mallory writes doc1.' then 'mallory
    // role=editor owner=no.'"
    // "Step to the rules. 'ABAC: no rule fires.' Last frame:
    // 'mallory is denied.'"
    const notes = last(rbacVsAbacAttrAlgo, 2).steps.map((s) => s.note);
    expect(notes).toEqual([
      "mallory writes doc1.",
      "mallory role=editor owner=no.",
      "ABAC: no rule fires.",
      "mallory is denied.",
    ]);
  });

  it("escalation is allowed && not admin && not owner — only mallory under RBAC", () => {
    // "Horizontal escalation is a grant that is not admin and not
    // owner: allowed, and the wrong person."
    // "a role grant that ignores ownership is horizontal escalation,
    // counted here as allowed 1 with escalation 1."
    const kinds: PolicyKind[] = ["rbac", "abac"];
    for (const kind of kinds) {
      for (const s of SUBJECTS) {
        const who = POLICY_SUBJECTS[s]!;
        const frame = runPolicy(kind, s).at(-1)!;
        const allowed = frame.state.allowed;
        const escalation = allowed && who.role !== "admin" && !who.owner;
        expect(frame.counters[C.escalation] ?? 0).toBe(escalation ? 1 : 0);
        expect(escalation).toBe(kind === "rbac" && s === 2);
      }
    }
    expect(last(rbacVsAbacAlgo, 2).escalation).toBe(1);
    expect(last(rbacVsAbacAttrAlgo, 2).escalation).toBe(0);
    expect(last(rbacVsAbacAlgo, 0).escalation).toBe(0);
    expect(last(rbacVsAbacAlgo, 1).escalation).toBe(0);
  });
});
