import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaEvent,
  emaRate,
  isAlive,
  killNode,
  recordSample,
  severEdge,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * Lesson 5 — Database Replication. Leader-follower with visible lag, and the
 * failure the arrangement is famous for.
 *
 * Writes (violet) land on whichever node currently holds the leader role.
 * Every commit is queued per follower and shipped one replication lag later,
 * so a replica's version badge visibly trails the leader's. Reads round-robin
 * the LIVE replicas; one whose key is behind comes back orange — stale data,
 * served with a straight face.
 *
 * Three failures, in rising order of drama:
 *   · kill a replica — its version freezes, the survivor absorbs every read;
 *     revive it and it grinds through the backlog at REPL_CAPACITY.
 *   · t=22, scripted — the leader dies. For three seconds writes bounce: there
 *     is no node that may accept them.
 *   · t=25, scripted — the most caught-up replica is promoted. Everything the
 *     old leader committed but never shipped is gone, counted in LOST WRITES,
 *     and the leader-version counter visibly steps *backwards*.
 */

/** Every database node. Any of them may hold the leader role. */
const NODES = ["leader", "f1", "f2"] as const;
type Nid = (typeof NODES)[number];

/** Writes and reads land on keys — a read is stale only if ITS key is behind. */
const KEYSPACE = 8;

/**
 * Entries/sec one replication wire can carry. Above the maximum write rate, so
 * a rejoining replica actually gains ground instead of falling behind forever;
 * low enough that catching up takes visible seconds.
 */
const REPL_CAPACITY = 12;

/**
 * Backlog a rejoining replica will replay entry by entry. Past it a real
 * cluster stops chasing the log and ships a base backup instead — modelled
 * here as an instant jump for the excess, with the tail streamed on the wire.
 */
const CATCHUP_CAP = 40;

/**
 * Share of the gap each read closes on the stale-read gauge. Deliberately
 * < 1: at 1 or above `approach` clamps and the "average" latches onto the
 * newest sample, so the dial could only ever read 0% or 100%. At 0.2 it
 * averages the last ~9 reads — about a second of traffic at the default read
 * rate, which is smooth enough to read and quick enough to answer the lag
 * slider.
 */
const STALE_EMA_RATE = 0.2;

/** Sim-seconds between replica-lag samples (the sparkline's resolution). */
const SAMPLE_EVERY = 0.2;

/** The client's wire to each node. Writes and reads both ride it. */
const CLIENT_EDGE: Record<Nid, string> = {
  leader: "write",
  f1: "read-f1",
  f2: "read-f2",
};

/**
 * The replication wire between each pair of databases, authored one way round.
 * Roles move (that is the lesson), wires do not — so a promoted replica feeds
 * its peers over the same links, some of them backwards.
 */
const LINKS: { a: Nid; b: Nid; edgeId: string }[] = [
  { a: "leader", b: "f1", edgeId: "repl-f1" },
  { a: "leader", b: "f2", edgeId: "repl-f2" },
  { a: "f1", b: "f2", edgeId: "cross" },
];

function replLink(from: Nid, to: Nid): { edgeId: string; reverse: boolean } {
  const link = LINKS.find(
    (l) => (l.a === from && l.b === to) || (l.a === to && l.b === from),
  )!;
  return { edgeId: link.edgeId, reverse: link.a !== from };
}

/** One committed write, waiting out the replication lag in a follower's queue. */
interface ReplEntry {
  key: number;
  version: number;
  /** Sim-seconds: the earliest this entry may leave the leader. */
  readyAt: number;
}

/** A follower's replication backlog + its service credit on the wire. */
interface ReplStream {
  pending: ReplEntry[];
  acc: number;
}

interface ReplState {
  /** Per-node, per-key applied version. The leader's row IS the truth. */
  v: Record<Nid, number[]>;
  repl: Record<Nid, ReplStream>;
  /** Who holds the leader role right now. Moves on promotion. */
  leaderId: Nid;
  /** Followers owed a rebuilt stream next tick (a revive, a promotion). */
  resync: Nid[];
  /** Liveness as of last tick — how kills and revives are detected. */
  wasAlive: Record<Nid, boolean>;
  rrRead: number;
  freshReads: number;
  staleReads: number;
  staleEma: number;
  /** Committed on the old leader, never replicated: gone at promotion. */
  lostWrites: number;
  /** Writes that arrived to find no live leader at that address. */
  rejectedWrites: number;
  commitEma: number;
  sampleAcc: number;
}

