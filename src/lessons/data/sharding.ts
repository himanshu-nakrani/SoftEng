import {
  advancePackets,
  approach,
  clamp01,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 6 — Sharding. Keys route to shards by hash(key) % N.
 * The REMAPPED meter is the star: change N and watch what fraction of the
 * keyspace changes owner. (Spoiler: nearly all of it — lesson 7 fixes this.)
 */

const SHARDS = ["s0", "s1", "s2", "s3"] as const;
const KEYSPACE = 48;

interface ShardingState {
  prevN: number;
  remappedPct: number;
  perShard: Record<string, number>; // smoothed traffic share
}

/** murmur3 finalizer — proper avalanche so % N behaves like real hashing. */
function hashKey(key: number): number {
  let h = key >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export const shardingSim: LessonSim<ShardingState> = {
  id: "sharding",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "app", x: 120, y: 225 },
      { id: "router", kind: "loadbalancer", label: "router", x: 340, y: 225 },
      { id: "s0", kind: "shard", label: "shard-0", x: 645, y: 75 },
      { id: "s1", kind: "shard", label: "shard-1", x: 645, y: 175 },
      { id: "s2", kind: "shard", label: "shard-2", x: 645, y: 275 },
      { id: "s3", kind: "shard", label: "shard-3", x: 645, y: 375 },
    ],
    edges: [
      { id: "in", from: "client", to: "router" },
      { id: "to-s0", from: "router", to: "s0", curve: -0.12 },
      { id: "to-s1", from: "router", to: "s1", curve: -0.05 },
      { id: "to-s2", from: "router", to: "s2", curve: 0.05 },
      { id: "to-s3", from: "router", to: "s3", curve: 0.12 },
    ],
  },

  params: [
    {
      key: "shards",
      label: "shards",
      kind: "slider",
      min: 2,
      max: 4,
      step: 1,
      defaultValue: 3,
    },
    {
      key: "rate",
      label: "query rate",
      kind: "slider",
      min: 3,
      max: 20,
      step: 1,
      unit: " q/s",
      defaultValue: 10,
    },
  ],

  init: () => ({
    prevN: 3,
    remappedPct: 0,
    perShard: { s0: 0, s1: 0, s2: 0, s3: 0 },
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const n = Number(params.shards);

    // Detect a reshard: recompute how much of the keyspace changed owner.
    if (n !== L.prevN) {
      let moved = 0;
      for (let k = 0; k < KEYSPACE; k++) {
        if (hashKey(k) % n !== hashKey(k) % L.prevN) moved += 1;
      }
      L.remappedPct = (moved / KEYSPACE) * 100;
      L.prevN = n;
    }

    // Ghost the unprovisioned shards; chip = how many keys each shard owns.
    for (let i = 0; i < SHARDS.length; i++) {
      const id = SHARDS[i];
      state.nodes[id].ghost = i >= n;
      let owned = 0;
      for (let k = 0; k < KEYSPACE; k++) {
        if (hashKey(k) % n === i) owned += 1;
      }
      state.nodes[id].queueDepth = i < n ? owned : 0;
    }

    // Queries arrive with keys; router sends each to hash(key) % n.
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      const key = Math.floor(state.rng() * KEYSPACE);
      spawnPacket(state, "in", "request", { speed: 1.7, payload: { key } });
    }

    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in" && p.type === "request") {
        const key = Number(p.payload?.key ?? 0);
        const target = SHARDS[hashKey(key) % n];
        spawnPacket(state, `to-${target}`, "request", {
          speed: 1.5,
          payload: { key },
        });
      } else if (p.type === "request") {
        // Arrived at a shard: answer.
        const id = p.edgeId.slice(3);
        L.perShard[id] = approach(L.perShard[id], 1, 1.5, 1);
        spawnPacket(state, p.edgeId, "response", { speed: 1.5, reverse: true });
      } else if (p.type === "response" && p.edgeId !== "in") {
        spawnPacket(state, "in", "response", { speed: 1.7, reverse: true });
      }
    }

    for (const id of SHARDS) {
      L.perShard[id] = approach(L.perShard[id], 0, 0.4, dt);
      state.nodes[id].load = clamp01(L.perShard[id]);
    }

    state.metrics.remapped = L.remappedPct;
    state.metrics.shards = n;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Each query's key hashes to a shard: hash(key) % 3. The chips show keys owned.",
    },
    {
      at: 8,
      caption:
        "Every shard holds only its slice — that's the point. Now the trap…",
    },
    {
      at: 15,
      caption:
        "💥 Drag SHARDS from 3 to 4 and read the REMAPPED meter. Nearly everything moved.",
    },
  ],

  quiz: [
    {
      id: "mod-remap",
      at: 12,
      question:
        "You're about to grow from 3 shards to 4, routing with hash(key) % N. What fraction of ALL keys will change shards?",
      choices: [
        { id: "quarter", label: "About 25% — just enough to fill the new shard" },
        { id: "most", label: "About 75% — nearly the whole keyspace moves" },
        { id: "none", label: "0% — existing keys keep their shard" },
      ],
      correctChoiceId: "most",
      explain:
        "Changing the modulus changes almost every key's answer: a key stays only when hash % 3 == hash % 4, which is true for roughly 1 key in 4. In production that ~75% remap means a massive data migration — the disaster consistent hashing was invented to avoid.",
    },
  ],

  meters: [
    {
      metricKey: "shards",
      label: "shards",
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
