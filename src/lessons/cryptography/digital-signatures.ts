import {
  CRYPTO_COUNTERS,
  runSign,
} from "@/engine/algo/crypto";
import type { AlgoDef } from "@/engine/algo/types";
import type { CryptoState } from "@/engine/algo/views/crypto";

/**
 * Digital Signatures — archetype B (`engine: "steps"`).
 *
 * Toy RSA, n=55, e=3, d=27. Sign is m^d mod n; verify is s^e mod n.
 * Anyone with e can check; only d can sign. THE CONTRAST IS TWO FIGURES:
 * an honest verify and a tampered message. The slider is the message,
 * 1 through 16.
 *
 * runSign wraps m = (message % 54) + 1 so it never signs 0. Slider 4
 * therefore signs plaintext 5. Measured at that default: sig = 25,
 * s^e = 5. Honest: ok true, verified 1, stamp "verify ok". Tamper: the
 * verifier sees 6, s^e = 5 ≠ 6, ok false, verified 0, stamp "verify fail".
 * Every slider position 1–16: honest accepts, tamper rejects. Sign costs
 * 8 modular multiplies; verify costs 3 more (11 total). Seed is ignored.
 *
 * MODELLING NOTE, and its limits. n=55 = 5×11 is factorable in your head,
 * so anyone can recover d from e. A real signature is over a hash of the
 * message, with a 2048-bit modulus, in constant time. Those change the
 * work factor. They do not change the argument: the public exponent
 * verifies, the private exponent signs, and a changed message cannot
 * reuse the signature.
 */

const CODE = [
  "s = m^d mod n",
  "accept if s^e = m",
  "reject if s^e != seen",
];

const counters = [
  { key: CRYPTO_COUNTERS.verified, label: "verified" },
  { key: CRYPTO_COUNTERS.mul, label: "mod muls" },
];

const sizeControl = {
  label: "message",
  min: 1,
  max: 16,
  default: 4,
} as const;

type SignInput = { message: number; tamper: boolean };

function def(
  id: string,
  title: string,
  tamper: boolean,
): AlgoDef<CryptoState, SignInput> {
  return {
    id,
    title,
    code: CODE,
    counters,
    size: sizeControl,
    generateInput: (_rng, size) => ({ message: size, tamper }),
    run: (input) => runSign(input.message, input.tamper),
  };
}

/** Honest verify: s^e comes back m. */
export const digitalSignaturesAlgo = def(
  "digital-signatures",
  "sign then verify",
  false,
);

/** Same signature, message bumped by one: the check fails. */
export const digitalSignaturesTamperAlgo = def(
  "digital-signatures-tamper",
  "tampered message",
  true,
);
