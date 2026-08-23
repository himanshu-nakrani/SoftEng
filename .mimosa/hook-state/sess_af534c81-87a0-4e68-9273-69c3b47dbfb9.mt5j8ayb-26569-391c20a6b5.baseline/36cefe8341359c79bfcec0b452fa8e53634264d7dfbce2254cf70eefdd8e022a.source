import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaRate,
  isAlive,
  recordSample,
  shouldSpawn,
  spawnPacket,
  type ServiceQueue,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * Lesson — Autoscaling.
 *
 * A fleet of six boxes behind one balancer: two running, four dashed ghosts
 * that are capacity you have not paid for yet. A control loop watches the same
 * average load bar the learner watches, and when it breaches the scale-up line
 * it PROVISIONS a ghost — which then sits there booting for `lag` sim-seconds,
 * taking no traffic at all, before it joins the rotation.
 *
 * The arc is the whole argument (seed 42, default params):
 *   observe   — the ramp (t=1.5 → 5). The breach is detected at t≈6.6, the box
 *               lands at t≈11.6, and nothing ever queues: zero drops.
 *   manipulate— thresholds and cooldown. Squeeze the two lines together with no
 *               cooldown and the fleet oscillates; a `when`-gated caption names
 *               it the moment it happens.
 *   break     — the cliff (t=15.5): demand steps from 12.5 to 35 req/s. The
 *               loop reacts within ~2.5s and is still useless for `lag`
 *               seconds after that: queues fill (t≈17.7), drops accumulate,
 *               and the boots land one at a time (t≈23, 23.7, 28) until the
 *               fleet finally covers it.
 *
 * The lag is the villain, and it is the only thing on the stage the autoscaler
 * cannot shorten by trying harder.
 */

const SERVERS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;
type ServerId = (typeof SERVERS)[number];

/** Requests/second one box can serve. */
const CAPACITY = 8;
/** Per-server queue before it starts shedding. Small on purpose: the gap has
 *  to become visible drops inside a few seconds, not a few minutes. */
const MAX_QUEUE = 5;
/** The two boxes you always pay for; scale-in never goes below this. */
const MIN_FLEET = 2;
/** Sim-seconds between simultaneous launches — a real fleet never gets its
 *  instances back at the same instant, and staggered landings read better. */
const LAUNCH_STAGGER = 0.7;
/** Sim-seconds a breach must persist before the loop acts (anti-noise). */
const BREACH_SUSTAIN = 1;
/** Give up on a polite drain after this long and re-ghost the box anyway. */
const DRAIN_TIMEOUT = 4;
/** Sim-seconds between queue-depth samples for the sparkline (~30s window). */
const QUEUE_SAMPLE = 0.25;

const IN_SPEED = 2.6;
const FAN_SPEED = 2.4;

interface AutoscaleState {
  servers: Record<ServerId, ServiceQueue>;
  /** Paid for: in the fleet, in rotation once its boot finishes. */
  provisioned: Record<ServerId, boolean>;
  /** Sim-seconds of boot left, or null when the box is not booting. */
  booting: Record<ServerId, number | null>;
  /** Total boot time for the in-flight boot — the progress bar's denominator. */
  bootTotal: Record<ServerId, number>;
  /** Sim-seconds spent draining before hand-back, or null. */
  draining: Record<ServerId, number | null>;
  rr: number;

  /** Scripted traffic: `demand` walks toward `demandTarget` at `demandSlope`. */
  demand: number;
  demandTarget: number;
  /** Req/s per sim-second. 0 = step change (the cliff). */
  demandSlope: number;

  /** EMA of admitted requests/sec — the fleet's utilization signal. */
  arrivalRate: number;
  /** Mean load bar across the rotation: what the autoscaler decides on. */
  avgLoad: number;
  aboveFor: number;
  belowFor: number;
  cooldownLeft: number;

  droppedTotal: number;
  bootsFinished: number;
  scaleOuts: number;
  scaleIns: number;
  /** +1 scale-out, -1 scale-in, 0 = nothing yet. */
  lastAction: number;
  /** Direction changes between consecutive actions — the flapping counter. */
  flips: number;

