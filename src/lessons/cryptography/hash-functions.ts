import { CRYPTO_COUNTERS, runHash } from "@/engine/algo/crypto";
import type { AlgoDef } from "@/engine/algo/types";
import type { CryptoState } from "@/engine/algo/views/crypto";

/**
 * Hash Functions — archetype B (`engine: "steps"`).
 *
 * A hash is cheap forward and a search backward. This lesson's mixer is
 * mix8: eight bits in, eight bits out, five shift/xor/add steps. It is
 * not SHA-256. The figure hashes a fixed input (42), then flips one bit
 * and counts how many of the eight output bits move — avalanche, measured
 * rather than promised at 50%.
 *
 * THE CONTROL IS WHICH INPUT BIT FLIPS. 0 through 7, default 0. Measured
 * at input 42: mix8(42) = 23; bit 0 moves 6 of 8 output bits, bit 1 moves
 * 4, bit 2 moves 3, bits 3–5 and 7 move 2, bit 6 moves 4. Every position
 * is a different flipped input; bits 3, 4, 5 and 7 happen to move the
 * same count and still light a different chip.
 *
 * Work factor is not a second figure. An 8-bit preimage is 256 guesses
 * (mix8 is a permutation of 0–255, so 23 has exactly one preimage — 42);
 * a 256-bit preimage is 2^256. The producer records avalanche as a
 * counter. It does not step through 256, let alone 2^256, guesses.
 *
 * MODELLING NOTE, and its limits. mix8 is a toy so a step list can show
 * diffusion. Deliberately absent: SHA-256, a variable-length input, a
 * salt, and a guess loop. Those change the constants. They do not change
 * the argument: forward is one mix, a one-bit change scatters, and a
 * preimage is 2^n guesses for an n-bit digest.
 */

const INPUT = 42;

const CODE = [
  "x is 8 bits",
  "h = mix8(x)",
  "flip one input bit",
];

export type HashInput = { input: number; flipBit: number };

export const hashFunctionsAlgo: AlgoDef<CryptoState, HashInput> = {
  id: "hash-functions",
  title: "one flipped bit",
  code: CODE,
  counters: [{ key: CRYPTO_COUNTERS.bitFlips, label: "bits moved" }],
  size: {
    label: "flip bit",
    min: 0,
    max: 7,
    default: 0,
  },
  generateInput: (_rng, size) => ({ input: INPUT, flipBit: size }),
  run: (input) => runHash(input.input, input.flipBit),
};

/** Pinned: the lesson's only input. mix8(42) is 23. */
export const HASH_INPUT = INPUT;
