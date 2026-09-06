import { MTLS_COUNTERS, runMtls } from "@/engine/algo/mtls";
import type { AlgoDef } from "@/engine/algo/types";
import type { MtlsState, MtlsTrust } from "@/engine/algo/views/mtls";

/**
 * Mutual TLS — archetype B (`engine: "steps"`).
 *
 * Ordinary TLS authenticates the server. The client checks a cert; the
 * server accepts whoever reached it. Mutual TLS is the same check both
 * ways: svc-b presents a cert, and svc-a must present one that chains
 * to the same CA. THE CONTRAST IS TWO FIGURES: perimeter trust (the
 * network is enough) and mTLS (the client cert is the name).
 *
 * THE CONTROL IS THE CLIENT CERT. 0 = from this CA, 1 = none, 2 =
 * other-ca. Perimeter default 1: no cert, still connected 1, verified
 * 0. mTLS default 0: connected 1, verified 1. mTLS at 1 or 2: rejected
 * 1, connected 0, stamp reject. Seed is ignored.
 *
 * MODELLING NOTE, and its limits. Two peers, svc-a / svc-b, and three
 * cert kinds: ok, none, other-ca. Deliberately absent: X.509 chains,
 * SPIFFE IDs, rotation. Those change how a CA is operated. They do not
 * change the argument: being on the network is not a name, and the
 * server authenticated the client only when the cert was from this CA.
 */

const PERIMETER_CODE = [
  "present server cert",
  "client may be silent",
  "accept anyone on net",
];

const MTLS_CODE = [
  "present server cert",
  "present client cert",
  "verify this CA",
  "reject if not this CA",
];

const counters = [
  { key: MTLS_COUNTERS.connected, label: "connected" },
  { key: MTLS_COUNTERS.verified, label: "verified" },
  { key: MTLS_COUNTERS.rejected, label: "rejected" },
];

function sizeControl(defaultSize: number) {
  return {
    label: "client cert",
    min: 0,
    max: 2,
    default: defaultSize,
  } as const;
}

function def(
  id: string,
  title: string,
  trust: MtlsTrust,
  defaultSize: number,
  code: string[],
): AlgoDef<MtlsState, number> {
  return {
    id,
    title,
    code,
    counters,
    size: sizeControl(defaultSize),
    generateInput: (_rng, size) => size,
    run: (size) => runMtls(trust, size),
  };
}

/** Network is enough: a missing client cert still connects. */
export const mtlsPerimeterAlgo = def(
  "mtls-perimeter",
  "perimeter trust",
  "perimeter",
  1,
  PERIMETER_CODE,
);

/** Client cert required: missing or other-ca is a reject. */
export const mtlsAlgo = def(
  "mtls",
  "mutual tls",
  "mtls",
  0,
  MTLS_CODE,
);
