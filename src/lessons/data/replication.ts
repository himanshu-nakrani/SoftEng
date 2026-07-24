import {
  advancePackets,
  approach,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 5 — Database Replication. Leader-follower with visible lag.
 * Writes (violet) land on the leader; replication packets trail out to the
 * followers after a configurable delay. Reads (cyan) round-robin the
 * followers — a read landing on a behind follower comes back amber: stale.
 */

const FOLLOWERS = ["f1", "f2"] as const;
type Fid = (typeof FOLLOWERS)[number];

/** Writes and reads land on keys — a read is stale only if ITS key is behind. */
const KEYSPACE = 8;

interface ReplState {
  /** Per-key version on the leader; total = sum (shown on the chip). */
  leaderV: number[];
  followerV: Record<Fid, number[]>;
  /** Writes waiting out their replication delay. */
  replBuffer: { sendAt: number; key: number; version: number; to: Fid }[];
  rrRead: number;
  freshReads: number;
  staleReads: number;
  staleEma: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const replicationSim: LessonSim<ReplState> = {
  id: "replication",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "app", x: 120, y: 225 },
      { id: "leader", kind: "database", label: "pg-leader", x: 420, y: 110 },
      { id: "f1", kind: "database", label: "replica-1", x: 660, y: 225 },
      { id: "f2", kind: "database", label: "replica-2", x: 420, y: 350 },
    ],
    edges: [
      { id: "write", from: "client", to: "leader", curve: -0.12 },
      { id: "read-f1", from: "client", to: "f1", curve: 0.06 },
      { id: "read-f2", from: "client", to: "f2", curve: 0.12 },
      { id: "repl-f1", from: "leader", to: "f1", curve: -0.15 },
      { id: "repl-f2", from: "leader", to: "f2", curve: 0.15 },
    ],
  },

  params: [
    {
      key: "writeRate",
      label: "write rate",
      kind: "slider",
      min: 1,
      max: 10,
      step: 1,
      unit: " w/s",
      defaultValue: 4,
    },
    {
      key: "readRate",
      label: "read rate",
      kind: "slider",
      min: 2,
      max: 20,
      step: 1,
      unit: " r/s",
      defaultValue: 8,
    },
    {
      key: "lag",
      label: "replication lag",
      kind: "slider",
      min: 0.2,
      max: 4,
      step: 0.2,
      unit: "s",
      defaultValue: 1.5,
    },
  ],

  init: () => ({
    leaderV: Array(KEYSPACE).fill(0),
    followerV: {
      f1: Array(KEYSPACE).fill(0),
      f2: Array(KEYSPACE).fill(0),
    },
    replBuffer: [],
    rrRead: 0,
    freshReads: 0,
    staleReads: 0,
    staleEma: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const lag = Number(params.lag);

    // 1. Writes → leader, each touching a random key.
    const writeSpawns = shouldSpawn(state, Number(params.writeRate), dt);
    for (let i = 0; i < writeSpawns; i++) {
      const key = Math.floor(state.rng() * KEYSPACE);
      spawnPacket(state, "write", "write", { speed: 1.5, payload: { key } });
    }
    // 2. Reads → followers, round-robin.
    const readSpawns = shouldSpawn(state, Number(params.readRate), dt);
    for (let i = 0; i < readSpawns; i++) {
      const target = FOLLOWERS[L.rrRead++ % FOLLOWERS.length];
      spawnPacket(state, `read-${target}`, "request", { speed: 1.6 });
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "write" && p.type === "write") {
        // Commit on the leader; schedule replication after the lag.
        const key = Number(p.payload?.key ?? 0);
        L.leaderV[key] += 1;
        for (const f of FOLLOWERS) {
          L.replBuffer.push({
            sendAt: state.t + lag,
            key,
            version: L.leaderV[key],
            to: f,
          });
        }
      } else if (p.type === "replication") {
        const to = p.payload?.to as Fid;
        const key = Number(p.payload?.key ?? 0);
        const version = Number(p.payload?.version ?? 0);
        L.followerV[to][key] = Math.max(L.followerV[to][key], version);
      } else if (p.type === "request" && p.edgeId.startsWith("read-")) {
        const f = p.edgeId.slice(5) as Fid;
        // Stale only if THIS read's key is behind on this follower.
        const key = Math.floor(state.rng() * KEYSPACE);
        const stale = L.followerV[f][key] < L.leaderV[key];
        if (stale) {
          L.staleReads += 1;
          L.staleEma = approach(L.staleEma, 1, 1.2, 1);
          // amber response = stale data served
          spawnPacket(state, p.edgeId, "miss", { speed: 1.6, reverse: true });
        } else {
          L.freshReads += 1;
          L.staleEma = approach(L.staleEma, 0, 1.2, 1);
          spawnPacket(state, p.edgeId, "response", {
            speed: 1.6,
            reverse: true,
          });
        }
      }
    }

    // 4. Release replication packets whose delay elapsed.
    const due = L.replBuffer.filter((r) => r.sendAt <= state.t);
    L.replBuffer = L.replBuffer.filter((r) => r.sendAt > state.t);
    for (const r of due) {
      spawnPacket(state, `repl-${r.to}`, "replication", {
        speed: 2.6,
        size: 3,
        payload: { to: r.to, key: r.key, version: r.version },
      });
    }

    // 5. Readouts.
    const leaderTotal = sum(L.leaderV);
    const avgBehind =
      FOLLOWERS.reduce((acc, f) => acc + (leaderTotal - sum(L.followerV[f])), 0) /
      FOLLOWERS.length;
    state.nodes.leader.queueDepth = leaderTotal;
    for (const f of FOLLOWERS) {
      state.nodes[f].queueDepth = sum(L.followerV[f]);
      state.nodes[f].load = approach(
        state.nodes[f].load,
        Math.min((leaderTotal - sum(L.followerV[f])) / 8, 1),
        6,
        dt,
      );
    }
    state.metrics.lagVersions = avgBehind;
    state.metrics.stalePct = L.staleEma * 100;
    state.metrics.version = leaderTotal;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Violet = writes & replication. The count chips are each node's data version.",
    },
    {
      at: 7,
      caption:
        "Watch a replica's chip lag the leader's — that gap is replication lag, live.",
    },
    {
      at: 16,
      caption:
        "⚠ Crank REPLICATION LAG to 4s and read rate up — amber responses are stale data.",
    },
  ],

  quiz: [
    {
      id: "read-your-writes",
      at: 12,
      question:
        "A user updates their profile (write → leader), then the page instantly re-reads it from a replica. What can they see?",
      choices: [
        { id: "old", label: "Their OLD profile — the write hasn't replicated yet" },
        { id: "new", label: "Always the new profile — writes are instant" },
        { id: "err", label: "An error — replicas reject reads during replication" },
      ],
      correctChoiceId: "old",
      explain:
        "The write committed on the leader, but the replica is still behind by the replication lag. Reading your own write back from a replica can time-travel you into the past — which is why 'read-your-writes' consistency usually means pinning those reads to the leader.",
    },
  ],

  meters: [
    {
      metricKey: "version",
      label: "leader version",
      kind: "counter",
    },
    {
      metricKey: "lagVersions",
      label: "avg replica lag",
      kind: "counter",
      unit: " versions",
      decimals: 1,
      dangerAbove: 5,
    },
    {
      metricKey: "stalePct",
      label: "stale reads",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerAbove: 30,
    },
  ],
};