  sampleAcc: number;
}

/** Booted, alive, not draining: the boxes the balancer is allowed to use. */
function inRotation(state: SimState<AutoscaleState>, id: ServerId): boolean {
  const L = state.lesson;
  return (
    L.provisioned[id] &&
    L.booting[id] === null &&
    L.draining[id] === null &&
    isAlive(state, id)
  );
}

function rotationOf(state: SimState<AutoscaleState>): ServerId[] {
  return SERVERS.filter((id) => inRotation(state, id));
}

function bootingCount(state: SimState<AutoscaleState>): number {
  return SERVERS.filter((id) => state.lesson.booting[id] !== null).length;
}

/** Requests still on the wire toward a box — a drain waits for these. */
function inFlightTo(state: SimState<AutoscaleState>, id: ServerId): number {
  let n = 0;
  for (const p of state.packets) {
    if (p.edgeId === `to-${id}` && p.type === "request" && !p.reverse) n += 1;
  }
  return n;
}

/** Hand a box back: dashed outline, no queue, no load, launchable again. */
function reghost(state: SimState<AutoscaleState>, id: ServerId): void {
  const L = state.lesson;
  L.provisioned[id] = false;
  L.draining[id] = null;
  L.booting[id] = null;
  L.servers[id] = { depth: 0, acc: 0 };
  const node = state.nodes[id];
  node.ghost = true;
  node.load = 0;
  node.queueDepth = undefined;
  node.meta = undefined;
}

const byId = <T,>(make: (id: ServerId) => T): Record<ServerId, T> =>
  Object.fromEntries(SERVERS.map((id) => [id, make(id)])) as Record<ServerId, T>;

