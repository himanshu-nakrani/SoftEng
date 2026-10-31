import { buildAlgoSteps } from "@/engine/algo/build";
import { CRYPTO_COUNTERS as C, DH_G, DH_P, runDh } from "@/engine/algo/crypto";
import type { AlgoDef } from "@/engine/algo/types";
import type { CryptoState } from "@/engine/algo/views/crypto";
import { diffieHellmanAlgo } from "@/lessons/cryptography/diffie-hellman";
import { describe, expect, it } from "vitest";

/**
 * The Diffie-Hellman lesson states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 */

function rowVal(row: CryptoState["rows"][number]): number {
  return row.bits.reduce(
    (n, b, i) => n + (b.value << (row.bits.length - 1 - i)),
    0,
  );
}

function rowsOf(state: CryptoState): Record<string, number> {
  return Object.fromEntries(state.rows.map((r) => [r.name, rowVal(r)]));
}

function run<I>(def: AlgoDef<CryptoState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    rows: rowsOf(last.state),
    muls: last.counters[C.mul] ?? 0,
    guesses: last.counters[C.guesses] ?? 0,
  };
}

const SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

describe("diffie-hellman: the slider is Alice's secret, 2 through 10", () => {
  it("offers 2 through 10, default 6, Bob fixed at 7", () => {
    // "Bob's secret is fixed at 7. The slider is Alice's secret, from 2
    // to 10. Default 6 is the measured run."
    expect(diffieHellmanAlgo.size).toMatchObject({
      min: 2,
      max: 10,
      default: 6,
      label: "Alice's secret",
    });
    expect(diffieHellmanAlgo.generateInput(() => 0, 6)).toEqual({
      alice: 6,
      bob: 7,
    });
  });

  it("ignores the seed: an exponentiation is not a scheduler", () => {
    expect(buildAlgoSteps(diffieHellmanAlgo, 6, 1)).toEqual(
      buildAlgoSteps(diffieHellmanAlgo, 6, 99),
    );
  });

  it("the lesson def at 6 is the same run as runDh(6, 7)", () => {
    expect(buildAlgoSteps(diffieHellmanAlgo, 6, 42)).toEqual(runDh(6, 7));
  });
});

describe("diffie-hellman: a=6, b=7 → shared 12", () => {
  it("Alice publishes 8, Bob publishes 17, both land on 12", () => {
    // "Leave Alice's secret at 6. Step: Alice publishes 8, then Bob
    // publishes 17."
    // "Rows sA and sB both show 12."
    const { steps, rows } = run(diffieHellmanAlgo, 6);
    expect(steps[1]!.note).toBe("Alice publishes g^a = 8.");
    expect(rowsOf(steps[1]!.state)).toEqual({ A: 8 });
    expect(steps[2]!.note).toBe("Bob publishes g^b = 17.");
    expect(rowsOf(steps[2]!.state)).toEqual({ A: 8, B: 17 });
    expect(steps[3]!.note).toBe("Shared secret 12 — both sides match.");
    expect(rows).toEqual({ A: 8, B: 17, sA: 12, sB: 12 });
    expect(rows.sA).toBe(rows.sB);
  });

  it("mod muls read 4, then 9, then 18", () => {
    // "Mod muls read 4, then 9." / "Mod muls land on 18."
    const { steps, muls } = run(diffieHellmanAlgo, 6);
    expect(steps[1]!.counters[C.mul]).toBe(4);
    expect(steps[2]!.counters[C.mul]).toBe(9);
    expect(steps[3]!.counters[C.mul]).toBe(18);
    expect(muls).toBe(18);
  });

  it("the last frame stamps shared 12 and records 23 guesses", () => {
    // "Last step: the stamp becomes shared 12. Guesses land on 23."
    const { steps, state, guesses } = run(diffieHellmanAlgo, 6);
    const last = steps[steps.length - 1]!;
    expect(last.note).toBe(
      "Eve sees 8 and 17. Brute-forcing a is at most 23 trials.",
    );
    expect(state.stamp).toBe("shared 12");
    expect(guesses).toBe(23);
    expect(guesses).toBe(DH_P);
    expect(DH_G).toBe(5);
    expect(DH_P).toBe(23);
  });

  it("opens on p=23 g=5 with no rows and no work yet", () => {
    const first = run(diffieHellmanAlgo, 6).steps[0]!;
    expect(first.note).toBe(
      "Diffie-Hellman, p=23, g=5. Alice a=6, Bob b=7.",
    );
    expect(first.state.stamp).toBe("DH p=23 g=5");
    expect(first.state.kind).toBe("dh");
    expect(first.state.rows).toEqual([]);
    expect(first.counters[C.mul] ?? 0).toBe(0);
    expect(first.counters[C.guesses] ?? 0).toBe(0);
  });
});

describe("diffie-hellman: dragging Alice's secret", () => {
  it("at 2, A becomes 2 and the secret becomes 13", () => {
    // "Now drag to 2: A becomes 2, the secret becomes 13."
    const { rows, state } = run(diffieHellmanAlgo, 2);
    expect(rows.A).toBe(2);
    expect(rows.B).toBe(17);
    expect(rows.sA).toBe(13);
    expect(rows.sB).toBe(13);
    expect(state.stamp).toBe("shared 13");
  });

  it("at 10, A becomes 9 and the secret becomes 4", () => {
    // "Drag to 10: A becomes 9, the secret 4. B stays 17."
    const { rows, state } = run(diffieHellmanAlgo, 10);
    expect(rows.A).toBe(9);
    expect(rows.B).toBe(17);
    expect(rows.sA).toBe(4);
    expect(rows.sB).toBe(4);
    expect(state.stamp).toBe("shared 4");
  });

  it("every stop publishes a different A; B stays 17; both sides match; guesses stay 23", () => {
    // "Every slider stop publishes a different A. B is 17 at all of
    // them" / "The guesses meter stays at 23" / "Both sides still match."
    const publics = SIZES.map((a) => run(diffieHellmanAlgo, a).rows.A);
    expect(new Set(publics).size).toBe(SIZES.length);
    for (const a of SIZES) {
      const { rows, guesses } = run(diffieHellmanAlgo, a);
      expect(rows.B).toBe(17);
      expect(rows.sA).toBe(rows.sB);
      expect(guesses).toBe(23);
    }
  });
});
