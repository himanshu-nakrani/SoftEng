import {
  advancePackets,
  bounceDrop,
  clamp01,
  emaEvent,
  emaRate,
  killNode,
  recordSample,
  reviveNode,
  severEdge,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * Lesson — Realtime Delivery. Three clients, one chat server, and the same
 * question asked three ways: how does a message the server already has reach
 * a client that is just sitting there?
 *
 *   SHORT-POLL  the client asks on a timer. Most answers are empty (grey),
 *               and a message waits, on average, half a poll interval.
 *   LONG-POLL   the request flies up and *parks* at the server (the chip on
 *               chat-1 counts parked requests). The moment an event lands for
 *               a parked client the response fires — one wire-hop of latency.
 *   WEBSOCKET   the wire stays open. Nothing travels client→server at all;
 *               messages just appear.
 *
 * Then the break: chat-1 restarts. Every client is severed — parked requests
 * die, sockets drop — and every client schedules a retry. With RECONNECT
 * JITTER off they all pick the same instant and land on the same tick: a
 * synchronized reconnect storm. With jitter on, `state.rng()` spreads them
 * across a couple of seconds and the same herd is absorbed without a bump.
 */

const CLIENT_IDS = ["c1", "c2", "c3"] as const;
type ClientId = (typeof CLIENT_IDS)[number];

/** Progress units/sec — ~0.4 s of wire in each direction. */
const WIRE = 2.5;

/** How long chat-1 is unavailable after a restart. */
const DOWN_TIME = 1;
/** A severed client waits this long before its first retry… */
const RECONNECT_DELAY = 1.4;
/** …plus, when jitter is on, `rng()` × this. THE mechanism of the lesson. */
const JITTER_SPREAD = 2.5;
/** A retry that arrives while chat-1 is still down backs off by this much. */
const RETRY_BACKOFF = 0.7;

/**
 * Reconnect work, expressed directly as server load: one accepted handshake
 * (TLS, auth, re-subscribe, rehydrate) costs HANDSHAKE_COST and is worked off
 * at HANDSHAKE_DRAIN per second — i.e. it occupies chat-1 for about half a
 * second. Arrive one at a time and each is gone before the next lands; arrive
 * together and they stack into a spike the bar cannot hold.
 */
const HANDSHAKE_COST = 0.55;
const HANDSHAKE_DRAIN = 1.1;
/** Load per held connection — the memory/fd cost websockets actually pay. */
const CONN_COST = 0.07;
/** Load per request/sec of arriving traffic (≈16 req/s saturates chat-1). */
const REQ_COST = 1 / 16;

/** Undelivered events buffered per client before the oldest is discarded. */
const MAX_BUFFER = 20;

interface ClientLink {
  id: ClientId;
  edge: string;
  /** "down" = severed by a restart, waiting on (or flying) its retry. */
  status: "live" | "down";
  /** Sim-seconds at which this client fires its reconnect. */
  reconnectAt: number;
  /** A reconnect packet is already on the wire (fire it once, not per tick). */
  reconnecting: boolean;
  /** short-poll: seconds until the next request. */
  pollTimer: number;
  /** long-poll: a request is on the wire or parked at the server. */
  outstanding: boolean;
  /** long-poll: the request is sitting at the server, waiting for an event. */
  parked: boolean;
  /** Enqueue times (sim-seconds) of events the server holds for this client. */
  buffer: number[];
}

interface RTState {
  clients: ClientLink[];
  /** Which transport the last tick ran — a change re-plumbs the stage. */
  mode: string;
  /** Sim-seconds until chat-1 answers again (0 = up). */
  downUntil: number;
  /** Set by the RESTART button or the scripted deploy; consumed by `step`. */
  restartRequested: boolean;
  /** Restarts performed with jitter on — gates the closing caption. */
  jitteredRestarts: number;
  /** Reconnects accepted on the current tick (the storm, measured). */
  reconnectsThisTick: number;
  /** Worst single-tick reconnect count so far. */
  reconnectPeak: number;
  /** Outstanding handshake work — what makes the load bar peg during a storm. */
  handshakeLoad: number;
  /** Smoothed client→server request rate. */
  requestEma: number;
  /** Smoothed empty-response rate — the waste meter. */
  wasteEma: number;
  /** Smoothed event→delivery latency, ms. */
  latencyEma: number;
  delivered: number;
}

function clientByEdge(L: RTState, edgeId: string): ClientLink | undefined {
  return L.clients.find((c) => c.edge === edgeId);
}

/**
 * A deploy: chat-1 goes away for DOWN_TIME, every in-flight packet dies where
 * it stood, and every client schedules a retry. Jitter is the only difference
 * between a stampede and a shrug — and it is one `state.rng()` call.
 */
function restartServer(state: SimState<RTState>, jitter: boolean): void {
  const L = state.lesson;
  L.downUntil = state.t + DOWN_TIME;
  if (jitter) L.jitteredRestarts += 1;
  killNode(state, "server");

  for (const c of L.clients) {
    // Parked long-polls, open sockets, polls mid-flight: all of it dies.
    severEdge(state, c.edge, "drop");
    c.status = "down";
    c.parked = false;
    c.outstanding = false;
    c.reconnecting = false;
    c.reconnectAt =
      state.t + RECONNECT_DELAY + (jitter ? state.rng() * JITTER_SPREAD : 0);
    state.nodes[c.id].health = "degraded";
  }
}

/** Hand a client everything the server is holding for it, in one response. */
function flush(state: SimState<RTState>, c: ClientLink, all: boolean): boolean {
  const batch = all ? c.buffer.splice(0, c.buffer.length) : c.buffer.splice(0, 1);
  if (batch.length === 0) return false;
  const packet = spawnPacket(state, c.edge, "message", {
    speed: WIRE,
    reverse: true,
    payload: { events: batch },
  });
  if (!packet) {
    // Pool cap: keep the events buffered rather than inventing a delivery.
    c.buffer.unshift(...batch);
    return false;
  }
  return true;
}

export const realtimeDeliverySim: LessonSim<RTState> = {
  id: "realtime-delivery",

  topology: {
    nodes: [
      { id: "c1", kind: "client", label: "phone", x: 150, y: 85 },
      { id: "c2", kind: "client", label: "laptop", x: 150, y: 225 },
      { id: "c3", kind: "client", label: "tablet", x: 150, y: 365 },
      { id: "server", kind: "server", label: "chat-1", x: 620, y: 225 },
    ],
    edges: [
      { id: "wire-c1", from: "c1", to: "server", curve: -0.1 },
      { id: "wire-c2", from: "c2", to: "server" },
      { id: "wire-c3", from: "c3", to: "server", curve: 0.1 },
    ],
  },

  packetStyles: {
    // An empty poll: real work, zero information. Faint and small on purpose —
    // the waste should read as noise, because that is exactly what it is.
    empty: { color: "var(--color-fg-faint)", size: 2.5 },
    // The thing the learner actually cares about arriving.
    message: { color: "var(--color-glow-green)", size: 5 },
    // Handshakes ride the warning hue — a reconnect is never free.
    reconnect: { color: "var(--color-glow-orange)", size: 4 },
  },

  params: [
    {
      key: "transport",
      label: "transport",
      kind: "select",
      options: [
        { value: "short-poll", label: "short-poll" },
        { value: "long-poll", label: "long-poll" },
        { value: "websocket", label: "websocket" },
      ],
      defaultValue: "short-poll",
    },
    {
      key: "pollInterval",
      label: "poll interval",
      kind: "slider",
      min: 0.25,
      max: 3,
      step: 0.25,
      unit: "s",
      defaultValue: 1,
    },
    {
      key: "eventRate",
      label: "event rate",
      kind: "slider",
      min: 0.5,
      max: 10,
      step: 0.5,
      unit: " msg/s",
      defaultValue: 1,
    },
    {
      key: "jitter",
      label: "reconnect jitter",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "restart",
      label: "restart server",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: (rng) => ({
    clients: CLIENT_IDS.map((id) => ({
      id,
      edge: `wire-${id}`,
      status: "live" as const,
      reconnectAt: 0,
      reconnecting: false,
      // Real clients boot at different moments, so their poll phases start
      // spread. The restart is what destroys that spread.
      pollTimer: rng() * 1.2,
      outstanding: false,
      parked: false,
      buffer: [],
    })),
    mode: "short-poll",
    downUntil: 0,
    restartRequested: false,
    jitteredRestarts: 0,
    reconnectsThisTick: 0,
    reconnectPeak: 0,
    handshakeLoad: 0,
    requestEma: 0,
    wasteEma: 0,
    latencyEma: 0,
    delivered: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const mode = String(params.transport);
    const pollInterval = Number(params.pollInterval);
    const eventRate = Number(params.eventRate);
    const jitter = params.jitter === true;

    // 0. Switching transport re-plumbs the stage: the old shape's packets are
    // meaningless, and a re-plumb is a learner action, not an outage — nobody
    // has to reconnect. Buffered events survive, so the meters stay comparable.
    if (mode !== L.mode) {
      for (const c of L.clients) {
        severEdge(state, c.edge);
        c.status = "live";
        c.parked = false;
        c.outstanding = false;
        c.reconnecting = false;
        state.nodes[c.id].health = "healthy";
      }
      L.mode = mode;
    }

    // 1. Deploys — the button and the scripted one land in the same place.
    if (params.restart === true) {
      params.restart = false; // consume the press
      L.restartRequested = true;
    }
    if (L.restartRequested) {
      L.restartRequested = false;
      restartServer(state, jitter);
    }

    const up = state.t >= L.downUntil;
    if (up && state.nodes.server.health === "dead") reviveNode(state, "server");

    // 2. Events arrive server-side (a message someone else sent). A restarting
    // server accepts nothing; already-buffered events survive it.
    if (up) {
      const events = shouldSpawn(state, eventRate, dt);
      for (let i = 0; i < events; i++) {
        const c = L.clients[Math.floor(state.rng() * L.clients.length)];
        c.buffer.push(state.t);
        if (c.buffer.length > MAX_BUFFER) c.buffer.shift();
      }
    }

    // 3. What each client does with its wire this tick.
    for (const c of L.clients) {
      if (c.status === "down") {
        if (!c.reconnecting && state.t >= c.reconnectAt) {
          c.reconnecting = true;
          spawnPacket(state, c.edge, "reconnect", { speed: WIRE });
        }
        continue;
      }
      if (mode === "short-poll") {
        c.pollTimer -= dt;
        if (c.pollTimer <= 0) {
          c.pollTimer += pollInterval;
          spawnPacket(state, c.edge, "request", { speed: WIRE });
        }
      } else if (mode === "long-poll") {
        // Exactly one request per client, always outstanding: answered, then
        // immediately re-issued.
        if (!c.outstanding) {
          c.outstanding = true;
          spawnPacket(state, c.edge, "request", { speed: WIRE });
        }
        // An event that landed while the request was parked fires it now.
        if (c.parked && c.buffer.length > 0 && flush(state, c, true)) {
          c.parked = false;
        }
      } else if (up) {
        // websocket: nothing goes up. Anything buffered goes down at once.
        while (c.buffer.length > 0 && flush(state, c, false)) {
          /* drain */
        }
      }
    }

    // 4. Arrivals.
    L.reconnectsThisTick = 0;
    let requestsNow = 0;
    let wastedNow = 0;
    for (const p of advancePackets(state, dt)) {
      const c = clientByEdge(L, p.edgeId);
      if (!c) continue;

      if (p.reverse) {
        // …reached a client.
        if (p.type === "message") {
          const events = (p.payload?.events as number[] | undefined) ?? [];
          for (const born of events) {
            L.delivered += 1;
            const ms = (state.t - born) * 1000;
            // The distribution IS the lesson — the sparkline reads this ring.
            recordSample(state, "latency", ms);
            L.latencyEma = emaEvent(L.latencyEma, ms, 0.4);
          }
          c.outstanding = false;
        } else if (p.type === "empty") {
          c.outstanding = false;
        }
        // acks and drops need nothing on arrival
        continue;
      }

      // …reached the server.
      if (p.type === "drop") continue;
      if (!up) {
        // Refused by a restarting process.
        bounceDrop(state, c.edge);
        if (p.type === "reconnect") {
          c.reconnecting = false;
          c.reconnectAt =
            state.t + RETRY_BACKOFF + (jitter ? state.rng() * JITTER_SPREAD : 0);
        }
        continue;
      }

      if (p.type === "reconnect") {
        c.status = "live";
        c.reconnecting = false;
        state.nodes[c.id].health = "healthy";
        L.handshakeLoad += HANDSHAKE_COST;
        L.reconnectsThisTick += 1;
        // Everyone who reconnects on the same tick now polls on the same
        // tick, forever: an outage synchronizes clients that were spread.
        c.pollTimer = pollInterval;
        spawnPacket(state, c.edge, "reconnect", { speed: WIRE, reverse: true });
      } else if (p.type === "request") {
        requestsNow += 1;
        if (mode === "long-poll") {
          // Something waiting? answer now. Nothing? hold the request open.
          if (!flush(state, c, true)) c.parked = true;
        } else if (!flush(state, c, true)) {
          // Short-poll's signature failure: a whole round trip for nothing.
          wastedNow += 1;
          spawnPacket(state, c.edge, "empty", { speed: WIRE, reverse: true });
        }
      }
    }
    if (L.reconnectsThisTick > L.reconnectPeak) {
      L.reconnectPeak = L.reconnectsThisTick;
    }

    // 5. Readouts.
    let parked = 0;
    let live = 0;
    for (const c of L.clients) {
      if (c.parked) parked += 1;
      if (c.status === "live") live += 1;
    }
    // What the server is actually holding open on your behalf.
    const held =
      mode === "websocket" ? (up ? live : 0) : mode === "long-poll" ? parked : 0;

    L.requestEma = emaRate(L.requestEma, requestsNow, dt);
    L.wasteEma = emaRate(L.wasteEma, wastedNow, dt);
    L.handshakeLoad = Math.max(0, L.handshakeLoad - HANDSHAKE_DRAIN * dt);

    const server = state.nodes.server;
    server.load = up
      ? clamp01(L.requestEma * REQ_COST + held * CONN_COST + L.handshakeLoad)
      : 0;
    // The parked-request count is long-poll's whole trick, so it gets the chip.
    server.queueDepth = mode === "long-poll" ? parked : 0;

    state.metrics.latency = L.latencyEma;
    state.metrics.waste = L.wasteEma;
    state.metrics.connections = held;
    state.metrics.delivered = L.delivered;
  },

  timeline: [
    // Three mutually exclusive openers: whichever transport is selected
    // explains itself. The other two stay pending and fire the first time the
    // learner switches to them.
    {
      at: 2,
      caption:
        "SHORT-POLL: every client asks on a timer. Grey dots are empty answers — a full round trip that carried nothing.",
      when: (_s, params) => params.transport === "short-poll",
    },
    {
      at: 2,
      caption:
        "LONG-POLL: the request flies up and parks at chat-1 (see the chip). It only answers when there is something to say.",
      when: (_s, params) => params.transport === "long-poll",
    },
    {
      at: 2,
      caption:
        "WEBSOCKET: the wire stays open. Nothing travels up at all — messages just arrive.",
      when: (_s, params) => params.transport === "websocket",
    },
    {
      at: 8,
      caption:
        "Flip TRANSPORT and watch two meters disagree: wasted requests vs. message latency.",
    },
    {
      at: 12.5,
      caption:
        "POLL INTERVAL only bites in short-poll: faster polling buys latency with waste.",
    },
    {
      at: 18,
      caption: "🚀 Deploy! chat-1 restarts — every client is severed.",
      apply: (s) => {
        s.lesson.restartRequested = true;
      },
    },
    {
      at: 21.5,
      caption:
        "All three came back on the same tick. Switch RECONNECT JITTER on and press RESTART SERVER again.",
      // Only claims a storm if one actually landed (3 reconnects, one tick).
      when: (s, params) => params.jitter !== true && s.lesson.reconnectPeak >= 3,
    },
    {
      at: 21.5,
      caption:
        "Jitter on: the same three clients, now spread over a couple of seconds. Watch chat-1's load bar stay flat.",
      // Waits — possibly forever — for a restart the learner runs with jitter on.
      when: (s) => s.lesson.jitteredRestarts > 0,
    },
  ],

  quiz: [
    {
      id: "rtd-reconnect",
      // t=18.4: the deploy has landed (clients severed, connections at zero)
      // and the retries are in the air but have not arrived. The premise is
      // on screen; the resumed sim is what proves the answer.
      at: 18.4,
      question:
        "The server restarts with all clients connected and no reconnect jitter. What happens?",
      choices: [
        {
          id: "storm",
          label:
            "A synchronized reconnect storm — every client hammers the server at the same instant.",
        },
        {
          id: "gradual",
          label: "Clients trickle back as each one notices, spreading the load.",
        },
        {
          id: "manual",
          label: "The clients stay disconnected until someone reloads the page.",
        },
      ],
      correctChoiceId: "storm",
      explain:
        "Every client was severed by the same event, so every client starts the same retry timer at the same moment — and arrives together. The herd is the fleet you were proud of. The fix is one line: jittered exponential backoff, a random spread on every retry, which is why browsers and client SDKs all randomize. Same physics as the cache stampede: identical clients doing the identical correct thing at the identical time.",
    },
  ],

  meters: [
    {
      metricKey: "latency",
      label: "message latency",
      kind: "sparkline",
      unit: "ms",
      dangerAbove: 1200,
    },
    {
      metricKey: "waste",
      label: "wasted requests",
      kind: "counter",
      unit: "req/s",
      decimals: 1,
      dangerAbove: 1,
    },
    {
      metricKey: "connections",
      label: "connections held",
      kind: "bar",
      max: CLIENT_IDS.length,
    },
    {
      metricKey: "delivered",
      label: "delivered",
      kind: "counter",
    },
  ],
};
