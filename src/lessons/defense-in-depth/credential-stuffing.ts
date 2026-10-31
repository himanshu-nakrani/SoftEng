import {
  STUFFING_COUNTERS,
  runStuffing,
} from "@/engine/algo/stuffing";
import type { AlgoDef } from "@/engine/algo/types";
import type { StuffingState } from "@/engine/algo/views/stuffing";

/**
 * Credential Stuffing — archetype B (`engine: "steps"`).
 *
 * Six guesses at ada, IPs a, b, c, a, b, c, correct password on attempt 5.
 * No limit: stolen 1, blocked 0, attempt 5 is ok, last note "Stuffing
 * succeeded.", stamp stolen. A username bucket of cap 3 blocks from
 * attempt 4: stolen 0, blocked 3, attempts 4–6 are block, stamp
 * "3 blocked". An IP bucket of the same cap still steals — two tries
 * per address stays under 3 — and is measured in the prose, not a
 * third figure.
 *
 * THE CONTRAST IS TWO FIGURES, not a slider. Policy is the lesson, and
 * a size control would imply the script changes. generateInput ignores
 * the seed: stuffing is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Six attempts, cap 3. Deliberately
 * absent: CAPTCHA, progressive backoff, device cookies. Those change
 * the constants. They do not change the argument: stuffing is many
 * passwords against one account, so the bucket belongs on the username.
 */

const CODE = [
  "try if tokens left",
  "block if empty",
  "match the secret",
];

const counters = [
  { key: STUFFING_COUNTERS.attempts, label: "attempts" },
  { key: STUFFING_COUNTERS.blocked, label: "blocked" },
  { key: STUFFING_COUNTERS.stolen, label: "stolen" },
];

function def(
  id: string,
  title: string,
  policy: "none" | "user",
): AlgoDef<StuffingState, "none" | "user"> {
  return {
    id,
    title,
    code: CODE,
    counters,
    generateInput: () => policy,
    run: (input) => runStuffing(input),
  };
}

/** No bucket. Attempt 5 matches and the account is stolen. */
export const credentialStuffingAlgo = def(
  "credential-stuffing",
  "no limit",
  "none",
);

/** Username bucket cap 3. Attempts 4–6 block; the password never runs. */
export const credentialStuffingUserAlgo = def(
  "credential-stuffing-user",
  "username bucket",
  "user",
);
