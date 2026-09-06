import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { CertKind, MtlsPeer, MtlsState, MtlsTrust } from "./views/mtls";

/**
 * Mutual TLS — a client and a server, and whether the client had to
 * present a cert the server trusts.
 *
 * Perimeter trust: anyone on the network is connected. The client cert
 * is never checked. mTLS: the handshake completes only when the client
 * cert is present and chains to the same CA.
 *
 * Slider: 0 = valid client cert, 1 = no cert, 2 = other-ca.
 *
 * Deliberately absent: a real X.509 chain, SPIFFE IDs, rotation. The
 * argument is who the server authenticated, not how a CA works.
 */

export const MTLS_COUNTERS = {
  connected: "connected",
  verified: "verified",
  rejected: "rejected",
} as const;

/** Slider 0 = valid cert; 1 = missing; 2 = wrong CA. */
export function clientCert(size: number): CertKind {
  if (size === 1) return "none";
  if (size === 2) return "other-ca";
  return "ok";
}

export function runMtls(trust: MtlsTrust, size: number): AlgoStep<MtlsState>[] {
  const cert = clientCert(size);
  let client: MtlsPeer = {
    name: "svc-a",
    cert,
    presented: false,
    valid: false,
    active: false,
  };
  let server: MtlsPeer = {
    name: "svc-b",
    cert: "ok",
    presented: false,
    valid: false,
    active: false,
  };
  let stamp: string = trust;
  let connected = false;
  const rec = new StepRecorder<MtlsState>(() => ({
    trust,
    client: { ...client },
    server: { ...server },
    stamp,
    connected,
  }));

  rec.record({
    note: trust === "mtls" ? "Mutual TLS handshake." : "Perimeter trust. Network is enough.",
  });

  server = { ...server, presented: true, valid: true, active: true };
  rec.record({ codeLine: 0, note: "Server presents its cert." });

  client = { ...client, presented: cert !== "none", valid: cert === "ok", active: true };
  server = { ...server, active: false };
  rec.record({
    codeLine: 1,
    note:
      cert === "none"
        ? "Client presents nothing."
        : cert === "other-ca"
          ? "Client presents a cert from another CA."
          : "Client presents a cert from this CA.",
  });

  if (trust === "perimeter") {
    rec.bump(MTLS_COUNTERS.connected);
    connected = true;
    stamp = "connected";
    client = { ...client, active: false };
    rec.record({ codeLine: 2, note: "Perimeter accepts anyone on the network." });
    return rec.steps;
  }

  if (cert === "ok") {
    rec.bump(MTLS_COUNTERS.verified);
    rec.bump(MTLS_COUNTERS.connected);
    connected = true;
    stamp = "connected";
    rec.record({ codeLine: 2, note: "Server verifies the client cert." });
  } else {
    rec.bump(MTLS_COUNTERS.rejected);
    connected = false;
    stamp = "reject";
    rec.record({
      codeLine: 3,
      note: cert === "none" ? "No client cert. Reject." : "Wrong CA. Reject.",
    });
  }
  return rec.steps;
}
