import { buildAlgoSteps } from "@/engine/algo/build";
import {
  AUTH_COUNTERS as C,
  JWT_NOW,
  jwtCase,
  runJwt,
  toySig,
} from "@/engine/algo/auth";
import type { AlgoDef } from "@/engine/algo/types";
import type { AuthState } from "@/engine/algo/views/auth";
import {
  jwtPitfallsAlgo,
  jwtPitfallsStrictAlgo,
} from "@/lessons/identity-access/jwt-pitfalls";
import { describe, expect, it } from "vitest";

/**
 * The jwt-pitfalls prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * This is a toy JWT, not JWS/JWE. now=10 is a step clock, not unix time.
 */

function chipsOf(state: AuthState): Record<string, string> {
  const token = state.lanes.find((l) => l.name === "token");
  return Object.fromEntries((token?.chips ?? []).map((c) => [c.label, c.value]));
}

function run<I>(def: AlgoDef<AuthState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    ok: last.state.ok,
    verified: last.counters[C.verified] ?? 0,
    rejected: last.counters[C.rejected] ?? 0,
    stamp: last.state.stamp,
    note: last.note,
    chips: chipsOf(last.state),
  };
}

const TOKENS = [0, 1, 2, 3] as const;

describe("jwt-pitfalls · toy JWT, now=10, toySig 56 and 137", () => {
  it("is the toy the page names: now = 10, a step clock", () => {
    // "This is a toy JWT, not JWS and not JWE. The clock is now = 10 —
    // a step clock, not unix time."
    // "now=10 is a step clock, not unix time, and toySig is not HMAC-SHA256."
    expect(JWT_NOW).toBe(10);
    expect(JWT_NOW).toBeLessThan(1_000_000_000);
  });

  it("toySig(HS256, ada, 20) is 56 and toySig(HS256, ada, 5) is 137", () => {
    // "Default 0 is the valid one: alg=HS256, sub=ada, exp=20, sig=56 —
    // that is toySig("HS256", "ada", 20)."
    // "Token 2 is exp=5, sig=137."
    expect(toySig("HS256", "ada", 20)).toBe(56);
    expect(toySig("HS256", "ada", 5)).toBe(137);
    expect(jwtCase(0).sig).toBe(56);
    expect(jwtCase(2).sig).toBe(137);
  });

  it("the slider picks which token, from 0 to 3, default 0 on both", () => {
    // "The slider picks which token, from 0 to 3. Default 0 is the valid one."
    expect(jwtPitfallsAlgo.id).toBe("jwt-pitfalls");
    expect(jwtPitfallsStrictAlgo.id).toBe("jwt-pitfalls-strict");
    expect(jwtPitfallsAlgo.size).toMatchObject({
      min: 0,
      max: 3,
      default: 0,
      label: "token",
    });
    expect(jwtPitfallsStrictAlgo.size).toEqual(jwtPitfallsAlgo.size);
    expect(jwtPitfallsAlgo.counters.map((c) => c.label)).toEqual([
      "verified",
      "rejected",
    ]);
    expect(jwtPitfallsStrictAlgo.counters).toEqual(jwtPitfallsAlgo.counters);
  });

  it("ignores the seed: a verifier is not a scheduler", () => {
    for (const size of TOKENS) {
      expect(buildAlgoSteps(jwtPitfallsAlgo, size, 1)).toEqual(
        buildAlgoSteps(jwtPitfallsAlgo, size, 99),
      );
      expect(buildAlgoSteps(jwtPitfallsStrictAlgo, size, 1)).toEqual(
        buildAlgoSteps(jwtPitfallsStrictAlgo, size, 99),
      );
    }
  });

  it("the lesson defs are the same runs as runJwt at every size", () => {
    for (const size of TOKENS) {
      expect(buildAlgoSteps(jwtPitfallsAlgo, size, 42)).toEqual(
        runJwt("naive", size),
      );
      expect(buildAlgoSteps(jwtPitfallsStrictAlgo, size, 42)).toEqual(
        runJwt("strict", size),
      );
    }
  });
});

