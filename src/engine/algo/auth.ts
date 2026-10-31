import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { AuthChip, AuthLane, AuthState } from "./views/auth";

/**
 * Identity machines for archetype B.
 *
 * Session: a cookie sid=S7 and three flags. XSS reads it only without
 * HttpOnly; an HTTP request leaks it only without Secure; a cross-site
 * POST sends it only with SameSite=None.
 *
 * JWT: a three-part token. The naive verifier accepts alg=none, an
 * expired exp, and a tampered payload. The strict verifier rejects all
 * three and accepts only a signed, unexpired token.
 *
 * OAuth: authorization-code exchange. Without PKCE an intercepted code
 * becomes the attacker's token. With PKCE the attacker is rejected and
 * the client, who has the verifier, still gets the token.
 *
 * These are toys. Real cookies have more flags, real JWT is JWS, real
 * PKCE is S256. The numbers are small so a step list can show them.
 */

export const AUTH_COUNTERS = {
  stolen: "stolen",
  csrf: "csrf",
  issued: "issued",
  rejected: "rejected",
  verified: "verified",
} as const;

export const SESSION_SID = "S7";

export type CookieFlags = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "None";
};

/** Slider 0 = all flags on; 1 = no HttpOnly; 2 = no Secure; 3 = SameSite=None. */
export function cookieFlags(size: number): CookieFlags {
  if (size === 1) return { httpOnly: false, secure: true, sameSite: "Strict" };
  if (size === 2) return { httpOnly: true, secure: false, sameSite: "Strict" };
  if (size === 3) return { httpOnly: true, secure: true, sameSite: "None" };
  return { httpOnly: true, secure: true, sameSite: "Strict" };
}

function chip(
  label: string,
  value: string,
  tone: AuthChip["tone"] = "idle",
  active = false,
): AuthChip {
  return { label, value, tone, active };
}

function clone(lanes: AuthLane[]): AuthLane[] {
  return lanes.map((lane) => ({
    name: lane.name,
    chips: lane.chips.map((c) => ({ ...c })),
  }));
}

export function runSession(size: number): AlgoStep<AuthState>[] {
  const flags = cookieFlags(size);
  let lanes: AuthLane[] = [];
  let stamp: string = "cookie";
  let ok = true;
  const rec = new StepRecorder<AuthState>(() => ({
    kind: "session",
    lanes: clone(lanes),
    stamp,
    ok,
  }));

  rec.record({ note: `Issue sid=${SESSION_SID}.` });

  const flagChips = [
    chip("HttpOnly", flags.httpOnly ? "on" : "off", flags.httpOnly ? "ok" : "bad", !flags.httpOnly),
    chip("Secure", flags.secure ? "on" : "off", flags.secure ? "ok" : "bad", !flags.secure),
    chip("SameSite", flags.sameSite, flags.sameSite === "Strict" ? "ok" : "warn", flags.sameSite !== "Strict"),
  ];
  lanes = [
    { name: "cookie", chips: [chip("sid", SESSION_SID, "ok"), ...flagChips] },
    { name: "attacker", chips: [] },
  ];
  rec.record({
    codeLine: 0,
    note: `Flags HttpOnly=${flags.httpOnly ? "on" : "off"} Secure=${flags.secure ? "on" : "off"} SameSite=${flags.sameSite}.`,
  });

  if (!flags.httpOnly) {
    rec.bump(AUTH_COUNTERS.stolen);
    ok = false;
    stamp = "stolen";
    lanes = [
      { name: "cookie", chips: [chip("sid", SESSION_SID, "bad", true), ...flagChips] },
      { name: "attacker", chips: [chip("sid", SESSION_SID, "bad", true)] },
    ];
    rec.record({ codeLine: 1, note: "XSS reads document.cookie. Sid stolen." });
  } else {
    rec.record({ codeLine: 1, note: "XSS cannot read HttpOnly cookie." });
  }

  if (!flags.secure) {
    rec.bump(AUTH_COUNTERS.stolen);
    ok = false;
    stamp = "stolen";
    lanes = [
      { name: "cookie", chips: [chip("sid", SESSION_SID, "bad", true), ...flagChips] },
      { name: "attacker", chips: [chip("sid", SESSION_SID, "bad", true)] },
    ];
    rec.record({ codeLine: 2, note: "HTTP request leaks the cookie." });
  } else {
    rec.record({ codeLine: 2, note: "Secure cookie stays off HTTP." });
  }

  if (flags.sameSite === "None") {
    rec.bump(AUTH_COUNTERS.csrf);
    ok = false;
    stamp = stamp === "stolen" ? "stolen+csrf" : "csrf";
    rec.record({ codeLine: 3, note: "Cross-site POST sends the cookie." });
  } else {
    rec.record({ codeLine: 3, note: "SameSite=Strict holds the cookie back." });
  }

  return rec.steps;
}

