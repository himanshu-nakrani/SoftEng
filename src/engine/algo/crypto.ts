import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { BitChip, CryptoState } from "./views/crypto";

/**
 * Tiny crypto machines for archetype B.
 *
 * Hash: an 8-bit mix. Flip one input bit and count how many output bits
 * move — avalanche. Work factor is 2^n guesses for an n-bit preimage,
 * recorded as a counter, not simulated guess-by-guess past 8 bits.
 *
 * DH: p=23, g=5. Alice and Bob raise g to their secrets; both land on
 * g^{ab} mod 23. Eve sees the public values. Brute-forcing a is at most
 * p trials.
 *
 * Sign: toy RSA n=55, e=3, d=27. Sign is m^d mod n; verify is s^e mod n.
 * Tampering the message makes verify fail.
 *
 * These are toys. The numbers are small so a step list can show them.
 * SHA-256, a 2048-bit modulus, and constant-time code are not here.
 */

export const DH_P = 23;
export const DH_G = 5;
export const RSA_N = 55;
export const RSA_E = 3;
export const RSA_D = 27;

export const CRYPTO_COUNTERS = {
  bitFlips: "bitFlips",
  guesses: "guesses",
  mul: "mul",
  verified: "verified",
} as const;

export function mix8(x: number): number {
  let v = x & 0xff;
  v = (v ^ ((v << 3) & 0xff)) & 0xff;
  v = (v + ((v << 2) & 0xff)) & 0xff;
  v = (v ^ (v >> 2)) & 0xff;
  v = (v + ((v << 4) & 0xff)) & 0xff;
  v = (v ^ (v >> 1)) & 0xff;
  return v & 0xff;
}

export function popcount(x: number): number {
  let n = 0;
  for (let i = 0; i < 8; i++) if (x & (1 << i)) n += 1;
  return n;
}

export function powmod(base: number, exp: number, mod: number): { value: number; muls: number } {
  let value = 1;
  let muls = 0;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0) {
    if (e & 1) {
      value = (value * b) % mod;
      muls += 1;
    }
    e >>= 1;
    if (e > 0) {
      b = (b * b) % mod;
      muls += 1;
    }
  }
  return { value, muls };
}

function bits(name: string, value: number, width: number, flipped = 0, active = -1): { name: string; bits: BitChip[] } {
  return {
    name,
    bits: Array.from({ length: width }, (_, i) => {
      const bit = width - 1 - i;
      return {
        label: String(bit),
        value: (value >> bit) & 1,
        flipped: ((flipped >> bit) & 1) === 1,
        active: bit === active,
      };
    }),
  };
}

export function runHash(input: number, flipBit: number): AlgoStep<CryptoState>[] {
  const h0 = mix8(input);
  const flipped = input ^ (1 << flipBit);
  const h1 = mix8(flipped);
  const delta = h0 ^ h1;
  const rec = new StepRecorder<CryptoState>(() => snapshot());
  let rows: CryptoState["rows"] = [];
  let stamp = "hash";

  function snapshot(): CryptoState {
    return { kind: "hash", rows: rows.map((r) => ({ name: r.name, bits: r.bits.map((b) => ({ ...b })) })), stamp };
  }

  rec.record({ note: `Hash 8-bit input ${input}.` });
  rows = [bits("in", input, 8)];
  rec.record({ codeLine: 0, note: `Input ${input}.` });
  rows = [bits("in", input, 8), bits("H", h0, 8)];
  rec.record({ codeLine: 1, note: `mix8 → ${h0}.` });
  rows = [
    bits("in", input, 8, 1 << flipBit, flipBit),
    bits("in'", flipped, 8, 1 << flipBit, flipBit),
    bits("H", h0, 8),
    bits("H'", h1, 8, delta),
  ];
  rec.bump(CRYPTO_COUNTERS.bitFlips, popcount(delta));
  rec.record({
    codeLine: 2,
    note: `Flip bit ${flipBit}: ${popcount(delta)} of 8 output bits move.`,
  });
  stamp = `${popcount(delta)}/8 avalanche`;
  rec.record({ note: `Avalanche ${popcount(delta)}/8.` });
  return rec.steps;
}