describe("jwt-pitfalls · token 0 valid: both accept, verified 1, stamp accept", () => {
  it("jwtCase(0) is alg=HS256 sub=ada exp=20 sig=56", () => {
    // "Default 0 is the valid one: alg=HS256, sub=ada, exp=20, sig=56."
    expect(jwtCase(0)).toEqual({
      alg: "HS256",
      sub: "ada",
      exp: 20,
      sig: 56,
      label: "valid",
    });
    expect(jwtCase(0).exp).toBeGreaterThan(JWT_NOW);
    expect(jwtCase(0).sig).toBe(toySig("HS256", "ada", 20));
  });

  it("the naive figure at 0 accepts: first caption, chips, stamp accept, verified 1", () => {
    // "Leave the token at 0. The first caption is 'JWT valid. now=10.'"
    // "Step. The chips read alg=HS256 sub=ada exp=20 sig=56."
    // "Step again. The caption reads 'Naive verifier accepts.' The stamp
    // is accept. verified is 1."
    const { steps, chips, stamp, verified, rejected, ok, note } = run(
      jwtPitfallsAlgo,
      0,
    );
    expect(steps[0]!.note).toBe("JWT valid. now=10.");
    expect(steps[1]!.note).toBe("alg=HS256 sub=ada exp=20 sig=56.");
    expect(note).toBe("Naive verifier accepts.");
    expect(chips).toEqual({ alg: "HS256", sub: "ada", exp: "20", sig: "56" });
    expect(stamp).toBe("accept");
    expect(verified).toBe(1);
    expect(rejected).toBe(0);
    expect(ok).toBe(true);
  });

  it("the strict figure at 0 is the same token and also accepts", () => {
    // "Leave the token at 0. The token is the same: alg=HS256 sub=ada
    // exp=20 sig=56. Strict accepts. verified is 1, rejected is 0,
    // stamp accept."
    const naive = run(jwtPitfallsAlgo, 0);
    const strict = run(jwtPitfallsStrictAlgo, 0);
    expect(strict.steps[0]!.note).toBe("JWT valid. now=10.");
    expect(strict.steps[1]!.note).toBe("alg=HS256 sub=ada exp=20 sig=56.");
    expect(strict.note).toBe("Strict accepts.");
    expect(strict.chips).toEqual(naive.chips);
    expect(strict.stamp).toBe("accept");
    expect(strict.verified).toBe(1);
    expect(strict.rejected).toBe(0);
    expect(strict.ok).toBe(true);
  });
});

describe("jwt-pitfalls · token 1 alg none", () => {
  it("jwtCase(1) is alg=none sub=ada exp=20 sig=0", () => {
    expect(jwtCase(1)).toEqual({
      alg: "none",
      sub: "ada",
      exp: 20,
      sig: 0,
      label: "alg none",
    });
  });

  it("naive captions at 1 are the three the page quotes, and it accepts", () => {
    // "Token 1's captions are 'JWT alg none. now=10.', then
    // 'alg=none sub=ada exp=20 sig=0.', then 'Naive verifier accepts.'"
    const { steps, verified, rejected, stamp, ok, chips } = run(
      jwtPitfallsAlgo,
      1,
    );
    expect(steps.map((s) => s.note)).toEqual([
      "JWT alg none. now=10.",
      "alg=none sub=ada exp=20 sig=0.",
      "Naive verifier accepts.",
    ]);
    expect(chips).toEqual({ alg: "none", sub: "ada", exp: "20", sig: "0" });
    expect(verified).toBe(1);
    expect(rejected).toBe(0);
    expect(stamp).toBe("accept");
    expect(ok).toBe(true);
  });

  it("strict at 1 rejects alg none: rejected 1, verified 0, ok false, stamp reject", () => {
    // "Drag to 1. The caption reads 'Strict rejects: alg none.'
    // rejected is 1, verified is 0, ok is false, stamp reject."
    const { note, verified, rejected, ok, stamp } = run(
      jwtPitfallsStrictAlgo,
      1,
    );
    expect(note).toBe("Strict rejects: alg none.");
    expect(rejected).toBe(1);
    expect(verified).toBe(0);
    expect(ok).toBe(false);
    expect(stamp).toBe("reject");
  });
});

describe("jwt-pitfalls · token 2 expired: exp=5 against now=10, sig=137", () => {
  it("jwtCase(2) is alg=HS256 sub=ada exp=5 sig=137, and exp is less than now", () => {
    // "Token 2 is exp=5, sig=137."
    // "Drag to 2. exp=5 is less than now=10. Strict rejects: expired."
    expect(jwtCase(2)).toEqual({
      alg: "HS256",
      sub: "ada",
      exp: 5,
      sig: 137,
      label: "expired",
    });
    expect(jwtCase(2).exp).toBeLessThan(JWT_NOW);
    expect(jwtCase(2).sig).toBe(toySig("HS256", "ada", 5));
  });

  it("naive at 2 still accepts, verified 1", () => {
    const { steps, verified, stamp, ok, chips } = run(jwtPitfallsAlgo, 2);
    expect(steps[0]!.note).toBe("JWT expired. now=10.");
    expect(steps[1]!.note).toBe("alg=HS256 sub=ada exp=5 sig=137.");
    expect(steps[2]!.note).toBe("Naive verifier accepts.");
    expect(chips).toEqual({ alg: "HS256", sub: "ada", exp: "5", sig: "137" });
    expect(verified).toBe(1);
    expect(stamp).toBe("accept");
    expect(ok).toBe(true);
  });

  it("strict at 2 rejects expired", () => {
    const { note, rejected, verified, ok, stamp } = run(
      jwtPitfallsStrictAlgo,
      2,
    );
    expect(note).toBe("Strict rejects: expired.");
    expect(rejected).toBe(1);
    expect(verified).toBe(0);
    expect(ok).toBe(false);
    expect(stamp).toBe("reject");
  });
});

