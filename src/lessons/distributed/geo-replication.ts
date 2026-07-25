import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  emaEvent,
  emaRate,
  isAlive,
  killNode,
  recordSample,
  severEdge,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, ParamValues, SimState } from "@/engine/types";

/**
 * Lesson 22 — Geo-Replication. The distributed module's capstone: replication
 * lag, CAP, last-write-wins and failover, all of it again — but at planetary
 * distance, where the round trip is a law rather than a slider you can zero.
 *
 * Two regions, each with its own users and its own database, and one cable
 * between them whose crossing time IS the RTT slider. Everything else follows:
 *
 *   ACTIVE-ACTIVE — each database accepts its local writes immediately (17 ms,
 *   a hop across a datacenter) and ships them across afterwards. Two regions
 *   writing the same key inside that flight window never see each other, so
 *   when the copies meet, last-write-wins keeps one and discards the other.
 *   CONFLICTS is the count of acknowledged writes this system has destroyed.
 *
 *   SINGLE-PRIMARY — us-east is the only writer. eu-west's writes cross the
 *   ocean and wait for the acknowledgement to come back, so its latency meter
 *   parks on the RTT and stays there. Zero conflicts, bought with one round
 *   trip on every save button in Europe.
 *
 * The mode select is the lesson: it trades one visible meter against another,
 * with both on screen at once. Then us-east dies (scripted, t=23.5) and the
 * same choice pays out again — active-active shrugs, single-primary bounces
 * writes until a promotion that eats every write the dead primary had not yet
 * shipped.
 */

/* ---------------------------------------------------------------------------
   Geography
--------------------------------------------------------------------------- */

const REGIONS = ["east", "west"] as const;
type Region = (typeof REGIONS)[number];
const other = (r: Region): Region => (r === "east" ? "west" : "east");

const DB: Record<Region, string> = { east: "db-e", west: "db-w" };
const CLIENT: Record<Region, string> = { east: "cli-e", west: "cli-w" };
/** Each region's own users → its own database. Short, cheap, local. */
const LOCAL_EDGE: Record<Region, string> = { east: "in-e", west: "in-w" };

/** The replication cable, authored east→west. Async copies, both directions. */
const REPL = "repl";
/** The forwarding cable, authored west→east: a replica's write and its ack. */
const FWD = "fwd";
/** `reverse` flips a packet to travel to→from, so it depends on the target. */
const replReverse = (dest: Region) => dest === "east";
const fwdReverse = (dest: Region) => dest === "west";

/* ---------------------------------------------------------------------------
   The one number this lesson is about: sim-seconds → milliseconds
--------------------------------------------------------------------------- */

/**
 * One sim-second of flight IS 40 ms of network. Every latency in this lesson
 * is *measured* against that scale, never asserted: a packet carries the sim
 * time its client sent it and the number is stamped on arrival.
 *
 *   local hop        0.2 sim-s each way  →   8 ms  →  16 ms per local write
 *   ocean crossing   rtt/2 ms each way   →  the slider, exactly
 *
 * So the cross-region packet speed is a function of the slider:
 *
 *   one-way duration = (rtt / 2) / MS_PER_SIM_SEC   sim-seconds
 *   speed            = 1 / duration = 2 * MS_PER_SIM_SEC / rtt
 *
 * which at the default 80 ms is exactly 1.0 progress-units per second — one
 * whole second of watching a single write cross the Atlantic. At the 300 ms
 * end it is 0.267, and the cable visibly fills with writes in flight, which is
 * the same fact the conflict counter reports in numbers.
 *
 * Arrival is sampled on the 30 Hz clock, so a measured leg overshoots its
 * flight time by up to one tick (1.3 ms): a local write reads 17 ms rather
 * than 16, and eu-west's single-primary write reads ~100 ms rather than 96 at
 * the default RTT. Measured beats asserted — this is what a real client's
 * stopwatch does too — and 4 ms of sampling noise on an ocean is the truth.
 */
const MS_PER_SIM_SEC = 40;
/** Progress units/sec on a local edge: 0.2 sim-s = 8 ms each way. */
const LOCAL_SPEED = 5;
const crossSpeed = (rtt: number) => (2 * MS_PER_SIM_SEC) / rtt;

