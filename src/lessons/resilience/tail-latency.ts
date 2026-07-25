import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  isAlive,
  killNode,
  recordSample,
  reviveNode,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson — Tail Latency. clients → lb-1 → three api servers.
 *
 * Nothing in this lesson is broken. Every server answers in about 40ms, and
 * every so often — a GC pause, a lock it has to queue behind, a cold page —
 * one of them takes a hundred times that. The lesson is what that rare event
 * does to the numbers you actually report, and what fan-out does to the rare
 * event.
 *
 * THE MEASUREMENT IS REAL. Every packet is stamped with `bornAt`; a request's
 * latency is `state.t - bornAt` read at the moment its response reaches the
 * client, appended to the `latency` ring, and the p50/p99 meters are nearest-
 * rank percentiles computed over that ring. No lookup table, no asserted
 * "this one was slow so print 2000" — the tail on the meters is the tail the
 * run produced, which is the only way a prediction about it can be honest.
 *
 * The one honest fudge is UNITS. Sim time is the animation's clock — a healthy
 * round trip runs 1.47 sim-seconds so you can watch it, a stalled leg crawls
 * its edge for seconds more so you can watch that too — and `toMs` is an
 * AFFINE rescaling of the measured sim-seconds around two calibrated anchors:
 * the median healthy round trip is called 40ms, everything past it is priced at
 * MS_PER_SIM per extra sim-second. Monotone and applied identically to every
 * request, so ordering, spacing and every percentile survive unchanged. A 25x
 * dynamic range cannot be animated truthfully at one timescale; this is the
 * trade `circuit-breaker.ts` makes, made once, in one function, on real input.
 *
 * Three regimes, all three in the arc (headless, seed 42, defaults):
 *
 *   SINGLE   one request, one server. p50 flat at 40ms, p99 spiking to
 *            500-750ms whenever the window happens to hold two stalls.
 *   FAN-OUT  one request, all three servers, finishing on the SLOWEST leg.
 *            1-(1-p)^3 ≈ 3p turns 2% per server into 5.9% per request, and
 *            p99 stops being an event: above its 300ms line for 87% of the
 *            scripted window, peaking over a second. Killing a server here is
 *            the counter-intuitive beat — two chances to be unlucky instead of
 *            three, so the tail gets THINNER. (lb-1 routes around the corpse
 *            on the tick it dies; health-check lag is `load-balancing`'s.)
 *   HEDGE    single again, plus a duplicate to a fresh server for anything
 *            still running at the p95 mark, first answer home wins. p99 back
 *            under 350ms for 85% of the window, for a few percent more dots.
 */

const SERVERS = ["s1", "s2", "s3"] as const;
type ServerId = (typeof SERVERS)[number];

/* ---------- timing model ---------- */

/**
 * Progress units/sec on every hop whose duration is *not* the point — one
 * traversal is 12 ticks (0.4 sim-seconds) regardless of the edge's length.
 * Three of them are fixed: client→lb, lb→api, and lb→client on the way home.
 * The fourth traversal (api→lb) carries the server's service time and is the
 * only variable in the model.
 */
const HOP_SPEED = 2.4;
/** How fast a dying packet clears the wire — fades, never lingers. */
const DROP_SPEED = 1.8;

/** A healthy answer, in sim-seconds. Jittered: real fast paths are a band. */
const FAST_MIN = 0.11;
const FAST_MAX = 0.25;
/** A bad moment — GC pause, lock wait — drawn uniformly in this range. */
const SLOW_MIN = 2.7;
const SLOW_MAX = 6.5;

/**
 * The two anchors of the unit conversion, CALIBRATED against headless runs
 * rather than derived: a healthy round trip measures 44 ticks end to end at
 * the median service draw, and that is what we call 40ms. Everything slower is
 * priced from there at MS_PER_SIM milliseconds per extra sim-second, which
 * puts the healthy band at ~28-52ms and a stalled request at ~490-1170ms.
 */
const FAST_SIM = 44 / 30;
const FAST_MS = 40;
const MS_PER_SIM = 180;

/** Measured sim-seconds → reported milliseconds. Affine, monotone, total. */
function toMs(simSeconds: number): number {
  return FAST_MS + (simSeconds - FAST_SIM) * MS_PER_SIM;
}

/** The inverse — used to turn a p95 in ms back into a hedging deadline. */
function toSim(ms: number): number {
  return FAST_SIM + (ms - FAST_MS) / MS_PER_SIM;
}

/* ---------- percentiles ---------- */

/** Samples kept for the percentile window (and drawn by the sparkline). */
const WINDOW = 120;
/** Below this many samples a percentile is noise, and hedging stays off. */
const MIN_SAMPLES = 40;
/**
 * Ceiling on the hedging deadline, as a multiple of the measured p50. Without
 * it the mechanism eats itself: a window still holding a fatter regime's
 * stalls pushes p95 up into the tail, the deadline follows it, and hedging
 * quietly switches off at exactly the moment it was worth having. Real
 * implementations clamp for the same reason — past a few times the median you
 * are not hedging, you are waiting.
 */
const HEDGE_CAP_X = 3;

/**
 * Nearest-rank percentile over an ascending copy of the window. At WINDOW=120
 * the p99 is the second-worst sample — which is exactly why p99 is jumpy on
 * small samples, and why one bad server shows up in it at all.
 */
function percentileOf(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(q * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/* ---------- lesson state ---------- */

/** One user-visible request, from the client's spawn to its response. */
interface Req {
  id: number;
  /** Sim-seconds at the client. The `bornAt` every latency is measured from. */
  bornAt: number;
  /** Servers this request has been sent to — a hedge picks one it hasn't. */
  tried: ServerId[];
  /** Legs still on the wire, in either direction. */
  outstanding: number;
  /** "all" = fan-out, finish on the SLOWEST leg. "first" = finish on the winner. */
  mode: "all" | "first";
  /** A duplicate has already gone out; a request is hedged at most once. */
  hedged: boolean;
  /** Some leg came home. */
  anySuccess: boolean;
  /** The response is on its way to the client; later legs decide nothing. */
  resolved: boolean;
}

interface TailState {
  /** Live requests by id. Insertion-ordered, so iteration is deterministic. */
  reqs: Map<number, Req>;
  nextReqId: number;
  /** Round-robin cursor for single-leg dispatch. */
  rr: number;
  /** Legs whose service draw came up slow — the fan-out multiplier, counted. */
  slowLegs: number;
  /** Duplicates sent past the p95 mark. */
  hedges: number;
  /** Requests that died with no answer (only possible with servers killed). */
  lost: number;
  /** Requests answered — the denominator behind every percentile on screen. */
  completed: number;
  meanMs: number;
  p50Ms: number;
  p99Ms: number;
  /** The hedging deadline, in sim-seconds of request age. 0 = not hedging yet. */
  p95Sim: number;
  /** Scripted beats. Outside these windows the toggles rule (see `step`). */
  scriptFanoutUntil: number;
  scriptSingleUntil: number;
  scriptHedgeUntil: number;
}

/* ---------- scripted beats ---------- */

/*
 * Beat times, chosen by sweeping them headless at seed 42 rather than by
 * taste: stalls are a 2% event, so where the fan-out window falls in the RNG
 * stream decides whether the learner sees the thing the caption promises. At
 * these values the p99 meter reads above its 300ms line for 87% of the fan-out
 * window and below it for 85% of the hedged one.
 */
const FANOUT_AT = 11;
const KILL_AT = 15;
const REVIVE_AT = 17;
const HEDGE_AT = 19;
/** Scripted single+hedge holds to here, then the toggles are the learner's. */
const SCRIPT_ENDS = 34;

/** A request outliving this lost its packets somewhere; don't leak the record. */
const REQ_MAX_LIFE = 20;

/** Concurrent legs that peg a server's load bar. */
const SERVER_CONCURRENCY = 5;
/** Requests in flight that peg lb-1's bar (~30 at the default rate). */
const LB_CONCURRENCY = 60;

export const tailLatencySim: LessonSim<TailState> = {
  id: "tail-latency",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "clients", x: 110, y: 225 },
      { id: "lb", kind: "loadbalancer", label: "lb-1", x: 330, y: 225 },
      { id: "s1", kind: "server", label: "api-1", x: 650, y: 95, breakable: true },
      { id: "s2", kind: "server", label: "api-2", x: 650, y: 225, breakable: true },
      { id: "s3", kind: "server", label: "api-3", x: 650, y: 355, breakable: true },
    ],
    edges: [
      { id: "in", from: "client", to: "lb" },
      { id: "to-s1", from: "lb", to: "s1", curve: -0.12 },
      { id: "to-s2", from: "lb", to: "s2" },
      { id: "to-s3", from: "lb", to: "s3", curve: 0.12 },
    ],
  },

  params: [
    {
      key: "rate",
      label: "request rate",
      kind: "slider",
      min: 6,
      max: 24,
      step: 1,
      unit: " req/s",
      // The rate does not change the window's *statistics* — 120 samples hold
      // the same expected number of stalls whatever the rate — but it does set
      // how fast the window turns over. 20/s refreshes it in six seconds, so a
      // scripted beat can actually finish inside its own regime. The ceiling
      // is where the pool starts to matter: 24/s fanned out at 5% peaks near
      // 110 of the 128 dots.
      defaultValue: 20,
    },
    {
      key: "slowPct",
      label: "slow requests",
      kind: "slider",
      min: 0,
      max: 5,
      step: 0.5,
      unit: "%",
      // Per SERVER, per request, drawn independently. 2% is the smallest rate
      // that actually *demonstrates* in a thirty-second run: a 120-sample
      // window holds ~2.4 stalls single-leg and ~7 fanned out, so p99 is a
      // spike in the first regime and a plateau in the second. At 1% the
      // window is as likely as not to be empty of them, and a beat that only
      // sometimes happens is not a beat.
      defaultValue: 2,
    },
    {
      key: "fanout",
      label: "fan out to all 3",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "hedge",
      label: "hedge at p95",
      kind: "toggle",
      defaultValue: false,
    },
  ],

  init: () => ({
    reqs: new Map(),
    nextReqId: 1,
    rr: 0,
    slowLegs: 0,
    hedges: 0,
    lost: 0,
    completed: 0,
    meanMs: 0,
    p50Ms: 0,
    p99Ms: 0,
    p95Sim: 0,
    scriptFanoutUntil: 0,
    scriptSingleUntil: 0,
    scriptHedgeUntil: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const slowP = Number(params.slowPct) / 100;

    // Mode resolution, `cap-theorem`'s pattern: a scripted window forces a
    // regime on, a shorter hold forces it off, and outside both the learner's
    // toggle is authoritative. The engine cannot write `params` from a
    // timeline event, so a scripted beat has to live in lesson state.
    const forcedFanout = state.t < L.scriptFanoutUntil;
    const forcedSingle = !forcedFanout && state.t < L.scriptSingleUntil;
    const fanout = forcedFanout || (!forcedSingle && params.fanout === true);
    const hedging = state.t < L.scriptHedgeUntil || params.hedge === true;

    const live = SERVERS.filter((id) => isAlive(state, id));

    /** Put one leg of `req` on the wire and let the server draw its fate later. */
    const dispatch = (req: Req, server: ServerId, isHedge: boolean): boolean => {
      const packet = spawnPacket(state, `to-${server}`, isHedge ? "hedge" : "request", {
        speed: HOP_SPEED,
        payload: { reqId: req.id, server },
      });
      if (!packet) return false; // pool cap: no dot, so no leg
      req.tried.push(server);
      req.outstanding += 1;
      return true;
    };

    /** The request is over with nothing to show for it. */
    const failRequest = (req: Req) => {
      req.resolved = true;
      L.lost += 1;
      bounceDrop(state, "in", { speed: DROP_SPEED });
      L.reqs.delete(req.id);
    };

    /**
     * A leg came home (or died). This is the ONLY place a request finishes,
     * and the `mode` line is the entire fan-out-vs-hedge difference: wait for
     * all of them, or take the first one.
     */
    const legDone = (req: Req, ok: boolean) => {
      req.outstanding = Math.max(0, req.outstanding - 1);
      if (req.resolved) return; // a hedge's loser, arriving after the winner
      if (ok) req.anySuccess = true;
      const finished =
        req.mode === "all" ? req.outstanding === 0 : ok || req.outstanding === 0;
      if (!finished) return;
      if (!req.anySuccess) {
        failRequest(req);
        return;
      }
      req.resolved = true;
      const home = spawnPacket(state, "in", "response", {
        speed: HOP_SPEED,
        reverse: true,
        payload: { reqId: req.id },
      });
      if (!home) L.reqs.delete(req.id); // no dot to arrive: drop the record
    };

    /** A finished request, measured and folded into the window. */
    const complete = (req: Req) => {
      const ms = toMs(state.t - req.bornAt);
      recordSample(state, "latency", ms, WINDOW);
      L.reqs.delete(req.id);
      L.completed += 1;

      const ring = state.series.latency ?? [];
      const sorted = [...ring].sort((a, b) => a - b);
      let sum = 0;
      for (const v of sorted) sum += v;
      L.meanMs = sum / sorted.length;
      L.p50Ms = percentileOf(sorted, 0.5);
      L.p99Ms = percentileOf(sorted, 0.99);
      // The hedging deadline: the p95 of the same measured distribution the
      // meters read — clamped (see HEDGE_CAP_X). Reading it off the live
      // distribution is what makes "duplicate anything past p95" self-limiting
      // rather than a magic constant someone has to retune.
      L.p95Sim =
        sorted.length >= MIN_SAMPLES
          ? toSim(Math.min(percentileOf(sorted, 0.95), HEDGE_CAP_X * L.p50Ms))
          : 0;
    };

    // 1. Demand.
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      const id = L.nextReqId;
      const packet = spawnPacket(state, "in", "request", {
        speed: HOP_SPEED,
        payload: { reqId: id },
      });
      if (!packet) continue; // at the cap the request is never made
      L.nextReqId += 1;
      L.reqs.set(id, {
        id,
        bornAt: state.t,
        tried: [],
        outstanding: 0,
        mode: fanout ? "all" : "first",
        hedged: false,
        anySuccess: false,
        resolved: false,
      });
    }

    // 2. A dead server loses everything it was holding — legs inbound to it and
    //    answers it had already started sending die where the failure caught
    //    them, rather than arriving from a corpse.
    for (const id of SERVERS) {
      if (isAlive(state, id)) continue;
      const edge = `to-${id}`;
      // Snapshot first: resolving a leg can spawn (a drop bouncing home), and
      // the spawn would otherwise land in the array being walked.
      const stranded = state.packets.filter(
        (p) => p.edgeId === edge && p.type !== "drop",
      );
      for (const p of stranded) {
        p.type = "drop";
        // A stalled answer was crawling at its service speed; as a corpse it
        // should fade out promptly rather than linger for another six seconds
        // looking like live traffic to a dead node.
        p.speed = Math.max(p.speed, DROP_SPEED);
        const req = L.reqs.get(Number(p.payload?.reqId ?? -1));
        if (req) legDone(req, false);
      }
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const req = L.reqs.get(Number(p.payload?.reqId ?? -1));

      if (p.edgeId === "in") {
        if (p.type === "drop") continue; // a dead request reaching the client
        if (!req) continue;
        if (p.reverse) {
          complete(req); // home. THE measurement.
          continue;
        }
        // At the balancer: one server, or all of them. The regime is read here
        // rather than at the client, so flipping FAN-OUT takes effect on the
        // next request to reach lb-1 instead of one hop later.
        if (live.length === 0) {
          failRequest(req);
          continue;
        }
        req.mode = fanout ? "all" : "first";
        let sent = 0;
        if (req.mode === "all") {
          for (const id of live) if (dispatch(req, id, false)) sent += 1;
        } else if (dispatch(req, live[L.rr++ % live.length], false)) {
          sent += 1;
        }
        if (sent === 0) failRequest(req);
        continue;
      }

      if (p.type === "drop") continue; // severed leg fading out

      if (!p.reverse) {
        // At a server. This draw is the whole distribution: one number decides
        // whether this leg is a 40ms answer or a two-second stall, and it is
        // drawn PER LEG, independently — which is precisely why fan-out hurts.
        const slow = state.rng() < slowP;
        const spread = state.rng();
        const service = slow
          ? SLOW_MIN + spread * (SLOW_MAX - SLOW_MIN)
          : FAST_MIN + spread * (FAST_MAX - FAST_MIN);
        if (slow) L.slowLegs += 1;
        // The answer's *speed* is the service time: a healthy leg snaps back,
        // a stalled one crawls the same edge for seconds. Nothing is held at
        // the node, so the stall is visible rather than implied.
        const answer = slow ? "slow" : p.type === "hedge" ? "hedge" : "response";
        spawnPacket(state, p.edgeId, answer, {
          speed: 1 / service,
          reverse: true,
          payload: p.payload,
        });
      } else if (req) {
        legDone(req, true);
      }
    }

    // 4. Hedging: any request still running when it passes the measured p95
    //    gets a duplicate on a server it has not tried. Under fan-out there is
    //    no such server, which is why the two ideas do not compose.
    if (hedging && L.p95Sim > 0) {
      for (const req of L.reqs.values()) {
        if (req.resolved || req.hedged || req.mode !== "first") continue;
        if (state.t - req.bornAt < L.p95Sim) continue;
        const alt = live.find((id) => !req.tried.includes(id));
        if (!alt) continue;
        req.hedged = true;
        if (dispatch(req, alt, true)) L.hedges += 1;
      }
    }

    // 5. Safety net: a record whose packets vanished (pool cap, a severed leg)
    //    must not outlive the run.
    for (const [id, req] of L.reqs) {
      if (state.t - req.bornAt > REQ_MAX_LIFE) L.reqs.delete(id);
    }

    // 6. Readouts. A server's "work in progress" is simply the answers it has
    //    in flight, so the load bar is read off the stage rather than tracked.
    const busy: Record<string, number> = { s1: 0, s2: 0, s3: 0 };
    const stalled: Record<string, number> = { s1: 0, s2: 0, s3: 0 };
    for (const p of state.packets) {
      if (!p.reverse || p.type === "drop" || p.edgeId === "in") continue;
      const id = p.edgeId.slice(3);
      if (!(id in busy)) continue;
      busy[id] += 1;
      if (p.type === "slow") stalled[id] += 1;
    }
    for (const id of SERVERS) {
      const node = state.nodes[id];
      if (node.health === "dead") {
        node.load = 0;
        continue;
      }
      // A server in the middle of a bad moment is degraded, not broken — the
      // amber-orange node is the GC pause you can point at.
      node.health = stalled[id] > 0 ? "degraded" : "healthy";
      node.load = approach(
        node.load,
        clamp01(busy[id] / SERVER_CONCURRENCY),
        6,
        dt,
      );
    }
    state.nodes.lb.load = approach(
      state.nodes.lb.load,
      clamp01(L.reqs.size / LB_CONCURRENCY),
      6,
      dt,
    );

    state.metrics.latency = L.meanMs;
    state.metrics.p50 = L.p50Ms;
    state.metrics.p99 = L.p99Ms;
    state.metrics.slowLegs = L.slowLegs;
    state.metrics.hedges = L.hedges;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Amber out, green back. lb-1 hands each request to one server in turn, and almost every one is home in about 40ms.",
    },
    {
      at: 5.5,
      caption:
        "Two numbers, one distribution. p50 barely moves. Watch p99 — same servers, same traffic, and every so often it leaps.",
    },
    {
      at: 9,
      caption:
        "Nothing is broken: each server just has a bad moment on ~2% of requests — a GC pause, a lock. Drag SLOW REQUESTS and see which number notices.",
    },
    {
      at: FANOUT_AT,
      caption:
        "Fan-out: every request now touches ALL THREE servers and cannot finish until the SLOWEST leg comes home. Watch p99 stop being an event.",
      apply: (s) => {
        s.lesson.scriptFanoutUntil = HEDGE_AT;
      },
    },
    {
      at: KILL_AT,
      caption:
        "☠ api-2 is gone. lb-1 routes around it on the same tick — two legs per request now, not three. Two chances to be unlucky instead of three: 1-(0.98)² is 4%, down from 6%.",
      apply: (s) => killNode(s, "s2"),
    },
    {
      at: REVIVE_AT,
      caption:
        "api-2 is back, and so is the third leg — and the third independent chance of a bad moment. Losing a server made the tail thinner. Nobody puts that in a postmortem.",
      apply: (s) => reviveNode(s, "s2"),
    },
    {
      at: HEDGE_AT,
      caption:
        "Hedging: one server per request again — but anything still running at the p95 mark gets a violet duplicate sent elsewhere, and the first answer home wins. Give p99 a few seconds: the window has to turn over before it can tell you.",
      apply: (s) => {
        // Fan-out is forced off only long enough for the beat to be legible;
        // after that the toggle is the learner's again, even though hedging
        // keeps running to the end of the script. Turning fan-out back on
        // simply makes hedging inert (there is no untried server left), which
        // is a true thing about the two ideas and worth being allowed to find.
        s.lesson.scriptSingleUntil = HEDGE_AT + 4;
        s.lesson.scriptHedgeUntil = SCRIPT_ENDS;
      },
    },
    {
      // No clock worth naming: this belongs to the moment the sample window has
      // actually turned over. Gated, so it simply never fires if it isn't true
      // — a learner who turned hedging off never gets told it worked.
      at: 28,
      when: (s) => s.metrics.hedges >= 2 && s.metrics.p99 < 350,
      caption:
        "There it is. A handful of duplicates — count them on the meter — and p99 has fallen from a stalled server's whole bad moment to the deadline plus one more round trip.",
    },
    {
      at: SCRIPT_ENDS,
      caption:
        "The controls are yours: SLOW REQUESTS, FAN-OUT, HEDGE — and click any server to give it a very bad day.",
    },
  ],

  quiz: [
    {
      /*
       * Ungated and pinned to the clock. Fan-out has been on since t=11, so at
       * 13.5 the premise is literally on screen: three legs leave lb-1 for
       * every amber dot that arrives, and (verified headless at seed 42) two
       * stalls have already landed in the window, so p99 is reading ~590ms
       * against a p50 of 40ms while the question is asked. Deliberately asked
       * before the window has fully turned over, so the answer has to be
       * arithmetic rather than meter-reading — the proof arrives over the next
       * few seconds and the counter-example (the kill at 15) right after it.
       *
       * A learner who has already dragged SLOW REQUESTS has left the script
       * behind and the stated 2% is theirs, not the sim's. The arithmetic in
       * the explanation is what generalises, which is why it is phrased as a
       * law rather than a reading.
       */
      id: "tl-fanout",
      at: 13.5,
      question:
        "Each server here stalls on about 2% of requests, independently. A request now fans out to all three and finishes only when the SLOWEST leg is home. How often is the whole request slow?",
      choices: [
        { id: "same", label: "About 2% — a stall is just as rare as it ever was" },
        { id: "triple", label: "About 6% — three independent chances to be unlucky" },
        {
          id: "product",
          label: "About 0.0008% — all three would have to stall at once",
        },
      ],
      correctChoiceId: "triple",
      explain:
        "For the request to be fast, EVERY leg has to be fast — probability (1-p)^3 — so it is slow with probability 1-(1-p)^3, which at p=2% is 5.9%. Three chances, not one. 'Product' is the trap: that would be right if you needed all three to stall, but you are waiting for the maximum, not the minimum. For small p the rule is just 1-(1-p)^n ≈ np: p=1% over three legs is ~3%, and the same 1% over a 100-way fan-out is 1-0.99^100 = 63% — a one-in-a-hundred event at the leaf becomes the common case at the root, purely because of width. That is the tail-at-scale result, and it is why a p99 you could shrug off on one machine dominates a fleet.",
    },
    {
      /*
       * Fires half a second before the scripted hedge beat: predict the cost,
       * then resume straight into it. 5 sim-seconds clear of tl-fanout, and a
       * full 1.5s after the revive at 17 so its caption is readable first.
       */
      id: "tl-hedge-cost",
      at: HEDGE_AT - 0.5,
      question:
        "Next: any request still running when it passes the p95 mark gets a duplicate sent to a second server, and the first answer home wins. What does that cost?",
      choices: [
        {
          id: "five",
          label: "At most 5% extra requests — only 5% ever cross p95",
        },
        { id: "double", label: "Double the load — every request now goes out twice" },
        { id: "free", label: "Nothing — the duplicate replaces the original" },
      ],
      correctChoiceId: "five",
      explain:
        "The threshold IS the cost control, and it is a percentile, so the bill is bounded before you run it: duplicate at p95 and you duplicate at most one request in twenty; at p50 you would duplicate half of them. Watch the HEDGES SENT meter — here it will read well under 5%, because almost every healthy request lands in the same tight band and the only ones past p95 are the genuinely stalled ones. What the duplicate buys is large: it goes to a DIFFERENT server, whose bad moments are independent, so the request now needs both to stall (2% becomes 0.04%) and the worst case is bounded at the deadline plus one more round trip. Note what this is not: it is not a retry. Nothing failed and nothing timed out — both copies are still running when the winner returns, which is why hedged work must be idempotent, and why you hedge once rather than in a loop. And never hedge a saturated service: 5% more load on something already at its limit is how a slow day becomes an outage.",
    },
  ],

  meters: [
    {
      // The distribution itself: one dot per completed request. The readout is
      // the MEAN, because the mean is what the dashboard shows you.
      metricKey: "latency",
      label: "mean latency",
      kind: "sparkline",
      unit: " ms",
      decimals: 0,
      // Deliberately no danger threshold: the mean's whole crime is that it
      // keeps looking fine while the trace under it grows spikes.
    },
    {
      metricKey: "p50",
      label: "p50",
      kind: "counter",
      unit: " ms",
      decimals: 0,
    },
    {
      // THE meter. Same 120 samples as p50, second-worst of them.
      metricKey: "p99",
      label: "p99",
      kind: "counter",
      unit: " ms",
      decimals: 0,
      // A 300ms budget for a 40ms service: generous, and still blown wide open
      // by a 1% event once fan-out gets hold of it.
      dangerAbove: 300,
    },
    {
      // Legs whose service draw came up slow. Under fan-out this climbs ~3x
      // faster than the request rate would suggest — the multiplier, counted.
      metricKey: "slowLegs",
      label: "slow legs",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "hedges",
      label: "hedges sent",
      kind: "counter",
    },
  ],

  packetStyles: {
    /** A leg having a bad moment: it crawls the edge for seconds. */
    slow: { color: "var(--color-glow-orange)", size: 5.5 },
    /** A deliberate duplicate, both ways — the dot you watch win the race. */
    hedge: { color: "var(--color-glow-violet)", size: 5 },
  },

  packetLegend: [
    { type: "request", label: "request" },
    { type: "response", label: "answer (~40ms)" },
    { type: "slow", label: "slow leg — a bad moment" },
    { type: "hedge", label: "hedged duplicate" },
    { type: "drop", label: "lost with a dead server" },
  ],
};
