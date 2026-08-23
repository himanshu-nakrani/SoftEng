import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaRate,
  isAlive,
  killNode,
  recordSample,
  shouldSpawn,
  spawnPacket,
  type ServiceQueue,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * Lesson 3 — Load Balancing.
 * Three strategies routing traffic to three servers — one of them (api-2) a
 * smaller instance. Round-robin drowns it; least-connections adapts.
 * A scripted death at t=12 shows the health-check detection window: the LB
 * keeps routing to a dead server until its checks notice (~1.5s).
 *
 * Two prediction checkpoints, one per idea: t=7.05 tests capacity-blindness
 * (api-2's chip reads 4 while its siblings read 0), t=11.5 tests the in-flight
 * requests the death is about to strand.
 */

const SERVERS = ["s1", "s2", "s3"] as const;
type ServerId = (typeof SERVERS)[number];

interface LBState {
  servers: Record<ServerId, ServiceQueue>;
  rr: number;
  /** LB's belief about liveness — lags reality by the health-check window. */
  believedAlive: Record<ServerId, boolean>;
  checkTimer: Record<ServerId, number>;
  droppedTotal: number;
  throughput: number;
  /** Time banked toward the next latency sample (see LATENCY_SAMPLE). */
  sampleAcc: number;
}

// api-2 is deliberately a smaller instance.
const CAPACITY: Record<ServerId, number> = { s1: 8, s2: 4, s3: 8 };
const MAX_QUEUE = 10;
const HEALTH_CHECK_DELAY = 1.5; // seconds before the LB notices a death
/**
 * Sim-seconds between latency samples. The meter draws the last ~80, so this
 * cadence buys a ~20s window — long enough to hold the whole arc (round-robin
 * sawtooth → least-conn flattening → the failover spike) in one trace. Sampling
 * every tick would show under 3 seconds of it.
 */
const LATENCY_SAMPLE = 0.25;

/** Outstanding work per server: queued + still on the wire toward it. */
function connections(state: SimState<LBState>, id: ServerId): number {
  let inFlight = 0;
  for (const p of state.packets) {
    if (p.edgeId === `to-${id}` && p.type === "request") inFlight += 1;
  }
  return state.lesson.servers[id].depth + inFlight;
}

function pickTarget(
  state: SimState<LBState>,
  strategy: string,
): ServerId | null {
  const L = state.lesson;
  const candidates = SERVERS.filter((id) => L.believedAlive[id]);
  if (candidates.length === 0) return null;
  if (strategy === "least-conn") {
    return candidates.reduce((best, id) =>
      connections(state, id) < connections(state, best) ? id : best,
    );
  }
  if (strategy === "random") {
    return candidates[Math.floor(state.rng() * candidates.length)];
  }
  // round-robin
  return candidates[L.rr++ % candidates.length];
}

export const loadBalancingSim: LessonSim<LBState> = {
  id: "load-balancing",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "traffic", x: 110, y: 225 },
      { id: "lb", kind: "loadbalancer", label: "lb-1", x: 340, y: 225 },
      { id: "s1", kind: "server", label: "api-1", x: 645, y: 100, breakable: true },
      { id: "s2", kind: "server", label: "api-2", x: 645, y: 225, breakable: true },
      { id: "s3", kind: "server", label: "api-3", x: 645, y: 350, breakable: true },
    ],
    edges: [
      { id: "in", from: "client", to: "lb" },
      { id: "to-s1", from: "lb", to: "s1", curve: -0.1 },
      { id: "to-s2", from: "lb", to: "s2" },
      { id: "to-s3", from: "lb", to: "s3", curve: 0.1 },
    ],
  },

  params: [
    {
      key: "strategy",
      label: "strategy",
      kind: "select",
      options: [
        { value: "round-robin", label: "round-robin" },
        { value: "least-conn", label: "least-conn" },
        { value: "random", label: "random" },
      ],
      defaultValue: "round-robin",
    },
    {
      key: "rate",
      label: "arrival rate",
      kind: "slider",
      min: 3,
      max: 24,
      step: 1,
      unit: " req/s",
      defaultValue: 12,
    },
  ],

  init: () => ({
    servers: {
      s1: { depth: 0, acc: 0 },
      s2: { depth: 0, acc: 0 },
      s3: { depth: 0, acc: 0 },
    },
    rr: 0,
    believedAlive: { s1: true, s2: true, s3: true },
    checkTimer: { s1: 0, s2: 0, s3: 0 },
    droppedTotal: 0,
    throughput: 0,
    sampleAcc: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;

    // 0. Health checks: the LB's belief lags reality.
    for (const id of SERVERS) {
      const actuallyAlive = isAlive(state, id);
      if (actuallyAlive === L.believedAlive[id]) {
        L.checkTimer[id] = 0;
      } else {
        L.checkTimer[id] += dt;
        if (L.checkTimer[id] >= HEALTH_CHECK_DELAY) {
          L.believedAlive[id] = actuallyAlive;
          L.checkTimer[id] = 0;
        }
      }
    }

    // 1. Client → LB arrivals.
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      spawnPacket(state, "in", "request", { speed: 1.6 });
    }

    // 2. Deliveries.
    let completedNow = 0;
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in") {
        if (p.type === "request") {
          // Arrived at the LB — route it.
          const target = pickTarget(state, String(params.strategy));
          if (target === null) {
            L.droppedTotal += 1;
            bounceDrop(state, "in");
          } else {
            spawnPacket(state, `to-${target}`, "request", {
              speed: 1.4,
              payload: p.payload,
            });
          }
        }
        // response/drop reaching the client: done.
        if (p.type === "response") completedNow += 1;
      } else {
        const serverId = p.edgeId.slice(3) as ServerId; // "to-s1" → "s1"
        if (p.type === "request") {
          const server = L.servers[serverId];
          if (!isAlive(state, serverId)) {
            // In-flight into a corpse: the error burst.
            L.droppedTotal += 1;
            bounceDrop(state, p.edgeId);
          } else if (server.depth >= MAX_QUEUE) {
            L.droppedTotal += 1;
            bounceDrop(state, p.edgeId);
          } else {
            server.depth += 1;
          }
        } else if (p.type === "response") {
          // Response reached the LB — forward to the client.
          spawnPacket(state, "in", "response", { speed: 1.6, reverse: true });
        }
      }
    }

    // 3. Service.
    for (const id of SERVERS) {
      const server = L.servers[id];
      if (!isAlive(state, id)) {
        server.depth = 0;
        continue;
      }
      drainQueue(server, CAPACITY[id], dt, () => {
        spawnPacket(state, `to-${id}`, "response", { speed: 1.4, reverse: true });
      });
      state.nodes[id].load = approach(
        state.nodes[id].load,
        clamp01(server.depth / MAX_QUEUE),
        6,
        dt,
      );
      state.nodes[id].queueDepth = server.depth;
    }

    // 4. Readouts.
    L.throughput = emaRate(L.throughput, completedNow, dt);
    const aliveIds = SERVERS.filter((id) => isAlive(state, id));
    const avgWait =
      aliveIds.length > 0
        ? aliveIds.reduce(
            (acc, id) => acc + L.servers[id].depth / CAPACITY[id],
            0,
          ) / aliveIds.length
        : 4;
    state.metrics.throughput = L.throughput;
    state.metrics.latency = 120 + avgWait * 1000;
    state.metrics.dropped = L.droppedTotal;

    // The latency *shape* is the argument this lesson makes, so trace it.
    L.sampleAcc += dt;
    if (L.sampleAcc >= LATENCY_SAMPLE) {
      L.sampleAcc -= LATENCY_SAMPLE;
      recordSample(state, "latency", state.metrics.latency);
    }
  },

  timeline: [
    {
      at: 2,
      caption: "The balancer splits traffic three ways. Watch the load bars.",
    },
    {
      at: 6,
      // Sets the premise the t=7.05 checkpoint asks about — deliberately stops
      // short of naming the consequence, which is the learner's to predict.
      caption:
        "api-2 is a smaller instance — half the capacity of its siblings. Round-robin gives it an equal share anyway.",
    },
    {
      at: 9,
      caption: "Switch to LEAST-CONN and watch the queues even out.",
    },
    {
      at: 12,
      caption: "☠ api-3 just died. The health checks take a beat to notice…",
      apply: (s) => killNode(s, "s3"),
    },
    {
      at: 17,
      caption:
        "Detected. Traffic now flows around the corpse. Click api-3 to revive it.",
    },
  ],

  quiz: [
    {
      // t=7.05 lands on the tick where api-2's chip reads 4 and both siblings
      // read 0 (seed 42, round-robin, 12 req/s) — the premise is on screen as
      // the question is asked. Kept ~4.5s clear of the t=11.5 checkpoint.
      id: "lb-uneven-capacity",
      at: 7.05,
      question:
        "api-2 is half the size of its siblings, but round-robin hands all three an equal share. What happens to api-2's queue from here?",
      choices: [
        {
          id: "grows",
          label: "It keeps backing up while the other two sit at zero",
        },
        {
          id: "evens",
          label: "It evens out — the LB notices the queue and eases off",
        },
        {
          id: "spread",
          label: "Nothing much — the backlog spreads across all three",
        },
      ],
      correctChoiceId: "grows",
      explain:
        "Round-robin counts requests, not capacity. api-2 is handed a third of the traffic and can serve about half of what api-1 and api-3 can, so the surplus has nowhere to go but its queue — and nothing in the strategy can ever notice, because round-robin has no feedback at all. LEAST-CONN is the fix: it routes on outstanding work, so the small machine simply gets asked less often. Switch to it and watch the chip drain.",
    },
    {
      id: "lb-inflight",
      at: 11.5,
      question:
        "api-3 is about to die. What happens to requests already routed to it — and to those routed in the moment before the LB's health checks notice?",
      choices: [
        { id: "lost", label: "They're lost — expect a brief error burst" },
        { id: "recall", label: "The LB recalls them mid-flight and re-routes" },
        { id: "wait", label: "They queue up and wait for api-3 to return" },
      ],
      correctChoiceId: "lost",
      explain:
        "A request on the wire can't be recalled — and until a health check fails, the LB keeps believing api-3 is fine and keeps sending more. That detection window is why failovers always leak a small error burst, and why retry logic exists.",
    },
  ],

  meters: [
    {
      metricKey: "throughput",
      label: "throughput",
      kind: "counter",
      unit: "req/s",
    },
    {
      metricKey: "latency",
      label: "p50 latency",
      kind: "sparkline",
      unit: "ms",
      dangerAbove: 1500,
    },
    {
      metricKey: "dropped",
      label: "dropped",
      kind: "counter",
      dangerAbove: 0,
    },
  ],
};