export function runDh(alice: number, bob: number): AlgoStep<CryptoState>[] {
  const rec = new StepRecorder<CryptoState>(() => snapshot());
  let rows: CryptoState["rows"] = [];
  let stamp = `DH p=${DH_P} g=${DH_G}`;
  function snapshot(): CryptoState {
    return { kind: "dh", rows: rows.map((r) => ({ name: r.name, bits: r.bits.map((b) => ({ ...b })) })), stamp };
  }

  rec.record({ note: `Diffie-Hellman, p=${DH_P}, g=${DH_G}. Alice a=${alice}, Bob b=${bob}.` });
  const A = powmod(DH_G, alice, DH_P);
  rec.bump(CRYPTO_COUNTERS.mul, A.muls);
  rows = [bits("A", A.value, 5)];
  rec.record({ codeLine: 0, note: `Alice publishes g^a = ${A.value}.` });
  const B = powmod(DH_G, bob, DH_P);
  rec.bump(CRYPTO_COUNTERS.mul, B.muls);
  rows = [bits("A", A.value, 5), bits("B", B.value, 5)];
  rec.record({ codeLine: 1, note: `Bob publishes g^b = ${B.value}.` });
  const sa = powmod(B.value, alice, DH_P);
  rec.bump(CRYPTO_COUNTERS.mul, sa.muls);
  const sb = powmod(A.value, bob, DH_P);
  rec.bump(CRYPTO_COUNTERS.mul, sb.muls);
  rows = [
    bits("A", A.value, 5),
    bits("B", B.value, 5),
    bits("sA", sa.value, 5),
    bits("sB", sb.value, 5),
  ];
  rec.record({
    codeLine: 2,
    note: `Shared secret ${sa.value}${sa.value === sb.value ? " — both sides match" : " MISMATCH"}.`,
  });
  rec.bump(CRYPTO_COUNTERS.guesses, DH_P);
  stamp = `shared ${sa.value}`;
  rec.record({
    codeLine: 3,
    note: `Eve sees ${A.value} and ${B.value}. Brute-forcing a is at most ${DH_P} trials.`,
  });
  return rec.steps;
}

export function runSign(message: number, tamper: boolean): AlgoStep<CryptoState>[] {
  const rec = new StepRecorder<CryptoState>(() => snapshot());
  let rows: CryptoState["rows"] = [];
  let stamp = "sign";
  let ok = true;
  function snapshot(): CryptoState {
    return {
      kind: "sign",
      rows: rows.map((r) => ({ name: r.name, bits: r.bits.map((b) => ({ ...b })) })),
      stamp,
      ok,
    };
  }

  const m = ((message % (RSA_N - 1)) + 1);
  rec.record({ note: `Sign message ${m} with d, verify with e. n=${RSA_N}.` });
  const sig = powmod(m, RSA_D, RSA_N);
  rec.bump(CRYPTO_COUNTERS.mul, sig.muls);
  rows = [bits("m", m, 6), bits("sig", sig.value, 6)];
  rec.record({ codeLine: 0, note: `sig = m^d mod n = ${sig.value}.` });
  const seen = tamper ? (m >= RSA_N - 1 ? 1 : m + 1) : m;
  const check = powmod(sig.value, RSA_E, RSA_N);
  rec.bump(CRYPTO_COUNTERS.mul, check.muls);
  ok = check.value === seen;
  rec.bump(CRYPTO_COUNTERS.verified, ok ? 1 : 0);
  rows = [
    bits("m", m, 6),
    bits("sig", sig.value, 6),
    bits("see", seen, 6, tamper ? m ^ seen : 0),
    bits("out", check.value, 6),
  ];
  stamp = ok ? "verify ok" : "verify fail";
  rec.record({
    codeLine: tamper ? 2 : 1,
    note: tamper
      ? `Verifier sees ${seen}, not ${m}. s^e = ${check.value} ≠ ${seen}. Reject.`
      : `s^e = ${check.value} = m. Accept.`,
  });
  return rec.steps;
}

export type CryptoInput =
  | { kind: "hash"; input: number; flipBit: number }
  | { kind: "dh"; alice: number; bob: number }
  | { kind: "sign"; message: number; tamper: boolean };

export function runCrypto(input: CryptoInput): AlgoStep<CryptoState>[] {
  if (input.kind === "hash") return runHash(input.input, input.flipBit);
  if (input.kind === "dh") return runDh(input.alice, input.bob);
  return runSign(input.message, input.tamper);
}
