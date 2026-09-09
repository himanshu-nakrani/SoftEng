import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  emaRate,
  isAlive,
  killNode,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * Lesson — Bulkheads. clients → router → two downstream dependencies,
 * dep-a and dep-b, sitting behind ONE fixed pool of concurrency slots (think
 * connections, or worker threads). A call has to hold a slot for as long as
 * its dependency takes to answer; with no slot free the router turns the call
 * away at the door — a policy refusal, so the meter says REJECTED, not dropped.
 *
 * The whole lesson is one contrast, staged by the `isolate` toggle:
 *
 *   SHARED       every slot serves either dependency. When dep-a stalls, its
 *                calls sit in the pool holding slots for seconds, the pool
 *                fills with stuck dep-a work, and dep-b — which is perfectly
 *                healthy — starves: its calls find no free slot and are
 *                rejected. One slow dependency took down a call that had
 *                nothing to do with it.
 *   PARTITIONED  the pool is split, half the slots reserved for each
 *                dependency. dep-a's stall can now consume only dep-a's half;
 *                dep-b keeps its own slots and keeps serving at its own share.
 *                The bulkhead contains the flooding to one compartment.
 *
 * The honest cost is in the numbers, not the prose: a reserved slot sits idle
 * when its dependency is quiet, so partitioning lowers PEAK utilisation. Two
 * pools of four cannot lend each other a slot the way one pool of eight can.
 *
 * MODEL LIMITS — this is a believable model, not queueing theory. Service
 * time is a single fixed number per regime (healthy / stalled), not a drawn
 * distribution, so there is no natural variance and no tail; the stall is a
 * step change the timeline flips, not an emergent event. The partition is a
 * static 50/50 split, not the adaptive or weighted sizing a real bulkhead
 * would use, and there is no queue in front of a full pool — a call that finds
 * no slot is refused immediately rather than waiting briefly. Slot occupancy is
 * tracked as an integer count in lesson state; the packet dots are a faithful
 * VIEW of that count (one dot per in-flight call up to the pool cap), not the
 * source of truth, so high load reads off the pool meters, never off more dots.
 */

/** A call occupying a slot, waiting for its dependency to answer. */
interface Call {
  id: number;
  dep: "a" | "b";
  /** Sim-seconds at which the dependency answers and the slot frees. */
  doneAt: number;
}

interface BulkheadsState {
  /** In-flight calls holding a slot, by packet id. */
  calls: Map<number, Call>;
  /** Smoothed completions/sec for each dependency — the throughput meters. */
  servedA: number;
  servedB: number;
  /** Calls turned away for want of a slot. Policy refusal ⇒ "rejected". */
  rejectedB: number;
  rejectedTotal: number;
  /** Per-tick completion tallies, folded into the smoothed rates. */
  doneAThisTick: number;
  doneBThisTick: number;
  /** Latches once the reader kills dep-a, to retire the closing invitation. */
  everKilled: boolean;
}

/** Slots (connections/threads). Held for the whole service time of a call. */
const POOL_DEFAULT = 8;

/**
 * Service time in sim-seconds. Fixed per regime — see MODEL LIMITS. At the
 * fast service time a pool of 8 sustains ~16 calls/s; the offered rate is set
 * well under that so the healthy pool sits half-idle and rejects nothing. A
 * stalled call holds its slot ten times longer, which is what lets one
 * dependency drink the pool dry.
 */
const FAST_SEC = 0.5;
const STALL_SEC = 5;

/** Packet travel speed on the two legs; the answer retraces at the same pace. */
const HOP_SPEED = 1.6;
/** A rejected call bounces back fast — it never reached a dependency. */
const REJECT_SPEED = 2.4;

/** Total offered load, fixed: the lesson is the pool, not the traffic shape. */
const REQ_RATE = 5;

function depOf(state: SimState<BulkheadsState>): "a" | "b" {
  // Half the offered load to each dependency, drawn from the seeded stream.
  return state.rng() < 0.5 ? "a" : "b";
}

/** How many of `dep`'s slots are occupied right now. */
function busy(L: BulkheadsState, dep: "a" | "b"): number {
  let n = 0;
  for (const c of L.calls.values()) if (c.dep === dep) n += 1;
  return n;
}

