"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { replicationSim } from "./replication";

export function ReplicationFigure() {
  return (
    <SectionFigure
      sim={replicationSim}
      description="A leader database receiving writes while two replicas trail behind by a configurable replication lag. Reads round-robin the replicas; amber responses mark stale reads. Meters show the leader version, average replica lag, and stale-read percentage."
    />
  );
}
