"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { replicationSim } from "./replication";

export function ReplicationFigure() {
  return (
    <SectionFigure
      sim={replicationSim}
      // "stale-reads" has no figure; stretching the replication lag (or
      // answering the read-your-writes checkpoint) is what demonstrates it.
      completes={[
        { on: "param-change", id: "lag", section: "stale-reads" },
        { on: "quiz-answered", id: "read-your-writes", section: "stale-reads" },
      ]}
      description="A leader database receiving writes while two replicas trail behind by a configurable replication lag. Reads round-robin the replicas; amber responses mark stale reads. Meters show the leader version, average replica lag, and stale-read percentage."
    />
  );
}