/* ---------------------------------------------------------------------------
   Tuning
--------------------------------------------------------------------------- */

/**
 * A small, hot keyspace — eight rows both regions care about (a user profile,
 * a cart, a counter). Conflicts are not a freak event in a system like this:
 * eight keys, six writes a second across the two regions and an 80 ms window
 * cost about a third of the writes at seed 42, which is the point being made.
 * Colder keys or a slower rate make it rare again, and the write-rate slider
 * is there so the learner can prove that to themselves.
 */
const KEYSPACE = 8;

/** Per-*event* EMA rates. Both MUST stay < 1 (see `emaEvent`). */
const LAT_EMA = 0.25;
const LAG_EMA = 0.2;

/** Sim-seconds between eu-west latency samples (the sparkline's resolution). */
const SAMPLE_EVERY = 0.25;

/**
 * Replication packets a rejoining region streams for show. A real rejoin
 * replays the log; past a handful of entries it ships a base backup instead,
 * modelled here as an instant copy (the state is settled at the reconcile, the
 * packets are the visible trace of it).
 */
const RESYNC_SHOWN = 5;

/** Refusals travel at local speed — an error is cheap to deliver. */
const DROP_SPEED = LOCAL_SPEED;

/* The scripted arc. The mode flip is a *window*, not a setting: it outranks
   the select for five and a half seconds and then hands control back, so the
   outage at 23.5 plays out in whatever mode the learner is actually in. */
const FLIP_AT = 17.5;
const FLIP_SECONDS = 5.5;
const KILL_AT = 23.5;
const PROMOTE_AT = 27.5;

/* ---------------------------------------------------------------------------
   State
--------------------------------------------------------------------------- */

/** The value a region holds for one key. */
interface KeyRec {
  /** Sim time of the write that produced it (the last-write-wins clock). */
  ts: number;
  /** Which region accepted that write. */
  origin: Region;
  /** The far region has seen it — its replication landed, win or lose. */
  acked: boolean;
}

interface GeoState {
  store: Record<Region, KeyRec[]>;
  /**
   * Writes committed here that the far region has not applied — the RPO
   * window, live. Incremented on every local commit, decremented when a
   * replication from here lands. Packets a death severed never land, so they
   * stay counted: that is precisely what a promotion then throws away.
   */
  unshipped: Record<Region, number>;
  /** Measured client-side write latency, ms. */
  lat: Record<Region, number>;
  /** Measured age of a write when it lands on the far replica, ms. */
  replLagMs: number;
  /** Acknowledged writes discarded by last-write-wins. */
  conflicts: number;
  /** Acknowledged writes destroyed by a failover. */
  lostWrites: number;
  /** Writes refused because no primary was reachable. */
  rejected: number;
  /** Who accepts writes in single-primary mode. Moves on promotion. */
  primary: Region;
  wasAlive: Record<Region, boolean>;
  commitEma: Record<Region, number>;
  /** Scripted single-primary window: overrides the select until this time. */
  scriptPrimaryUntil: number;
  sampleAcc: number;
}

/** What the figure hangs on each database. */
export interface GeoDbMeta {
  /** "writer" = active-active (every region is a primary). */
  role: "writer" | "primary" | "replica";
  /** Writes committed here that the other region has never seen. */
  unshipped: number;
}

/** What the figure hangs under each client. */
export interface GeoClientMeta {
  latencyMs: number;
}

const emptyStore = (): KeyRec[] =>
  Array.from({ length: KEYSPACE }, () => ({
    ts: 0,
    origin: "east" as Region,
    acked: true,
  }));

/**
 * Single-primary in force right now — the learner's select, unless the
 * scripted window is holding it. Shared by `step` and the timeline gates so
 * they can never disagree about which mode the run is in.
 */
function singlePrimaryNow(
  state: SimState<GeoState>,
  params: ParamValues,
): boolean {
  return (
    state.t < state.lesson.scriptPrimaryUntil ||
    params.mode === "single-primary"
  );
}

/** Accept a write locally. It is durable here and nowhere else. */
function commitLocal(state: SimState<GeoState>, r: Region, key: number): void {
  state.lesson.store[r][key] = { ts: state.t, origin: r, acked: false };
  state.lesson.unshipped[r] += 1;
}

