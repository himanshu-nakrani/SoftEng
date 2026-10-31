/**
 * mTLS view — two peers and whether the client had to prove a name.
 *
 * Perimeter trust accepts anyone on the network. Mutual TLS accepts a
 * client only when its cert chains to the same CA as the server's.
 */

export type MtlsTrust = "perimeter" | "mtls";

export type CertKind = "ok" | "none" | "other-ca";

export interface MtlsPeer {
  name: string;
  cert: CertKind;
  presented: boolean;
  valid: boolean;
  active: boolean;
}

export interface MtlsState {
  trust: MtlsTrust;
  client: MtlsPeer;
  server: MtlsPeer;
  stamp: string;
  connected: boolean;
}
