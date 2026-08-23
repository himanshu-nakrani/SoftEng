import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  emaEvent,
  emaRate,
  isAlive,
  recordSample,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 6 — Sharding. Keys route to shards by hash(key) % N.
 *
 * Two lessons live in this one figure:
 *   1. REMAPPED — change N and watch what fraction of the keyspace changes
 *      owner. (Spoiler: nearly all of it. Lesson 7 fixes exactly this.)
 *   2. The dark slice — kill a shard and its keys do NOT move somewhere else.
 *      % N gave every key exactly one owner, so a dead owner means that whole
 *      slice of the keyspace answers with errors until it comes back.
 *
 * The figure's keyspace strip derives its colors from `shardIndexForKey`, the
 * same pure function the router uses here — the strip is never a re-telling of
 * the routing rule, it *is* the routing rule.
 */

/** Shard node ids in shard-index order: index i owns keys with hash % N === i. */
export const SHARD_IDS = ["s0", "s1", "s2", "s3"] as const;

/** Keys in the (toy) keyspace — one strip slot per key in the figure. */
export const KEYSPACE = 48;

interface ShardingState {
  prevN: number;
  remappedPct: number;
  /** Smoothed 0..1 activity per shard — drives the in-node load bars. */
  perShard: Record<string, number>;
  /** Smoothed queries/sec per shard — drives the hot-shard readout. */
  shardRate: Record<string, number>;
  /** Busiest live shard ÷ average live shard. 1.0 = perfectly even. */
  skew: number;
  throughput: number;
  droppedTotal: number;
}

