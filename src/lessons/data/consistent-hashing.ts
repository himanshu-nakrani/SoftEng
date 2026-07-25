import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  isAlive,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 7 — Consistent Hashing. The ring that fixes lesson 6's disaster.
 * Cache nodes sit at fixed positions on a circle; each key belongs to the
 * first node clockwise from its hash. Add or kill a node and ONLY the
 * neighbouring arc's keys move — contrast with %N's ~75%.
 *
 * Everything the ring overlay draws (arcs, key ticks, dead-node folds) is
 * derived from the pure helpers exported here, so the picture and the routing
 * can never disagree: same hash, same positions, same owner.
 */

export const RING_CX = 470;
export const RING_CY = 225;
export const RING_R = 150;

export const RING_NODE_IDS = ["n1", "n2", "n3", "n4"] as const;
export type RingNodeId = (typeof RING_NODE_IDS)[number];

/** Keys hashed onto the ring — the ticks the overlay draws. */
export const KEYSPACE = 24;

/** Ring positions (fraction of the circle) each cache is provisioned at. */
const RING_POS: Record<string, number> = {
  n1: 0.05,
  n2: 0.3,
  n3: 0.62,
  n4: 0.85,
};

/** Ring points per physical node once VNODES is on. */
const VNODE_REPLICAS = 3;

export function ringPoint(fraction: number, r = RING_R) {
  const angle = fraction * Math.PI * 2 - Math.PI / 2; // 12 o'clock = 0
  return {
    x: RING_CX + Math.cos(angle) * r,
    y: RING_CY + Math.sin(angle) * r,
  };
}

/**
 * Knuth multiplicative hash → a fraction of the ring. Deterministic and
 * allocation-free, and deliberately NOT drawn from `state.rng`: placement has
 * to stay pure so a seeded run consumes exactly the same random draws per tick
 * whether virtual nodes are on or off.
 */
function hashFraction(n: number): number {
  let h = n * 2654435761;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Deterministic key position on the ring. */
export function keyFraction(key: number): number {
  return hashFraction(key);
}

/**
 * Ring positions of a physical node, memoised per mode.
 *
 * VNODES off: the one provisioned point (where the node's box is drawn).
 * VNODES on: that point plus two more hashed from (node index, replica) with
 * the same hash the keys use — a real cluster hashes `"cache-2#7"`; here the
 * replica seeds are picked so the demo reads clearly at 2–4 nodes.
 */
const POSITIONS: Record<"one" | "many", Record<string, number[]>> = {
  one: Object.fromEntries(RING_NODE_IDS.map((id) => [id, [RING_POS[id]]])),
  many: Object.fromEntries(
    RING_NODE_IDS.map((id, i) => {
      const points = [RING_POS[id]];
      for (let r = 1; r < VNODE_REPLICAS; r++) {
        points.push(hashFraction(3 + i * 53 + r * 7));
      }
      return [id, points];
    }),
  ),
};

export function ringPositions(id: string, vnodes: boolean): readonly number[] {
  return POSITIONS[vnodes ? "many" : "one"][id] ?? [];
}

/** One owner's slice of the ring: the keys in `(from, to]` walking clockwise. */
export interface RingArc {
  owner: string;
  from: number;
  to: number;
  /** Fraction of the circle covered; 1 when a single point owns everything. */
  span: number;
}

/**
 * The ownership arcs of a live cluster, one per ring position. A dead or
 * unprovisioned node is simply absent from `active`, so its arc disappears and
 * its clockwise successor's arc grows over it — the fold the overlay draws.
 */
export function ownershipArcs(
  active: readonly string[],
  vnodes: boolean,
): RingArc[] {
  const points: { owner: string; at: number }[] = [];
  for (const id of active) {
    for (const at of ringPositions(id, vnodes)) points.push({ owner: id, at });
  }
  if (points.length === 0) return [];
  points.sort((a, b) => a.at - b.at);
  if (points.length === 1) {
    const only = points[0];
    return [{ owner: only.owner, from: only.at, to: only.at, span: 1 }];
  }
  return points.map((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length];
    return {
      owner: p.owner,
      from: prev.at,
      to: p.at,
      span: (p.at - prev.at + 1) % 1,
    };
  });
}

