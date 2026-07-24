"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { loadBalancingSim } from "./load-balancing";

export function LoadBalancingFigure(props: { seed?: number }) {
  return (
    <SectionFigure
      sim={loadBalancingSim}
      seed={props.seed}
      description="A load balancer routing request packets from a client to three servers, one of which is a smaller instance. A strategy selector switches between round-robin, least-connections, and random; servers can be clicked to kill or revive them. Meters show throughput, latency, and drops."
    />
  );
}