/**
 * Apply a write that arrived from the far side — and, on the way, settle
 * whether the two regions were writing in the dark.
 */
function applyRemote(
  state: SimState<GeoState>,
  dest: Region,
  key: number,
  ts: number,
  origin: Region,
  lagMs: number | null,
): void {
  const L = state.lesson;
  // Landed on a corpse: nothing is applied and the write stays unshipped.
  if (!isAlive(state, DB[dest])) return;
  L.unshipped[origin] = Math.max(0, L.unshipped[origin] - 1);

  const src = L.store[origin][key];
  if (src.origin === origin && src.ts === ts) src.acked = true;

  const local = L.store[dest][key];
  /*
   * An un-acked local write on this key means the sender cannot possibly have
   * seen it — its own copy was still on the wire — so the two writes raced
   * inside the flight window. Detected exactly once per racing pair: the other
   * direction's packet arrives to find `acked` already set by this one.
   */
  const concurrent = local.origin === dest && !local.acked;
  // Last-write-wins by timestamp; a tie goes to us-east. Arbitrary, and
  // deterministic — which is all a tiebreak has to be.
  const remoteWins = ts > local.ts || (ts === local.ts && origin === "east");

  if (concurrent) {
    L.conflicts += 1;
    const loser = remoteWins ? dest : origin;
    // Nobody is told. This dot is the lesson making the silence visible: it
    // travels back to the client whose write no longer exists.
    if (isAlive(state, DB[loser])) {
      spawnPacket(state, LOCAL_EDGE[loser], "conflict", {
        speed: LOCAL_SPEED,
        reverse: true,
        size: 3.5,
      });
    }
  }

  if (remoteWins) L.store[dest][key] = { ts, origin, acked: true };
  if (lagMs !== null) L.replLagMs = emaEvent(L.replLagMs, lagMs, LAG_EMA);
}

/** Ship a committed write across the ocean (asynchronously, always). */
function replicate(
  state: SimState<GeoState>,
  from: Region,
  key: number,
  speed: number,
): void {
  const dest = other(from);
  const rec = state.lesson.store[from][key];
  // No cable to a dead region and none from one: the write simply stays
  // unshipped, which is the failover window accumulating in plain sight.
  if (!isAlive(state, DB[dest]) || !isAlive(state, DB[from])) return;
  const packet = spawnPacket(state, REPL, "replication", {
    speed,
    size: 3,
    reverse: replReverse(dest),
    payload: { key, ts: rec.ts, origin: from, dest },
  });
  // At the pool cap the wire is a picture, not the ledger — apply it now
  // rather than lose the write to a rendering budget.
  if (!packet) applyRemote(state, dest, key, rec.ts, from, null);
}

/**
 * A region rejoins. Both sides settle every key by the same last-write-wins
 * rule, un-acked losers included (they are conflicts like any other), and the
 * catch-up is streamed for the first few keys so it is visible.
 */
function reconcile(
  state: SimState<GeoState>,
  rejoined: Region,
  speed: number,
): void {
  const L = state.lesson;
  const peer = other(rejoined);
  if (!isAlive(state, DB[peer])) return;

  let shown = 0;
  for (let key = 0; key < KEYSPACE; key++) {
    const mine = L.store[rejoined][key];
    const theirs = L.store[peer][key];
    if (mine.ts === theirs.ts) continue;
    const from = mine.ts > theirs.ts ? rejoined : peer;
    const dest = other(from);
    const losing = L.store[dest][key];
    if (losing.origin === dest && !losing.acked) L.conflicts += 1;

    L.store[dest][key] = { ...L.store[from][key], acked: true };
    L.store[from][key].acked = true;
    if (shown < RESYNC_SHOWN) {
      shown += 1;
      spawnPacket(state, REPL, "replication", {
        speed,
        size: 3,
        reverse: replReverse(dest),
        payload: { resync: true },
      });
    }
  }
  L.unshipped[rejoined] = 0;
  L.unshipped[peer] = 0;
}

/**
 * Failover. The surviving region becomes the primary, and every write the dead
 * one committed but never shipped is gone — counted, then erased, so a region
 * that comes back cannot resurrect writes the new primary has never heard of.
 */
