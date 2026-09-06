import {
  AUTH_COUNTERS,
  runSession,
} from "@/engine/algo/auth";
import type { AlgoDef } from "@/engine/algo/types";
import type { AuthState } from "@/engine/algo/views/auth";

/**
 * Session Cookies — archetype B (`engine: "steps"`).
 *
 * The cookie is the session. Whoever holds sid=S7 is the user. Three
 * flags each close a different door: HttpOnly against XSS reading
 * document.cookie, Secure against an HTTP leak, SameSite=Strict against
 * a cross-site POST. THE CONTROL IS THE FLAGS. 0 through 3, default 0.
 *
 * Measured: 0 (HttpOnly on, Secure on, SameSite=Strict) is stolen 0,
 * csrf 0, stamp "cookie", ok true. 1 turns HttpOnly off: stolen 1, csrf
 * 0, stamp "stolen", attacker holds S7. 2 turns Secure off: stolen 1,
 * csrf 0, stamp "stolen". 3 sets SameSite=None: stolen 0, csrf 1, stamp
 * "csrf". Five frames either way. Seed is ignored.
 *
 * MODELLING NOTE, and its limits. This is a toy cookie: sid S7 and
 * those three flags. It is not a browser. No XSS payload runs. Real
 * Set-Cookie has more attributes (Domain, Path, Max-Age, Partitioned).
 * Those change the cookie. They do not change the argument: each flag
 * is a door, and the meters count which one opened.
 */

const CODE = [
  "Set-Cookie: sid=S7",
  "document.cookie",
  "HTTP request",
  "cross-site POST",
];

export const sessionCookiesAlgo: AlgoDef<AuthState, number> = {
  id: "session-cookies",
  title: "cookie flags",
  code: CODE,
  counters: [
    { key: AUTH_COUNTERS.stolen, label: "stolen" },
    { key: AUTH_COUNTERS.csrf, label: "csrf" },
  ],
  size: {
    label: "flags",
    min: 0,
    max: 3,
    default: 0,
  },
  generateInput: (_rng, size) => size,
  run: (size) => runSession(size),
};
