import {
  advancePackets,
  approach,
  clamp01,
  emaEvent,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Keep-Alive & Connection Reuse — archetype A (the packet engine).
 *
 * The last three lessons priced a web request: a DNS lookup to find the
 * server, a handshake round trip to open a connection, then the request and
 * its response. Two of those three — the lookup and the handshake — are setup,
 * paid before the useful work. This lesson is about the cheapest optimisation
 * in the whole chain: don't pay them twice.
 *
 * A NEW connection per request pays the full setup every time: a handshake
 * round trip, then the request/response round trip — 2 RTT per request. A
 * REUSED (keep-alive) connection pays the handshake ONCE; every request after
 * the first rides the warm connection at 1 RTT. So the two strategies start
 * the same and then diverge, and the gap is exactly the setup cost multiplied
 * by the number of requests you saved it on.
 *
 * The stage shows both at once — a "new connection each time" client on top, a
 * "keep-alive" client below — driven by the same request stream, so the
 * divergence is a thing you watch rather than a number you are told. The
 * `reuse` toggle is really about whether the SECOND client keeps its
 * connection; with it off, both clients behave identically, which is the
 * control.
 *
 * Times are MEASURED: every request stamps when it was issued, and its latency
 * is stamped when the response returns.
 */

const FRESH_CLIENT = "fresh";
const KEEP_CLIENT = "keep";
const SERVER = "server";
const FRESH_EDGE = "fresh-wire";
const KEEP_EDGE = "keep-wire";

/** Sim-seconds → the millisecond figure the meters show. */
const MS_PER_SEC = 1000;

/**
 * One-way wire time, sim-seconds. RTT is twice this. Chosen so that even the
 * new-connection lane (2 RTT + serve per request) can keep up with the default
 * request rate without a growing backlog — otherwise the latency meter would
 * show accumulating QUEUE wait rather than the clean per-request cost the
 * lesson is about. A cold request is ~650ms (2 RTT), a warm one ~350ms (1 RTT).
 */
const ONE_WAY = 0.15;
const WIRE_SPEED = 1 / ONE_WAY;

/** Server processing time per request, sim-seconds. */
const SERVE_TIME = 0.05;

/**
 * Per-event smoothing rate for the latency meters. At 1 the meter LATCHES to
 * the most recent request's measured latency (see `emaEvent`: rate >= 1 clamps
 * the blend to 1), which is what this lesson wants — the reader is comparing
 * the actual cost of the last request on each client, not a running average
 * that would blur the first-request-identical moment into the divergence.
 */
const LAT_EMA_RATE = 1;

type Phase = "handshake" | "request" | "response";

/** A request making its way through one client's chosen strategy. */
interface Flight {
  id: number;
  issuedAt: number;
  phase: Phase;
}

interface ClientLane {
  /** Requests waiting for the lane (this model serves one at a time). */
  queue: Flight[];
  active: Flight | null;
  /** Whether this lane already holds a warm, established connection. */
  warm: boolean;
  /** Sim time the server finishes the active request. */
  serveUntil: number;
  atServer: boolean;
  /** Connections this lane has opened (handshakes paid). */
  opened: number;
}

interface ReuseState {
  fresh: ClientLane;
  keep: ClientLane;
  nextId: number;
  /** Smoothed per-request latency for each client, ms. */
  freshMs: number;
  keepMs: number;
  /** Requests completed by each client. */
  freshDone: number;
  keepDone: number;
}

export interface ReuseClientMeta {
  /** Connections opened so far by this client. */
  opened: number;
  /** Requests completed by this client. */
  done: number;
}

const QUIZ_AT = 10;

function emptyLane(): ClientLane {
  return {
    queue: [],
    active: null,
    warm: false,
    serveUntil: 0,
    atServer: false,
    opened: 0,
  };
}

export const connectionReuseSim: LessonSim<ReuseState> = {
  id: "connection-reuse",

  topology: {
    nodes: [
      { id: FRESH_CLIENT, kind: "client", label: "new conn each time", x: 150, y: 120 },
      { id: KEEP_CLIENT, kind: "client", label: "keep-alive", x: 150, y: 330 },
      { id: SERVER, kind: "server", label: "server", x: 650, y: 225 },
    ],
    edges: [
      { id: FRESH_EDGE, from: FRESH_CLIENT, to: SERVER, curve: -0.14 },
      { id: KEEP_EDGE, from: KEEP_CLIENT, to: SERVER, curve: 0.14 },
    ],
  },

  params: [
    {
      key: "rate",
      label: "requests",
      kind: "slider",
      min: 1,
      max: 3,
      step: 1,
      unit: " /s",
      defaultValue: 1,
    },
    {
      key: "reuse",
      label: "keep-alive client reuses",
      kind: "toggle",
      defaultValue: true,
    },
  ],

  init: () => ({
    fresh: emptyLane(),
    keep: emptyLane(),
    nextId: 1,
    freshMs: 0,
    keepMs: 0,
    freshDone: 0,
    keepDone: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const rate = Number(params.rate);
    const reuse = params.reuse === true;

    /** Start the active request: handshake first on a cold lane, else request. */
    const launch = (lane: ClientLane, edge: string, canReuse: boolean) => {
      const flight = lane.active!;
      if (lane.warm && canReuse) {
        // Warm connection: straight to the request, no handshake.
        flight.phase = "request";
        spawnPacket(state, edge, "request", {
          speed: WIRE_SPEED,
          payload: { edge },
        });
      } else {
        // Cold: open a connection first (one handshake round trip, drawn as a
        // single setup packet standing in for the SYN/SYN-ACK/ACK exchange).
        flight.phase = "handshake";
        lane.opened += 1;
        spawnPacket(state, edge, "handshake", {
          speed: WIRE_SPEED,
          payload: { edge },
        });
      }
    };

    // 1. Both clients receive the SAME request stream.
    const spawns = shouldSpawn(state, rate, dt);
    for (let i = 0; i < spawns; i++) {
      const id = L.nextId++;
      L.fresh.queue.push({ id, issuedAt: state.t, phase: "request" });
      L.keep.queue.push({ id, issuedAt: state.t, phase: "request" });
    }

    // 2. Feed each lane: at most one request in flight at a time.
    if (!L.fresh.active && L.fresh.queue.length > 0) {
      L.fresh.active = L.fresh.queue.shift()!;
      // The "new connection each time" client is never warm: it closes after
      // every response, so it always handshakes.
      launch(L.fresh, FRESH_EDGE, false);
    }
    if (!L.keep.active && L.keep.queue.length > 0) {
      L.keep.active = L.keep.queue.shift()!;
      // The keep-alive client reuses its connection when the toggle is on.
      launch(L.keep, KEEP_EDGE, reuse);
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const edge = String(p.payload?.edge ?? "");
      const lane = edge === FRESH_EDGE ? L.fresh : L.keep;
      if (!lane.active) continue;

      if (p.type === "handshake") {
        if (p.reverse) {
          // Handshake acknowledged: the connection is up. Now send the request.
          lane.warm = true;
          lane.active.phase = "request";
          spawnPacket(state, edge, "request", { speed: WIRE_SPEED, payload: { edge } });
        } else {
          // Handshake reached the server; it agrees, sending the ack back.
          spawnPacket(state, edge, "handshake", {
            speed: WIRE_SPEED,
            reverse: true,
            payload: { edge },
          });
        }
      } else if (p.type === "request") {
        // Reached the server: process it.
        lane.atServer = true;
        lane.serveUntil = state.t + SERVE_TIME;
      } else if (p.type === "response") {
        // Response home: record latency, retire the request.
        const ms = (state.t - lane.active.issuedAt) * MS_PER_SEC;
        if (lane === L.fresh) {
          L.freshMs = emaEvent(L.freshMs, ms, LAT_EMA_RATE);
          L.freshDone += 1;
          // The fresh client tears the connection down after each response.
          lane.warm = false;
        } else {
          L.keepMs = emaEvent(L.keepMs, ms, LAT_EMA_RATE);
          L.keepDone += 1;
        }
        lane.active = null;
        lane.atServer = false;
      }
    }

    // 4. Server finishes processing → send the response.
    for (const [lane, edge] of [
      [L.fresh, FRESH_EDGE],
      [L.keep, KEEP_EDGE],
    ] as const) {
      if (!lane.active || !lane.atServer || lane.serveUntil === 0) continue;
      if (state.t >= lane.serveUntil) {
        lane.atServer = false;
        lane.serveUntil = 0;
        lane.active.phase = "response";
        spawnPacket(state, edge, "response", {
          speed: WIRE_SPEED,
          reverse: true,
          payload: { edge },
        });
      }
    }

    // 5. Readouts.
    for (const [lane, node] of [
      [L.fresh, FRESH_CLIENT],
      [L.keep, KEEP_CLIENT],
    ] as const) {
      const n = state.nodes[node];
      n.load = approach(n.load, clamp01(lane.queue.length / 6), 5, dt);
      const meta: ReuseClientMeta = { opened: lane.opened, done: lane === L.fresh ? L.freshDone : L.keepDone };
      n.meta = { ...meta };
    }

    state.metrics.freshMs = L.freshMs;
    state.metrics.keepMs = L.keepMs;
    state.metrics.opened = L.fresh.opened;
    state.metrics.keepOpened = L.keep.opened;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Both clients get the same requests. The top one opens a new connection every time; the bottom one keeps its connection open.",
    },
    {
      at: 6,
      caption:
        "First request: the top client handshakes (setup packet), then sends. The bottom client did too — its FIRST request pays the same setup.",
    },
    {
      at: QUIZ_AT + 3,
      caption:
        "From the second request on, the keep-alive client skips the handshake — 1 RTT instead of 2. The top client pays setup again, and again.",
    },
    {
      at: 18,
      caption:
        "Toggle KEEP-ALIVE off and the bottom client handshakes every time too — the two lanes converge. Reuse was the whole difference.",
    },
  ],

  quiz: [
    {
      id: "reuse-first-request",
      at: QUIZ_AT,
      question:
        "The keep-alive client is much faster than the new-connection client. On which request do they take the SAME amount of time?",
      choices: [
        { id: "first", label: "The first one — both must open a connection before anything." },
        { id: "none", label: "None — keep-alive is faster from the very first request." },
        { id: "last", label: "The last one — the connection cost is amortised by then." },
      ],
      correctChoiceId: "first",
      explain:
        "There is no connection yet when the first request arrives, so both clients pay the same handshake round trip to open one. They are identical on request one. The difference is everything after: the keep-alive client holds that connection and its next request goes straight out at 1 RTT, while the new-connection client threw its connection away and must handshake all over again. So reuse saves nothing on a single request and everything on a stream of them — the payoff is the setup cost times the number of requests you avoided repeating it on. A connection pool is this idea kept ready in advance.",
    },
  ],

  meters: [
    {
      metricKey: "keepMs",
      label: "keep-alive latency",
      kind: "counter",
      unit: "ms",
    },
    {
      metricKey: "freshMs",
      label: "new-conn latency",
      kind: "counter",
      unit: "ms",
      dangerAbove: 550,
    },
    {
      metricKey: "opened",
      label: "connections opened (new-conn)",
      kind: "counter",
    },
    {
      metricKey: "keepOpened",
      label: "connections opened (keep-alive)",
      kind: "counter",
    },
  ],

  packetStyles: {
    handshake: { color: "var(--color-glow-violet)" },
  },

  packetLegend: [
    { type: "handshake", label: "connection setup" },
    { type: "request", label: "request" },
    { type: "response", label: "response" },
  ],
};
