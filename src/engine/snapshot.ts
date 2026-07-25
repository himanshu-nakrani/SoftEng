import type { MutableRefObject } from "react";
import type { NodeRuntime, Packet, SimState } from "./types";

/**
 * What the React (structure) layer sees. Published at ~10Hz — meters and
 * node chrome re-render at snapshot frequency, never per frame. CSS
 * transitions interpolate between snapshots so 10Hz still looks continuous.
 * Packets are deliberately absent: PacketLayer reads the live state ref.
 */
export interface SimSnapshot {
  t: number;
  metrics: Record<string, number>;
  /**
   * Copies of `SimState.series` (see `recordSample`) — what "sparkline"
   * meters draw. Bounded rings, so the per-publish copy is cheap and the
   * React layer never aliases the live arrays.
   */
  series: Record<string, number[]>;
  nodes: Record<string, NodeRuntime>;
  /**
   * Per-edge traffic aggregate: how many packets are on the edge right now
   * and which type most of them are. Not the packets themselves — this is the
   * *shape* of the flow, coarse enough for the 10Hz React layer.
   *
   * It exists because reduced motion hides `PacketLayer` outright, taking the
   * lesson's core signal with it; `EdgeLine` re-expresses that signal as edge
   * weight and color, which is information without movement. Only edges with
   * at least one in-flight packet appear, so an idle stage costs one empty
   * object per publish.
   */
  edgeActivity: Record<string, EdgeActivity>;
  caption: string | null;
}

/** In-flight traffic on one edge at snapshot time. */
export interface EdgeActivity {
  /** In-flight packets on this edge (all types, both directions). */
  count: number;
  /** The most common `Packet.type` on the edge; ties go to the older packet. */
  dominantType: string | null;
}

export interface SnapshotStore {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => SimSnapshot;
  getServerSnapshot: () => SimSnapshot;
  /** Rebuild + notify, throttled to `hz`. */
  maybePublish: (now: number, caption: string | null) => void;
  /** Rebuild + notify immediately (restart, step-once, param jolt). */
  publish: (caption?: string | null) => void;
}

/**
 * Tally in-flight packets per edge. One pass over `packets` (≤ PACKET_POOL =
 * 128) plus one pass over the edges that actually carry traffic, ten times a
 * second — cheaper than the node clone above it, and it allocates nothing at
 * all while the stage is empty.
 *
 * Insertion order decides ties, and `packets` is spawn-ordered, so the older
 * type wins a 1-1 split. That keeps the dominant type stable frame to frame
 * instead of flickering between two equally common kinds.
 */
function buildEdgeActivity(packets: Packet[]): Record<string, EdgeActivity> {
  const activity: Record<string, EdgeActivity> = {};
  if (packets.length === 0) return activity;

  const tallies: Record<string, Record<string, number>> = {};
  for (const p of packets) {
    const byType = (tallies[p.edgeId] ??= {});
    byType[p.type] = (byType[p.type] ?? 0) + 1;
  }

  for (const [edgeId, byType] of Object.entries(tallies)) {
    let count = 0;
    let dominantType: string | null = null;
    let best = 0;
    for (const [type, n] of Object.entries(byType)) {
      count += n;
      if (n > best) {
        best = n;
        dominantType = type;
      }
    }
    activity[edgeId] = { count, dominantType };
  }
  return activity;
}

export function createSnapshotStore(
  stateRef: MutableRefObject<SimState<never>> | { current: SimState<unknown> },
  hz = 10,
): SnapshotStore {
  const interval = 1000 / hz;
  let lastPublish = 0;
  let lastCaption: string | null = null;

  const build = (): SimSnapshot => {
    const s = stateRef.current;
    const nodes: Record<string, NodeRuntime> = {};
    for (const [id, n] of Object.entries(s.nodes)) {
      nodes[id] = { ...n, meta: n.meta ? structuredClone(n.meta) : undefined };
    }
    const series: Record<string, number[]> = {};
    for (const [key, ring] of Object.entries(s.series)) {
      series[key] = ring.slice();
    }
    return {
      t: s.t,
      metrics: { ...s.metrics },
      series,
      nodes,
      edgeActivity: buildEdgeActivity(s.packets),
      caption: lastCaption,
    };
  };

  let snapshot = build();
  const serverSnapshot = snapshot;
  const listeners = new Set<() => void>();

  const notify = () => {
    snapshot = build();
    for (const cb of listeners) cb();
  };

  return {
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    maybePublish: (now, caption) => {
      if (now - lastPublish >= interval || caption !== lastCaption) {
        lastPublish = now;
        lastCaption = caption;
        notify();
      }
    },
    publish: (caption) => {
      if (caption !== undefined) lastCaption = caption;
      notify();
    },
  };
}
