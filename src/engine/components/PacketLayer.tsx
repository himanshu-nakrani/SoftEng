"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PathRegistry } from "../paths";
import { pointAt } from "../paths";
import type { LessonSim, PacketStyle, PacketType } from "../types";
import { PACKET_POOL } from "../types";
import type { Simulation } from "../useSimulation";

/**
 * The engine's built-in packet vocabulary. Colors are tokens, never literals —
 * the stage shares one palette with the UI. "drop" is the only built-in that
 * fades: a shed request visibly dies on its way back down the edge.
 */
export const BUILT_IN_PACKET_STYLES: Record<PacketType, PacketStyle> = {
  request: { color: "var(--color-accent)" },
  response: { color: "var(--color-glow-green)" },
  hit: { color: "var(--color-glow-green)" },
  miss: { color: "var(--color-glow-cyan)" },
  write: { color: "var(--color-glow-violet)" },
  replication: { color: "var(--color-glow-violet)" },
  drop: { color: "var(--color-glow-red)", fadeOut: true },
  limited: { color: "var(--color-glow-red)" },
};

/** Drawn for a `Packet.type` no one registered — visible beats invisible. */
export const FALLBACK_PACKET_STYLE: PacketStyle =
  BUILT_IN_PACKET_STYLES.request;

/** Just enough of a lesson to style its packets. */
export type PacketStyleSource = Pick<LessonSim<unknown>, "packetStyles">;

/**
 * The single resolution of "how is this packet type drawn": lesson styles
 * merged over the built-ins (a lesson may add kinds or restyle a built-in).
 * Exported so anything else that has to agree with the stage — a legend, a
 * key in the prose — reads the same map instead of re-deriving it.
 */
export function resolvePacketStyles(
  sim?: PacketStyleSource,
): Record<string, PacketStyle> {
  return sim?.packetStyles
    ? { ...BUILT_IN_PACKET_STYLES, ...sim.packetStyles }
    : BUILT_IN_PACKET_STYLES;
}

interface PacketLayerProps {
  simulation: Simulation;
  registry: PathRegistry;
  /** When true, packets are hidden (reduced-motion mode). */
  hidden?: boolean;
  /** The lesson, read only for `packetStyles`. Omit for built-ins only. */
  sim?: PacketStyleSource;
}

/**
 * The ONLY per-frame consumer. Owns a pool of PACKET_POOL circles mounted
 * once; every frame it reads the live sim state and writes `transform`
 * attributes imperatively. React never re-renders this subtree.
 */
export function PacketLayer({
  simulation,
  registry,
  hidden,
  sim,
}: PacketLayerProps) {
  const groupRef = useRef<SVGGElement>(null);
  // The sim object is authored as a module constant, so this resolves once.
  const styles = useMemo(() => resolvePacketStyles(sim), [sim]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const slots = group.children as HTMLCollectionOf<SVGCircleElement>;

    const sync = () => {
      const { packets } = simulation.stateRef.current;
      const count = hidden ? 0 : Math.min(packets.length, PACKET_POOL);

      for (let i = 0; i < count; i++) {
        const p = packets[i];
        const path = registry.get(p.edgeId);
        const slot = slots[i];
        if (!path || !slot) continue;
        const style = styles[p.type] ?? FALLBACK_PACKET_STYLE;
        const { x, y } = pointAt(path, p.progress, p.reverse);
        slot.setAttribute("transform", `translate(${x} ${y})`);
        slot.setAttribute("r", String(p.size ?? style.size ?? 4));
        slot.style.fill = style.color;
        slot.style.visibility = "visible";
        // Fading kinds (drops, and anything a lesson marks) die as they travel.
        slot.style.opacity = style.fadeOut ? String(1 - p.progress) : "1";
      }
      for (let i = count; i < PACKET_POOL; i++) {
        slots[i].style.visibility = "hidden";
      }
    };

    sync(); // initial paint (e.g. after restart while paused)
    return simulation.subscribeFrame(sync);
  }, [simulation, registry, hidden, styles]);

  return (
    <g ref={groupRef} aria-hidden style={{ willChange: "transform" }}>
      {Array.from({ length: PACKET_POOL }, (_, i) => (
        <circle key={i} r={4} style={{ visibility: "hidden" }} />
      ))}
    </g>
  );
}
