import { buildAlgoSteps } from "@/engine/algo/build";
import {
  CRYPTO_COUNTERS,
  DH_P,
  mix8,
  popcount,
  runCrypto,
  runDh,
  runHash,
  runSign,
} from "@/engine/algo/crypto";
import type { AlgoDef } from "@/engine/algo/types";
import type { CryptoState } from "@/engine/algo/views/crypto";
import { CryptoView } from "@/engine/algo/views/CryptoView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

describe("mix8", () => {
  it("is deterministic and flipping a bit moves several output bits", () => {
    expect(mix8(42)).toBe(mix8(42));
    const flips = popcount(mix8(42) ^ mix8(42 ^ 1));
    expect(flips).toBeGreaterThanOrEqual(2);
  });
});

describe("runHash", () => {
  it("records the avalanche of one flipped bit", () => {
    const last = runHash(42, 0).at(-1)!;
    expect(last.counters[CRYPTO_COUNTERS.bitFlips]).toBe(
      popcount(mix8(42) ^ mix8(42 ^ 1)),
    );
    expect(last.state.kind).toBe("hash");
  });
});

describe("runDh", () => {
  it("Alice and Bob compute the same secret", () => {
    const last = runDh(6, 7).at(-1)!;
    const sA = last.state.rows.find((r) => r.name === "sA")!;
    const sB = last.state.rows.find((r) => r.name === "sB")!;
    const val = (row: typeof sA) =>
      row.bits.reduce((n, b, i) => n + (b.value << (row.bits.length - 1 - i)), 0);
    expect(val(sA)).toBe(val(sB));
    expect(last.counters[CRYPTO_COUNTERS.guesses]).toBe(DH_P);
  });
});

describe("runSign", () => {
  it("accepts the signed message and rejects a tampered one", () => {
    expect(runSign(4, false).at(-1)!.state.ok).toBe(true);
    expect(runSign(4, true).at(-1)!.state.ok).toBe(false);
    expect(runSign(4, false).at(-1)!.counters[CRYPTO_COUNTERS.verified]).toBe(1);
    expect(runSign(4, true).at(-1)!.counters[CRYPTO_COUNTERS.verified] ?? 0).toBe(0);
  });
});

describe("crypto rides on archetype B", () => {
  const def: AlgoDef<CryptoState, { kind: "hash"; input: number; flipBit: number }> = {
    id: "hash",
    title: "hash",
    code: ["input", "mix", "flip one bit"],
    counters: [{ key: CRYPTO_COUNTERS.bitFlips, label: "bits moved" }],
    size: { label: "flip bit", min: 0, max: 7, default: 0 },
    generateInput: (_rng, size) => ({ kind: "hash" as const, input: 42, flipBit: size }),
    run: (input) => runCrypto(input),
  };

  it("size changes the flipped bit and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 3, 1));
    const view: ComponentType<{ state: CryptoState }> = CryptoView;
    expect(view).toBe(CryptoView);
  });
});