/** Owner of a key = first active ring position clockwise from the key. */
export function ownerOf(
  key: number,
  active: readonly string[],
  vnodes: boolean,
): string | null {
  const kf = keyFraction(key);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const id of active) {
    for (const at of ringPositions(id, vnodes)) {
      const dist = (at - kf + 1) % 1;
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    }
  }
  return best;
}

interface CHState {
  /** False until the first tick has adopted the starting placement. */
  primed: boolean;
  prevActive: string[];
  prevVnodes: boolean;
  remappedPct: number;
  /** Bitmask of RING_NODE_IDS indices that gained keys on the last change. */
  movedMask: number;
  /** Sim-time of the last membership/placement change (overlay flash clock). */
  remapAt: number;
}

function activeNodes(count: number, dead: Set<string>): string[] {
  return RING_NODE_IDS.slice(0, count).filter((id) => !dead.has(id));
}

const nodeCoords = Object.fromEntries(
  RING_NODE_IDS.map((id) => [id, ringPoint(RING_POS[id])]),
) as Record<string, { x: number; y: number }>;

export const consistentHashingSim: LessonSim<CHState> = {
  id: "consistent-hashing",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "app", x: 110, y: 225 },
      ...RING_NODE_IDS.map((id, i) => ({
        id,
        kind: "cache" as const,
        label: `cache-${i + 1}`,
        x: Math.round(nodeCoords[id].x),
        y: Math.round(nodeCoords[id].y),
        breakable: true,
      })),
    ],
    edges: RING_NODE_IDS.map((id) => ({
      id: `to-${id}`,
      from: "client",
      to: id,
      curve: id === "n2" || id === "n3" ? 0.08 : -0.08,
    })),
  },

  params: [
    {
      key: "nodes",
      label: "ring nodes",
      kind: "slider",
      min: 2,
      max: 4,
      step: 1,
      defaultValue: 3,
    },
    {
      key: "vnodes",
      label: "vnodes ×3",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "rate",
      label: "lookup rate",
      kind: "slider",
      min: 3,
      max: 20,
      step: 1,
      unit: " q/s",
      defaultValue: 10,
    },
  ],

  init: () => ({
    primed: false,
    prevActive: [],
    prevVnodes: false,
    remappedPct: 0,
    movedMask: 0,
    // Far enough in the past that nothing flashes on the first frame.
    remapAt: -99,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const count = Number(params.nodes);
    const vnodes = Boolean(params.vnodes);
    const dead = new Set(RING_NODE_IDS.filter((id) => !isAlive(state, id)));
    const active = activeNodes(count, dead);

    // Placement change — slider, kill/revive, or the VNODES toggle (re-placing
    // every node is itself a rebalance). Count the keys that changed hands and
    // remember WHO gained them, so the overlay can flash exactly those arcs.
    // The very first tick only adopts whatever it starts with: a run opened at
    // 4 nodes has not "remapped" anything yet.
    if (!L.primed) {
      L.primed = true;
      L.prevActive = active;
      L.prevVnodes = vnodes;
    } else if (
      active.join() !== L.prevActive.join() ||
      vnodes !== L.prevVnodes
    ) {
      let moved = 0;
      let mask = 0;
      for (let k = 0; k < KEYSPACE; k++) {
        const after = ownerOf(k, active, vnodes);
        if (after === ownerOf(k, L.prevActive, L.prevVnodes)) continue;
        moved += 1;
        const gainer = RING_NODE_IDS.indexOf(after as RingNodeId);
        if (gainer >= 0) mask |= 1 << gainer;
      }
      L.remappedPct = (moved / KEYSPACE) * 100;
      L.movedMask = mask;
      L.remapAt = state.t;
      L.prevActive = active;
      L.prevVnodes = vnodes;
    }

    // Who owns what right now: one pass over the keyspace.
    const owned: Record<string, number> = {};
    for (const id of RING_NODE_IDS) owned[id] = 0;
    for (let k = 0; k < KEYSPACE; k++) {
      const owner = ownerOf(k, active, vnodes);
      if (owner) owned[owner] += 1;
    }

    // Ghost unprovisioned nodes; chips = keys owned.
    for (let i = 0; i < RING_NODE_IDS.length; i++) {
      const id = RING_NODE_IDS[i];
      state.nodes[id].ghost = i >= count;
      state.nodes[id].queueDepth =
        state.nodes[id].ghost || dead.has(id) ? 0 : owned[id];
    }

    // Lumpiness, as a number: the gap between the fattest and thinnest share.
    let widest = 0;
    let thinnest = KEYSPACE;
    for (const id of active) {
      widest = Math.max(widest, owned[id]);
      thinnest = Math.min(thinnest, owned[id]);
    }
    const spread = active.length > 0 ? ((widest - thinnest) / KEYSPACE) * 100 : 0;

    // Lookups route to each key's ring owner.
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      const key = Math.floor(state.rng() * KEYSPACE);
      const owner = ownerOf(key, active, vnodes);
      if (owner) {
        spawnPacket(state, `to-${owner}`, "request", {
          speed: 1.5,
          payload: { key },
        });
      }
    }

    for (const p of advancePackets(state, dt)) {
      if (p.type === "request") {
        const id = p.edgeId.slice(3);
        if (!isAlive(state, id) || state.nodes[id].ghost) {
          bounceDrop(state, p.edgeId);
        } else {
          state.nodes[id].load = clamp01(state.nodes[id].load + 0.15);
          spawnPacket(state, p.edgeId, "hit", { speed: 1.5, reverse: true });
        }
      }
    }

    for (const id of RING_NODE_IDS) {
      state.nodes[id].load = approach(state.nodes[id].load, 0, 0.8, dt);
    }

    state.metrics.remapped = L.remappedPct;
    state.metrics.nodes = active.length;
    state.metrics.spread = spread;
    // Overlay-only channel: params never reach the snapshot, and the flash
    // needs sim-time (never wall time) so pause/step/speed stay honest.
    state.metrics.vnodes = vnodes ? 1 : 0;
    state.metrics.remapAt = L.remapAt;
    state.metrics.movedMask = L.movedMask;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Each cache owns the arc that ends at it — every key from the previous node clockwise.",
    },
    {
      at: 9,
      caption:
        "Drag RING NODES 3 → 4 and check REMAPPED. Then remember lesson 6's number.",
    },
    {
      at: 16,
      caption:
        "☠ Kill a node — only its arc's keys migrate to the next neighbour.",
    },
    {
      at: 21,
      when: (_state, params) => !params.vnodes,
      caption:
        "Arcs still lumpy? Flip VNODES: three ring points per cache instead of one.",
    },
    // Gated beats: they wait for the learner, however long that takes.
    {
      at: 0,
      when: (state) => RING_NODE_IDS.some((id) => !isAlive(state, id)),
      caption:
        "☠ Only the dead node's arc remapped — its keys walked clockwise to the next node. Lesson 6 moved ~75%.",
    },
    {
      at: 0,
      when: (_state, params) => Boolean(params.vnodes),
      caption:
        "Every cache now claims three arcs scattered around the ring — watch ARC SPREAD collapse.",
    },
  ],

  quiz: [
    {
      id: "ring-remap",
      at: 13,
      // Only ask while there is still a node left to add.
      when: (_state, params) => Number(params.nodes) < 4,
      question:
        "Same growth as last lesson — one new node joins the ring. Roughly what fraction of keys move now?",
      choices: [
        { id: "some", label: "~25% — only the arc the new node claims" },
        { id: "most", label: "~75% — same as hash % N" },
        { id: "all", label: "100% — the ring reshuffles completely" },
      ],
      correctChoiceId: "some",
      explain:
        "A new node claims exactly one arc: the keys between it and its predecessor. Everyone else's mapping is untouched — ~1/N of keys move instead of ~all of them. That single property is why Dynamo, Cassandra, and every serious cache cluster route on a ring.",
    },
  ],

  meters: [
    {
      metricKey: "nodes",
      label: "ring nodes",
      kind: "counter",
    },
    {
      metricKey: "remapped",
      label: "keys remapped on last change",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerAbove: 40,
    },
    {
      metricKey: "spread",
      label: "arc spread",
      kind: "gauge",
      max: 50,
      unit: "%",
      dangerAbove: 12,
    },
  ],
};
