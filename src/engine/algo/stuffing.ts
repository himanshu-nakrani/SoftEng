import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { StuffAttempt, StuffBucket, StuffPolicy, StuffingState } from "./views/stuffing";

/**
 * Credential stuffing — six guesses at ada, rotating three IPs, with
 * the correct password on attempt 5.
 *
 * No limit: attempt 5 succeeds. An IP bucket of 3 lets the rotation
 * through (two tries per address). A username bucket of 3 blocks from
 * attempt 4, so the correct password never runs.
 *
 * Deliberately absent: CAPTCHA, progressive backoff, device cookies.
 * The argument is which key the bucket is on.
 */

export const STUFFING_COUNTERS = {
  attempts: "attempts",
  blocked: "blocked",
  stolen: "stolen",
} as const;

export const STUFF_SECRET = "ok";
export const STUFF_CAP = 3;

export const STUFF_ATTEMPTS = [
  { user: "ada", ip: "a", password: "w1" },
  { user: "ada", ip: "b", password: "w2" },
  { user: "ada", ip: "c", password: "w3" },
  { user: "ada", ip: "a", password: "w4" },
  { user: "ada", ip: "b", password: STUFF_SECRET },
  { user: "ada", ip: "c", password: "w6" },
] as const;

/** Slider 0 = no limit; 1 = per-IP cap 3; 2 = per-username cap 3. */
export function stuffingPolicy(size: number): StuffPolicy {
  if (size === 1) return "ip";
  if (size === 2) return "user";
  return "none";
}

export function runStuffing(policy: StuffPolicy): AlgoStep<StuffingState>[] {
  const attempts: StuffAttempt[] = STUFF_ATTEMPTS.map((a, i) => ({
    n: i + 1,
    user: a.user,
    ip: a.ip,
    result: "pending",
    active: false,
  }));
  const tokens = new Map<string, number>();
  if (policy === "ip") {
    for (const ip of ["a", "b", "c"]) tokens.set(ip, STUFF_CAP);
  } else if (policy === "user") {
    tokens.set("ada", STUFF_CAP);
  }
  let stamp: string = policy;
  const rec = new StepRecorder<StuffingState>(() => ({
    policy,
    attempts: attempts.map((a) => ({ ...a })),
    buckets: buckets(),
    stamp,
  }));

  function buckets(): StuffBucket[] {
    return [...tokens.entries()].map(([key, n]) => ({
      key,
      tokens: n,
      cap: STUFF_CAP,
    }));
  }

  rec.record({
    note:
      policy === "none"
        ? "No rate limit. Six guesses."
        : policy === "ip"
          ? `IP bucket cap ${STUFF_CAP}. Three addresses.`
          : `Username bucket cap ${STUFF_CAP}.`,
  });

  for (let i = 0; i < STUFF_ATTEMPTS.length; i++) {
    const row = STUFF_ATTEMPTS[i]!;
    for (const a of attempts) a.active = false;
    attempts[i]!.active = true;
    rec.bump(STUFFING_COUNTERS.attempts);

    const key = policy === "ip" ? row.ip : policy === "user" ? row.user : null;
    const remaining = key === null ? Infinity : (tokens.get(key) ?? 0);
    if (key !== null && remaining <= 0) {
      rec.bump(STUFFING_COUNTERS.blocked);
      attempts[i]!.result = "block";
      stamp = `${rec.count(STUFFING_COUNTERS.blocked)} blocked`;
      rec.record({
        codeLine: 1,
        note: `Attempt ${i + 1} ${row.ip} blocked.`,
      });
      continue;
    }
    if (key !== null) tokens.set(key, remaining - 1);

    attempts[i]!.result = "try";
    rec.record({
      codeLine: 0,
      note: `Attempt ${i + 1} ${row.user}@${row.ip}.`,
    });

    if (row.password === STUFF_SECRET) {
      rec.bump(STUFFING_COUNTERS.stolen);
      attempts[i]!.result = "ok";
      stamp = "stolen";
      rec.record({ codeLine: 2, note: `Password matches on attempt ${i + 1}.` });
    } else {
      attempts[i]!.result = "fail";
      rec.record({ codeLine: 2, note: `Wrong password on attempt ${i + 1}.` });
    }
  }

  if (rec.count(STUFFING_COUNTERS.stolen) === 0 && stamp !== `${rec.count(STUFFING_COUNTERS.blocked)} blocked`) {
    stamp = rec.count(STUFFING_COUNTERS.blocked) > 0 ? `${rec.count(STUFFING_COUNTERS.blocked)} blocked` : "held";
  }
  rec.record({
    note:
      rec.count(STUFFING_COUNTERS.stolen) > 0
        ? "Stuffing succeeded."
        : "Stuffing did not get the password through.",
  });
  return rec.steps;
}
