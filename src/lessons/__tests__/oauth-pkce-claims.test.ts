import {
  AUTH_COUNTERS as C,
  OAUTH_CODE,
  OAUTH_TOKEN,
  OAUTH_VERIFIER,
  pkceChallenge,
  runOAuth,
} from "@/engine/algo/auth";
import { buildAlgoSteps } from "@/engine/algo/build";
import type { AlgoDef } from "@/engine/algo/types";
import type { AuthState } from "@/engine/algo/views/auth";
import {
  oauthPkceAlgo,
  oauthPkceNoneAlgo,
} from "@/lessons/identity-access/oauth-pkce";
import { describe, expect, it } from "vitest";

/**
 * The oauth-pkce prose states numbers. A failure here means the page now
 * lies, and the message should name the sentence that became untrue.
 *
 * Both figures drive `runOAuth` with intercept = size === 1. The seed is
 * ignored: an exchange is not a scheduler.
 */

function lane(state: AuthState, name: string) {
  const found = state.lanes.find((l) => l.name === name);
  expect(found, `missing lane ${name}`).toBeDefined();
  return found!;
}

function holds(state: AuthState, name: string, value: string): boolean {
  return lane(state, name).chips.some((c) => c.value === value);
}

function run<I>(def: AlgoDef<AuthState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    notes: steps.map((s) => s.note),
    state: last.state,
    counters: last.counters,
    stolen: last.counters[C.stolen] ?? 0,
    issued: last.counters[C.issued] ?? 0,
    rejected: last.counters[C.rejected] ?? 0,
    stamp: last.state.stamp,
  };
}

describe("oauth-pkce · the toys the page names", () => {
  it("code C9, token T1, verifier V4, challenge 77 — not S256", () => {
    // "This lesson's ticket is C9. The token is T1."
    // "The client holds verifier V4 and sends challenge 77"
    // "pkceChallenge(V4) is 77."
    // "This is a toy. Challenge 77 is not S256. Code C9, token T1."
    expect(OAUTH_CODE).toBe("C9");
    expect(OAUTH_TOKEN).toBe("T1");
    expect(OAUTH_VERIFIER).toBe("V4");
    expect(pkceChallenge("V4")).toBe(77);
    expect(pkceChallenge(OAUTH_VERIFIER)).toBe(77);
  });

  it("the slider is intercept, 0 or 1, default 1", () => {
    // "The slider is intercept, 0 or 1. Default 1 is the measured run."
    expect(oauthPkceAlgo.id).toBe("oauth-pkce");
    expect(oauthPkceNoneAlgo.id).toBe("oauth-pkce-none");
    for (const def of [oauthPkceAlgo, oauthPkceNoneAlgo]) {
      expect(def.size).toMatchObject({
        min: 0,
        max: 1,
        default: 1,
        label: "intercept",
      });
      expect(def.generateInput(() => 0, 0)).toBe(false);
      expect(def.generateInput(() => 0, 1)).toBe(true);
      expect(def.counters.map((c) => c.key)).toEqual([
        C.stolen,
        C.issued,
        C.rejected,
      ]);
    }
  });

  it("ignores the seed: an exchange is not a scheduler", () => {
    for (const def of [oauthPkceAlgo, oauthPkceNoneAlgo]) {
      for (const size of [0, 1]) {
        expect(buildAlgoSteps(def, size, 1)).toEqual(
          buildAlgoSteps(def, size, 99),
        );
      }
    }
  });

  it("the lesson defs are the same runs as runOAuth", () => {
    expect(buildAlgoSteps(oauthPkceNoneAlgo, 0, 42)).toEqual(
      runOAuth(false, false),
    );
    expect(buildAlgoSteps(oauthPkceNoneAlgo, 1, 42)).toEqual(
      runOAuth(false, true),
    );
    expect(buildAlgoSteps(oauthPkceAlgo, 0, 42)).toEqual(runOAuth(true, false));
    expect(buildAlgoSteps(oauthPkceAlgo, 1, 42)).toEqual(runOAuth(true, true));
  });
});

describe("oauth-pkce · without PKCE, intercept 0: issued 1, stolen 0", () => {
  it("issues T1 to the client and steals nothing", () => {
    // "Drag intercept to 0: issued 1, stolen 0. The client holds T1."
    // "Drag intercept to 0: issued 1, stolen 0, either way."
    const { stolen, issued, rejected, stamp, state } = run(
      oauthPkceNoneAlgo,
      0,
    );
    expect(stolen).toBe(0);
    expect(issued).toBe(1);
    expect(rejected).toBe(0);
    expect(stamp).toBe("issued");
    expect(holds(state, "client", "T1")).toBe(true);
    expect(holds(state, "attacker", "T1")).toBe(false);
  });
});

describe("oauth-pkce · without PKCE, intercept 1: stolen 1, issued 0", () => {
  it("intercepting C9 issues T1 to the attacker", () => {
    // "Without PKCE, intercepting C9 issues T1 to the attacker (stolen
    // 1, issued 0)."
    // "The stamp reads stolen. The attacker holds T1."
    const { stolen, issued, rejected, stamp, state, notes } = run(
      oauthPkceNoneAlgo,
      1,
    );
    expect(stolen).toBe(1);
    expect(issued).toBe(0);
    expect(rejected).toBe(0);
    expect(stamp).toBe("stolen");
    expect(holds(state, "attacker", "T1")).toBe(true);
    expect(holds(state, "client", "T1")).toBe(false);
    expect(notes).toEqual([
      "Auth code without PKCE.",
      "Client has no verifier.",
      "Authz issues code C9.",
      "Attacker intercepts C9.",
      "Attacker exchanges C9 for T1.",
      "Client's exchange fails: code already used.",
    ]);
  });
});

describe("oauth-pkce · with PKCE, intercept 0: issued 1, stolen 0", () => {
  it("issues T1 to the client and steals nothing", () => {
    // "Drag intercept to 0: issued 1, stolen 0, either way."
    const { stolen, issued, rejected, stamp, state } = run(oauthPkceAlgo, 0);
    expect(stolen).toBe(0);
    expect(issued).toBe(1);
    expect(rejected).toBe(0);
    expect(stamp).toBe("issued");
    expect(holds(state, "client", "T1")).toBe(true);
    expect(holds(state, "attacker", "T1")).toBe(false);
  });
});

describe("oauth-pkce · with PKCE, intercept 1: stolen 0, rejected 1, issued 1", () => {
  it("rejects the attacker and the client still holds T1", () => {
    // "With PKCE challenge 77, the attacker is rejected and the client
    // still holds T1 (rejected 1, issued 1, stolen 0)."
    // "The stamp reads client holds."
    const { stolen, issued, rejected, stamp, state, notes } = run(
      oauthPkceAlgo,
      1,
    );
    expect(stolen).toBe(0);
    expect(rejected).toBe(1);
    expect(issued).toBe(1);
    expect(stamp).toBe("client holds");
    expect(holds(state, "client", "T1")).toBe(true);
    expect(holds(state, "attacker", "T1")).toBe(false);
    expect(holds(state, "client", "V4")).toBe(true);
    expect(notes).toEqual([
      "Auth code with PKCE. challenge=77.",
      "Client holds verifier V4.",
      "Authz issues code C9.",
      "Attacker intercepts C9.",
      "Attacker has no verifier. Exchange rejected.",
      "Client exchanges C9 for T1.",
    ]);
  });
});