/** murmur3 finalizer — proper avalanche so % N behaves like real hashing. */
export function hashKey(key: number): number {
  let h = key >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The routing rule, and the whole lesson: which shard index owns `key` when
 * there are `n` shards. Pure — the figure's keyspace strip colors its slots
 * with this exact call, so the strip can never drift from the router.
 */
export function shardIndexForKey(key: number, n: number): number {
  return hashKey(key) % Math.max(1, n);
}

/** How many of the KEYSPACE keys change owner going from `from` shards to `to`. */
function movedKeys(from: number, to: number): number {
  let moved = 0;
  for (let k = 0; k < KEYSPACE; k++) {
    if (shardIndexForKey(k, to) !== shardIndexForKey(k, from)) moved += 1;
  }
  return moved;
}

/** How many keys shard `index` owns at `n` shards (the node's count chip). */
function keysOwnedBy(index: number, n: number): number {
  let owned = 0;
  for (let k = 0; k < KEYSPACE; k++) {
    if (shardIndexForKey(k, n) === index) owned += 1;
  }
  return owned;
}

export const shardingSim: LessonSim<ShardingState> = {
  id: "sharding",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "app", x: 120, y: 225 },
      { id: "router", kind: "loadbalancer", label: "router", x: 340, y: 225 },
      // Every shard is killable: a dead shard is the point, not an accident.
      { id: "s0", kind: "shard", label: "shard-0", x: 645, y: 75, breakable: true },
      { id: "s1", kind: "shard", label: "shard-1", x: 645, y: 175, breakable: true },
      { id: "s2", kind: "shard", label: "shard-2", x: 645, y: 275, breakable: true },
      { id: "s3", kind: "shard", label: "shard-3", x: 645, y: 375, breakable: true },
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
    shardRate: { s0: 0, s1: 0, s2: 0, s3: 0 },
    skew: 1,
    throughput: 0,
    droppedTotal: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const n = Number(params.shards);

    // Detect a reshard: recompute how much of the keyspace changed owner.
    if (n !== L.prevN) {
      L.remappedPct = (movedKeys(L.prevN, n) / KEYSPACE) * 100;
      L.prevN = n;
    }

    // Ghost the unprovisioned shards; chip = how many keys each shard owns.
    // A *dead* shard keeps its chip: % N hands its keys to nobody.
    for (let i = 0; i < SHARD_IDS.length; i++) {
      const id = SHARD_IDS[i];
      state.nodes[id].ghost = i >= n;
      state.nodes[id].queueDepth = i < n ? keysOwnedBy(i, n) : 0;
    }

    // Queries arrive with keys; router sends each to hash(key) % n.
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      const key = Math.floor(state.rng() * KEYSPACE);
      spawnPacket(state, "in", "request", { speed: 1.7, payload: { key } });
    }

    const hits: Record<string, number> = { s0: 0, s1: 0, s2: 0, s3: 0 };
    let answered = 0;

    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in") {
        if (p.type === "request") {
          const key = Number(p.payload?.key ?? 0);
          const target = SHARD_IDS[shardIndexForKey(key, n)];
          spawnPacket(state, `to-${target}`, "request", {
            speed: 1.5,
            payload: { key },
          });
        } else if (p.type === "response") {
          answered += 1; // an answer made it back to the app
        }
        // A "drop" reaching the app was already counted at the shard.
        continue;
      }

      const id = p.edgeId.slice(3); // "to-s2" → "s2"
      if (p.type === "request") {
        if (isAlive(state, id)) {
          hits[id] += 1;
          L.perShard[id] = emaEvent(L.perShard[id], true, 0.35);
          spawnPacket(state, p.edgeId, "response", { speed: 1.5, reverse: true });
        } else {
          // The dark slice: no reroute exists under % N, so the query dies at
          // the shard that owns it. Its keys stay unreachable until it's back.
          L.droppedTotal += 1;
          bounceDrop(state, p.edgeId);
        }
      } else if (p.type === "response") {
        spawnPacket(state, "in", "response", { speed: 1.7, reverse: true });
      } else if (p.type === "drop") {
        bounceDrop(state, "in"); // the error carries on back to the app
      }
    }

    // Per-shard readouts. Dead shards read zero on both — they serve nothing.
    for (const id of SHARD_IDS) {
      if (!isAlive(state, id)) {
        L.perShard[id] = 0;
        L.shardRate[id] = 0;
        state.nodes[id].load = 0;
        continue;
      }
      L.perShard[id] = approach(L.perShard[id], 0, 0.4, dt);
      L.shardRate[id] = emaRate(L.shardRate[id], hits[id], dt, 0.6);
      state.nodes[id].load = clamp01(L.perShard[id]);
    }

    // Hot-shard imbalance: busiest live shard vs. the average of them. A good
    // hash spreads keys *evenly-ish*, never evenly — 48 keys over 3 shards is
    // 20/14/14 here, and the busiest one feels it.
    const live = SHARD_IDS.filter((id, i) => i < n && isAlive(state, id));
    let skewTarget = 1;
    if (live.length > 1) {
      let sum = 0;
      let max = 0;
      for (const id of live) {
        sum += L.shardRate[id];
        if (L.shardRate[id] > max) max = L.shardRate[id];
      }
      const mean = sum / live.length;
      // Below ~0.5 q/s per shard the ratio is measuring noise, not skew.
      if (mean > 0.5) skewTarget = max / mean;
    }
    L.skew = approach(L.skew, skewTarget, 1.2, dt);

    L.throughput = emaRate(L.throughput, answered, dt);
    recordSample(state, "throughput", L.throughput);

    state.metrics.shards = n;
    state.metrics.remapped = L.remappedPct;
    state.metrics.throughput = L.throughput;
    state.metrics.dropped = L.droppedTotal;
    state.metrics.hotShard = L.skew;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Each query's key hashes to a shard: hash(key) % 3. The strip below is the whole keyspace, colored by owner.",
    },
    {
      // Fires the first time the learner kills a shard — a moment no clock can
      // predict, so it waits on the state instead of on `at`.
      at: 3,
      when: (state) =>
        SHARD_IDS.some(
          (id) =>
            !state.nodes[id].ghost && state.nodes[id].health === "dead",
        ),
      caption:
        "☠ A third of your keys just became errors. % N has no reroute — that slice stays dark until the shard is back. Remember this next lesson.",
    },
    {
      at: 8,
      caption:
        "Every shard holds only its slice — that's the point. The chips count keys owned: even-ish, never even. Now the trap…",
    },
    {
      // Right after the quiz resumes: show the answer on the meter without
      // making the learner touch the slider first.
      at: 13.4,
      caption:
        "Preview: that's the share of the keyspace that would change owner if you added ONE more shard — slider untouched.",
      apply: (state) => {
        const from = state.lesson.prevN;
        state.lesson.remappedPct = (movedKeys(from, from + 1) / KEYSPACE) * 100;
      },
    },
    {
      at: 18,
      caption:
        "💥 Now drag SHARDS 3 → 4 for real. The strip recolors almost everywhere — every recolored slot is data on the move.",
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
        "Changing the modulus changes almost every key's answer: a key stays only when hash % 3 == hash % 4, which is true for roughly 1 key in 4. This 48-key sample lands near 8 in 10. In production that remap is a massive data migration — the disaster consistent hashing was invented to avoid.",
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
      label: "keys remapped",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerAbove: 40,
    },
    {
      metricKey: "throughput",
      label: "throughput",
      kind: "sparkline",
      unit: "q/s",
    },
    {
      metricKey: "dropped",
      label: "dropped",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "hotShard",
      label: "hot shard vs. avg",
      kind: "counter",
      unit: "×",
      decimals: 2,
      // 48 keys over 3 shards is a 1.25× split by construction, 1.33× over 4 —
      // red is reserved for a genuinely lopsided shard, not the usual lumpiness.
      dangerAbove: 1.6,
    },
  ],
};
