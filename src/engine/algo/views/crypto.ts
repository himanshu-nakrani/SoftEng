/**
 * Crypto view — three small machines: a hash avalanche, Diffie-Hellman
 * over a tiny prime, and a public-key signature check.
 */

export type CryptoKind = "hash" | "dh" | "sign";

export interface BitChip {
  label: string;
  value: number;
  flipped: boolean;
  active: boolean;
}

export interface CryptoState {
  kind: CryptoKind;
  rows: { name: string; bits: BitChip[] }[];
  stamp: string;
  ok?: boolean;
}
