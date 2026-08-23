import type { Packet, PacketType, SimState } from "./types";
import { PACKET_POOL } from "./types";

/* Author toolkit — the verbs lesson `step` functions are written in.
   All helpers mutate state in place (the sim is never serialized). */

export interface SpawnOpts {
  speed?: number;
  reverse?: boolean;
  size?: number;
  payload?: Record<string, unknown>;
  /**
   * Absolute sim-seconds deadline (usually `state.t + timeout`). Packets past
   * it are reaped by `expirePackets`, which the lesson calls where it wants.
   */
  diesAt?: number;
}

/**
 * Spawn a packet on an edge. Silently no-ops at the pool cap — high load is
 * shown via aggregates (queue bars, glow intensity), never more dots.
 *
 * `type` is a `PacketType` or any key the lesson registered in
 * `packetStyles`; the packet is stamped with `bornAt = state.t`.
 */
export function spawnPacket(
  state: SimState<unknown>,
  edgeId: string,
  // `string & {}` keeps the built-in names in autocomplete while accepting
  // lesson-defined ones — a plain `string` would drop the suggestions.
  type: PacketType | (string & {}),
  opts: SpawnOpts = {},
): Packet | null {
  if (state.packets.length >= PACKET_POOL) return null;
  const packet: Packet = {
    id: state.nextPacketId++,
    edgeId,
    type,
    progress: 0,
    speed: opts.speed ?? 0.5,
    reverse: opts.reverse,
    size: opts.size,
    payload: opts.payload,
    bornAt: state.t,
    diesAt: opts.diesAt,
  };
  state.packets.push(packet);
  return packet;
}

/**
 * Advance all packets by dt; removes and returns the ones that arrived
 * (progress ≥ 1). The lesson's step function routes arrivals.
 */
export function advancePackets(state: SimState<unknown>, dt: number): Packet[] {
  const arrived: Packet[] = [];
  const inFlight: Packet[] = [];
  for (const p of state.packets) {
    p.progress += p.speed * dt;
    if (p.progress >= 1) {
      arrived.push(p);
    } else {
      inFlight.push(p);
    }
  }
  state.packets = inFlight;
  return arrived;
}

/**
 * Remove and return the in-flight packets whose deadline has passed. What an
 * expiry *means* is the lesson's to decide — count it as a timeout, retry it
 * on another edge, re-spawn it as a "drop" so it visibly dies.
 *
 * Compares against `state.t`, which inside `step` is the tick's *start* time
 * (the runner advances the clock after stepping), so a packet spawned with
 * `diesAt: state.t + 2` lives a full 2 sim-seconds.
 */
export function expirePackets(state: SimState<unknown>): Packet[] {
  // Nothing due is the common case (this runs every tick) — scan first so the
  // quiet path allocates nothing and leaves the packet array untouched.
  const due = (p: Packet) => p.diesAt !== undefined && state.t >= p.diesAt;
  if (!state.packets.some(due)) return [];
  const expired: Packet[] = [];
  const alive: Packet[] = [];
  for (const p of state.packets) {
    if (due(p)) expired.push(p);
    else alive.push(p);
  }
  state.packets = alive;
  return expired;
}

/**
 * Cut a link: every packet currently on `edgeId` either disappears (no
 * `toType`) or is converted in place to `toType` — keeping its position and
 * direction, so it dies where the break caught it rather than restarting.
 * Returns the packets it touched, for the lesson to count as lost.
 *
 * The partition verb: call it on the tick a partition opens, and each tick it
 * stays open, to keep the severed link empty.
 */
export function severEdge(
  state: SimState<unknown>,
  edgeId: string,
  toType?: string,
): Packet[] {
  const affected = state.packets.filter((p) => p.edgeId === edgeId);
  if (affected.length === 0) return affected;
  if (toType === undefined) {
    state.packets = state.packets.filter((p) => p.edgeId !== edgeId);
  } else {
    for (const p of affected) p.type = toType;
  }
  return affected;
}

/**
 * Append to a bounded sample ring on `state.series[key]`, trimming from the
 * front past `cap`. For measured *distributions* that a scalar metric cannot
 * express — per-packet latency, per-tick queue depth, inter-arrival gaps —
 * and the data behind "sparkline" meters, which read the same key.
 *
 * Cheap enough to call every tick; the cap is what keeps the snapshot copy
 * (and the sparkline) O(1).
 */
