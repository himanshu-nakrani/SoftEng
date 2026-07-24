"use client";

import { useEffect, useRef } from "react";
import type { PathRegistry } from "../paths";
import { pointAt } from "../paths";
import type { PacketType } from "../types";
import { PACKET_POOL } from "../types";
import type { Simulation } from "../useSimulation";

const packetColor: Record<PacketType, string> = {
  request: "var(--color-accent)",
  response: "var(--color-glow-green)",
  hit: "var(--color-glow-green)",
  miss: "var(--color-glow-cyan)",
  write: "var(--color-glow-violet)",
  replication: "var(--color-glow-violet)",
  drop: "var(--color-glow-red)",
  limited: "var(--color-glow-red)",
};

interface PacketLayerProps {
  simulation: Simulation;
  registry: PathRegistry;
  /** When true, packets are hidden (reduced-motion mode). */
  hidden?: boolean;
}

/**
 * The ONLY per-frame consumer. Owns a pool of PACKET_POOL circles mounted
 * once; every frame it reads the live sim state and writes `transform`
 * attributes imperatively. React never re-renders this subtree.
 */
export function PacketLayer({ simulation, registry, hidden }: PacketLayerProps) {
  const groupRef = useRef<SVGGElement>(null);

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
        const { x, y } = pointAt(path, p.progress, p.reverse);
        slot.setAttribute("transform", `translate(${x} ${y})`);
        slot.setAttribute("r", String(p.size ?? 4));
        slot.style.fill = packetColor[p.type];
        slot.style.visibility = "visible";
        // Drops fade out as they die.
        slot.style.opacity = p.type === "drop" ? String(1 - p.progress) : "1";
      }
      for (let i = count; i < PACKET_POOL; i++) {
        slots[i].style.visibility = "hidden";
      }
    };

    sync(); // initial paint (e.g. after restart while paused)
    return simulation.subscribeFrame(sync);
  }, [simulation, registry, hidden]);

  return (
    <g ref={groupRef} aria-hidden style={{ willChange: "transform" }}>
      {Array.from({ length: PACKET_POOL }, (_, i) => (
        <circle key={i} r={4} style={{ visibility: "hidden" }} />
      ))}
    </g>
  );
}