export const bulkheadsSim: LessonSim<BulkheadsState> = {
  id: "bulkheads",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "clients", x: 120, y: 225 },
      { id: "router", kind: "loadbalancer", label: "pool", x: 360, y: 225 },
      {
        id: "depA",
        kind: "server",
        label: "dep-a",
        x: 660,
        y: 120,
        breakable: true,
      },
      { id: "depB", kind: "server", label: "dep-b", x: 660, y: 330 },
    ],
    edges: [
      { id: "in", from: "client", to: "router" },
      { id: "to-a", from: "router", to: "depA", curve: -0.14 },
      { id: "to-b", from: "router", to: "depB", curve: 0.14 },
    ],
  },

  params: [
    {
      key: "pool",
      label: "pool size",
      kind: "slider",
      min: 4,
      max: 12,
      step: 2,
      unit: " slots",
      defaultValue: POOL_DEFAULT,
    },
    {
      key: "isolate",
      label: "isolate the pool",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "stall",
      label: "dep-a stalls",
      kind: "toggle",
      defaultValue: false,
    },
  ],

  init: () => ({
    calls: new Map(),
    servedA: 0,
    servedB: 0,
    rejectedB: 0,
    rejectedTotal: 0,
    doneAThisTick: 0,
    doneBThisTick: 0,
    everKilled: false,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const pool = Number(params.pool);
    const isolate = params.isolate === true;
    const stall = params.stall === true;
    const aAlive = isAlive(state, "depA");
    if (!aAlive) L.everKilled = true;

    // A dead dep-a hangs every call for the full stall time before it dies;
    // a live-but-stalled dep-a answers, just slowly. Either way its calls sit
    // in the pool holding slots — which is the whole mechanism.
    const aStalled = stall || !aAlive;

    // Is there a slot for a call to `dep` right now? SHARED: any slot in the
    // whole pool will do, so admission is bounded by TOTAL occupancy — this is
    // the line that lets stuck dep-a work crowd dep-b out. ISOLATED: only
    // `dep`'s own reserved half counts, so the other dependency can never take
    // a slot from it.
    const halfA = Math.ceil(pool / 2);
    const halfB = Math.floor(pool / 2);
    const hasFreeSlot = (dep: "a" | "b"): boolean => {
      if (isolate) return busy(L, dep) < (dep === "a" ? halfA : halfB);
      return L.calls.size < pool; // one shared pool, bounded as a whole
    };

    L.doneAThisTick = 0;
    L.doneBThisTick = 0;

    // 1. Service: free slots whose calls have finished. A dead dep-a never
    //    finishes — its calls stay parked until it revives or the reader
    //    flips the stall off, which is exactly what a hung connection does.
    for (const [pid, call] of L.calls) {
      const finished = call.dep === "a" ? aAlive && state.t >= call.doneAt : state.t >= call.doneAt;
      if (!finished) continue;
      L.calls.delete(pid);
      const edge = call.dep === "a" ? "to-a" : "to-b";
      spawnPacket(state, edge, "response", { speed: HOP_SPEED, reverse: true });
      if (call.dep === "a") L.doneAThisTick += 1;
      else L.doneBThisTick += 1;
    }

    // 2. Arrivals from the client, at a fixed offered rate.
    const spawns = shouldSpawn(state, REQ_RATE, dt);
    for (let i = 0; i < spawns; i++) {
      const dep = depOf(state);
      spawnPacket(state, "in", "request", { speed: HOP_SPEED, payload: { dep } });
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in" && !p.reverse) {
        // At the router — this branch IS the pool. Ask for a slot; if the
        // dependency's share is full, refuse at the door.
        const dep = (p.payload?.dep as "a" | "b") ?? "b";
        if (!hasFreeSlot(dep)) {
          // No slot: rejected. Policy refusal, not capacity loss.
          L.rejectedTotal += 1;
          if (dep === "b") L.rejectedB += 1;
          bounceDrop(state, "in", { type: "limited", speed: REJECT_SPEED });
          continue;
        }
        // Slot acquired: hold it for the dependency's service time.
        const svc = dep === "a" && aStalled ? STALL_SEC : FAST_SEC;
        const packet = spawnPacket(state, dep === "a" ? "to-a" : "to-b", "request", {
          speed: HOP_SPEED,
          payload: { dep },
        });
        if (!packet) {
          // Pool of dots is full even though a slot is free: refuse rather
          // than silently lose the call. Rare — the pool cap is well above
          // any real slot count here.
          L.rejectedTotal += 1;
          if (dep === "b") L.rejectedB += 1;
          continue;
        }
        L.calls.set(packet.id, { id: packet.id, dep, doneAt: state.t + svc });
      } else if (p.edgeId === "in" && p.reverse) {
        // A response (or a rejection bounce) reached the client. Nothing to do.
      }
      // Packets on to-a / to-b are the VIEW of an occupied slot; their arrival
      // at the dependency is cosmetic — the slot frees on `doneAt` in step 1,
      // and the response packet is spawned there. Reverse packets on those
      // edges just fade home.
    }

    // 4. Readouts.
    L.servedA = emaRate(L.servedA, L.doneAThisTick, dt);
    L.servedB = emaRate(L.servedB, L.doneBThisTick, dt);

    const usedA = busy(L, "a");
    const usedB = busy(L, "b");
    // Utilisation is what's occupied over what the pool could occupy — the
    // honest cost meter. Under isolation a quiet compartment's reserved slots
    // count against the denominator whether or not anyone is using them.
    state.metrics.util = clamp01((usedA + usedB) / Math.max(1, pool)) * 100;
    state.metrics.servedB = L.servedB;
    state.metrics.rejectedB = L.rejectedB;
    state.metrics.rejected = L.rejectedTotal;
    state.metrics.poolA = usedA;

    // Node loads: dep-a fills with stuck work, dep-b tracks its own occupancy.
    const denomA = isolate ? halfA : pool;
    const denomB = isolate ? halfB : pool;
    state.nodes.depA.load = approach(
      state.nodes.depA.load,
      aAlive ? clamp01(usedA / Math.max(1, denomA)) : 0,
      6,
      dt,
    );
    state.nodes.depA.health = aStalled && aAlive ? "degraded" : state.nodes.depA.health;
    if (aAlive && !aStalled) state.nodes.depA.health = "healthy";
    state.nodes.depB.load = approach(
      state.nodes.depB.load,
      clamp01(usedB / Math.max(1, denomB)),
      6,
      dt,
    );
    // The router bar shows how full the whole pool is.
    state.nodes.router.load = approach(
      state.nodes.router.load,
      clamp01((usedA + usedB) / Math.max(1, pool)),
      6,
      dt,
    );
    state.nodes.router.queueDepth = usedA + usedB;
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Cyan out, green back. Every call to dep-a or dep-b must hold a slot in the shared pool until its dependency answers.",
    },
    {
      at: 6,
      caption:
        "Both dependencies are fast, the pool is never full, and nothing is rejected. Watch the pool utilisation.",
    },
    {
      at: 10,
      caption:
        "⚡ dep-a starts to stall — every dep-a call now holds its slot for seconds. Watch the pool fill with stuck dep-a work.",
      apply: (s) => {
        // Force the stall on for the scripted beat regardless of the toggle,
        // by killing dep-a: a dead dep hangs its calls for the full service
        // time, which is the stall made visible. (The `stall` toggle is the
        // reader's own way to stage it without a corpse.)
        killNode(s, "depA");
      },
    },
    {
      at: 15,
      caption:
        "dep-b is HEALTHY — but its calls now find no free slot and are REJECTED. One slow dependency is taking down the other.",
    },
    {
      at: 19,
      caption:
        "Now flip ISOLATE THE POOL on: dep-a's stall is trapped in its own half, and dep-b gets its slots back. Then click dep-a to stage the failure yourself.",
    },
  ],

  quiz: [
    {
      id: "bulkheads-starve",
      // Ungated, pinned to seed 42. dep-a is killed at 10.0; by 14.0 the pool
      // is full of stuck dep-a calls and dep-b's rejections are climbing but
      // the starvation caption (at 15) has not shown yet — so this predicts
      // before its own proof. Verified headless: see the def report.
      at: 14,
      question:
        "dep-a has stalled and its calls are piling up in the shared pool. dep-b is completely healthy. What happens to dep-b's calls?",
      choices: [
        {
          id: "reject",
          label: "They get rejected too — the stuck dep-a calls hold every slot",
        },
        {
          id: "fine",
          label: "They keep succeeding — dep-b is healthy, so its calls are fine",
        },
        {
          id: "slow",
          label: "They succeed but slowly, sharing dep-a's degraded speed",
        },
      ],
      correctChoiceId: "reject",
      explain:
        "A slot is held for the whole time its call is waiting, so a dependency that answers slowly holds its slots longer. With one shared pool, the stuck dep-a calls occupy every slot, and a healthy dep-b call arriving to a full pool is refused at the door — rejected for want of a slot it had every right to expect. The failure crossed a boundary that was never meant to exist: dep-b's availability is now hostage to dep-a's latency. That is the bulkhead's whole reason to exist — partition the pool and dep-a can only ever exhaust its own half.",
    },
  ],

  meters: [
    {
      metricKey: "servedB",
      label: "dep-b throughput",
      kind: "counter",
      unit: " req/s",
      decimals: 1,
    },
    {
      metricKey: "rejectedB",
      label: "dep-b rejected",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "poolA",
      label: "slots held by dep-a",
      kind: "bar",
      max: 12,
      dangerAbove: 8,
    },
    {
      metricKey: "util",
      label: "pool utilisation",
      kind: "gauge",
      max: 100,
      unit: "%",
      decimals: 0,
    },
    {
      metricKey: "rejected",
      label: "rejected (all)",
      kind: "counter",
      dangerAbove: 0,
    },
  ],

  packetLegend: [
    { type: "request", label: "call holding a slot" },
    { type: "response", label: "answer" },
    { type: "limited", label: "rejected — no free slot" },
  ],
};