export function recordSample(
  state: SimState<unknown>,
  key: string,
  value: number,
  cap = 120,
): void {
  const ring = (state.series[key] ??= []);
  ring.push(value);
  if (ring.length > cap) ring.splice(0, ring.length - cap);
}

/** Poisson-ish arrival: expected `rate * dt` spawns this tick. */
export function shouldSpawn(
  state: SimState<unknown>,
  rate: number,
  dt: number,
): number {
  const expected = rate * dt;
  const whole = Math.floor(expected);
  return whole + (state.rng() < expected - whole ? 1 : 0);
}

export interface BounceOpts {
  /** Progress units/sec. Defaults to 1.8; several sites still tune it. */
  speed?: number;
  /** Bounces head back toward the sender; pass false to keep the direction. */
  reverse?: boolean;
  /** "drop" (shed/lost) or "limited" (a 429-style refusal). */
  type?: "drop" | "limited";
}

/**
 * The "rejected" visual: a small packet fired back down the edge it arrived
 * on. Covers shed load, dead-node errors, queue-full backpressure and 429s —
 * everywhere a request dies instead of being served.
 */
export function bounceDrop(
  state: SimState<unknown>,
  edgeId: string,
  opts: BounceOpts = {},
): Packet | null {
  return spawnPacket(state, edgeId, opts.type ?? "drop", {
    speed: opts.speed ?? 1.8,
    reverse: opts.reverse ?? true,
    size: 3,
  });
}

/**
 * A bounded work queue being worked off at a fixed rate: `depth` items
 * waiting, `acc` the fractional service credit carried between ticks.
 */
export interface ServiceQueue {
  depth: number;
  acc: number;
}

/**
 * Work a queue off at `capacity` items/sec, calling `onServe` once per item
 * (spawn the response, pop the payload…). Returns how many were served.
 *
 * `acc` banks the fractional remainder so a 5 req/s server really serves 5 a
 * second across 30 ticks. Once the queue empties the credit is clamped to 1:
 * an idle server may bank at most one item of head start, otherwise a quiet
 * stretch would let it teleport through the next backlog.
 */
export function drainQueue(
  q: ServiceQueue,
  capacity: number,
  dt: number,
  onServe: () => void,
): number {
  q.acc += capacity * dt;
  let served = 0;
  while (q.acc >= 1 && q.depth > 0) {
    q.acc -= 1;
    q.depth -= 1;
    onServe();
    served += 1;
  }
  if (q.depth === 0) q.acc = Math.min(q.acc, 1);
  return served;
}

export function killNode(state: SimState<unknown>, nodeId: string): void {
  const node = state.nodes[nodeId];
  if (node) {
    node.health = "dead";
    node.load = 0;
  }
}

export function reviveNode(state: SimState<unknown>, nodeId: string): void {
  const node = state.nodes[nodeId];
  if (node) node.health = "healthy";
}

export function isAlive(state: SimState<unknown>, nodeId: string): boolean {
  return state.nodes[nodeId]?.health !== "dead";
}

/** Exponential smoothing toward a target — makes load bars/meters organic. */
export function approach(
  current: number,
  target: number,
  rate: number,
  dt: number,
): number {
  return current + (target - current) * Math.min(rate * dt, 1);
}

/**
 * Throughput meter: smooth a per-tick event count into events/sec.
 * `count / dt` is this tick's instantaneous rate; `rate` is how hard the
 * meter chases it (higher = twitchier needle).
 */
export function emaRate(
  current: number,
  count: number,
  dt: number,
  rate = 1.5,
): number {
  return approach(current, count / dt, rate, dt);
}

/**
 * Per-*event* smoothing — one sample per arrival (a hit/miss, a fresh/stale
 * read), not one per second. There is no elapsed time to weight by, so dt is
 * pinned to 1 and `rate` becomes the share of the gap each event closes.
 * Note the edge this leans on: `approach` clamps its blend factor at 1, so
 * any `rate >= 1` makes the value *latch* onto the newest sample rather than
 * average — which is exactly what the existing 1.2/1.5 call sites do.
 *
 * Pass a boolean for a 0..1 ratio readout, or a number to track an arbitrary
 * per-event value (e.g. the latency a hit vs. a miss implies).
 */
export function emaEvent(
  current: number,
  sample: number | boolean,
  rate = 1.2,
): number {
  const target = typeof sample === "boolean" ? (sample ? 1 : 0) : sample;
  return approach(current, target, rate, 1);
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