export const JWT_NOW = 10;

export function toySig(alg: string, sub: string, exp: number): number {
  let n = exp % 251;
  for (const c of `${alg}|${sub}`) {
    n = (n * 33 + c.charCodeAt(0)) % 251;
  }
  return n;
}

export type JwtCase = {
  alg: string;
  sub: string;
  exp: number;
  sig: number;
  label: string;
};

/** Slider 0 = valid; 1 = alg none; 2 = expired; 3 = tampered payload. */
export function jwtCase(size: number): JwtCase {
  if (size === 1) return { alg: "none", sub: "ada", exp: 20, sig: 0, label: "alg none" };
  if (size === 2) {
    return { alg: "HS256", sub: "ada", exp: 5, sig: toySig("HS256", "ada", 5), label: "expired" };
  }
  if (size === 3) {
    return {
      alg: "HS256",
      sub: "mallory",
      exp: 20,
      sig: toySig("HS256", "ada", 20),
      label: "tampered",
    };
  }
  return { alg: "HS256", sub: "ada", exp: 20, sig: toySig("HS256", "ada", 20), label: "valid" };
}

export type JwtPolicy = "naive" | "strict";

export function runJwt(policy: JwtPolicy, size: number): AlgoStep<AuthState>[] {
  const tok = jwtCase(size);
  let lanes: AuthLane[] = [];
  let stamp: string = tok.label;
  let ok = true;
  const rec = new StepRecorder<AuthState>(() => ({
    kind: "jwt",
    lanes: clone(lanes),
    stamp,
    ok,
  }));

  rec.record({ note: `JWT ${tok.label}. now=${JWT_NOW}.` });

  lanes = [
    {
      name: "token",
      chips: [
        chip("alg", tok.alg, tok.alg === "none" ? "warn" : "idle"),
        chip("sub", tok.sub, tok.sub === "mallory" ? "warn" : "idle"),
        chip("exp", String(tok.exp), tok.exp < JWT_NOW ? "warn" : "idle"),
        chip("sig", String(tok.sig), tok.alg === "none" ? "warn" : "idle"),
      ],
    },
  ];
  rec.record({
    codeLine: 0,
    note: `alg=${tok.alg} sub=${tok.sub} exp=${tok.exp} sig=${tok.sig}.`,
  });

  if (policy === "naive") {
    rec.bump(AUTH_COUNTERS.verified);
    stamp = "accept";
    ok = true;
    rec.record({ codeLine: 1, note: "Naive verifier accepts." });
  } else {
    let reason = "";
    if (tok.alg === "none") reason = "alg none";
    else if (tok.exp < JWT_NOW) reason = "expired";
    else if (tok.sig !== toySig(tok.alg, tok.sub, tok.exp)) reason = "bad sig";
    if (reason) {
      rec.bump(AUTH_COUNTERS.rejected);
      stamp = "reject";
      ok = false;
      rec.record({ codeLine: 2, note: `Strict rejects: ${reason}.` });
    } else {
      rec.bump(AUTH_COUNTERS.verified);
      stamp = "accept";
      ok = true;
      rec.record({ codeLine: 1, note: "Strict accepts." });
    }
  }

  return rec.steps;
}

export const OAUTH_CODE = "C9";
export const OAUTH_VERIFIER = "V4";
export const OAUTH_TOKEN = "T1";

export function pkceChallenge(verifier: string): number {
  let n = 0;
  for (const c of verifier) n = (n * 33 + c.charCodeAt(0)) % 97;
  return n;
}

