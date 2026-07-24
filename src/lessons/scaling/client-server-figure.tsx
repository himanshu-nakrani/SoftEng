"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { clientServerSim } from "./client-server";

/**
 * Client boundary for the client-server sim. LessonSim objects contain
 * functions, so they can't cross the RSC serialization boundary as props —
 * each lesson exports its figure as a client component instead.
 */
export function ClientServerFigure() {
  return (
    <SectionFigure
      sim={clientServerSim}
      description="A client sending request packets across a wire to a single server. Sliders control arrival rate, server speed, and network latency; meters show throughput, latency, queue depth, and drops."
    />
  );
}
