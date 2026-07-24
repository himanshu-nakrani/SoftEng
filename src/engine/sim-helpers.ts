import type { Packet, PacketType, SimState } from "./types";
import { PACKET_POOL } from "./types";

/* Author toolkit — the verbs lesson `step` functions are written in.
   All helpers mutate state in place (the sim is never serialized). */

export interface SpawnOpts {
  speed?: number;
  reverse?: boolean;
  size?: number;
  payload?: Record<string, unknown>;
}

/**
 * Spawn a packet on an edge. Silently no-ops at the pool cap — high load is
 * shown via aggregates (queue bars, glow intensity), never more dots.
 */
export function spawnPacket(
  state: SimState<unknown>,
  edgeId: string,
  type: PacketType,
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

/** base ± jitter fraction, seeded. */
export function jitter(
  state: SimState<unknown>,
  base: number,
  fraction = 0.3,
): number {
  return base * (1 + (state.rng() * 2 - 1) * fraction);
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
