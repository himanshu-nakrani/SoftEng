import { advancePackets, spawnPacket } from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * The TLS Handshake: 1-RTT to 0-RTT — archetype A (the packet engine).
 *
 * Securing an HTTP connection requires agreeing on cryptographic secrets over an
 * untrusted, adversarial channel:
 *
 * 1. Full 1-RTT Handshake (ECDHE):
 *    - Client sends ClientHello + KeyShare (ephemeral elliptic curve parameters).
 *    - Server returns ServerHello + KeyShare + EncryptedExtensions + Certificate + Finished.
 *    - Setup takes exactly 1 RTT (300ms on a 150ms one-way wire).
 *    - Only after verifying the server's Finished token can the client transmit
 *      encrypted application requests.
 *
 * 2. Resumed 0-RTT Handshake (PSK Early Data):
 *    - If client and server previously negotiated a session, the client holds a
 *      Pre-Shared Key (PSK) session ticket.
 *    - The client sends early HTTP data immediately in the very first flight alongside
 *      ClientHello + PSK, achieving 0-RTT setup (0ms setup delay; data returns in 1 RTT).
 *
 * 3. The 0-RTT Replay Vulnerability:
 *    - Because 0-RTT early data is encrypted using keys derived from the PSK ticket
 *      without a fresh interactive Diffie-Hellman exchange, an eavesdropper can capture
 *      and replay the packet.
 *    - Without server anti-replay protection, the server processes duplicate early data,
 *      re-executing non-idempotent operations.
 *    - With anti-replay protection (single-use ticket tracking / bloom filter), duplicate
 *      early data is rejected.
 */

const CLIENT = "client";
const SERVER = "server";
const WIRE = "wire";

const MS_PER_SEC = 1000;
const ONE_WAY = 0.15; // 150ms one-way latency -> 300ms RTT
const WIRE_SPEED = 1 / ONE_WAY;
const SESSION_INTERVAL = 2.0;

interface TlsPacketPayload extends Record<string, unknown> {
  sessionId: number;
  type: string;
  label: string;
  bornAt: number;
  handshakeStartedAt?: number;
  ticketId?: string;
  isReplay?: boolean;
}

interface TlsHandshakeState {
  nextSessionId: number;
  nextSessionAt: number;
  lastMode: string;
  sessionStartedAt: number;
  replayScheduledAt: number;
  replayPayload: TlsPacketPayload | null;
  seenTickets: string[];
  handshakeMs: number;
  roundTrips: number;
  replaysBlocked: number;
  earlyDataExecuted: number;
  sessionsCompleted: number;
}

