import { buildAlgoSteps } from "@/engine/algo/build";
import {
  CRYPTO_COUNTERS as C,
  RSA_D,
  RSA_E,
  RSA_N,
  runSign,
} from "@/engine/algo/crypto";
import type { AlgoDef } from "@/engine/algo/types";
import type { CryptoState } from "@/engine/algo/views/crypto";
import {
  digitalSignaturesAlgo,
  digitalSignaturesTamperAlgo,
} from "@/lessons/cryptography/digital-signatures";
import { describe, expect, it } from "vitest";

/**
 * The digital-signatures prose states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became untrue.
 */

function rowValue(state: CryptoState, name: string): number | undefined {
  const row = state.rows.find((r) => r.name === name);
  if (!row) return undefined;
  return row.bits.reduce(
    (n, b, i) => n + (b.value << (row.bits.length - 1 - i)),
    0,
  );
}

function run<I>(def: AlgoDef<CryptoState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    ok: last.state.ok,
    verified: last.counters[C.verified] ?? 0,
    mul: last.counters[C.mul] ?? 0,
    stamp: last.state.stamp,
    note: last.note,
    m: rowValue(last.state, "m"),
    sig: rowValue(last.state, "sig"),
    see: rowValue(last.state, "see"),
    out: rowValue(last.state, "out"),
  };
}

const MESSAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

describe("digital-signatures · toy RSA n=55, e=3, d=27", () => {
  it("is the toy the page names, factorable as 5 × 11", () => {
    // "This is toy RSA. The modulus is n = 55, the public exponent is
    // e = 3, the private exponent is d = 27."
    // "n = 55 is 5 × 11."
    expect(RSA_N).toBe(55);
    expect(RSA_E).toBe(3);
    expect(RSA_D).toBe(27);
    expect(5 * 11).toBe(RSA_N);
  });

  it("the slider is the message, 1 through 16, default 4", () => {
    // "The slider is the message, from 1 to 16. Default 4 is the measured run."
    expect(digitalSignaturesAlgo.id).toBe("digital-signatures");
    expect(digitalSignaturesTamperAlgo.id).toBe("digital-signatures-tamper");
    expect(digitalSignaturesAlgo.size).toMatchObject({
      min: 1,
      max: 16,
      default: 4,
      label: "message",
    });
    expect(digitalSignaturesTamperAlgo.size).toEqual(digitalSignaturesAlgo.size);
  });

  it("maps slider 4 to plaintext 5 so the toy never signs 0", () => {
    // "This toy never signs 0, so it maps that control into 1..54 and
    // 4 becomes plaintext 5."
    expect(RSA_N - 1).toBe(54);
    expect((4 % (RSA_N - 1)) + 1).toBe(5);
  });

  it("ignores the seed: a signature is not a scheduler", () => {
    expect(buildAlgoSteps(digitalSignaturesAlgo, 4, 1)).toEqual(
      buildAlgoSteps(digitalSignaturesAlgo, 4, 99),
    );
    expect(buildAlgoSteps(digitalSignaturesTamperAlgo, 4, 1)).toEqual(
      buildAlgoSteps(digitalSignaturesTamperAlgo, 4, 99),
    );
  });
});

describe("digital-signatures · message 4, tamper false accepts", () => {
  it("runSign(4, false) is ok true, verified 1", () => {
    const last = runSign(4, false).at(-1)!;
    expect(last.state.ok).toBe(true);
    expect(last.counters[C.verified]).toBe(1);
  });

  it("the honest figure at 4 is that same run: plaintext 5, sig 25, recovered 5", () => {
    // "The first caption is 'Sign message 5 with d, verify with e. n=55.'
    // This toy never signs 0, so the slider maps 4 to plaintext 5."
    const { steps } = run(digitalSignaturesAlgo, 4);
    expect(steps[0]!.note).toBe("Sign message 5 with d, verify with e. n=55.");
    expect(steps[1]!.note).toBe("sig = m^d mod n = 25.");
    expect(steps[2]!.note).toBe("s^e = 5 = m. Accept.");

    const last = run(digitalSignaturesAlgo, 4);
    expect(last.m).toBe(5);
    expect(last.sig).toBe(25);
    expect(last.see).toBe(5);
    expect(last.out).toBe(5);
    expect(last.ok).toBe(true);
    expect(last.verified).toBe(1);
    expect(last.stamp).toBe("verify ok");
  });

  it("sign costs 8 mod muls; verify costs 3 more, 11 total", () => {
    // "Mod muls read 8." / "Mod muls land on 11."
    const { steps, mul } = run(digitalSignaturesAlgo, 4);
    expect(steps[1]!.counters[C.mul]).toBe(8);
    expect(mul).toBe(11);
    expect(digitalSignaturesAlgo.counters.map((c) => c.label)).toEqual([
      "verified",
      "mod muls",
    ]);
  });
});

describe("digital-signatures · message 4, tamper true rejects", () => {
  it("runSign(4, true) is ok false, verified 0", () => {
    const last = runSign(4, true).at(-1)!;
    expect(last.state.ok).toBe(false);
    expect(last.counters[C.verified] ?? 0).toBe(0);
  });

  it("the tampered figure at 4 signs the same 25, sees 6, recovers 5, and refuses", () => {
    // "The sign step is identical: sig is still 25."
    // "The see row is 6, not 5. 25^3 mod 55 is still 5. 5 is not 6.
    // The stamp reads verify fail. verified is 0."
    const honest = run(digitalSignaturesAlgo, 4);
    const tamper = run(digitalSignaturesTamperAlgo, 4);
    expect(tamper.steps[0]!.note).toBe(
      "Sign message 5 with d, verify with e. n=55.",
    );
    expect(tamper.steps[1]!.note).toBe("sig = m^d mod n = 25.");
    expect(tamper.note).toBe("Verifier sees 6, not 5. s^e = 5 ≠ 6. Reject.");
    expect(tamper.m).toBe(5);
    expect(tamper.sig).toBe(25);
    expect(tamper.sig).toBe(honest.sig);
    expect(tamper.see).toBe(6);
    expect(tamper.out).toBe(5);
    expect(tamper.ok).toBe(false);
    expect(tamper.verified).toBe(0);
    expect(tamper.stamp).toBe("verify fail");
    expect(tamper.mul).toBe(11);
  });
});

describe("digital-signatures · every slider position", () => {
  it("every honest run accepts and every tampered run rejects", () => {
    // "Drag 1 through 16. Every honest run accepts. verified stays 1."
    // "Drag 1 through 16. Every tampered run rejects. verified stays 0."
    for (const n of MESSAGES) {
      const honest = run(digitalSignaturesAlgo, n);
      const tamper = run(digitalSignaturesTamperAlgo, n);
      expect(honest.ok).toBe(true);
      expect(honest.verified).toBe(1);
      expect(honest.stamp).toBe("verify ok");
      expect(tamper.ok).toBe(false);
      expect(tamper.verified).toBe(0);
      expect(tamper.stamp).toBe("verify fail");
      expect(tamper.sig).toBe(honest.sig);
      expect(tamper.see).not.toBe(tamper.out);
    }
  });
});
