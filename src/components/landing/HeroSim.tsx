"use client";

import { EdgeLine } from "@/engine/components/EdgeLine";
import { PacketLayer } from "@/engine/components/PacketLayer";
import { SystemNode } from "@/engine/components/SystemNode";
import { buildPaths } from "@/engine/paths";
import { useSimulation, useSimSnapshot } from "@/engine/useSimulation";
import { useEffect, useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { heroSim } from "./hero-sim";

/**
 * The hero IS the product: a chromeless, ambient, always-running cluster.
 * Visitors can kill servers within two seconds of arriving; it self-heals.
 */
export function HeroSim() {
  const simulation = useSimulation(heroSim, { seed: 7 });
  const snapshot = useSimSnapshot(simulation);
  const registry = useMemo(() => buildPaths(heroSim.topology), []);
  const reduced = useReducedMotion();

  const { play } = simulation.controls;
  useEffect(() => {
    if (!reduced) play();
  }, [play, reduced]);

  return (
    <svg
      viewBox="0 0 760 420"
      className="block h-auto w-full"
      role="img"
      aria-label="Live simulation: a load balancer routing request packets to three servers. Click a server to kill it; the cluster heals itself."
    >
      {heroSim.topology.edges.map((edge) => (
        <EdgeLine
          key={edge.id}
          path={registry.get(edge.id)!}
          dimmed={snapshot.nodes[edge.to]?.health === "dead"}
        />
      ))}
      <PacketLayer
        simulation={simulation}
        registry={registry}
        hidden={Boolean(reduced)}
      />
      {heroSim.topology.nodes.map((spec) => (
        <SystemNode
          key={spec.id}
          spec={spec}
          runtime={snapshot.nodes[spec.id] ?? { health: "healthy", load: 0 }}
          onToggleHealth={
            spec.breakable ? simulation.controls.toggleNodeHealth : undefined
          }
        />
      ))}
    </svg>
  );
}
