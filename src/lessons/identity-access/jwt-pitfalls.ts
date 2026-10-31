import {
  AUTH_COUNTERS,
  runJwt,
  type JwtPolicy,
} from "@/engine/algo/auth";
import type { AlgoDef } from "@/engine/algo/types";
import type { AuthState } from "@/engine/algo/views/auth";

/**
 * JWT Pitfalls — archetype B (`engine: "steps"`).
 *
 * A JWT is three strings: header, payload, signature. The naive verifier
 * accepts every token. The strict verifier checks alg, exp, and the
 * signature, and accepts only a signed unexpired token.
 *
 * THE CONTRAST IS TWO FIGURES: naive vs strict. THE CONTROL IS WHICH
 * TOKEN. 0 through 3, default 0 on both.
 *
 * Measured:
 *   0 valid: alg=HS256 sub=ada exp=20 sig=toySig("HS256","ada",20)=56.
 *     Both accept, verified 1, stamp accept.
 *   1 alg none: alg=none sub=ada exp=20 sig=0.
 *     Naive verified 1. Strict rejected 1, verified 0, ok false,
 *     note "Strict rejects: alg none."
 *     Naive notes: "JWT alg none. now=10." /
 *     "alg=none sub=ada exp=20 sig=0." / "Naive verifier accepts."
 *   2 expired: alg=HS256 sub=ada exp=5 (exp < now=10),
 *     sig=toySig("HS256","ada",5)=137. Naive verified 1. Strict rejected 1.
 *   3 tampered: alg=HS256 sub=mallory exp=20 sig=56 (signed as ada).
 *     Naive verified 1. Strict rejected 1.
 *
 * Naive accepts ALL four (verified 1). Strict accepts ONLY size 0.
 * Seed is ignored. This is a TOY JWT, not JWS/JWE. now=10 is a step
 * clock, not unix time. toySig is not HMAC-SHA256. alg=none is a real
 * historical pitfall; the rest of the numbers are the toy's.
 *
 * Both figures declare verified and rejected so the meters contrast:
 * naive bumps only verified; strict bumps verified at 0 and rejected
 * at 1–3.
 */

const NAIVE_CODE = [
  "read alg sub exp sig",
  "accept any token",
];

const STRICT_CODE = [
  "read alg sub exp sig",
  "accept signed unexpired",
  "reject none/exp/sig",
];

const counters = [
  { key: AUTH_COUNTERS.verified, label: "verified" },
  { key: AUTH_COUNTERS.rejected, label: "rejected" },
];

const sizeControl = {
  label: "token",
  min: 0,
  max: 3,
  default: 0,
} as const;

function def(
  id: string,
  title: string,
  policy: JwtPolicy,
  code: string[],
): AlgoDef<AuthState, number> {
  return {
    id,
    title,
    code,
    counters,
    size: sizeControl,
    generateInput: (_rng, size) => size,
    run: (size) => runJwt(policy, size),
  };
}

/** Naive verifier: accepts alg=none, an expired exp, and a tampered sub. */
export const jwtPitfallsAlgo = def(
  "jwt-pitfalls",
  "naive verifier",
  "naive",
  NAIVE_CODE,
);

/** Strict verifier: accepts only the signed unexpired token. */
export const jwtPitfallsStrictAlgo = def(
  "jwt-pitfalls-strict",
  "strict verifier",
  "strict",
  STRICT_CODE,
);
