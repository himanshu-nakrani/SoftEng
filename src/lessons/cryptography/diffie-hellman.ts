import {
  CRYPTO_COUNTERS,
  runDh,
} from "@/engine/algo/crypto";
import type { AlgoDef } from "@/engine/algo/types";
import type { CryptoState } from "@/engine/algo/views/crypto";

/**
 * Diffie-Hellman — archetype B (`engine: "steps"`).
 *
 * Alice and Bob agree on a number without sending it. Each keeps an
 * exponent, publishes g^exponent mod p, and raises the other's public
 * value to their own secret. Both land on g^(ab) mod p. Eve sees the
 * two publics. Measured at a=6, b=7, p=23, g=5: Alice publishes 8, Bob
 * publishes 17, both compute 12, 18 modular multiplies, and Eve's
 * brute-force bound is 23 trials — p, not a loop the figure ran.
 *
 * THE CONTROL IS ALICE'S SECRET. 2 through 10, Bob fixed at 7. Default
 * 6 is the pinned run. Every stop publishes a different A; B stays 17;
 * both sides still match; guesses stay 23.
 *
 * MODELLING NOTE, and its limits. p=23 so the numbers fit on chips.
 * Real Diffie-Hellman uses a 2048-bit modulus; the same bound is then
 * 2^2048, which is why the toy is a toy. The guesses meter records
 * that bound — it does not simulate 23 guesses. Deliberately absent:
 * authentication (a man-in-the-middle who substitutes public values),
 * constant-time exponentiation, a safe prime / subgroup. Those change
 * how you deploy DH. They do not change that both sides land on the
 * same secret without sending the exponents.
 */

const BOB = 7;

const CODE = [
  "A = g^a mod p",
  "B = g^b mod p",
  "s = B^a = A^b",
  "Eve tries 1..p",
];

export const diffieHellmanAlgo: AlgoDef<
  CryptoState,
  { alice: number; bob: number }
> = {
  id: "diffie-hellman",
  title: "key exchange",
  code: CODE,
  counters: [
    { key: CRYPTO_COUNTERS.mul, label: "mod muls" },
    { key: CRYPTO_COUNTERS.guesses, label: "guesses" },
  ],
  size: {
    label: "Alice's secret",
    min: 2,
    max: 10,
    default: 6,
  },
  generateInput: (_rng, size) => ({ alice: size, bob: BOB }),
  run: (input) => runDh(input.alice, input.bob),
};
