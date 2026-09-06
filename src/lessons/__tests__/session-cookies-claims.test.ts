import { buildAlgoSteps } from "@/engine/algo/build";
import {
  AUTH_COUNTERS as C,
  SESSION_SID,
  cookieFlags,
  runSession,
} from "@/engine/algo/auth";
import type { AlgoDef } from "@/engine/algo/types";
import type { AuthState } from "@/engine/algo/views/auth";
import { sessionCookiesAlgo } from "@/lessons/identity-access/session-cookies";
import { describe, expect, it } from "vitest";

/**
 * The session-cookies prose states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became
 * untrue.
 *
 * This is a toy cookie (sid S7, three flags). Not a browser.
 */

function run<I>(def: AlgoDef<AuthState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  const attacker = last.state.lanes.find((l) => l.name === "attacker");
  return {
    steps,
    state: last.state,
    counters: last.counters,
    stolen: last.counters[C.stolen] ?? 0,
    csrf: last.counters[C.csrf] ?? 0,
    stamp: last.state.stamp,
    ok: last.state.ok,
    attackerSid: attacker?.chips.some((c) => c.value === SESSION_SID) ?? false,
  };
}

const FLAGS = [0, 1, 2, 3] as const;

describe("session-cookies: the slider is flags, 0 through 3", () => {
  it("offers 0 through 3, default 0, labelled flags", () => {
    // "The slider is the flags, from 0 to 3. Default 0 is all three
    // on: HttpOnly, Secure, SameSite=Strict."
    expect(sessionCookiesAlgo.size).toMatchObject({
      min: 0,
      max: 3,
      default: 0,
      label: "flags",
    });
    expect(sessionCookiesAlgo.id).toBe("session-cookies");
    expect(sessionCookiesAlgo.id.startsWith("session-cookies")).toBe(true);
    expect(sessionCookiesAlgo.counters.map((c) => c.key)).toEqual([
      C.stolen,
      C.csrf,
    ]);
  });

  it("size is the flags argument; the sid is S7", () => {
    // "A session cookie is a name the server wrote into the browser:
    // sid=S7."
    expect(SESSION_SID).toBe("S7");
    expect(sessionCookiesAlgo.generateInput(() => 0, 0)).toBe(0);
    expect(sessionCookiesAlgo.generateInput(() => 0, 3)).toBe(3);
  });

  it("ignores the seed: a cookie is not a scheduler", () => {
    expect(buildAlgoSteps(sessionCookiesAlgo, 0, 1)).toEqual(
      buildAlgoSteps(sessionCookiesAlgo, 0, 99),
    );
    expect(buildAlgoSteps(sessionCookiesAlgo, 1, 1)).toEqual(
      buildAlgoSteps(sessionCookiesAlgo, 1, 99),
    );
  });

  it("every flags position is five frames, and the producer agrees", () => {
    for (const n of FLAGS) {
      const { steps } = run(sessionCookiesAlgo, n);
      expect(steps).toHaveLength(5);
      expect(buildAlgoSteps(sessionCookiesAlgo, n, 42)).toEqual(runSession(n));
    }
  });
});

describe("session-cookies: flags 0 keeps S7 put", () => {
  it("HttpOnly on, Secure on, SameSite=Strict: stolen 0, csrf 0, stamp cookie", () => {
    // "Leave flags at 0. Step through the captions: "Issue sid=S7."
    // "Flags HttpOnly=on Secure=on SameSite=Strict." "XSS cannot read
    // HttpOnly cookie." "Secure cookie stays off HTTP."
    // "SameSite=Strict holds the cookie back." stolen 0, csrf 0.
    // Stamp cookie."
    expect(cookieFlags(0)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    });
    const { steps, stolen, csrf, stamp, ok, attackerSid } = run(
      sessionCookiesAlgo,
      0,
    );
    expect(steps[0]!.note).toBe("Issue sid=S7.");
    expect(steps[1]!.note).toBe(
      "Flags HttpOnly=on Secure=on SameSite=Strict.",
    );
    expect(steps[2]!.note).toBe("XSS cannot read HttpOnly cookie.");
    expect(steps[3]!.note).toBe("Secure cookie stays off HTTP.");
    expect(steps[4]!.note).toBe("SameSite=Strict holds the cookie back.");
    expect(stolen).toBe(0);
    expect(csrf).toBe(0);
    expect(stamp).toBe("cookie");
    expect(ok).toBe(true);
    expect(attackerSid).toBe(false);
  });
});

