import {
  advancePackets,
  approach,
  clamp01,
  emaEvent,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * HTTP Request & Response — archetype A (the packet engine).
 *
 * The connection is open (that was the last lesson). Now the browser actually
 * asks for things: a page is rarely one request — it is an HTML document and
 * then the stylesheet, the script, the images it references. This lesson is
 * about what happens when those requests share ONE connection, which is what
 * HTTP/1.1 keep-alive gives you: a single ordered lane.
 *
 * The mechanism is HEAD-OF-LINE BLOCKING. On one HTTP/1.1 connection a request
 * cannot start until the response to the one before it has come back. The
 * requests are a queue, served strictly in order, so the page's total time is
 * the SUM of the per-request round trips — not their max. And if one response
 * is slow (a big image, a slow endpoint), every request behind it waits on it,
 * even the tiny ones that would have finished instantly on their own.
 *
 * The knob is `connections`: how many parallel HTTP/1.1 connections the
 * browser opens. Each is its own independent lane, so K connections cut the
 * queue into K roughly-equal strands and the page time falls toward the batch
 * divided by K — the reason browsers cap at ~6 connections per host, and the
 * reason HTTP/2 multiplexing (many streams on ONE connection) exists at all.
 *
 * Times are MEASURED: each request stamps the sim time it was ENQUEUED, and
 * the page-load time is stamped when the last response of a batch returns.
 */

const CLIENT = "client";
const SERVER = "server";

/** Sim-seconds → the millisecond figure the meters show. */
const MS_PER_SEC = 1000;

/** One-way wire time, sim-seconds. RTT is twice this. */
const ONE_WAY = 0.2;
const WIRE_SPEED = 1 / ONE_WAY;

/** Server processing time for an ordinary resource, sim-seconds. */
const SERVE_TIME = 0.12;
/** A "slow" resource takes this much longer to produce. */
const SLOW_TIME = 0.9;

/** How many resources a page batch requests. */
const BATCH = 8;
/** Sim-seconds between page loads (a new batch of BATCH requests). */
const BATCH_PERIOD = 6;

/** Per-event EMA rate for the latency meter — MUST stay under 1. */
const LAT_EMA_RATE = 0.5;

/** Up to this many parallel connections (the connections slider ceiling). */
const MAX_CONN = 6;

/** A resource the page needs. */
interface Resource {
  id: number;
  /** Sim time it entered the queue. */
  enqueuedAt: number;
  /** This resource is a slow endpoint (blocks the lane behind it). */
  slow: boolean;
}

/** One HTTP/1.1 connection: a single ordered lane. */
interface Lane {
  /** The resource currently on the wire / being served, or null if idle. */
  active: Resource | null;
  /** Sim time the server finishes the active resource (0 = not yet at server). */
  serveUntil: number;
  /** Whether the active request has reached the server (vs still on the wire). */
  atServer: boolean;
}

interface HttpState {
  /** Resources waiting for a free lane. */
  queue: Resource[];
  lanes: Lane[];
  nextResource: number;
  /** Requests still outstanding in the current page batch. */
  batchRemaining: number;
  /** Sim time the current batch was started. */
  batchStartedAt: number;
  /** Sim time to open the next batch. */
  nextBatchAt: number;
  /** Smoothed page-load time (batch start → last response), ms. */
  pageMs: number;
  /** Most recent completed page-load time, ms. */
  lastPageMs: number;
  /** Resources completed so far. */
  completed: number;
  /** Highest lane count we have built lanes for, so we resize on demand. */
  laneCount: number;
}

export interface HttpClientMeta {
  /** Requests waiting in the queue right now. */
  queued: number;
  /** Lanes currently busy. */
  busy: number;
}

const QUIZ_AT = 9;

function makeLanes(n: number): Lane[] {
  return Array.from({ length: n }, () => ({
    active: null,
    serveUntil: 0,
    atServer: false,
  }));
}

export const httpRequestResponseSim: LessonSim<HttpState> = {
  id: "http-request-response",

  topology: {
    nodes: [
      { id: CLIENT, kind: "client", label: "browser", x: 150, y: 225 },
      { id: SERVER, kind: "server", label: "server", x: 650, y: 225 },
    ],
    edges: [
      { id: "conn-0", from: CLIENT, to: SERVER, curve: -0.34 },
      { id: "conn-1", from: CLIENT, to: SERVER, curve: -0.2 },
      { id: "conn-2", from: CLIENT, to: SERVER, curve: -0.07 },
      { id: "conn-3", from: CLIENT, to: SERVER, curve: 0.07 },
      { id: "conn-4", from: CLIENT, to: SERVER, curve: 0.2 },
      { id: "conn-5", from: CLIENT, to: SERVER, curve: 0.34 },
    ],
  },

  params: [
    {
      key: "connections",
      label: "connections",
      kind: "slider",
      min: 1,
      max: MAX_CONN,
      step: 1,
      defaultValue: 1,
    },
    {
      key: "slowResource",
      label: "one slow resource",
      kind: "toggle",
      defaultValue: false,
    },
  ],

  init: () => ({
    queue: [],
    lanes: makeLanes(1),
    nextResource: 1,
    batchRemaining: 0,
    batchStartedAt: 0,
    nextBatchAt: 1,
    pageMs: 0,
    lastPageMs: 0,
    completed: 0,
    laneCount: 1,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const connections = Math.round(Number(params.connections));
    const slowResource = params.slowResource === true;

    // Resize the lane pool when the connections slider moves. Only idle lanes
    // are dropped; a busy lane finishes its resource first.
    if (connections !== L.laneCount) {
      if (connections > L.lanes.length) {
        while (L.lanes.length < connections) {
          L.lanes.push({ active: null, serveUntil: 0, atServer: false });
        }
      }
      L.laneCount = connections;
    }

    // 1. Start a new page batch on the clock. A batch is BATCH resources; the
    //    first is the HTML, the rest its sub-resources.
    if (state.t >= L.nextBatchAt && L.batchRemaining === 0) {
      L.batchStartedAt = state.t;
      L.batchRemaining = BATCH;
      L.nextBatchAt = state.t + BATCH_PERIOD;
      for (let i = 0; i < BATCH; i++) {
        // At most one slow resource per page, and only when toggled on. Put it
        // second so there is always something waiting behind it to block.
        const slow = slowResource && i === 1;
        L.queue.push({ id: L.nextResource++, enqueuedAt: state.t, slow });
      }
    }

    // 2. Feed idle lanes from the queue. Each lane can hold ONE request at a
    //    time — that single-request-per-lane rule IS head-of-line blocking.
    for (let i = 0; i < connections; i++) {
      const lane = L.lanes[i];
      if (lane.active || L.queue.length === 0) continue;
      const res = L.queue.shift()!;
      lane.active = res;
      lane.atServer = false;
      lane.serveUntil = 0;
      spawnPacket(state, `conn-${i}`, "request", {
        speed: WIRE_SPEED,
        payload: { res: res.id, lane: i },
      });
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const laneIndex = Number(p.payload?.lane ?? 0);
      const lane = L.lanes[laneIndex];
      if (!lane || !lane.active) continue;

      if (p.type === "request") {
        // Reached the server: begin processing (slow resources take longer).
        lane.atServer = true;
        lane.serveUntil = state.t + (lane.active.slow ? SLOW_TIME : SERVE_TIME);
      } else if (p.type === "response") {
        // The response is home. Record completion; the lane frees up and can
        // take the next queued resource on the following tick.
        const res = lane.active;
        L.completed += 1;
        L.batchRemaining -= 1;
        if (L.batchRemaining === 0) {
          const pageMs = (state.t - L.batchStartedAt) * MS_PER_SEC;
          L.lastPageMs = pageMs;
          L.pageMs = emaEvent(L.pageMs, pageMs, LAT_EMA_RATE);
        }
        lane.active = null;
        lane.atServer = false;
        void res;
      }
    }

    // 4. Server finishes processing → send the response back down the lane.
    for (let i = 0; i < L.lanes.length; i++) {
      const lane = L.lanes[i];
      if (!lane.active || !lane.atServer || lane.serveUntil === 0) continue;
      if (state.t >= lane.serveUntil) {
        lane.atServer = false;
        lane.serveUntil = 0;
        spawnPacket(state, `conn-${i}`, "response", {
          speed: WIRE_SPEED,
          reverse: true,
          payload: { res: lane.active.id, lane: i },
        });
      }
    }

    // 5. Readouts.
    const busy = countBusy(L.lanes);
    const client = state.nodes[CLIENT];
    client.load = approach(client.load, clamp01(L.queue.length / BATCH), 5, dt);
    const clientMeta: HttpClientMeta = { queued: L.queue.length, busy };
    client.meta = { ...clientMeta };
    const server = state.nodes[SERVER];
    server.load = approach(server.load, clamp01(busy / MAX_CONN), 5, dt);

    state.metrics.pageMs = L.pageMs;
    state.metrics.lastPageMs = L.lastPageMs;
    state.metrics.queued = L.queue.length;
    state.metrics.inFlight = busy;
    state.metrics.completed = L.completed;
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "A page is eight requests on ONE connection: HTML, then its stylesheet, script and images — sent one at a time, each waiting for the one before it to come back.",
    },
    {
      at: QUIZ_AT + 3,
      caption:
        "That is head-of-line blocking: the page time is the SUM of every request's round trip, because the single connection is a single lane.",
    },
    {
      at: 15,
      caption:
        "Drag CONNECTIONS up. Each new connection is an independent lane, so the queue splits and the page time falls toward the batch divided by the lane count.",
    },
    {
      at: 21,
      caption:
        "Now toggle ONE SLOW RESOURCE. On a single connection every request behind it waits on it — even the tiny ones. More lanes route around it.",
    },
  ],

  quiz: [
    {
      id: "http-hol",
      at: QUIZ_AT,
      question:
        "Eight requests are sharing one HTTP/1.1 connection. How does the total page-load time relate to the individual request times?",
      choices: [
        { id: "sum", label: "It is roughly the SUM of them — they go one at a time." },
        { id: "max", label: "It is roughly the largest one — they all run in parallel." },
        { id: "avg", label: "It is the average — the connection balances them." },
      ],
      correctChoiceId: "sum",
      explain:
        "One HTTP/1.1 connection is a single ordered lane: a request cannot be sent until the response to the previous one has returned. So the requests run strictly in series and the page-load time is their sum, not their max. That is head-of-line blocking, and it is why the connection count matters — each extra connection is another independent lane that lets some of those requests run at the same time. It is also why a single slow response is so damaging on one connection: everything queued behind it is stuck waiting, and HTTP/2 multiplexing exists precisely to remove this constraint.",
    },
  ],

  meters: [
    {
      metricKey: "lastPageMs",
      label: "page load time",
      kind: "counter",
      unit: "ms",
      dangerAbove: 2500,
    },
    {
      metricKey: "inFlight",
      label: "requests in flight",
      kind: "bar",
      max: MAX_CONN,
    },
    {
      metricKey: "queued",
      label: "requests queued",
      kind: "counter",
    },
    {
      metricKey: "completed",
      label: "resources loaded",
      kind: "counter",
    },
  ],

  packetLegend: [
    { type: "request", label: "resource request" },
    { type: "response", label: "resource response" },
  ],
};

/** Lanes with a resource currently on them. */
function countBusy(lanes: Lane[]): number {
  let n = 0;
  for (const lane of lanes) if (lane.active) n += 1;
  return n;
}
