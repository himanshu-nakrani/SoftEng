/**
 * Auth view — cookies, JWT checks, and an OAuth code exchange.
 *
 * Three small machines share chip lanes: a session cookie and its flags,
 * a three-part token, and the actors in an authorization-code flow.
 */

export type AuthKind = "session" | "jwt" | "oauth";

export type AuthTone = "idle" | "ok" | "warn" | "bad" | "active";

export interface AuthChip {
  label: string;
  value: string;
  tone: AuthTone;
  active: boolean;
}

export interface AuthLane {
  name: string;
  chips: AuthChip[];
}

export interface AuthState {
  kind: AuthKind;
  lanes: AuthLane[];
  stamp: string;
  ok?: boolean;
}