function promote(state: SimState<GeoState>): void {
  const L = state.lesson;
  const dead = L.primary;
  const successor = other(dead);
  if (isAlive(state, DB[dead]) || !isAlive(state, DB[successor])) return;

  L.lostWrites += L.unshipped[dead];
  L.unshipped[dead] = 0;
  L.primary = successor;
  // Fence the corpse: whatever it still had on the wire is void.
  severEdge(state, REPL, "drop");
  for (let key = 0; key < KEYSPACE; key++) {
    const rec = L.store[dead][key];
    if (rec.origin === dead && !rec.acked) {
      L.store[dead][key] = { ...L.store[successor][key], acked: true };
    }
  }
}

/* ---------------------------------------------------------------------------
   The lesson
--------------------------------------------------------------------------- */

export const geoReplicationSim: LessonSim<GeoState> = {
  id: "geo-replication",

  topology: {
    nodes: [
      { id: "cli-e", kind: "client", label: "us-east app", x: 95, y: 155 },
      {
        id: "db-e",
        kind: "database",
        label: "db-us-east",
        x: 280,
        y: 265,
        breakable: true,
      },
      {
        id: "db-w",
        kind: "database",
        label: "db-eu-west",
        x: 520,
        y: 265,
        breakable: true,
      },
      { id: "cli-w", kind: "client", label: "eu-west app", x: 705, y: 155 },
    ],
    edges: [
      { id: "in-e", from: "cli-e", to: "db-e" },
      { id: "in-w", from: "cli-w", to: "db-w" },
      // Two cables across the same ocean, bowed apart so the streams stay
      // legible when both are busy: replication above, forwarded writes below.
      { id: REPL, from: "db-e", to: "db-w", curve: -0.28 },
      { id: FWD, from: "db-w", to: "db-e", curve: -0.28 },
    ],
  },

  params: [
    {
      key: "rtt",
      label: "inter-region rtt",
      kind: "slider",
      min: 40,
      max: 300,
      step: 10,
      unit: " ms",
      // ~80 ms is a real us-east↔eu-west round trip: about 16,000 km of fiber
      // once you count the routing that never goes in a straight line.
      defaultValue: 80,
    },
    {
      key: "mode",
      label: "write mode",
      kind: "select",
      options: [
        { value: "active-active", label: "active-active" },
        { value: "single-primary", label: "single-primary (us-east)" },
      ],
      defaultValue: "active-active",
    },
    {
      key: "rate",
      label: "write rate / region",
      kind: "slider",
      min: 1,
      max: 6,
      step: 1,
      unit: " w/s",
      defaultValue: 3,
    },
  ],

  init: () => ({
    store: { east: emptyStore(), west: emptyStore() },
    unshipped: { east: 0, west: 0 },
    // Everyone starts at the local round trip; the meters are measured from
    // the first write onward and converge within a second either way.
    lat: { east: 17, west: 17 },
    replLagMs: 40,
    conflicts: 0,
    lostWrites: 0,
    rejected: 0,
    primary: "east",
    wasAlive: { east: true, west: true },
    commitEma: { east: 0, west: 0 },
    scriptPrimaryUntil: 0,
    sampleAcc: 0,
  }),

  initialNodes: {
    "db-e": { meta: { role: "writer", unshipped: 0 } },
    "db-w": { meta: { role: "writer", unshipped: 0 } },
    "cli-e": { meta: { latencyMs: 17 } },
    "cli-w": { meta: { latencyMs: 17 } },
  },

  step: (state, dt, params) => {
    const L = state.lesson;
    const rtt = Number(params.rtt);
    const rate = Number(params.rate);
    const cross = crossSpeed(rtt);
    const singlePrimary = singlePrimaryNow(state, params);
    const commits: Record<Region, number> = { east: 0, west: 0 };

    // 0. Membership. Replication in flight to or from a dying region dies
    //    where the failure caught it; a forwarded write is deliberately NOT
    //    severed, because a remote writer's experience of an outage is a
    //    request that crosses an ocean to find nobody home.
    for (const r of REGIONS) {
      const alive = isAlive(state, DB[r]);
      if (alive === L.wasAlive[r]) continue;
      L.wasAlive[r] = alive;
      if (!alive) severEdge(state, REPL, "drop");
      else reconcile(state, r, cross);
    }

    // 1. Both regions' users write, all day, independently.
    for (const r of REGIONS) {
      const spawns = shouldSpawn(state, rate, dt);
      for (let i = 0; i < spawns; i++) {
        const key = Math.floor(state.rng() * KEYSPACE);
        spawnPacket(state, LOCAL_EDGE[r], "write", {
          speed: LOCAL_SPEED,
          payload: { key, from: r, t0: state.t },
        });
      }
    }

    // 2. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const key = Number(p.payload?.key ?? 0);
      const t0 = Number(p.payload?.t0 ?? p.bornAt);

      if (p.edgeId === LOCAL_EDGE.east || p.edgeId === LOCAL_EDGE.west) {
        const r: Region = p.edgeId === LOCAL_EDGE.east ? "east" : "west";
        if (p.type === "write") {
          if (!isAlive(state, DB[r])) {
            // The region's own database is gone; its users are down with it.
            L.rejected += 1;
            bounceDrop(state, p.edgeId, { speed: DROP_SPEED });
          } else if (!singlePrimary || L.primary === r) {
            commitLocal(state, r, key);
            commits[r] += 1;
            replicate(state, r, key, cross);
            spawnPacket(state, LOCAL_EDGE[r], "response", {
              speed: LOCAL_SPEED,
              reverse: true,
              payload: { t0 },
            });
          } else {
            // A replica may not accept a write: across the ocean it goes.
            const dest = L.primary;
            spawnPacket(state, FWD, "write", {
              speed: cross,
              reverse: fwdReverse(dest),
              payload: { key, from: r, dest, t0 },
            });
          }
        } else if (p.type === "response") {
          L.lat[r] = emaEvent(L.lat[r], (state.t - t0) * MS_PER_SIM_SEC, LAT_EMA);
        }
        // "drop" and "conflict" reaching a client need no handling — they are
        // the client finding out (or, for a conflict, not finding out).
        continue;
      }

      if (p.edgeId === REPL) {
        // Severed replication ("drop") and catch-up streams fade out on arrival.
        if (p.type !== "replication" || p.payload?.resync === true) continue;
        applyRemote(
          state,
          p.payload?.dest as Region,
          key,
          Number(p.payload?.ts ?? 0),
          p.payload?.origin as Region,
          (state.t - p.bornAt) * MS_PER_SIM_SEC,
        );
        continue;
      }

      // The forwarding cable.
      const home = (p.payload?.from as Region) ?? "west";
      if (p.type === "write") {
        const dest = p.payload?.dest as Region;
        const acceptable =
          isAlive(state, DB[dest]) && (!singlePrimary || L.primary === dest);
        if (!acceptable) {
          L.rejected += 1;
          spawnPacket(state, FWD, "drop", {
            speed: cross,
            size: 3,
            reverse: fwdReverse(home),
            payload: { dest: home },
          });
          continue;
        }
        commitLocal(state, dest, key);
        commits[dest] += 1;
        // The acknowledgement carries the commit home: this replica proxied
        // the write, so it applies the value as the ack passes through it.
        // (us-east's own writes still ride the ordinary replication cable.)
        spawnPacket(state, FWD, "response", {
          speed: cross,
          reverse: fwdReverse(home),
          payload: {
            key,
            ts: L.store[dest][key].ts,
            origin: dest,
            dest: home,
            t0,
          },
        });
      } else if (p.type === "response") {
        const dest = p.payload?.dest as Region;
        applyRemote(
          state,
          dest,
          key,
          Number(p.payload?.ts ?? 0),
          p.payload?.origin as Region,
          (state.t - p.bornAt) * MS_PER_SIM_SEC,
        );
        // The acknowledgement outlived the replica that was waiting for it.
        const ok = isAlive(state, DB[dest]);
        if (!ok) L.rejected += 1;
        spawnPacket(state, LOCAL_EDGE[dest], ok ? "response" : "drop", {
          speed: LOCAL_SPEED,
          reverse: true,
          size: ok ? undefined : 3,
          payload: { t0 },
        });
      } else if (p.type === "drop") {
        const dest = p.payload?.dest as Region;
        spawnPacket(state, LOCAL_EDGE[dest], "drop", {
          speed: DROP_SPEED,
          reverse: true,
          size: 3,
        });
      }
    }

    // 3. Readouts.
    for (const r of REGIONS) {
      const db = state.nodes[DB[r]];
      const alive = isAlive(state, DB[r]);
      L.commitEma[r] = emaRate(L.commitEma[r], commits[r], dt);
      db.load = alive
        ? approach(db.load, clamp01(L.commitEma[r] / Math.max(rate * 1.6, 1)), 5, dt)
        : 0;
      db.meta = {
        role: !singlePrimary ? "writer" : L.primary === r ? "primary" : "replica",
        unshipped: L.unshipped[r],
      } satisfies GeoDbMeta;
      state.nodes[CLIENT[r]].meta = {
        latencyMs: L.lat[r],
      } satisfies GeoClientMeta;
    }

    state.metrics.latEast = L.lat.east;
    state.metrics.latWest = L.lat.west;
    state.metrics.replLag = L.replLagMs;
    state.metrics.conflicts = L.conflicts;
    state.metrics.lostWrites = L.lostWrites;
    state.metrics.rejected = L.rejected;
    // Read by the stage overlay: the band divider prints the live crossing.
    state.metrics.rtt = rtt;
    state.metrics.singlePrimary = singlePrimary ? 1 : 0;

    L.sampleAcc += dt;
    if (L.sampleAcc >= SAMPLE_EVERY) {
      L.sampleAcc -= SAMPLE_EVERY;
      recordSample(state, "latWest", L.lat.west);
    }
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Two regions, one dataset. Each side answers its own users from the database next door — 17 ms.",
    },
    {
      at: 4.5,
      caption:
        "Violet crossing the middle is replication. Every write here is fast because it hasn't told the truth yet.",
    },
    {
      at: 8.5,
      caption:
        "CONFLICTS counts writes last-write-wins threw away. Orange dots are the clients who were never told.",
    },
    {
      at: 11.5,
      caption:
        "⚠ Drag INTER-REGION RTT. The flight window is how long two regions can write in the dark.",
    },
    {
      at: 14.5,
      caption:
        "Or raise WRITE RATE — the same bet on the same eight keys, taken more often per second.",
    },
    {
      at: FLIP_AT,
      caption:
        "Now SINGLE-PRIMARY: us-east is the only writer in the world. Watch eu-west's meter.",
      apply: (s) => {
        s.lesson.scriptPrimaryUntil = s.t + FLIP_SECONDS;
      },
    },
    {
      at: 21,
      caption:
        "No new conflicts — there is only one writer. And eu-west has parked on the ocean floor.",
    },
    {
      at: FLIP_AT + FLIP_SECONDS,
      caption:
        "The select is yours again. Those two meters, moving in opposite directions, are the whole decision.",
    },
    {
      at: KILL_AT,
      caption: "☠ us-east is gone — not a server, the region.",
      apply: (s) => killNode(s, DB.east),
    },
    {
      at: KILL_AT + 0.7,
      when: (s, p) => !singlePrimaryNow(s, p) && !isAlive(s, DB.east),
      caption:
        "Active-active: eu-west never flinched. It was already a full copy AND already its own users' writer.",
    },
    {
      at: KILL_AT + 0.7,
      when: (s, p) => singlePrimaryNow(s, p) && !isAlive(s, DB.east),
      caption:
        "Single-primary: eu-west's writes are crossing an ocean to find nobody home. Watch them come back red.",
    },
    {
      at: 26.5,
      when: (s, p) => !singlePrimaryNow(s, p) && !isAlive(s, DB.east),
      caption:
        "No election, no promotion, no data loss. That is the pitch — and CONFLICTS is its price on every ordinary day.",
    },
    {
      at: PROMOTE_AT,
      when: (s, p) =>
        singlePrimaryNow(s, p) &&
        !isAlive(s, DB[s.lesson.primary]) &&
        isAlive(s, DB[other(s.lesson.primary)]),
      caption:
        "↑ eu-west is promoted. Everything us-east committed but never shipped is gone — that is LOST WRITES.",
      apply: promote,
    },
    {
      at: PROMOTE_AT + 1,
      when: (s) => s.lesson.primary === "west" && s.lesson.lostWrites > 0,
      caption:
        "eu-west writes are local again. The users who saved something in that last second are the ones who paid.",
    },
  ],

  quiz: [
    {
      id: "geo-conflict",
      at: 7,
      question:
        "Both regions accept a write to the SAME key inside the ~80 ms replication flight window — neither database has heard of the other's yet. What happens when the two copies meet?",
      choices: [
        {
          id: "lww",
          label: "Last-write-wins keeps one; the other is discarded, silently",
        },
        {
          id: "order",
          label: "Both are applied in timestamp order, so no write is lost",
        },
        {
          id: "reject",
          label: "The later write is rejected and its client sees a conflict error",
        },
      ],
      correctChoiceId: "lww",
      explain:
        "Both clients already got their 200. Each database accepted locally, before it had any way to know about the other — that is what bought the 17 ms. When the copies meet, one value survives: last-write-wins picks it by timestamp, with ties broken by region here (arbitrary, and deterministic, which is all a tiebreak has to be). The other write is gone. No error, no retry, no notification. CONFLICTS is the invoice for the fast local write: acknowledged writes this system has quietly destroyed. Widen the RTT and it climbs, because the flight window is exactly how long two regions may write in the dark. The alternatives keep both writes but demand more of your data model: CRDTs (counters, sets, sequences that merge instead of choosing) and application-level merge functions. 'Add to cart' merges beautifully; 'change my shipping address' does not.",
    },
    {
      id: "geo-latency",
      at: 19.5,
      question:
        "Single-primary: every write in the world commits in us-east. What is the FLOOR on write latency for a user in eu-west?",
      choices: [
        {
          id: "rtt",
          label: "One inter-region round trip — the RTT, before the database does any work",
        },
        {
          id: "same",
          label: "Roughly the same as us-east, once the connection is warm and pooled",
        },
        { id: "half", label: "Half the round trip — the ack doesn't have to come back" },
      ],
      correctChoiceId: "rtt",
      explain:
        "The write has to reach us-east and the acknowledgement has to come back: one full round trip, before the primary has done a microsecond of work. Nothing in your stack moves that. Light in fiber covers about 200 km per millisecond, so an 80 ms round trip is roughly 16,000 km of glass — and the Atlantic does not get shorter for a bigger instance, a warmer pool or a faster disk. Watch eu-west's meter climb to the RTT plus its local hop — about 100 ms at the default 80 — and park there while us-east stays at 17. That asymmetry is why 'which region owns the writes' is a product decision, not an infrastructure one: whichever ocean your primary sits on, somebody is on the far side of it, and this is what they pay on every save button.",
    },
  ],

  meters: [
    {
      metricKey: "latEast",
      label: "us-east latency",
      kind: "counter",
      unit: "ms",
    },
    {
      metricKey: "latWest",
      label: "eu-west latency",
      kind: "sparkline",
      unit: "ms",
      // Past ~60 ms somebody's writes are crossing an ocean before they commit.
      // A cost, not a fault — but the shape of the trace is the argument.
      dangerAbove: 60,
    },
    {
      metricKey: "replLag",
      label: "replication lag",
      kind: "counter",
      unit: "ms",
    },
    {
      /*
       * Deliberately NOT `dangerAbove: 0`. A conflict here is not a fault the
       * system should be red about — it is the price of a choice the learner
       * made, ticking up exactly as designed. Red is reserved for the meter
       * below, where writes an operator promised are actually destroyed.
       */
      metricKey: "conflicts",
      label: "conflicts (lww losses)",
      kind: "counter",
    },
    {
      metricKey: "lostWrites",
      label: "lost writes",
      kind: "counter",
      dangerAbove: 0,
    },
  ],

  packetStyles: {
    /** The overwrite nobody was told about. Warning hue, never brand amber. */
    conflict: { color: "var(--color-glow-orange)" },
  },

  packetLegend: [
    { type: "write", label: "write / replication" },
    { type: "response", label: "acknowledged" },
    { type: "conflict", label: "overwritten by lww" },
    { type: "drop", label: "no primary reachable" },
  ],
};