/** What the figure draws in each node's version badge. */
export interface ReplNodeMeta {
  version: number;
  role: "leader" | "replica";
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const zeros = () => Array<number>(KEYSPACE).fill(0);
const behind = (L: ReplState, id: Nid) =>
  Math.max(0, sum(L.v[L.leaderId]) - sum(L.v[id]));

/**
 * Rebuild a follower's stream from scratch: every entry it is missing, oldest
 * first, released one lag from now. Used by both rejoin paths (a revived
 * replica, and every survivor of a promotion) so catch-up always travels the
 * ordinary replication pipeline rather than teleporting.
 */
function resync(state: SimState<ReplState>, id: Nid, lag: number): void {
  const L = state.lesson;
  const truth = L.v[L.leaderId];
  const mine = L.v[id];
  const entries: ReplEntry[] = [];
  for (let k = 0; k < KEYSPACE; k++) {
    for (let version = mine[k] + 1; version <= truth[k]; version++) {
      entries.push({ key: k, version, readyAt: state.t + lag });
    }
  }
  if (entries.length > CATCHUP_CAP) {
    // Too far behind to replay: base-backup the excess, stream the tail.
    for (const e of entries.splice(0, entries.length - CATCHUP_CAP)) {
      mine[e.key] = Math.max(mine[e.key], e.version);
    }
  }
  L.repl[id].pending = entries;
  L.repl[id].acc = 0;
}

/**
 * Failover. The election picks the most caught-up live replica — the one with
 * the least to lose — and its copy becomes the truth. Everything the old
 * leader accepted past that point is data loss: counted, then erased
 * everywhere (a rejoining old leader is rewound, never merged).
 */
function promote(state: SimState<ReplState>): void {
  const L = state.lesson;
  const old = L.leaderId;
  const candidates = NODES.filter((id) => id !== old && isAlive(state, id));
  if (candidates.length === 0) return; // nothing to promote — writes keep bouncing

  const winner = candidates.reduce((best, id) =>
    sum(L.v[id]) > sum(L.v[best]) ? id : best,
  );
  L.lostWrites += Math.max(0, sum(L.v[old]) - sum(L.v[winner]));
  L.leaderId = winner;

  // Fence the old leader: its in-flight stream carries versions that, one
  // tick from now, no node in this cluster has ever heard of.
  for (const id of NODES) {
    if (id !== old) severEdge(state, replLink(old, id).edgeId, "drop");
  }
  for (const id of NODES) {
    if (id === winner) continue;
    for (let k = 0; k < KEYSPACE; k++) {
      L.v[id][k] = Math.min(L.v[id][k], L.v[winner][k]);
    }
    L.repl[id].pending.length = 0;
    L.repl[id].acc = 0;
    if (isAlive(state, id)) L.resync.push(id);
  }
}

export const replicationSim: LessonSim<ReplState> = {
  id: "replication",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "app", x: 120, y: 225 },
      {
        id: "leader",
        kind: "database",
        label: "pg-leader",
        x: 420,
        y: 110,
        breakable: true,
      },
      {
        id: "f1",
        kind: "database",
        label: "replica-1",
        x: 660,
        y: 225,
        breakable: true,
      },
      {
        id: "f2",
        kind: "database",
        label: "replica-2",
        x: 420,
        y: 350,
        breakable: true,
      },
    ],
    edges: [
      { id: "write", from: "client", to: "leader", curve: -0.12 },
      { id: "read-f1", from: "client", to: "f1", curve: 0.06 },
      { id: "read-f2", from: "client", to: "f2", curve: 0.12 },
      { id: "repl-f1", from: "leader", to: "f1", curve: -0.15 },
      { id: "repl-f2", from: "leader", to: "f2", curve: 0.15 },
      // Stands idle until a replica is promoted and has to feed its peer.
      { id: "cross", from: "f1", to: "f2", curve: -0.12 },
    ],
  },

  packetStyles: {
    // A stale read is a degraded answer, not an error and not a miss — the
    // warning hue, kept clear of the amber the requests themselves ride on.
    stale: { color: "var(--color-glow-orange)" },
  },

  // Seeded so the version badges are already on the stage before the first
  // tick; `step` rewrites them every tick after that.
  initialNodes: {
    leader: { meta: { version: 0, role: "leader" } },
    f1: { meta: { version: 0, role: "replica" } },
    f2: { meta: { version: 0, role: "replica" } },
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
    v: { leader: zeros(), f1: zeros(), f2: zeros() },
    repl: {
      leader: { pending: [], acc: 0 },
      f1: { pending: [], acc: 0 },
      f2: { pending: [], acc: 0 },
    },
    leaderId: "leader",
    resync: [],
    wasAlive: { leader: true, f1: true, f2: true },
    rrRead: 0,
    freshReads: 0,
    staleReads: 0,
    staleEma: 0,
    lostWrites: 0,
    rejectedWrites: 0,
    commitEma: 0,
    sampleAcc: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const lag = Number(params.lag);

    // 0. Membership changes. A node that dies loses whatever was on its wire;
    //    a node that comes back has to be told everything it missed.
    for (const id of NODES) {
      const alive = isAlive(state, id);
      if (alive === L.wasAlive[id]) continue;
      L.wasAlive[id] = alive;
      if (!alive) {
        L.repl[id].pending.length = 0;
        L.repl[id].acc = 0;
        if (id !== L.leaderId) {
          // In-flight replication dies where the failure caught it.
          severEdge(state, replLink(L.leaderId, id).edgeId, "drop");
        }
      } else if (id !== L.leaderId) {
        L.resync.push(id);
      }
    }
    // Rebuilding a stream needs `lag`, which timeline `apply` never sees — so
    // promotion queues its survivors here rather than doing the work itself.
    for (const id of L.resync) {
      if (id !== L.leaderId && isAlive(state, id)) resync(state, id, lag);
    }
    L.resync.length = 0;

    const leaderId = L.leaderId;
    const leaderAlive = isAlive(state, leaderId);
    const truth = L.v[leaderId];

    // 1. Writes → whoever holds the leader role, each touching a random key.
    const writeSpawns = shouldSpawn(state, Number(params.writeRate), dt);
    for (let i = 0; i < writeSpawns; i++) {
      const key = Math.floor(state.rng() * KEYSPACE);
      spawnPacket(state, CLIENT_EDGE[leaderId], "write", {
        speed: 1.5,
        payload: { to: leaderId, key },
      });
    }

    // 2. Reads → the LIVE replicas, round-robin. With none left they fall back
    //    to the leader, where an answer is always fresh — which is exactly the
    //    read-your-writes fix, seen from the other side.
    const replicas = NODES.filter((id) => id !== leaderId && isAlive(state, id));
    const readSpawns = shouldSpawn(state, Number(params.readRate), dt);
    for (let i = 0; i < readSpawns; i++) {
      const to =
        replicas.length > 0
          ? replicas[L.rrRead++ % replicas.length]
          : leaderId;
      spawnPacket(state, CLIENT_EDGE[to], "request", {
        speed: 1.6,
        payload: { to },
      });
    }

    // 3. Deliveries.
    let commitsNow = 0;
    for (const p of advancePackets(state, dt)) {
      const to = p.payload?.to as Nid | undefined;
      if (p.type === "write") {
        if (to !== leaderId || !leaderAlive) {
          // Addressed to a node that is dead, demoted, or both.
          L.rejectedWrites += 1;
          bounceDrop(state, p.edgeId);
          continue;
        }
        const key = Number(p.payload?.key ?? 0);
        truth[key] += 1;
        commitsNow += 1;
        for (const f of NODES) {
          if (f === leaderId || !isAlive(state, f)) continue;
          L.repl[f].pending.push({
            key,
            version: truth[key],
            readyAt: state.t + lag,
          });
        }
      } else if (p.type === "replication") {
        if (!to || !isAlive(state, to)) continue;
        const key = Number(p.payload?.key ?? 0);
        const version = Number(p.payload?.version ?? 0);
        L.v[to][key] = Math.max(L.v[to][key], version);
      } else if (p.type === "request") {
        if (!to || !isAlive(state, to)) {
          bounceDrop(state, p.edgeId); // the read found a corpse
          continue;
        }
        // Stale only if THIS read's key is behind on the node serving it.
        const key = Math.floor(state.rng() * KEYSPACE);
        const stale = to !== leaderId && L.v[to][key] < truth[key];
        L.staleEma = emaEvent(L.staleEma, stale, STALE_EMA_RATE);
        if (stale) {
          L.staleReads += 1;
          spawnPacket(state, p.edgeId, "stale", { speed: 1.6, reverse: true });
        } else {
          L.freshReads += 1;
          spawnPacket(state, p.edgeId, "response", {
            speed: 1.6,
            reverse: true,
          });
        }
      }
    }

    // 4. The replication streams. Each live follower ships whatever has waited
    //    out its lag, capped at REPL_CAPACITY — the cap is what makes a
    //    rejoining replica grind visibly through its backlog.
    if (leaderAlive) {
      for (const f of NODES) {
        if (f === leaderId || !isAlive(state, f)) continue;
        const stream = L.repl[f];
        let ready = 0;
        while (
          ready < stream.pending.length &&
          stream.pending[ready].readyAt <= state.t
        ) {
          ready += 1;
        }
        const wire = { depth: ready, acc: stream.acc };
        const link = replLink(leaderId, f);
        drainQueue(wire, REPL_CAPACITY, dt, () => {
          const e = stream.pending.shift()!;
          spawnPacket(state, link.edgeId, "replication", {
            speed: 2.6,
            size: 3,
            reverse: link.reverse,
            payload: { to: f, key: e.key, version: e.version },
          });
        });
        stream.acc = wire.acc;
      }
    }

    // 5. Readouts.
    const live = NODES.filter((id) => id !== leaderId && isAlive(state, id));
    const avgBehind =
      live.length > 0
        ? live.reduce((acc, id) => acc + behind(L, id), 0) / live.length
        : 0;

    L.commitEma = emaRate(L.commitEma, commitsNow, dt);
    for (const id of NODES) {
      const node = state.nodes[id];
      node.meta = {
        version: sum(L.v[id]),
        role: id === leaderId ? "leader" : "replica",
      } satisfies ReplNodeMeta;
      if (!isAlive(state, id)) {
        node.load = 0;
        continue;
      }
      // The leader's bar is write throughput; a replica's is how far behind.
      const target =
        id === leaderId
          ? clamp01(L.commitEma / 12)
          : clamp01(behind(L, id) / 20);
      node.load = approach(node.load, target, 6, dt);
    }

    state.metrics.version = sum(truth);
    state.metrics.lagVersions = avgBehind;
    state.metrics.stalePct = L.staleEma * 100;
    state.metrics.lostWrites = L.lostWrites;

    L.sampleAcc += dt;
    if (L.sampleAcc >= SAMPLE_EVERY) {
      L.sampleAcc -= SAMPLE_EVERY;
      recordSample(state, "lagVersions", avgBehind);
    }
  },

  timeline: [
    {
      at: 2,
      caption:
        "Violet = writes & replication. The badge over each node is its data version.",
    },
    {
      at: 7,
      caption:
        "Watch a replica's version trail the leader's — that gap is replication lag, live.",
    },
    {
      at: 13,
      caption:
        "☠ Click a replica to kill it — its version freezes and the survivor takes every read.",
    },
    {
      at: 16,
      caption:
        "Click it again to revive it: it has to replay the whole backlog before it catches up.",
    },
    {
      at: 19,
      caption:
        "⚠ Now crank REPLICATION LAG — orange responses are reads served from the past.",
    },
    {
      at: 22,
      caption: "☠ pg-leader just died — the writes have nowhere to go.",
      apply: (s) => killNode(s, s.lesson.leaderId),
    },
    {
      at: 25,
      // Waits for a leaderless cluster with something left to promote — so a
      // learner who revives pg-leader in the gap simply never needs a failover.
      when: (s) =>
        !isAlive(s, s.lesson.leaderId) &&
        NODES.some((id) => id !== s.lesson.leaderId && isAlive(s, id)),
      caption:
        "↑ The most caught-up replica is promoted — the writes it never got are gone. See LOST WRITES.",
      apply: promote,
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
    {
      id: "repl-lost-writes",
      at: 21.5,
      // Only worth asking while there is still a leader to lose; the gate also
      // closes for good at 22, so a much later revival can't stage it again.
      when: (s) => s.t < 22 && isAlive(s, s.lesson.leaderId),
      question:
        "pg-leader is about to die. The writes it accepted in the last second are committed there but haven't reached a replica yet. Once a replica is promoted, what becomes of them?",
      choices: [
        { id: "gone", label: "Gone — the new leader never received them" },
        { id: "replayed", label: "Replayed from the old leader once it's back" },
        { id: "queued", label: "Held by the client and re-committed automatically" },
      ],
      correctChoiceId: "gone",
      explain:
        "With asynchronous replication, 'committed' and 'replicated' are two different moments, and the failover happens between them. Whatever was in that gap is on a disk nobody can reach — and the promoted replica's copy is now the truth, so it can never come back. That window is your RPO, measured in writes. Synchronous replication closes it by making every commit wait for a replica; you pay for that on every write, forever.",
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
      kind: "sparkline",
      unit: " versions",
      decimals: 1,
      dangerAbove: 10,
    },
    {
      metricKey: "stalePct",
      label: "stale reads",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerAbove: 30,
    },
    {
      metricKey: "lostWrites",
      label: "lost writes",
      kind: "counter",
      dangerAbove: 0,
    },
  ],
};