describe("session-cookies: 1 XSS, 2 HTTP, 3 CSRF", () => {
  it("flags 1 turns HttpOnly off: stolen 1, csrf 0, stamp stolen, attacker holds S7", () => {
    // "Drag to 1. HttpOnly is off. Caption: "XSS reads document.cookie.
    // Sid stolen." stolen 1, csrf 0. Stamp stolen. The attacker holds
    // S7."
    expect(cookieFlags(1)).toEqual({
      httpOnly: false,
      secure: true,
      sameSite: "Strict",
    });
    const { steps, stolen, csrf, stamp, ok, attackerSid } = run(
      sessionCookiesAlgo,
      1,
    );
    expect(steps.some((s) => s.note === "XSS reads document.cookie. Sid stolen.")).toBe(
      true,
    );
    expect(stolen).toBe(1);
    expect(csrf).toBe(0);
    expect(stamp).toBe("stolen");
    expect(ok).toBe(false);
    expect(attackerSid).toBe(true);
  });

  it("flags 2 turns Secure off: stolen 1, csrf 0, stamp stolen", () => {
    // "Drag to 2. Secure is off. Caption: "HTTP request leaks the
    // cookie." stolen 1, csrf 0. Stamp still stolen."
    expect(cookieFlags(2)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    });
    const { steps, stolen, csrf, stamp, ok, attackerSid } = run(
      sessionCookiesAlgo,
      2,
    );
    expect(steps.some((s) => s.note === "HTTP request leaks the cookie.")).toBe(
      true,
    );
    expect(stolen).toBe(1);
    expect(csrf).toBe(0);
    expect(stamp).toBe("stolen");
    expect(ok).toBe(false);
    expect(attackerSid).toBe(true);
  });

  it("flags 3 sets SameSite=None: stolen 0, csrf 1, stamp csrf", () => {
    // "Drag to 3. SameSite=None. Caption: "Cross-site POST sends the
    // cookie." stolen 0, csrf 1. Stamp csrf. The sid never left as a
    // copy — the browser sent it."
    expect(cookieFlags(3)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });
    const { steps, stolen, csrf, stamp, ok, attackerSid } = run(
      sessionCookiesAlgo,
      3,
    );
    expect(
      steps.some((s) => s.note === "Cross-site POST sends the cookie."),
    ).toBe(true);
    expect(stolen).toBe(0);
    expect(csrf).toBe(1);
    expect(stamp).toBe("csrf");
    expect(ok).toBe(false);
    expect(attackerSid).toBe(false);
  });

  it("stolen and csrf are different doors at every slider stop", () => {
    // "stolen and csrf are different doors. XSS and HTTP produce a copy
    // (stolen 1). SameSite=None never copies the sid — it lets a
    // cross-site POST ride along (csrf 1, stolen 0)."
    const expected = [
      { stolen: 0, csrf: 0, stamp: "cookie" },
      { stolen: 1, csrf: 0, stamp: "stolen" },
      { stolen: 1, csrf: 0, stamp: "stolen" },
      { stolen: 0, csrf: 1, stamp: "csrf" },
    ] as const;
    for (const n of FLAGS) {
      const got = run(sessionCookiesAlgo, n);
      expect(got.stolen, `flags ${n} stolen`).toBe(expected[n].stolen);
      expect(got.csrf, `flags ${n} csrf`).toBe(expected[n].csrf);
      expect(got.stamp, `flags ${n} stamp`).toBe(expected[n].stamp);
    }
  });
});
