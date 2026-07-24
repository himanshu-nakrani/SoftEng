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
 */

export const RING_CX = 470;
export const RING_CY = 225;
export const RING_R = 150;

/** Ring positions (fraction of the circle) for the four cache nodes. */
const RING_POS: Record<string, number> = {
  n1: 0.05,
  n2: 0.3,
  n3: 0.62,
  n4: 0.85,
};
const NODE_IDS = ["n1", "n2", "n3", "n4"] as const;
const KEYSPACE = 24;

export function ringPoint(fraction: number, r = RING_R) {
  const angle = fraction * Math.PI * 2 - Math.PI / 2; // 12 o'clock = 0
  return {
    x: RING_CX + Math.cos(angle) * r,
    y: RING_CY + Math.sin(angle) * r,
  };
}

/** Deterministic key position on the ring. */
export function keyFraction(key: number): number {
  let h = key * 2654435761;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

interface CHState {
  prevActive: string[];
  remappedPct: number;
}

function activeNodes(count: number, dead: Set<string>): string[] {
  return NODE_IDS.slice(0, count).filter((id) => !dead.has(id));
}

/** Owner of a key = first active node clockwise from the key's position. */
function ownerOf(key: number, active: string[]): string | null {
  if (active.length === 0) return null;
  const kf = keyFraction(key);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const id of active) {
    const dist = (RING_POS[id] - kf + 1) % 1;
    if (dist < bestDist) {
      bestDist = dist;
      best = id;
    }
  }
  return best;
}

const nodeCoords = Object.fromEntries(
  NODE_IDS.map((id) => [id, ringPoint(RING_POS[id])]),
) as Record<string, { x: number; y: number }>;

export const consistentHashingSim: LessonSim<CHState> = {
  id: "consistent-hashing",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "app", x: 110, y: 225 },
      ...NODE_IDS.map((id, i) => ({
        id,
        kind: "cache" as const,
        label: `cache-${i + 1}`,
        x: Math.round(nodeCoords[id].x),
        y: Math.round(nodeCoords[id].y),
        breakable: true,
      })),
    ],
    edges: NODE_IDS.map((id) => ({
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
    prevActive: activeNodes(3, new Set()),
    remappedPct: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const count = Number(params.nodes);
    const dead = new Set(NODE_IDS.filter((id) => !isAlive(state, id)));
    const active = activeNodes(count, dead);

    // Membership change (slider OR kill/revive) → compute keys that moved.
    if (active.join() !== L.prevActive.join()) {
      let moved = 0;
      for (let k = 0; k < KEYSPACE; k++) {
        if (ownerOf(k, active) !== ownerOf(k, L.prevActive)) moved += 1;
      }
      L.remappedPct = (moved / KEYSPACE) * 100;
      L.prevActive = active;
    }

    // Ghost unprovisioned nodes; chips = keys owned.
    for (let i = 0; i < NODE_IDS.length; i++) {
      const id = NODE_IDS[i];
      state.nodes[id].ghost = i >= count;
      let owned = 0;
      for (let k = 0; k < KEYSPACE; k++) {
        if (ownerOf(k, active) === id) owned += 1;
      }
      state.nodes[id].queueDepth =
        state.nodes[id].ghost || dead.has(id) ? 0 : owned;
    }

    // Lookups route to each key's ring owner.
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      const key = Math.floor(state.rng() * KEYSPACE);
      const owner = ownerOf(key, active);
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

    for (const id of NODE_IDS) {
      state.nodes[id].load = approach(state.nodes[id].load, 0, 0.8, dt);
    }

    state.metrics.remapped = L.remappedPct;
    state.metrics.nodes = active.length;
  },

  timeline: [
    {
      at: 2,
      caption:
        "The nodes sit at fixed points on a ring. A key belongs to the next node clockwise.",
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
  ],

  quiz: [
    {
      id: "ring-remap",
      at: 13,
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
  ],
};
