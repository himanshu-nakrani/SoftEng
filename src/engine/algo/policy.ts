import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { PolicyFact, PolicyKind, PolicyRule, PolicyState } from "./views/policy";

/**
 * Access-control machines for archetype B.
 *
 * Three subjects want to write bob's doc: alice (admin), bob (editor,
 * owner), mallory (editor, not owner). RBAC grants every editor the
 * write; ABAC grants it only to admin or owner. Mallory writing under
 * RBAC is the escalation the lesson counts.
 *
 * Deliberately absent: role hierarchies, deny-overrides, a real PDP.
 * The argument is who the same action is allowed for, measured twice.
 */

export const POLICY_COUNTERS = {
  allowed: "allowed",
  escalation: "escalation",
} as const;

export const POLICY_SUBJECTS = [
  { id: "alice", role: "admin", owner: false },
  { id: "bob", role: "editor", owner: true },
  { id: "mallory", role: "editor", owner: false },
] as const;

export const POLICY_RESOURCE = { id: "doc1", owner: "bob" } as const;

export function runPolicy(kind: PolicyKind, subjectIndex: number): AlgoStep<PolicyState>[] {
  const who = POLICY_SUBJECTS[subjectIndex] ?? POLICY_SUBJECTS[0]!;
  let subject: PolicyFact[] = [];
  let resource: PolicyFact[] = [];
  let rules: PolicyRule[] = [];
  let stamp: string = kind;
  let allowed = false;
  const rec = new StepRecorder<PolicyState>(() => ({
    kind,
    subject: subject.map((f) => ({ ...f })),
    resource: resource.map((f) => ({ ...f })),
    rules: rules.map((r) => ({ ...r })),
    stamp,
    allowed,
  }));

  rec.record({ note: `${who.id} writes ${POLICY_RESOURCE.id}.` });

  subject = [
    { label: "id", value: who.id, active: true },
    { label: "role", value: who.role, active: false },
    { label: "owner", value: who.owner ? "yes" : "no", active: false },
  ];
  resource = [
    { label: "doc", value: POLICY_RESOURCE.id, active: false },
    { label: "owner", value: POLICY_RESOURCE.owner, active: false },
  ];
  rec.record({
    codeLine: 0,
    note: `${who.id} role=${who.role} owner=${who.owner ? "yes" : "no"}.`,
  });

  if (kind === "rbac") {
    const admin = who.role === "admin";
    const editor = who.role === "editor";
    rules = [
      { label: "admin writes", fired: admin, active: admin },
      { label: "editor writes", fired: editor, active: editor },
    ];
    allowed = admin || editor;
    rec.record({
      codeLine: 1,
      note: admin ? "RBAC: admin writes." : "RBAC: editor writes.",
    });
  } else {
    const admin = who.role === "admin";
    const owner = who.owner;
    rules = [
      { label: "admin writes", fired: admin, active: admin },
      { label: "owner writes", fired: owner, active: owner && !admin },
    ];
    allowed = admin || owner;
    rec.record({
      codeLine: 1,
      note: admin ? "ABAC: admin writes." : owner ? "ABAC: owner writes." : "ABAC: no rule fires.",
    });
  }

  if (allowed) rec.bump(POLICY_COUNTERS.allowed);
  const escalation = allowed && who.role !== "admin" && !who.owner;
  if (escalation) rec.bump(POLICY_COUNTERS.escalation);
  stamp = allowed ? (escalation ? "escalation" : "allow") : "deny";
  rec.record({
    codeLine: 2,
    note: allowed
      ? escalation
        ? `${who.id} writes a doc they do not own.`
        : `${who.id} is allowed.`
      : `${who.id} is denied.`,
  });
  return rec.steps;
}