describe("jwt-pitfalls · token 3 tampered: sub=mallory carrying ada's sig 56", () => {
  it("jwtCase(3) is alg=HS256 sub=mallory exp=20 sig=56, signed as ada", () => {
    // "Token 3 is sub=mallory carrying ada's sig 56."
    // "sub=mallory carries sig 56, which is toySig of ada, not mallory.
    // Strict rejects: bad sig."
    const tok = jwtCase(3);
    expect(tok).toEqual({
      alg: "HS256",
      sub: "mallory",
      exp: 20,
      sig: 56,
      label: "tampered",
    });
    expect(tok.sig).toBe(toySig("HS256", "ada", 20));
    expect(tok.sig).not.toBe(toySig(tok.alg, tok.sub, tok.exp));
  });

  it("naive at 3 still accepts, verified 1", () => {
    const { steps, verified, stamp, ok, chips } = run(jwtPitfallsAlgo, 3);
    expect(steps[0]!.note).toBe("JWT tampered. now=10.");
    expect(steps[1]!.note).toBe("alg=HS256 sub=mallory exp=20 sig=56.");
    expect(steps[2]!.note).toBe("Naive verifier accepts.");
    expect(chips).toEqual({
      alg: "HS256",
      sub: "mallory",
      exp: "20",
      sig: "56",
    });
    expect(verified).toBe(1);
    expect(stamp).toBe("accept");
    expect(ok).toBe(true);
  });

  it("strict at 3 rejects bad sig", () => {
    const { note, rejected, verified, ok, stamp } = run(
      jwtPitfallsStrictAlgo,
      3,
    );
    expect(note).toBe("Strict rejects: bad sig.");
    expect(rejected).toBe(1);
    expect(verified).toBe(0);
    expect(ok).toBe(false);
    expect(stamp).toBe("reject");
  });
});

describe("jwt-pitfalls · all four tokens on both defs", () => {
  it("naive accepts all four tokens; verified is 1 at 0, 1, 2, and 3", () => {
    // "Drag 1 through 3. Every naive run accepts. verified stays 1."
    // "Accepts all four tokens. verified is 1 at 0, 1, 2, and 3.
    // rejected never moves."
    // "verified 1 on all four tokens is the bug, not the feature."
    for (const size of TOKENS) {
      const naive = run(jwtPitfallsAlgo, size);
      expect(naive.verified, `naive verified at ${size}`).toBe(1);
      expect(naive.rejected, `naive rejected at ${size}`).toBe(0);
      expect(naive.ok).toBe(true);
      expect(naive.stamp).toBe("accept");
      expect(naive.note).toBe("Naive verifier accepts.");
    }
  });

  it("strict accepts only token 0; tokens 1–3 are rejected 1, verified 0", () => {
    // "The same four tokens. A verifier that actually checks alg, exp,
    // and the signature accepts only one of them."
    // "Accepts only token 0. Tokens 1–3 are rejected 1, verified 0."
    const at0 = run(jwtPitfallsStrictAlgo, 0);
    expect(at0.verified).toBe(1);
    expect(at0.rejected).toBe(0);
    expect(at0.ok).toBe(true);
    expect(at0.stamp).toBe("accept");

    for (const size of [1, 2, 3] as const) {
      const strict = run(jwtPitfallsStrictAlgo, size);
      expect(strict.rejected, `strict rejected at ${size}`).toBe(1);
      expect(strict.verified, `strict verified at ${size}`).toBe(0);
      expect(strict.ok).toBe(false);
      expect(strict.stamp).toBe("reject");
    }
  });

  it("both figures run the same four tokens", () => {
    // "The next two figures run the same four tokens."
    for (const size of TOKENS) {
      const naive = run(jwtPitfallsAlgo, size);
      const strict = run(jwtPitfallsStrictAlgo, size);
      expect(naive.chips).toEqual(strict.chips);
      expect(naive.steps[1]!.note).toBe(strict.steps[1]!.note);
    }
  });
});
