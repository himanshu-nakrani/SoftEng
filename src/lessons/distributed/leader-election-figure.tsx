"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { leaderElectionSim } from "./leader-election";

export function LeaderElectionFigure() {
  return (
    <SectionFigure
      sim={leaderElectionSim}
      description="Five consensus nodes in a full mesh. The leader (full load bar) sends violet heartbeats; when it dies, randomized election timeouts race, the first expiring node campaigns with amber vote requests, and a majority of the total cluster elects it. Node chips show the current term. Nodes can be clicked dead or alive; with fewer than three alive no quorum exists and the cluster refuses to elect. Meters show leader presence, term, and alive count."
    />
  );
}
