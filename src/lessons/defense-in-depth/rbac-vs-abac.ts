import { POLICY_COUNTERS, runPolicy } from "@/engine/algo/policy";
import type { AlgoDef } from "@/engine/algo/types";
import type { PolicyKind, PolicyState } from "@/engine/algo/views/policy";

/**
 * RBAC vs ABAC — archetype B (`engine: "steps"`).
 *
 * Three subjects write bob's doc1: alice (admin, not owner), bob
 * (editor, owner), mallory (editor, not owner). RBAC grants every
 * editor the write; ABAC grants it only to admin or owner. Mallory
 * writing under RBAC is the escalation the lesson counts.
 *
 * THE CONTRAST IS TWO FIGURES. The slider is the subject, 0 through 2,
 * default 2 (mallory) — the only subject the two policies disagree on.
 * Measured last frames: alice and bob allowed 1 / escalation 0 under
 * both; mallory under RBAC allowed 1 / escalation 1 / stamp
 * "escalation"; under ABAC allowed 0 / escalation 0 / stamp "deny".
 *
 * Escalation = allowed && not admin && not owner. Only mallory under
 * RBAC. Seed is ignored: a policy is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Two rules, no role hierarchy, no
 * deny-overrides, no real PDP. Those change the table. They do not
 * change the argument: a role grant that ignores ownership is
 * horizontal escalation, counted here rather than asserted.
 */

const RBAC_CODE = [
  "subject writes doc1",
  "role grants write",
  "allow or escalate",
];

const ABAC_CODE = [
  "subject writes doc1",
  "admin or owner",
  "allow or deny",
];

const counters = [
  { key: POLICY_COUNTERS.allowed, label: "allowed" },
  { key: POLICY_COUNTERS.escalation, label: "escalation" },
];

const sizeControl = {
  label: "subject",
  min: 0,
  max: 2,
  default: 2,
} as const;

function def(
  id: string,
  title: string,
  kind: PolicyKind,
  code: readonly string[],
): AlgoDef<PolicyState, number> {
  return {
    id,
    title,
    code: [...code],
    counters,
    size: sizeControl,
    generateInput: (_rng, size) => size,
    run: (size) => runPolicy(kind, size),
  };
}

/** Role grants the write. Mallory is an editor, so she writes. */
export const rbacVsAbacAlgo = def(
  "rbac-vs-abac",
  "role writes",
  "rbac",
  RBAC_CODE,
);

/** Attributes grant the write. Mallory is neither admin nor owner. */
export const rbacVsAbacAttrAlgo = def(
  "rbac-vs-abac-attr",
  "owner or admin",
  "abac",
  ABAC_CODE,
);
