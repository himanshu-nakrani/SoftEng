import {
  advancePackets,
  approach,
  clamp01,
  emaEvent,
  emaRate,
  isAlive,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * Quorums — archetype A (the packet engine).
 *
 * A replicated store of N = 5 databases. A write does NOT wait for all five;
 * it returns to the client the moment W of them have acked, and lands its new
 * version on exactly that W-subset (the fastest responders). A read consults
 * an R-subset and answers with the newest version it finds there. The lesson
 * is the overlap rule: because any set of R replicas and any set of W replicas
 * are both drawn from the same five, R + W > N forces them to share at least
 * one node — so a read set always contains a replica that saw the newest
 * committed write, and cannot miss it. When R + W ≤ N the two sets can be
 * disjoint, and a read that lands entirely on replicas the write skipped
 * returns a value that is real, committed, and stale.
 *
 * Writes (violet) fan out to all five; the first W to ack turn the commit
 * green back to the client. Reads (amber) touch R nodes; a read whose R-set
 * missed the newest write comes back orange — stale, served with a straight
 * face. Kill a replica to shrink the pool the sets are drawn from and watch a
 * quorum that no longer has enough live nodes to satisfy W start failing.
 *
 * LIMITS — this is a believable model, not a real Dynamo-style store. Every
 * replica applies at most one version per key and there is no read-repair,
 * no vector clocks, no hinted handoff, no anti-entropy: the "stale" replicas
 * simply stay behind until the next write happens to include them. Which W
 * replicas ack first is a fresh uniform draw per write rather than a function
 * of real latency, and reads pick their R-set the same way, so the stale rate
 * is the pure combinatorial overlap probability, not a measured tail. Sloppy
 * quorums, quorum reads that trigger repair, and per-key sloppiness are all
 * out of scope; the point here is only the intersection arithmetic.
 */

/** N is fixed at five — odd, so a strict majority (3) is unambiguous. */
const N = 5;
const REPLICAS = ["r1", "r2", "r3", "r4", "r5"] as const;
type Rid = (typeof REPLICAS)[number];

/** Writes and reads land on keys; a read is stale only if ITS key is behind. */
const KEYSPACE = 6;

/**
 * Share of the gap each read closes on the stale-read gauge. Deliberately
 * < 1: at 1 or above `approach` clamps and the "average" latches onto the
 * newest sample, so the dial could only ever read 0% or 100%. At 0.15 it
 * averages the last ~12 reads — a bit over a second at the default read rate,
 * smooth enough to read and quick enough to answer the R and W sliders.
 */
const STALE_EMA_RATE = 0.15;

/** The client's wire to each replica. Writes fan out on all five; reads pick R. */
const EDGE: Record<Rid, string> = {
  r1: "w1",
  r2: "w2",
  r3: "w3",
  r4: "w4",
  r5: "w5",
};

interface QuorumsState {
  /** Per-replica, per-key applied version. */
  v: Record<Rid, number[]>;
  /** The newest COMMITTED version per key — the truth a stale read misses. */
  truth: number[];
  /** Writes acked to the client (W replicas reached). */
  committedWrites: number;
  /** Writes that could not reach W live replicas — a policy refusal. */
  rejectedWrites: number;
  reads: number;
  freshReads: number;
  staleReads: number;
  /** Smoothed stale share for the gauge. */
  staleEma: number;
  /** Smoothed commit throughput for the load bars. */
  commitEma: number;
  /** Scripted degraded window: R + W forced below N + 1 so staleness appears. */
  forceWeakUntil: number;
}

const zeros = () => Array<number>(KEYSPACE).fill(0);

/**
 * Draw a uniform k-subset of the live replicas via a partial Fisher-Yates over
 * `state.rng`. Every shuffle draw goes through the seeded RNG, so the whole run
 * replays byte-identically. Returns fewer than k only when fewer than k
 * replicas are alive.
 */
function pickLive(state: SimState<QuorumsState>, k: number): Rid[] {
  const pool = REPLICAS.filter((id) => isAlive(state, id));
  for (let i = 0; i < pool.length && i < k; i++) {
    const j = i + Math.floor(state.rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(k, pool.length));
}

export const quorumsSim: LessonSim<QuorumsState> = {
  id: "quorums",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "app", x: 120, y: 225 },
      { id: "r1", kind: "database", label: "db-1", x: 470, y: 70, breakable: true },
      { id: "r2", kind: "database", label: "db-2", x: 620, y: 150, breakable: true },
      { id: "r3", kind: "database", label: "db-3", x: 665, y: 285, breakable: true },
      // y was 390, which put db-4 under the stage edge where the caption sits —
      // one of the five replicas was simply not visible. The ring is compressed
      // to keep every replica inside the frame.
      { id: "r4", kind: "database", label: "db-4", x: 505, y: 355, breakable: true },
      { id: "r5", kind: "database", label: "db-5", x: 345, y: 300, breakable: true },
    ],
    edges: [
      { id: "w1", from: "client", to: "r1", curve: -0.16 },
      { id: "w2", from: "client", to: "r2", curve: -0.08 },
      { id: "w3", from: "client", to: "r3", curve: 0.04 },
      { id: "w4", from: "client", to: "r4", curve: 0.12 },
      { id: "w5", from: "client", to: "r5", curve: 0.18 },
    ],
  },

  packetStyles: {
    // A committed write's ack — the answer the client has been waiting for.
    ack: { color: "var(--color-glow-green)" },
    // A stale read is a degraded answer, not an error and not a miss.
    stale: { color: "var(--color-glow-orange)" },
  },

  packetLegend: [
    { type: "write", label: "write → all N" },
    { type: "ack", label: "W acked — commit returns" },
    { type: "request", label: "read → R replicas" },
    { type: "stale", label: "read missed the newest write" },
  ],

  params: [
    {
      key: "writeRate",
      label: "write rate",
      kind: "slider",
      min: 1,
      max: 8,
      step: 1,
      unit: " w/s",
      defaultValue: 3,
    },
    {
      key: "readRate",
      label: "read rate",
      kind: "slider",
      min: 2,
      max: 16,
      step: 1,
      unit: " r/s",
      defaultValue: 8,
    },
    {
      key: "w",
      label: "write quorum W",
      kind: "slider",
      min: 1,
      max: N,
      step: 1,
      defaultValue: 3,
    },
    {
      key: "r",
      label: "read quorum R",
      kind: "slider",
      min: 1,
      max: N,
      step: 1,
      defaultValue: 3,
    },
  ],

  init: () => ({
    v: {
      r1: zeros(),
      r2: zeros(),
      r3: zeros(),
      r4: zeros(),
      r5: zeros(),
    },
    truth: zeros(),
    committedWrites: 0,
    rejectedWrites: 0,
    reads: 0,
    freshReads: 0,
    staleReads: 0,
    staleEma: 0,
    commitEma: 0,
    forceWeakUntil: 0,
  }),

  // `params` is ParamValues, so read through Number() — a narrower parameter
  // type is not assignable to the LessonSim interface.
  step: (state, dt, params) => {
    const L = state.lesson;
    // The scripted degraded beat forces R = W = 2 (R + W = 4 ≤ N) so a passive
    // reader still sees staleness appear even if they never touch the sliders.
    const weak = state.t < L.forceWeakUntil;
    const W = weak ? 2 : Number(params.w);
    const R = weak ? 2 : Number(params.r);

    // 1. Writes. A write picks a key, then needs W live acks. The W fastest
    //    responders are a uniform draw; they get the new version, the rest do
    //    not — that skipped set is where a stale read lives.
    const writeSpawns = shouldSpawn(state, Number(params.writeRate), dt);
    for (let i = 0; i < writeSpawns; i++) {
      const key = Math.floor(state.rng() * KEYSPACE);
      const ackSet = pickLive(state, W);
      if (ackSet.length < W) {
        // Not enough live replicas to reach W: the write is REJECTED (a policy
        // refusal — the quorum cannot be assembled), not dropped.
        L.rejectedWrites += 1;
        // Visual: a write goes out to one replica and bounces back limited.
        const target = REPLICAS.find((id) => isAlive(state, id)) ?? "r1";
        spawnPacket(state, EDGE[target], "write", {
          speed: 1.7,
          payload: { rejected: true },
        });
        continue;
      }
      // Commit: the version is now the truth, applied to the acking subset.
      const version = L.truth[key] + 1;
      L.truth[key] = version;
      for (const id of ackSet) L.v[id][key] = version;
      L.committedWrites += 1;
      // Fan the write out to all five (the ones off the ack-set are the async
      // laggards); the acking subset fires a green ack back to the client.
      for (const id of REPLICAS) {
        const acked = ackSet.includes(id);
        spawnPacket(state, EDGE[id], "write", {
          speed: 1.7,
          reverse: false,
          payload: { key, acked },
        });
      }
    }

    // 2. Reads. A read picks a key and an R-subset, and answers with the newest
    //    version it finds there. Stale iff that max trails the committed truth.
    const readSpawns = shouldSpawn(state, Number(params.readRate), dt);
    for (let i = 0; i < readSpawns; i++) {
      const key = Math.floor(state.rng() * KEYSPACE);
      const readSet = pickLive(state, R);
      if (readSet.length < R) {
        // Cannot assemble R live replicas: the read is refused, same as a write.
        L.rejectedWrites += 1;
        const target = REPLICAS.find((id) => isAlive(state, id)) ?? "r1";
        spawnPacket(state, EDGE[target], "request", {
          speed: 1.8,
          payload: { rejected: true },
        });
        continue;
      }
      const seen = Math.max(...readSet.map((id) => L.v[id][key]));
      const stale = seen < L.truth[key];
      L.reads += 1;
      L.staleEma = emaEvent(L.staleEma, stale, STALE_EMA_RATE);
      // Send the read to the FIRST replica in its R-set (representative dot);
      // the answer's colour carries the verdict for the whole set.
      const via = EDGE[readSet[0]];
      spawnPacket(state, via, "request", { speed: 1.8, payload: { stale } });
      if (stale) L.staleReads += 1;
      else L.freshReads += 1;
    }

    // 3. Deliveries — turn arrivals around as acks / responses / stale reads.
    let commitsNow = 0;
    for (const p of advancePackets(state, dt)) {
      if (p.type === "write") {
        if (p.payload?.rejected === true) {
          // Bounce the refused write back, limited-style.
          spawnPacket(state, p.edgeId, "limited", { speed: 2, reverse: true, size: 3 });
          continue;
        }
        if (p.payload?.acked === true) {
          commitsNow += 1;
          spawnPacket(state, p.edgeId, "ack", { speed: 2, reverse: true, size: 3 });
        }
        // Non-acking replicas just absorb the write silently (the laggards).
      } else if (p.type === "request") {
        if (p.payload?.rejected === true) {
          spawnPacket(state, p.edgeId, "limited", { speed: 2, reverse: true, size: 3 });
          continue;
        }
        const stale = p.payload?.stale === true;
        spawnPacket(state, p.edgeId, stale ? "stale" : "response", {
          speed: 2,
          reverse: true,
        });
      }
      // acks, responses, stale, limited just fade out on arrival back home.
    }

    // 4. Readouts.
    L.commitEma = emaRate(L.commitEma, commitsNow, dt);
    for (const id of REPLICAS) {
      const node = state.nodes[id];
      if (!isAlive(state, id)) {
        node.load = 0;
        continue;
      }
      node.load = approach(node.load, clamp01(L.commitEma / 8), 6, dt);
    }

    // R + W overlap headroom: positive when the rule holds. Published so the
    // meter and the prediction checkpoint read the same number the step used.
    state.metrics.overlap = R + W - N;
    state.metrics.committed = L.committedWrites;
    state.metrics.stalePct = L.staleEma * 100;
    state.metrics.rejected = L.rejectedWrites;
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Violet = writes to all 5. Green = the W acks that let the commit return. Amber = reads.",
    },
    {
      at: 7,
      caption:
        "W = R = 3 and N = 5, so R + W = 6 > 5. Every read set overlaps every write set — no stale reads.",
    },
    {
      at: 13,
      caption:
        "⚠ Now the store is reconfigured for speed: R and W both drop to 2. R + W = 4, no longer > 5.",
      apply: (s) => {
        s.lesson.forceWeakUntil = s.t + 7;
      },
    },
    {
      at: 15,
      caption:
        "Orange reads appear — a read whose 2 replicas both missed the newest write, returned stale.",
    },
    {
      at: 20.5,
      caption:
        "Back to a real quorum. ☠ Now click replicas dead: once fewer than W survive, writes are rejected.",
    },
  ],

  quiz: [
    {
      id: "quorums-overlap",
      // Fires inside the scripted weak window (13..20) but BEFORE its proof:
      // at 13.6 the reconfigure has taken hold (overlap = -1) yet the stale
      // gauge has not moved off zero yet (verified at seed 42), so the reader
      // predicts the orange reads before seeing one.
      at: 13.6,
      question:
        "The store was just reconfigured to R = 2, W = 2, with N = 5. A write commits on 2 replicas; a read consults a different 2. What can that read return?",
      choices: [
        {
          id: "stale",
          label: "Possibly a stale value — its 2 replicas can miss the write's 2",
        },
        {
          id: "fresh",
          label: "Always the newest write — quorums guarantee it",
        },
        {
          id: "error",
          label: "An error — the read set is too small to answer",
        },
      ],
      correctChoiceId: "stale",
      explain:
        "R + W = 4 is not greater than N = 5, so a read set of 2 and a write set of 2 can be entirely disjoint — five replicas is enough room for them not to touch. When that happens the read lands only on replicas the write skipped and returns the previous value: real, committed, and stale. Watch the stale-read gauge climb off zero. The fix is arithmetic, not luck: make R + W > N and the two sets are forced to share a replica.",
    },
  ],

  meters: [
    {
      metricKey: "overlap",
      label: "R + W − N",
      kind: "counter",
      dangerBelow: 1,
    },
    {
      metricKey: "stalePct",
      label: "stale reads",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerAbove: 5,
    },
    {
      metricKey: "committed",
      label: "committed writes",
      kind: "counter",
    },
    {
      metricKey: "rejected",
      label: "rejected writes",
      kind: "counter",
      dangerAbove: 0,
    },
  ],
};
