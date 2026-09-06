import { buildAlgoSteps } from "@/engine/algo/build";
import {
  CRYPTO_COUNTERS as C,
  mix8,
  popcount,
  runHash,
} from "@/engine/algo/crypto";
import type { AlgoDef } from "@/engine/algo/types";
import type { CryptoState } from "@/engine/algo/views/crypto";
import {
  HASH_INPUT,
  hashFunctionsAlgo,
  type HashInput,
} from "@/lessons/cryptography/hash-functions";
import { describe, expect, it } from "vitest";

/**
 * The hash-functions prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * mix8 is an 8-bit toy, not SHA-256. Avalanche is measured on input 42.
 * Work factor is 2^n for an n-bit preimage, counted, not simulated.
 */

function run(def: AlgoDef<CryptoState, HashInput>, flipBit: number, seed = 42) {
  const steps = buildAlgoSteps(def, flipBit, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    bitFlips: last.counters[C.bitFlips] ?? 0,
  };
}

function rowValue(state: CryptoState, name: string): number {
  const row = state.rows.find((r) => r.name === name);
  expect(row, `missing row ${name}`).toBeDefined();
  return row!.bits.reduce(
    (n, b, i) => n + (b.value << (row!.bits.length - 1 - i)),
    0,
  );
}

/** Output bits that move when input 42 flips bit b. Pinned on the page. */
const AVALANCHE_42 = [6, 4, 3, 2, 2, 2, 4, 2] as const;

describe("hash-functions: mix8 is an 8-bit toy", () => {
  it("mix8(42) is 23", () => {
    // "mix8(42) is 23. One pass."
    expect(HASH_INPUT).toBe(42);
    expect(mix8(42)).toBe(23);
    expect(hashFunctionsAlgo.generateInput(() => 0, 0).input).toBe(42);
  });

  it("the mixer hits every 8-bit value exactly once", () => {
    // "mix8 is a permutation of the 256 eight-bit values: every digest
    // has exactly one preimage, and 23 came from 42 and only 42."
    const seen = new Set<number>();
    for (let x = 0; x < 256; x++) seen.add(mix8(x));
    expect(seen.size).toBe(256);
    const preimages = [...Array(256).keys()].filter((x) => mix8(x) === 23);
    expect(preimages).toEqual([42]);
  });
});

describe("hash-functions: the slider is which bit to flip, 0 through 7", () => {
  it("offers 0 through 7, default 0, labelled flip bit", () => {
    expect(hashFunctionsAlgo.size).toMatchObject({
      min: 0,
      max: 7,
      default: 0,
      label: "flip bit",
    });
    expect(hashFunctionsAlgo.id).toBe("hash-functions");
    expect(hashFunctionsAlgo.counters.map((c) => c.key)).toEqual([C.bitFlips]);
  });

  it("every slider position changes the flipped bit", () => {
    const notes = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (b) => run(hashFunctionsAlgo, b).steps[3]!.note,
    );
    expect(new Set(notes).size).toBe(8);
  });

  it("ignores the seed: a mixer is not a scheduler", () => {
    expect(buildAlgoSteps(hashFunctionsAlgo, 0, 1)).toEqual(
      buildAlgoSteps(hashFunctionsAlgo, 0, 99),
    );
  });
});

describe("hash-functions: avalanche on input 42", () => {
  it("flip bit 0 moves 6 of 8 output bits", () => {
    // "One more step. Flip bit 0: 6 of 8 output bits move. The meter
    // jumps to 6. The last stamp is 6/8 avalanche."
    const { steps, bitFlips, state } = run(hashFunctionsAlgo, 0);
    expect(steps[2]!.note).toBe("mix8 → 23.");
    expect(steps[2]!.counters[C.bitFlips] ?? 0).toBe(0);
    expect(steps[3]!.note).toBe("Flip bit 0: 6 of 8 output bits move.");
    expect(steps[3]!.counters[C.bitFlips]).toBe(6);
    expect(steps[4]!.note).toBe("Avalanche 6/8.");
    expect(state.stamp).toBe("6/8 avalanche");
    expect(bitFlips).toBe(6);
    expect(rowValue(state, "in")).toBe(42);
    expect(rowValue(state, "H")).toBe(23);
    expect(rowValue(state, "in'")).toBe(43);
    expect(rowValue(state, "H'")).toBe(mix8(43));
  });

  it("the eight bits move 6, 4, 3, 2, 2, 2, 4, and 2 output bits", () => {
    // "On input 42 the eight single-bit flips move 6, 4, 3, 2, 2, 2, 4,
    // and 2 output bits."
    // "Drag to bit 1: 4 of 8 move. Bit 2: 3. Bits 3, 4, 5 and 7: 2.
    // Bit 6: 4."
    for (let b = 0; b < 8; b++) {
      const moved = popcount(mix8(42) ^ mix8(42 ^ (1 << b)));
      expect(moved, `bit ${b}`).toBe(AVALANCHE_42[b]);
      const { bitFlips, state, steps } = run(hashFunctionsAlgo, b);
      expect(bitFlips).toBe(AVALANCHE_42[b]);
      expect(state.stamp).toBe(`${AVALANCHE_42[b]}/8 avalanche`);
      expect(steps[3]!.note).toBe(
        `Flip bit ${b}: ${AVALANCHE_42[b]} of 8 output bits move.`,
      );
      const last = runHash(42, b).at(-1)!;
      expect(last.counters[C.bitFlips]).toBe(AVALANCHE_42[b]);
    }
  });

  it("the producer and the lesson def agree at every bit", () => {
    for (const b of [0, 1, 2, 7]) {
      expect(buildAlgoSteps(hashFunctionsAlgo, b, 42)).toEqual(runHash(42, b));
    }
  });

  it("opens on an empty stage with the input not yet hashed", () => {
    // "Leave flip bit at 0. Step until the caption reads mix8 → 23.
    // The bits-moved meter is still 0."
    const { steps } = run(hashFunctionsAlgo, 0);
    expect(steps).toHaveLength(5);
    expect(steps[0]!.note).toBe("Hash 8-bit input 42.");
    expect(steps[0]!.state.stamp).toBe("hash");
    expect(steps[0]!.state.rows).toEqual([]);
    expect(steps[0]!.counters[C.bitFlips] ?? 0).toBe(0);
    expect(steps[1]!.note).toBe("Input 42.");
    expect(rowValue(steps[1]!.state, "in")).toBe(42);
    expect(steps[2]!.note).toBe("mix8 → 23.");
    expect(rowValue(steps[2]!.state, "H")).toBe(23);
  });
});

describe("hash-functions: work factor is counted, not simulated", () => {
  it("an 8-bit preimage is 256 guesses, and the run does not guess", () => {
    // "An 8-bit preimage is 256 guesses. A 256-bit preimage is 2^256.
    // We count that. We do not step through it."
    // "This page does not run SHA-256, and it does not simulate 2^256 steps."
    expect(2 ** 8).toBe(256);
    expect(hashFunctionsAlgo.counters.some((c) => c.key === C.guesses)).toBe(
      false,
    );
    for (const b of [0, 3, 7]) {
      const { steps, counters } = run(hashFunctionsAlgo, b);
      expect(steps).toHaveLength(5);
      expect(counters[C.guesses]).toBeUndefined();
    }
  });
});
