import {
  AUTH_COUNTERS,
  runOAuth,
} from "@/engine/algo/auth";
import type { AlgoDef } from "@/engine/algo/types";
import type { AuthState } from "@/engine/algo/views/auth";

/**
 * OAuth and PKCE — archetype B (`engine: "steps"`).
 *
 * Authorization-code exchange. Authz issues C9; the token is T1. Without
 * PKCE, whoever presents C9 gets T1. With PKCE the client holds verifier
 * V4 and the challenge is 77; the attacker has the code and not the
 * verifier, so the exchange is rejected and the client still gets T1.
 *
 * THE CONTROL IS WHETHER THE CODE IS INTERCEPTED. Slider 0 or 1, default
 * 1. generateInput maps size === 1 to intercept. Measured at intercept 1:
 * no PKCE → stolen 1, issued 0, stamp "stolen", attacker holds T1; with
 * PKCE → stolen 0, rejected 1, issued 1, stamp "client holds". Intercept
 * 0 issues T1 to the client either way (issued 1, stolen 0). Seed is
 * ignored.
 *
 * MODELLING NOTE, and its limits. Challenge 77 is a toy mix of V4, not
 * S256. C9 and T1 are labels. Real PKCE is SHA-256 of a high-entropy
 * verifier, and a real code is one-time at a TLS token endpoint. Those
 * change the work factor. They do not change the argument: the redirect
 * carried a code, not a session, and PKCE binds that code to a verifier
 * the attacker never saw.
 */

const interceptControl = {
  label: "intercept",
  min: 0,
  max: 1,
  default: 1,
} as const;

const counters = [
  { key: AUTH_COUNTERS.stolen, label: "stolen" },
  { key: AUTH_COUNTERS.issued, label: "issued" },
  { key: AUTH_COUNTERS.rejected, label: "rejected" },
];

function def(
  id: string,
  title: string,
  pkce: boolean,
  code: string[],
): AlgoDef<AuthState, boolean> {
  return {
    id,
    title,
    code,
    counters,
    size: interceptControl,
    generateInput: (_rng, size) => size === 1,
    run: (intercept) => runOAuth(pkce, intercept),
  };
}

/** PKCE on: intercepted C9 is rejected; the client still holds T1. */
export const oauthPkceAlgo = def(
  "oauth-pkce",
  "with PKCE",
  true,
  [
    "hold V4, challenge=77",
    "authz issues C9",
    "attacker intercepts",
    "no V4: reject",
    "client: C9 + V4 -> T1",
  ],
);

/** PKCE off: intercepted C9 becomes the attacker's T1. */
export const oauthPkceNoneAlgo = def(
  "oauth-pkce-none",
  "without PKCE",
  false,
  [
    "request code (no PKCE)",
    "authz issues C9",
    "attacker intercepts",
    "attacker: C9 -> T1",
    "client: code used",
  ],
);