export function runOAuth(pkce: boolean, intercept: boolean): AlgoStep<AuthState>[] {
  const challenge = pkce ? pkceChallenge(OAUTH_VERIFIER) : null;
  let lanes: AuthLane[] = [];
  let stamp: string = pkce ? "pkce" : "no pkce";
  let ok = true;
  const rec = new StepRecorder<AuthState>(() => ({
    kind: "oauth",
    lanes: clone(lanes),
    stamp,
    ok,
  }));

  rec.record({
    note: pkce
      ? `Auth code with PKCE. challenge=${challenge}.`
      : "Auth code without PKCE.",
  });

  lanes = [
    { name: "client", chips: pkce ? [chip("ver", OAUTH_VERIFIER, "ok")] : [] },
    { name: "authz", chips: [] },
    { name: "attacker", chips: [] },
  ];
  rec.record({
    codeLine: 0,
    note: pkce ? `Client holds verifier ${OAUTH_VERIFIER}.` : "Client has no verifier.",
  });

  lanes = [
    {
      name: "client",
      chips: pkce ? [chip("ver", OAUTH_VERIFIER, "ok")] : [],
    },
    {
      name: "authz",
      chips: [
        chip("code", OAUTH_CODE, "ok", true),
        ...(challenge !== null ? [chip("ch", String(challenge), "ok")] : []),
      ],
    },
    { name: "attacker", chips: [] },
  ];
  rec.record({ codeLine: 1, note: `Authz issues code ${OAUTH_CODE}.` });

  if (intercept) {
    lanes = [
      {
        name: "client",
        chips: pkce ? [chip("ver", OAUTH_VERIFIER, "ok")] : [chip("code", OAUTH_CODE, "warn")],
      },
      {
        name: "authz",
        chips: [
          chip("code", OAUTH_CODE, "warn"),
          ...(challenge !== null ? [chip("ch", String(challenge), "ok")] : []),
        ],
      },
      { name: "attacker", chips: [chip("code", OAUTH_CODE, "bad", true)] },
    ];
    rec.record({ codeLine: 2, note: `Attacker intercepts ${OAUTH_CODE}.` });

    if (!pkce) {
      rec.bump(AUTH_COUNTERS.stolen);
      ok = false;
      stamp = "stolen";
      lanes = [
        { name: "client", chips: [chip("code", OAUTH_CODE, "warn")] },
        { name: "authz", chips: [chip("code", "used", "bad")] },
        {
          name: "attacker",
          chips: [chip("code", OAUTH_CODE, "bad"), chip("tok", OAUTH_TOKEN, "bad", true)],
        },
      ];
      rec.record({ codeLine: 3, note: `Attacker exchanges ${OAUTH_CODE} for ${OAUTH_TOKEN}.` });
      rec.record({ codeLine: 4, note: "Client's exchange fails: code already used." });
      return rec.steps;
    }

    rec.bump(AUTH_COUNTERS.rejected);
    rec.record({
      codeLine: 3,
      note: "Attacker has no verifier. Exchange rejected.",
    });
  }

  rec.bump(AUTH_COUNTERS.issued);
  stamp = intercept ? "client holds" : "issued";
  ok = true;
  lanes = [
    {
      name: "client",
      chips: [
        ...(pkce ? [chip("ver", OAUTH_VERIFIER, "ok")] : []),
        chip("tok", OAUTH_TOKEN, "ok", true),
      ],
    },
    {
      name: "authz",
      chips: [
        chip("code", "used", "idle"),
        ...(challenge !== null ? [chip("ch", String(challenge), "ok")] : []),
      ],
    },
    { name: "attacker", chips: intercept ? [chip("code", OAUTH_CODE, "warn")] : [] },
  ];
  rec.record({
    codeLine: 4,
    note: `Client exchanges ${OAUTH_CODE} for ${OAUTH_TOKEN}.`,
  });
  return rec.steps;
}

export type AuthInput =
  | { kind: "session"; size: number }
  | { kind: "jwt"; policy: JwtPolicy; size: number }
  | { kind: "oauth"; pkce: boolean; intercept: boolean };

export function runAuth(input: AuthInput): AlgoStep<AuthState>[] {
  if (input.kind === "session") return runSession(input.size);
  if (input.kind === "jwt") return runJwt(input.policy, input.size);
  return runOAuth(input.pkce, input.intercept);
}