export const tlsHandshakeSim: LessonSim<TlsHandshakeState> = {
  id: "tls-handshake",

  topology: {
    nodes: [
      { id: CLIENT, kind: "client", label: "browser", x: 160, y: 225 },
      { id: SERVER, kind: "server", label: "tls-origin", x: 640, y: 225 },
    ],
    edges: [{ id: WIRE, from: CLIENT, to: SERVER }],
  },

  params: [
    {
      key: "mode",
      label: "TLS handshake mode",
      kind: "select",
      options: [
        { label: "Full Handshake (1-RTT ECDHE)", value: "full-1rtt" },
        { label: "Session Resumption (0-RTT PSK)", value: "resumed-0rtt" },
      ],
      defaultValue: "full-1rtt",
    },
    {
      key: "replayAttack",
      label: "replay attack (adversary retransmits early data)",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "antiReplay",
      label: "server anti-replay protection",
      kind: "toggle",
      defaultValue: true,
    },
  ],

  init: () => ({
    nextSessionId: 1,
    nextSessionAt: 0.5,
    lastMode: "",
    sessionStartedAt: 0,
    replayScheduledAt: 0,
    replayPayload: null,
    seenTickets: [],
    handshakeMs: 0,
    roundTrips: 0,
    replaysBlocked: 0,
    earlyDataExecuted: 0,
    sessionsCompleted: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const mode = String(params.mode ?? "full-1rtt");
    const replayAttack = params.replayAttack === true;
    const antiReplay = params.antiReplay !== false;

    // React immediately to mode changes
    if (L.lastMode !== "" && L.lastMode !== mode) {
      L.lastMode = mode;
      L.nextSessionAt = state.t;
      state.packets = [];
      L.replayScheduledAt = 0;
      L.replayPayload = null;
      if (mode === "resumed-0rtt") {
        L.handshakeMs = 0;
        L.roundTrips = 0;
      }
    } else if (L.lastMode === "") {
      L.lastMode = mode;
      if (mode === "resumed-0rtt") {
        L.handshakeMs = 0;
        L.roundTrips = 0;
      }
    }

    // Dispatch scheduled attacker replay flight
    if (L.replayScheduledAt > 0 && state.t >= L.replayScheduledAt && L.replayPayload) {
      spawnPacket(state, WIRE, "replay", {
        speed: WIRE_SPEED,
        payload: L.replayPayload,
      });
      L.replayScheduledAt = 0;
      L.replayPayload = null;
    }

    // 1. Client initiates periodic session
    if (state.t >= L.nextSessionAt) {
      L.nextSessionAt = state.t + SESSION_INTERVAL;
      const sessionId = L.nextSessionId++;
      L.sessionStartedAt = state.t;

      if (mode === "resumed-0rtt") {
        // 0-RTT: Setup takes 0 ms and 0 RTTs; early data is sent in the very first flight
        L.handshakeMs = 0;
        L.roundTrips = 0;
        const ticketId = "ticket-" + sessionId;

        spawnPacket(state, WIRE, "early-data", {
          speed: WIRE_SPEED,
          payload: {
            sessionId,
            ticketId,
            type: "early-data",
            label: "ClientHello + PSK + Early HTTP Data",
            bornAt: state.t,
            isReplay: false,
          } satisfies TlsPacketPayload,
        });

        if (replayAttack) {
          // Attacker eavesdrops and replays the exact flight 1 tick later
          L.replayScheduledAt = state.t + 0.05;
          L.replayPayload = {
            sessionId,
            ticketId,
            type: "replay",
            label: "Replayed Early Data (Attacker)",
            bornAt: state.t + 0.05,
            isReplay: true,
          };
        }
      } else {
        // 1-RTT: Client sends ClientHello with ephemeral ECDHE KeyShare
        spawnPacket(state, WIRE, "client-hello", {
          speed: WIRE_SPEED,
          payload: {
            sessionId,
            type: "client-hello",
            label: "ClientHello + KeyShare (ECDHE)",
            bornAt: state.t,
          } satisfies TlsPacketPayload,
        });
      }
    }

    // 2. Advance packets & handle arrivals
    for (const p of advancePackets(state, dt)) {
      const payload = p.payload as TlsPacketPayload | undefined;
      if (!payload) continue;

      if (p.type === "client-hello") {
        // Server receives ClientHello + KeyShare
        // Server responds with ServerHello + KeyShare + Cert + Finished (1 RTT total)
        spawnPacket(state, WIRE, "server-hello", {
          speed: WIRE_SPEED,
          reverse: true,
          payload: {
            sessionId: payload.sessionId,
            type: "server-hello",
            label: "ServerHello + KeyShare + Cert + Finished",
            bornAt: state.t,
            handshakeStartedAt: payload.bornAt,
          } satisfies TlsPacketPayload,
        });
      } else if (p.type === "server-hello") {
        // Client receives ServerHello -> Handshake established!
        const setupTime = Math.round((state.t - (payload.handshakeStartedAt ?? payload.bornAt)) * MS_PER_SEC);
        L.handshakeMs = setupTime;
        L.roundTrips = 1;

        // Client immediately sends Finished + HTTP Request payload data
        spawnPacket(state, WIRE, "data", {
          speed: WIRE_SPEED,
          payload: {
            sessionId: payload.sessionId,
            type: "data",
            label: "Finished + GET /data (encrypted)",
            bornAt: state.t,
          } satisfies TlsPacketPayload,
        });
      } else if (p.type === "early-data") {
        // Server receives legitimate 0-RTT early data
        const ticketId = payload.ticketId ?? ("ticket-" + payload.sessionId);
        if (antiReplay) {
          L.seenTickets.push(ticketId);
          if (L.seenTickets.length > 50) L.seenTickets.shift();
        }
        L.earlyDataExecuted += 1;

        // Server responds with ServerHello + 200 OK
        spawnPacket(state, WIRE, "response", {
          speed: WIRE_SPEED,
          reverse: true,
          payload: {
            sessionId: payload.sessionId,
            type: "response",
            label: "ServerHello + 200 OK (encrypted)",
            bornAt: state.t,
          } satisfies TlsPacketPayload,
        });
      } else if (p.type === "replay") {
        // Server receives replayed early data
        const ticketId = payload.ticketId ?? ("ticket-" + payload.sessionId);
        const isDuplicate = L.seenTickets.includes(ticketId);

        if (antiReplay && isDuplicate) {
          // Replay detected and rejected via single-use ticket check!
          L.replaysBlocked += 1;
          spawnPacket(state, WIRE, "replay-rejected", {
            speed: WIRE_SPEED,
            reverse: true,
            payload: {
              sessionId: payload.sessionId,
              type: "replay-rejected",
              label: "425 Too Early (Replay Blocked)",
              bornAt: state.t,
            } satisfies TlsPacketPayload,
          });
        } else {
          // Anti-replay disabled or ticket unchecked -> duplicate execution vulnerability!
          L.earlyDataExecuted += 1;
          spawnPacket(state, WIRE, "response", {
            speed: WIRE_SPEED,
            reverse: true,
            payload: {
              sessionId: payload.sessionId,
              type: "response",
              label: "200 OK (Duplicate Replay Executed!)",
              bornAt: state.t,
            } satisfies TlsPacketPayload,
          });
        }
      } else if (p.type === "data") {
        // Server receives 1-RTT application data
        spawnPacket(state, WIRE, "response", {
          speed: WIRE_SPEED,
          reverse: true,
          payload: {
            sessionId: payload.sessionId,
            type: "response",
            label: "HTTP/1.1 200 OK (encrypted)",
            bornAt: state.t,
          } satisfies TlsPacketPayload,
        });
      } else if (p.type === "response" || p.type === "replay-rejected") {
        L.sessionsCompleted += 1;
      }
    }

    // Server health reflects replay vulnerability
    state.nodes.server.health = (mode === "resumed-0rtt" && replayAttack && !antiReplay) ? "degraded" : "healthy";

    // 3. Publish metrics
    state.metrics.handshakeMs = L.handshakeMs;
    state.metrics.roundTrips = L.roundTrips;
    state.metrics.replaysBlocked = L.replaysBlocked;
    state.metrics.earlyDataExecuted = L.earlyDataExecuted;
    state.metrics.sessionsCompleted = L.sessionsCompleted;
  },

  meters: [
    { metricKey: "handshakeMs", label: "handshake latency", kind: "gauge", max: 1000, unit: "ms" },
    { metricKey: "roundTrips", label: "setup round trips", kind: "gauge", max: 4, unit: " RTT" },
    { metricKey: "replaysBlocked", label: "replays blocked", kind: "counter" },
  ],

  packetStyles: {
    "client-hello": { color: "var(--color-glow-cyan)" },
    "server-hello": { color: "var(--color-glow-violet)" },
    "early-data": { color: "var(--color-glow-amber)" },
    data: { color: "var(--color-accent)" },
    response: { color: "var(--color-glow-cyan)" },
    replay: { color: "var(--color-glow-red)" },
    "replay-rejected": { color: "var(--color-glow-red)" },
  },

  packetLegend: [
    { type: "client-hello", label: "ClientHello (ECDHE key share)" },
    { type: "server-hello", label: "ServerHello (key share + cert + finished)" },
    { type: "early-data", label: "0-RTT Early Data (PSK ticket)" },
    { type: "data", label: "Encrypted HTTP Request" },
    { type: "response", label: "Encrypted HTTP Response" },
    { type: "replay", label: "Replayed Early Data (Attacker)" },
  ],
};
