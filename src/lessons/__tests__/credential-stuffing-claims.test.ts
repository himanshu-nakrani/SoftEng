import { buildAlgoSteps } from "@/engine/algo/build";
import {
  STUFFING_COUNTERS as C,
  STUFF_ATTEMPTS,
  STUFF_CAP,
  STUFF_SECRET,
  runStuffing,
} from "@/engine/algo/stuffing";
import type { AlgoDef } from "@/engine/algo/types";
import type { StuffingState } from "@/engine/algo/views/stuffing";
import {
  credentialStuffingAlgo,
  credentialStuffingUserAlgo,
} from "@/lessons/defense-in-depth/credential-stuffing";
import { describe, expect, it } from "vitest";

/**
 * The credential-stuffing prose states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became untrue.
 *
 * None and user ride the lesson defs. IP is measured via runStuffing
 * directly — there is no third figure.
 */

function last(def: AlgoDef<StuffingState, "none" | "user">, seed = 42) {
  const steps = buildAlgoSteps(def, 0, seed);
  const final = steps[steps.length - 1]!;
  return {
    steps,
    state: final.state,
    counters: final.counters,
    note: final.note,
    stamp: final.state.stamp,
    attempts: final.counters[C.attempts] ?? 0,
    blocked: final.counters[C.blocked] ?? 0,
    stolen: final.counters[C.stolen] ?? 0,
  };
}

const none = (seed = 42) => last(credentialStuffingAlgo, seed);
const user = (seed = 42) => last(credentialStuffingUserAlgo, seed);

describe("credential-stuffing · six guesses at ada, password on attempt 5", () => {
  it("is six attempts at ada, IPs a, b, c, a, b, c, cap 3", () => {
    // "This toy is six guesses at ada. The IPs rotate a, b, c, a, b, c —
    // two tries per address."
    // "The cap is 3."
    expect(STUFF_ATTEMPTS).toHaveLength(6);
    expect(STUFF_ATTEMPTS.every((a) => a.user === "ada")).toBe(true);
    expect(STUFF_ATTEMPTS.map((a) => a.ip)).toEqual(["a", "b", "c", "a", "b", "c"]);
    expect(STUFF_CAP).toBe(3);
  });

  it("attempt 5 is the password ok", () => {
    // "Attempt 5 is the password ok. The other five are wrong."
    expect(STUFF_ATTEMPTS[4]!.password).toBe("ok");
    expect(STUFF_ATTEMPTS[4]!.password).toBe(STUFF_SECRET);
    expect(STUFF_ATTEMPTS.filter((a) => a.password === STUFF_SECRET)).toHaveLength(
      1,
    );
  });

  it("has no size slider — policy is a second figure, not a control", () => {
    expect(credentialStuffingAlgo.size).toBeUndefined();
    expect(credentialStuffingUserAlgo.size).toBeUndefined();
    expect(credentialStuffingAlgo.id).toBe("credential-stuffing");
    expect(credentialStuffingUserAlgo.id).toBe("credential-stuffing-user");
    expect(credentialStuffingAlgo.generateInput(() => 0, 0)).toBe("none");
    expect(credentialStuffingUserAlgo.generateInput(() => 0, 0)).toBe("user");
    expect(credentialStuffingAlgo.counters.map((c) => c.key)).toEqual([
      C.attempts,
      C.blocked,
      C.stolen,
    ]);
  });

  it("ignores the seed: stuffing is not a scheduler", () => {
    expect(buildAlgoSteps(credentialStuffingAlgo, 0, 1)).toEqual(
      buildAlgoSteps(credentialStuffingAlgo, 0, 99),
    );
    expect(buildAlgoSteps(credentialStuffingUserAlgo, 0, 1)).toEqual(
      buildAlgoSteps(credentialStuffingUserAlgo, 0, 99),
    );
  });
});

describe("credential-stuffing · no limit", () => {
  it("attempts 6, stolen 1, blocked 0, attempt 5 is ok", () => {
    // "Skip to the end. Attempts 6, stolen 1, blocked 0. Attempt 5
    // reads ok."
    const run = none();
    expect(run.attempts).toBe(6);
    expect(run.stolen).toBe(1);
    expect(run.blocked).toBe(0);
    expect(run.state.attempts[4]!.result).toBe("ok");
  });

  it("ends Stuffing succeeded with stamp stolen", () => {
    // "The last caption is \"Stuffing succeeded.\" Stamp stolen."
    const run = none();
    expect(run.note).toBe("Stuffing succeeded.");
    expect(run.stamp).toBe("stolen");
    expect(run.steps[0]!.note).toBe("No rate limit. Six guesses.");
  });

  it("the none figure is runStuffing(\"none\")", () => {
    expect(buildAlgoSteps(credentialStuffingAlgo, 0, 42)).toEqual(
      runStuffing("none"),
    );
  });
});

describe("credential-stuffing · username bucket", () => {
  it("attempts 6, stolen 0, blocked 3, attempts 4–6 are block", () => {
    // "Skip to the end. Attempts 6, stolen 0, blocked 3. Attempts 4–6
    // read block."
    // "Attempts 4–6 never run the password."
    const run = user();
    expect(run.attempts).toBe(6);
    expect(run.stolen).toBe(0);
    expect(run.blocked).toBe(3);
    expect(run.state.attempts.slice(3).map((a) => a.result)).toEqual([
      "block",
      "block",
      "block",
    ]);
  });

  it("ends with stamp 3 blocked", () => {
    // "Stamp 3 blocked."
    const run = user();
    expect(run.stamp).toBe("3 blocked");
    expect(run.steps[0]!.note).toBe("Username bucket cap 3.");
  });

  it("the user figure is runStuffing(\"user\")", () => {
    expect(buildAlgoSteps(credentialStuffingUserAlgo, 0, 42)).toEqual(
      runStuffing("user"),
    );
  });
});

describe("credential-stuffing · IP bucket is the wrong key", () => {
  it("stolen 1, blocked 0, attempts 6 — rotation gets through", () => {
    // "Three addresses, two tries each. Stolen 1, blocked 0, attempts 6.
    // Rotation stays under the cap, so attempt 5 still runs."
    // "an IP bucket still steals the account: stolen 1, blocked 0, attempts 6."
    const final = runStuffing("ip").at(-1)!;
    expect(final.counters[C.stolen]).toBe(1);
    expect(final.counters[C.blocked] ?? 0).toBe(0);
    expect(final.counters[C.attempts]).toBe(6);
    expect(final.state.attempts[4]!.result).toBe("ok");
    expect(final.state.stamp).toBe("stolen");
    expect(final.note).toBe("Stuffing succeeded.");
  });

  it("two tries per address stays under a cap of 3", () => {
    // "Two tries per address stays under a cap of 3"
    const counts = { a: 0, b: 0, c: 0 };
    for (const row of STUFF_ATTEMPTS) counts[row.ip as "a" | "b" | "c"] += 1;
    expect(counts).toEqual({ a: 2, b: 2, c: 2 });
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(STUFF_CAP);
  });
});
