import {
  advancePackets,
  approach,
  clamp01,
  emaEvent,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * The TCP Handshake — archetype A (the packet engine).
 *
 * Before a browser can send one byte of a request it has to build a
 * connection, and TCP builds one with a three-way handshake: the client sends
 * a SYN, the server answers SYN-ACK, the client answers ACK. Only then is the
 * connection ESTABLISHED and data allowed to flow. That is a full round trip
 * spent on nothing but agreeing to talk.
 *
 * The lesson is two costs the handshake imposes, both of them latency the user
 * pays before seeing anything:
 *   1. On a clean link, a fresh connection costs ONE RTT of setup, and then
 *      the request/response is a second RTT — so time-to-first-byte on a new
 *      connection is ~2 RTT, double what the data exchange alone would suggest.
 *   2. On a lossy link the handshake is fragile in a specific, expensive way:
 *      a dropped SYN or SYN-ACK is not noticed until a RETRANSMIT TIMEOUT
 *      (RTO) fires — and the RTO is deliberately conservative, far longer than
 *      one RTT. So a single lost setup packet does not cost a round trip, it
 *      costs a whole timeout, and tail connection latency explodes long before
 *      the average does.
 *
 * Latency is MEASURED: every SYN carries the sim time it was first sent, and
 * the time-to-established / time-to-first-byte is stamped when the connection
 * completes. Loss is drawn from the seeded RNG per packet in flight.
 */

const CLIENT = "client";
const SERVER = "server";
const WIRE = "wire";

/** Sim-seconds → the millisecond figure the meters show. */
const MS_PER_SEC = 1000;

/**
 * One-way wire time, in sim-seconds, at the default latency. Packet speed is
 * `1 / oneWay`, so a leg takes exactly `oneWay` sim-seconds and an RTT is
 * `2 * oneWay`. Latency is a slider, so this is only the default.
 */
const DEFAULT_ONE_WAY = 0.25;

/**
 * The retransmit timeout, as a MULTIPLE of the current RTT. TCP's real RTO is
 * an adaptive estimate with a floor well above one RTT; the point the lesson
 * makes is only that it is much larger than an RTT, so a lost handshake packet
 * is expensive out of all proportion to the round trip it replaces.
 */
const RTO_RTTS = 4;

/** Per-event EMA rate for the latency meters — MUST stay under 1. */
const LAT_EMA_RATE = 0.2;

type Phase = "syn" | "synack" | "ack" | "established";

/** A connection attempt walking the handshake. */
interface Conn {
  id: number;
  /** Sim time the very first SYN for this connection was sent. */
  startedAt: number;
  phase: Phase;
  /** Sim time the in-flight setup packet should be given up on (RTO). */
  deadline: number;
  /** Retransmits this connection has needed to get established. */
  retransmits: number;
  /** Whether a setup packet for the current phase is on the wire. */
  inFlight: boolean;
  /** Whether the first data request has been sent post-establish. */
  dataSent: boolean;
}

interface TcpHandshakeState {
  conns: Conn[];
  nextConn: number;
  /**
   * Loss the scripted arc turns on so a passive viewer sees the retransmit
   * story. A timeline `apply` may only touch state, never params — so this
   * lives here and YIELDS the moment the learner moves the loss slider
   * themselves (latched by `lossReleased`), which is the timeline/params trap
   * documented in CLAUDE.md.
   */
  scriptedLoss: number;
  /** Latches true once the learner's own loss slider takes over. */
  lossReleased: boolean;
  /** Last loss param value seen, to detect the learner touching the slider. */
  lastLossParam: number;
  /** Smoothed time-to-establish (SYN → ESTABLISHED), ms. */
  setupMs: number;
  /** Smoothed time-to-first-byte (SYN → response), ms. */
  ttfbMs: number;
  /** Worst time-to-first-byte seen so far, ms — the tail. */
  worstMs: number;
  /** Cumulative retransmitted setup packets. */
  retransmits: number;
  /** Connections established so far. */
  established: number;
}

export interface TcpConnMeta {
  /** How many connections are mid-handshake right now. */
  handshaking: number;
}

const LOSS_ON_AT = 12;
const QUIZ_AT = 13;

export const tcpHandshakeSim: LessonSim<TcpHandshakeState> = {
  id: "tcp-handshake",

  topology: {
    nodes: [
      { id: CLIENT, kind: "client", label: "browser", x: 150, y: 225 },
      { id: SERVER, kind: "server", label: "server", x: 650, y: 225 },
    ],
    edges: [{ id: WIRE, from: CLIENT, to: SERVER }],
  },

  params: [
    {
      key: "latency",
      label: "one-way latency",
      kind: "slider",
      min: 20,
      max: 200,
      step: 10,
      unit: "ms",
      defaultValue: DEFAULT_ONE_WAY * MS_PER_SEC,
    },
    {
      key: "loss",
      label: "packet loss",
      kind: "slider",
      min: 0,
      max: 30,
      step: 5,
      unit: "%",
      defaultValue: 0,
    },
    {
      key: "rate",
      label: "new connections",
      kind: "slider",
      min: 1,
      max: 4,
      step: 1,
      unit: " /s",
      defaultValue: 2,
    },
  ],

  init: () => ({
    conns: [],
    nextConn: 1,
    setupMs: 0,
    ttfbMs: 0,
    worstMs: 0,
    retransmits: 0,
    established: 0,
    scriptedLoss: 0,
    lossReleased: false,
    lastLossParam: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const oneWay = Number(params.latency) / MS_PER_SEC;
    const speed = 1 / oneWay;
    const rtt = 2 * oneWay;
    const rto = RTO_RTTS * rtt;
    const rate = Number(params.rate);

    // The learner touching the loss slider RELEASES the scripted value for
    // good, so the control and the behaviour can never disagree.
    const lossParam = Number(params.loss) / 100;
    if (lossParam !== L.lastLossParam) {
      L.lossReleased = true;
      L.lastLossParam = lossParam;
    }
    const loss = L.lossReleased ? lossParam : Math.max(lossParam, L.scriptedLoss);

    /** Send a setup packet for this phase and arm the retransmit timer. */
    const sendSetup = (conn: Conn, type: Phase, reverse: boolean) => {
      conn.inFlight = true;
      conn.deadline = state.t + rto;
      spawnPacket(state, WIRE, type, {
        speed,
        reverse,
        payload: { conn: conn.id, phase: type },
      });
    };

    // 1. New connection attempts. Each starts with a SYN.
    const spawns = shouldSpawn(state, rate, dt);
    for (let i = 0; i < spawns; i++) {
      const conn: Conn = {
        id: L.nextConn++,
        startedAt: state.t,
        phase: "syn",
        deadline: 0,
        retransmits: 0,
        inFlight: false,
        dataSent: false,
      };
      L.conns.push(conn);
      sendSetup(conn, "syn", false);
    }

    // 2. Deliveries. A setup or data packet may be lost on the wire — the
    //    seeded RNG decides, once per arriving packet.
    for (const p of advancePackets(state, dt)) {
      const connId = Number(p.payload?.conn ?? 0);
      const conn = L.conns.find((c) => c.id === connId);
      if (!conn) continue;

      const dropped = state.rng() < loss;
      if (dropped) {
        // The packet vanishes. Nobody learns until the RTO fires (step 3).
        // Show the loss as a fading drop where it died.
        spawnPacket(state, WIRE, "drop", {
          speed: speed * 1.2,
          reverse: p.reverse,
          size: 3,
        });
        continue;
      }

      if (p.type === "syn") {
        // Server received the SYN; it replies SYN-ACK.
        conn.inFlight = false;
        conn.phase = "synack";
        sendSetup(conn, "synack", true);
      } else if (p.type === "synack") {
        // Client received SYN-ACK. This is the moment that matters: after ONE
        // round trip the client can finally send data, and it piggybacks the
        // request on the ACK. Record time-to-send (1 RTT), fire the ACK, and
        // send the first request right behind it.
        conn.inFlight = false;
        conn.phase = "established";
        L.established += 1;
        L.setupMs = emaEvent(L.setupMs, (state.t - conn.startedAt) * MS_PER_SEC, LAT_EMA_RATE);
        // The ACK is not on the critical path for the reply (the server acts on
        // the data), so it needs no retransmit timer of its own.
        spawnPacket(state, WIRE, "ack", {
          speed,
          payload: { conn: conn.id, phase: "ack" },
        });
        conn.dataSent = true;
        spawnPacket(state, WIRE, "request", {
          speed,
          payload: { conn: conn.id, phase: "data" },
        });
      } else if (p.type === "ack") {
        // Server received the ACK. Nothing to do — the data request is right
        // behind it and drives the response.
      } else if (p.type === "request") {
        // Server got the data request; respond.
        spawnPacket(state, WIRE, "response", {
          speed,
          reverse: true,
          payload: { conn: conn.id },
        });
      } else if (p.type === "response") {
        // First byte home. Record time-to-first-byte and retire the connection.
        const ttfb = (state.t - conn.startedAt) * MS_PER_SEC;
        L.ttfbMs = emaEvent(L.ttfbMs, ttfb, LAT_EMA_RATE);
        L.worstMs = Math.max(L.worstMs, ttfb);
        L.conns = L.conns.filter((c) => c.id !== conn.id);
      }
    }

    // 3. Retransmit timeouts. A setup packet that never arrived (was lost)
    //    leaves its connection stuck with `inFlight` and a passed deadline.
    //    When the RTO fires the client/server resends — the whole cost of the
    //    loss, and it is an RTO, not an RTT.
    for (const conn of L.conns) {
      if (!conn.inFlight || state.t < conn.deadline) continue;
      conn.retransmits += 1;
      L.retransmits += 1;
      if (conn.phase === "syn") sendSetup(conn, "syn", false);
      else if (conn.phase === "synack") sendSetup(conn, "synack", true);
    }

    // 4. Readouts.
    const handshaking = L.conns.filter((c) => c.phase !== "established").length;
    const client = state.nodes[CLIENT];
    client.load = approach(client.load, clamp01(handshaking / 6), 5, dt);
    const connMeta: TcpConnMeta = { handshaking };
    client.meta = { ...connMeta };

    state.metrics.setupMs = L.setupMs;
    state.metrics.ttfbMs = L.ttfbMs;
    state.metrics.worstMs = L.worstMs;
    state.metrics.retransmits = L.retransmits;
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "SYN → server, SYN-ACK ← server, ACK → server. One full round trip agreeing to talk, before a single byte of the request moves.",
    },
    {
      at: 6,
      caption:
        "Then the request goes and the response returns — a second round trip. Time-to-first-byte on a fresh connection is about 2 RTT.",
    },
    {
      at: LOSS_ON_AT,
      caption:
        "☠ The link starts dropping packets. Watch the worst-case latency, not the average — a lost SYN is not noticed until the retransmit timeout fires.",
      apply: (s: SimState<TcpHandshakeState>) => {
        // Scripted loss for passive viewers. It YIELDS the instant the learner
        // moves the loss slider (see the release latch in step).
        if (!s.lesson.lossReleased) s.lesson.scriptedLoss = 0.2;
      },
    },
    {
      at: QUIZ_AT + 4,
      caption:
        "One dropped setup packet cost a whole RTO — several RTTs — not one. That is why the tail exploded while the average barely moved.",
      when: (s) => s.lesson.retransmits > 0,
    },
  ],

  quiz: [
    {
      id: "tcp-lost-syn",
      at: QUIZ_AT,
      question:
        "The link is dropping some packets. A connection's SYN is lost in flight. How long until the client tries again?",
      choices: [
        { id: "rto", label: "A full retransmit timeout — much longer than one round trip." },
        { id: "rtt", label: "One round trip — it notices the missing reply immediately." },
        { id: "instant", label: "Instantly — TCP resends dropped packets with no delay." },
      ],
      correctChoiceId: "rto",
      explain:
        "Nothing on the client's side knows the SYN was lost: there is no reply to be missing yet, because no reply was ever due. The client only learns when its retransmit timer expires, and that timer is set well above one RTT on purpose — retransmitting too eagerly would flood a congested link. So a single lost handshake packet costs a whole timeout, not a round trip. That is why packet loss wrecks tail connection latency long before it moves the average: most connections pay 2 RTT, but the unlucky few pay an RTO on top.",
    },
  ],

  meters: [
    {
      metricKey: "setupMs",
      label: "time to send",
      kind: "counter",
      unit: "ms",
    },
    {
      metricKey: "ttfbMs",
      label: "time to first byte",
      kind: "counter",
      unit: "ms",
    },
    {
      metricKey: "worstMs",
      label: "worst first byte",
      kind: "counter",
      unit: "ms",
      dangerAbove: 2000,
    },
    {
      metricKey: "retransmits",
      label: "retransmits",
      kind: "counter",
      dangerAbove: 0,
    },
  ],

  packetStyles: {
    syn: { color: "var(--color-glow-cyan)" },
    synack: { color: "var(--color-glow-violet)" },
    ack: { color: "var(--color-accent)" },
  },

  packetLegend: [
    { type: "syn", label: "SYN (open request)" },
    { type: "synack", label: "SYN-ACK (server agrees)" },
    { type: "ack", label: "ACK (connection up)" },
    { type: "request", label: "data request" },
    { type: "response", label: "response" },
    { type: "drop", label: "lost packet" },
  ],
};
