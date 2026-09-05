"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { tlsHandshakeSim } from "./tls-handshake";

export function TlsHandshakeFigure() {
  return (
    <SectionFigure
      sim={tlsHandshakeSim}
      completes={[
        { on: "param-change", id: "mode", section: "handshake-round-trips" },
        { on: "param-change", id: "replayAttack", section: "replay-vulnerabilities" },
        { on: "param-change", id: "antiReplay", section: "replay-vulnerabilities" },
      ]}
      description="A browser client and origin TLS server demonstrating TLS 1.3 key exchange and 0-RTT session resumption. In full 1-RTT mode, the client transmits a ClientHello with an ephemeral ECDHE key share; the server responds with ServerHello, its own key share, certificates, and finished verification, requiring one full round trip (~300ms) before encrypted application HTTP requests can be sent. In 0-RTT session resumption mode, a client holding a pre-shared key (PSK) ticket sends early HTTP data immediately alongside ClientHello with zero round trips of setup latency (0ms setup, data returns in 300ms). Toggling a replay attack demonstrates the security vulnerability of early data: an adversary replaying early data without server anti-replay protection causes the origin to execute the request twice. Enabling single-use ticket anti-replay tracking detects the duplicate session ticket and blocks the replayed request, maintaining idempotent safety."
    />
  );
}
