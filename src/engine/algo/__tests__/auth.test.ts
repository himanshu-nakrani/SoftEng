import { buildAlgoSteps } from "@/engine/algo/build";
import {
  AUTH_COUNTERS as C,
  JWT_NOW,
  OAUTH_CODE,
  OAUTH_TOKEN,
  OAUTH_VERIFIER,
  SESSION_SID,
  cookieFlags,
  jwtCase,
  pkceChallenge,
  runJwt,
  runOAuth,
  runSession,
  toySig,
} from "@/engine/algo/auth";
import type { AlgoDef } from "@/engine/algo/types";
import type { AuthState } from "@/engine/algo/views/auth";
import { AuthView } from "@/engine/algo/views/AuthView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const lastS = (size: number) => runSession(size).at(-1)!;
const lastJ = (policy: "naive" | "strict", size: number) => runJwt(policy, size).at(-1)!;
const lastO = (pkce: boolean, intercept: boolean) => runOAuth(pkce, intercept).at(-1)!;

describe("runSession", () => {
  it("all flags on: nothing stolen, no csrf", () => {
    const { counters, state } = lastS(0);
    expect(cookieFlags(0)).toEqual({ httpOnly: true, secure: true, sameSite: "Strict" });
    expect(counters[C.stolen] ?? 0).toBe(0);
    expect(counters[C.csrf] ?? 0).toBe(0);
    expect(state.ok).toBe(true);
    expect(state.stamp).toBe("cookie");
  });

  it("HttpOnly off: XSS steals S7", () => {
    const { counters, state } = lastS(1);
    expect(counters[C.stolen]).toBe(1);
    expect(counters[C.csrf] ?? 0).toBe(0);
    expect(state.ok).toBe(false);
    expect(state.stamp).toBe("stolen");
    expect(state.lanes.find((l) => l.name === "attacker")!.chips[0]!.value).toBe(SESSION_SID);
  });

  it("Secure off: HTTP leak steals S7", () => {
    const { counters } = lastS(2);
    expect(counters[C.stolen]).toBe(1);
    expect(counters[C.csrf] ?? 0).toBe(0);
  });

  it("SameSite=None: csrf 1, stolen 0", () => {
    const { counters, state } = lastS(3);
    expect(counters[C.stolen] ?? 0).toBe(0);
    expect(counters[C.csrf]).toBe(1);
    expect(state.stamp).toBe("csrf");
  });

  it("never aliases", () => {
    const steps = runSession(1);
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
  });
});

describe("runJwt", () => {
  it("valid token: both verifiers accept", () => {
    expect(lastJ("naive", 0).counters[C.verified]).toBe(1);
    expect(lastJ("strict", 0).counters[C.verified]).toBe(1);
    expect(lastJ("strict", 0).state.ok).toBe(true);
    expect(jwtCase(0).exp).toBeGreaterThan(JWT_NOW);
  });

  it("alg none: naive accepts, strict rejects", () => {
    expect(lastJ("naive", 1).counters[C.verified]).toBe(1);
    expect(lastJ("strict", 1).counters[C.rejected]).toBe(1);
    expect(lastJ("strict", 1).counters[C.verified] ?? 0).toBe(0);
    expect(lastJ("strict", 1).state.ok).toBe(false);
  });

  it("expired: naive accepts, strict rejects", () => {
    expect(jwtCase(2).exp).toBeLessThan(JWT_NOW);
    expect(lastJ("naive", 2).counters[C.verified]).toBe(1);
    expect(lastJ("strict", 2).counters[C.rejected]).toBe(1);
  });

  it("tampered payload: naive accepts, strict rejects", () => {
    const tok = jwtCase(3);
    expect(tok.sub).toBe("mallory");
    expect(tok.sig).toBe(toySig("HS256", "ada", 20));
    expect(tok.sig).not.toBe(toySig(tok.alg, tok.sub, tok.exp));
    expect(lastJ("naive", 3).counters[C.verified]).toBe(1);
    expect(lastJ("strict", 3).counters[C.rejected]).toBe(1);
  });
});

describe("runOAuth", () => {
  it("no intercept: client is issued the token", () => {
    for (const pkce of [true, false]) {
      const { counters } = lastO(pkce, false);
      expect(counters[C.issued]).toBe(1);
      expect(counters[C.stolen] ?? 0).toBe(0);
    }
  });

  it("without PKCE an intercept steals the token", () => {
    const { counters, state } = lastO(false, true);
    expect(counters[C.stolen]).toBe(1);
    expect(counters[C.issued] ?? 0).toBe(0);
    expect(state.stamp).toBe("stolen");
    const attacker = state.lanes.find((l) => l.name === "attacker")!;
    expect(attacker.chips.some((c) => c.value === OAUTH_TOKEN)).toBe(true);
  });

  it("with PKCE an intercept is rejected and the client still gets the token", () => {
    const { counters, state } = lastO(true, true);
    expect(counters[C.stolen] ?? 0).toBe(0);
    expect(counters[C.rejected]).toBe(1);
    expect(counters[C.issued]).toBe(1);
    expect(state.stamp).toBe("client holds");
    const client = state.lanes.find((l) => l.name === "client")!;
    expect(client.chips.some((c) => c.value === OAUTH_TOKEN)).toBe(true);
    expect(pkceChallenge(OAUTH_VERIFIER)).toBe(pkceChallenge("V4"));
    expect(OAUTH_CODE).toBe("C9");
  });
});

describe("auth rides on archetype B", () => {
  const def: AlgoDef<AuthState, number> = {
    id: "session",
    title: "cookie",
    code: ["issue", "xss", "sniff", "csrf"],
    counters: [{ key: C.stolen, label: "stolen" }],
    size: { label: "flags", min: 0, max: 3, default: 0 },
    generateInput: (_rng, size) => size,
    run: (size) => runSession(size),
  };

  it("size changes the flags and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 1, 1));
    const view: ComponentType<{ state: AuthState }> = AuthView;
    expect(view).toBe(AuthView);
  });
});
