import type { MutableRefObject } from "react";
import type { NodeRuntime, SimState } from "./types";

/**
 * What the React (structure) layer sees. Published at ~10Hz — meters and
 * node chrome re-render at snapshot frequency, never per frame. CSS
 * transitions interpolate between snapshots so 10Hz still looks continuous.
 * Packets are deliberately absent: PacketLayer reads the live state ref.
 */
export interface SimSnapshot {
  t: number;
  metrics: Record<string, number>;
  nodes: Record<string, NodeRuntime>;
  caption: string | null;
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
      nodes[id] = { ...n };
    }
    return { t: s.t, metrics: { ...s.metrics }, nodes, caption: lastCaption };
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
