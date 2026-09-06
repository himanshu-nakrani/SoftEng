/**
 * Policy view — RBAC (role grants the action) vs ABAC (attributes do).
 *
 * The same subject, resource, and action; two decision procedures. A
 * grant that is not owner and not admin is horizontal escalation.
 */

export type PolicyKind = "rbac" | "abac";

export interface PolicyFact {
  label: string;
  value: string;
  active: boolean;
}

export interface PolicyRule {
  label: string;
  fired: boolean;
  active: boolean;
}

export interface PolicyState {
  kind: PolicyKind;
  subject: PolicyFact[];
  resource: PolicyFact[];
  rules: PolicyRule[];
  stamp: string;
  allowed: boolean;
}