export const autoscalingSim: LessonSim<AutoscaleState> = {
  id: "autoscaling",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "traffic", x: 96, y: 225 },
      { id: "lb", kind: "loadbalancer", label: "lb-1", x: 300, y: 225 },
      { id: "s1", kind: "server", label: "api-1", x: 620, y: 40, breakable: true },
      { id: "s2", kind: "server", label: "api-2", x: 620, y: 115, breakable: true },
      { id: "s3", kind: "server", label: "api-3", x: 620, y: 190, breakable: true },
      { id: "s4", kind: "server", label: "api-4", x: 620, y: 265, breakable: true },
      { id: "s5", kind: "server", label: "api-5", x: 620, y: 340, breakable: true },
      { id: "s6", kind: "server", label: "api-6", x: 620, y: 415, breakable: true },
    ],
    edges: [
      { id: "in", from: "client", to: "lb" },
      { id: "to-s1", from: "lb", to: "s1", curve: -0.14 },
      { id: "to-s2", from: "lb", to: "s2", curve: -0.09 },
      { id: "to-s3", from: "lb", to: "s3", curve: -0.04 },
      { id: "to-s4", from: "lb", to: "s4", curve: 0.04 },
      { id: "to-s5", from: "lb", to: "s5", curve: 0.09 },
      { id: "to-s6", from: "lb", to: "s6", curve: 0.14 },
    ],
  },

  params: [
    {
      key: "scaleUp",
      label: "scale-out above",
      kind: "slider",
      min: 30,
      max: 95,
      step: 5,
      unit: "%",
      defaultValue: 65,
    },
    {
      key: "scaleDown",
      label: "scale-in below",
      kind: "slider",
      min: 10,
      max: 80,
      step: 5,
      unit: "%",
      defaultValue: 30,
    },
    {
      key: "lag",
      label: "provisioning lag",
      kind: "slider",
      min: 5,
      max: 60,
      step: 1,
      unit: "s",
      defaultValue: 5,
    },
    {
      key: "cooldown",
      label: "cooldown",
      kind: "slider",
      min: 0,
      max: 20,
      step: 1,
      unit: "s",
      defaultValue: 4,
    },
  ],

  initialNodes: {
    s3: { ghost: true },
    s4: { ghost: true },
    s5: { ghost: true },
    s6: { ghost: true },
  },

  init: () => ({
    servers: byId(() => ({ depth: 0, acc: 0 })),
    provisioned: byId((id) => id === "s1" || id === "s2"),
    booting: byId(() => null),
    bootTotal: byId(() => 0),
    draining: byId(() => null),
    rr: 0,

    demand: 8,
    demandTarget: 8,
    demandSlope: 0,

    arrivalRate: 8,
    avgLoad: 0.5,
    aboveFor: 0,
    belowFor: 0,
    cooldownLeft: 0,

    droppedTotal: 0,
    bootsFinished: 0,
    scaleOuts: 0,
    scaleIns: 0,
    lastAction: 0,
    flips: 0,

    sampleAcc: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const up = Number(params.scaleUp) / 100;
    const down = Number(params.scaleDown) / 100;
    const lag = Number(params.lag);
    const cooldown = Number(params.cooldown);

    /* 1. Scripted traffic. The timeline moves the target; demand walks. */
    if (L.demandSlope <= 0) {
      L.demand = L.demandTarget;
    } else if (L.demand < L.demandTarget) {
      L.demand = Math.min(L.demandTarget, L.demand + L.demandSlope * dt);
    } else if (L.demand > L.demandTarget) {
      L.demand = Math.max(L.demandTarget, L.demand - L.demandSlope * dt);
    }

    /* 2. Boot timers. A booting box stays a ghost and takes no traffic — the
          whole point of the lesson lives in these few lines. */
    for (const id of SERVERS) {
      const left = L.booting[id];
      if (left === null) continue;
      const next = left - dt;
      if (next <= 0) {
        L.booting[id] = null;
        L.provisioned[id] = true;
        L.servers[id] = { depth: 0, acc: 0 };
        L.bootsFinished += 1;
        const node = state.nodes[id];
        node.ghost = false;
        node.load = 0;
        node.queueDepth = 0;
        node.meta = undefined;
      } else {
        L.booting[id] = next;
        state.nodes[id].meta = {
          bootRemaining: next,
          bootTotal: L.bootTotal[id],
        };
      }
    }

    /* 3. Connection draining: no new traffic, finish what you have, then the
          box goes back to being a dashed outline. */
    for (const id of SERVERS) {
      const spent = L.draining[id];
      if (spent === null) continue;
      const elapsed = spent + dt;
      L.draining[id] = elapsed;
      const idle = L.servers[id].depth === 0 && inFlightTo(state, id) === 0;
      if (idle || elapsed >= DRAIN_TIMEOUT) {
        reghost(state, id);
      } else {
        state.nodes[id].meta = { draining: true };
      }
    }

    /* 4. Arrivals. */
    const spawns = shouldSpawn(state, L.demand, dt);
    for (let i = 0; i < spawns; i++) {
      spawnPacket(state, "in", "request", { speed: IN_SPEED });
    }

    /* 5. Deliveries. */
    const rotation = rotationOf(state);
    let admittedNow = 0;
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in") {
        if (p.type !== "request") continue; // response home: done
        if (rotation.length === 0) {
          L.droppedTotal += 1;
          bounceDrop(state, "in");
          continue;
        }
        const target = rotation[L.rr++ % rotation.length];
        spawnPacket(state, `to-${target}`, "request", { speed: FAN_SPEED });
        continue;
      }
      const id = p.edgeId.slice(3) as ServerId;
      if (p.type === "request") {
        const q = L.servers[id];
        const servable =
          L.provisioned[id] && L.booting[id] === null && isAlive(state, id);
        if (!servable || q.depth >= MAX_QUEUE) {
          L.droppedTotal += 1;
          bounceDrop(state, p.edgeId);
        } else {
          q.depth += 1;
          admittedNow += 1;
        }
      } else if (p.type === "response") {
        spawnPacket(state, "in", "response", { speed: IN_SPEED, reverse: true });
      }
    }

    /* 6. Service. Draining boxes keep serving; ghosts and booting boxes do not
          exist as far as work is concerned. */
    for (const id of SERVERS) {
      const q = L.servers[id];
      const node = state.nodes[id];
      if (!L.provisioned[id] || L.booting[id] !== null) {
        q.depth = 0;
        q.acc = 0;
        continue;
      }
      if (!isAlive(state, id)) {
        q.depth = 0;
        node.load = 0;
        node.queueDepth = 0;
        continue;
      }
      drainQueue(q, CAPACITY, dt, () => {
        spawnPacket(state, `to-${id}`, "response", {
          speed: FAN_SPEED,
          reverse: true,
        });
      });
      node.queueDepth = q.depth;
    }

    /* 7. The signal. Utilization is fleet-wide (round-robin spreads evenly, and
          a fleet-wide EMA is far steadier than six thin per-box ones); queue
          pressure is per-box, so a backed-up box still pins its own bar. */
    L.arrivalRate = emaRate(L.arrivalRate, admittedNow, dt, 0.4);
    const perBox = rotation.length > 0 ? L.arrivalRate / rotation.length : 0;
    const util = clamp01(perBox / CAPACITY);
    let loadSum = 0;
    for (const id of SERVERS) {
      const node = state.nodes[id];
      const pressure = clamp01(L.servers[id].depth / MAX_QUEUE);
      if (inRotation(state, id)) {
        node.load = approach(node.load, Math.max(util, pressure), 6, dt);
        loadSum += node.load;
      } else if (L.draining[id] !== null) {
        node.load = approach(node.load, pressure, 6, dt);
      }
    }
    const avgLoad = rotation.length > 0 ? loadSum / rotation.length : 1;
    L.avgLoad = avgLoad;

    /* 8. The control loop: measure → decide → provision → WAIT. */
    L.cooldownLeft = Math.max(0, L.cooldownLeft - dt);
    L.aboveFor = avgLoad > up ? L.aboveFor + dt : 0;
    L.belowFor = avgLoad < down ? L.belowFor + dt : 0;

    const booting = bootingCount(state);
    const draining = SERVERS.filter((id) => L.draining[id] !== null).length;
    // Everything already bought or being bought — what `desired` is measured
    // against, so a pending boot is never double-ordered.
    const effectiveFleet = rotation.length + booting + draining;
    const ghosts = SERVERS.filter(
      (id) => !L.provisioned[id] && L.booting[id] === null,
    );

    const record = (dir: number) => {
      if (L.lastAction !== 0 && L.lastAction !== dir) L.flips += 1;
      L.lastAction = dir;
      L.cooldownLeft = cooldown;
    };

    if (L.aboveFor >= BREACH_SUSTAIN && L.cooldownLeft <= 0 && ghosts.length) {
      // How many boxes would drag the average back down to the target line?
      // Saturated load reads 1.0 and no higher, so a fleet buried past its
      // capacity under-orders and has to come back for a second round.
      const want =
        rotation.length === 0
          ? effectiveFleet + 1
          : Math.ceil((rotation.length * avgLoad) / up);
      const desired = Math.min(SERVERS.length, Math.max(MIN_FLEET, want));
      const launches = Math.min(desired - effectiveFleet, ghosts.length);
      if (launches > 0) {
        for (let i = 0; i < launches; i++) {
          const id = ghosts[i];
          const total = lag + i * LAUNCH_STAGGER;
          L.booting[id] = total;
          L.bootTotal[id] = total;
          state.nodes[id].ghost = true;
          state.nodes[id].load = 0;
          state.nodes[id].meta = { bootRemaining: total, bootTotal: total };
        }
        L.scaleOuts += 1;
        L.aboveFor = 0;
        record(1);
      }
    } else if (
      // Scale-in wants the load *sustained* under the line for a whole
      // cooldown — set cooldown to 0 and this fires the instant it dips.
      L.belowFor >= Math.max(cooldown, BREACH_SUSTAIN) &&
      L.cooldownLeft <= 0 &&
      booting === 0 &&
      draining === 0 &&
      rotation.length > MIN_FLEET
    ) {
      const victim = rotation[rotation.length - 1]; // the newest box goes first
      L.draining[victim] = 0;
      state.nodes[victim].meta = { draining: true };
      L.scaleIns += 1;
      L.belowFor = 0;
      record(-1);
    }

    /* 9. Readouts. */
    let queued = 0;
    for (const id of SERVERS) queued += L.servers[id].depth;
    state.metrics.avgLoad = avgLoad * 100;
    state.metrics.capacity = rotation.length * CAPACITY;
    state.metrics.booting = booting;
    state.metrics.queued = queued;
    state.metrics.dropped = L.droppedTotal;
    state.metrics.demand = L.demand;

    L.sampleAcc += dt;
    if (L.sampleAcc >= QUEUE_SAMPLE) {
      L.sampleAcc -= QUEUE_SAMPLE;
      recordSample(state, "queued", queued);
    }
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Two boxes running, four dashed outlines — capacity you haven't paid for yet. Traffic is climbing, and the autoscaler watches the same load bars you do.",
      apply: (s) => {
        s.lesson.demandTarget = 12.5;
        s.lesson.demandSlope = 1.3;
      },
    },
    {
      at: 4,
      when: (s) => bootingCount(s) > 0,
      caption:
        "Above the line: api-3 is being provisioned. It boots for PROVISIONING LAG seconds and takes no traffic at all until it's up.",
    },
    {
      // The satisfying beat: the fleet grew before anything queued.
      at: 10,
      when: (s) => s.lesson.bootsFinished > 0 && s.lesson.droppedTotal === 0,
      caption:
        "It landed before the load did — nothing queued, nothing dropped. That's autoscaling absorbing a trend.",
    },
    {
      // Only fires for a learner who has squeezed the two lines together.
      at: 6,
      when: (s) => s.lesson.flips >= 2,
      caption:
        "Scale-out, scale-in, scale-out — you're paying boot time to oscillate. Widen the gap between the lines, or give it a cooldown.",
    },
    {
      at: 15.5,
      caption: "☠ The spike is here. The boots are not.",
      apply: (s) => {
        s.lesson.demandTarget = 35;
        s.lesson.demandSlope = 0; // step change: no ramp to ride
      },
    },
    {
      at: 17.5,
      when: (s) => s.lesson.droppedTotal > 0,
      caption:
        "Queues full, requests shedding — and the boxes it ordered are still booting. This is the provisioning gap.",
    },
    {
      at: 23,
      when: (s) =>
        s.metrics.capacity >= s.lesson.demand && s.lesson.droppedTotal > 0,
      caption:
        "Capacity landed and the queues drain. Everything shed during the gap is gone for good.",
    },
  ],

  quiz: [
    {
      // t=19 (seed 42, defaults): the spike has been on the servers for ~2.5s,
      // two boxes are visibly booting, every queue is at 14/15 and the drop
      // counter has just started moving. The premise is on screen; the shape of
      // what follows is the learner's to predict.
      id: "as-gap",
      at: 19,
      question:
        "The spike needs roughly double this fleet, and the autoscaler has already placed the order — you can watch the boxes booting. In production that boot is 30-odd seconds; here it's whatever PROVISIONING LAG says. What happens while you wait?",
      choices: [
        {
          id: "queue-then-drop",
          label: "Queues fill, and once they're full the overflow is dropped",
        },
        {
          id: "absorb",
          label: "Nothing much — the autoscaler reacted, so it's handled",
        },
        {
          id: "slow",
          label: "Everything just gets slower; no requests are actually lost",
        },
      ],
      correctChoiceId: "queue-then-drop",
      explain:
        "Ordering a server and having a server are separated by the provisioning lag, and during it your capacity is exactly what it was before the spike. The queues are the only buffer you own: they absorb the overflow until they're full, and after that every extra request is shed. Autoscaling absorbs TRENDS, not spikes — the ramp earlier worked because the load arrived slower than a boot. For spikes you need capacity that already exists (headroom, warm pools) or a buffer deep enough to hold the excess until the boots land — which is exactly the job of the queue from the message-queues lesson.",
    },
  ],

  meters: [
    {
      metricKey: "avgLoad",
      label: "avg load",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerAbove: 85,
    },
    {
      metricKey: "capacity",
      label: "live capacity",
      kind: "counter",
      unit: "req/s",
    },
    { metricKey: "booting", label: "booting", kind: "counter" },
    {
      metricKey: "queued",
      label: "queued",
      kind: "sparkline",
      dangerAbove: 8,
    },
    { metricKey: "dropped", label: "dropped", kind: "counter", dangerAbove: 0 },
  ],
};
