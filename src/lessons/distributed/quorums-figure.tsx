"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { quorumsSim } from "./quorums";

export function QuorumsFigure() {
  return (
    <SectionFigure
      sim={quorumsSim}
      // Both interactive sections render the same figure; wire the second one
      // ("read-quorum") to complete when the reader drags R — the control that
      // section is about lives in this shared figure.
      completes={[
        { on: "param-change", id: "r", section: "read-quorum" },
        { on: "quiz-answered", id: "quorums-overlap", section: "read-quorum" },
      ]}
      description="A client writing to and reading from five replica databases arranged in a ring. Each write fans out to all five (violet) and the commit returns the moment W of them ack (green); each read consults R replicas (amber) and comes back orange when its R replicas all missed the newest write. Sliders set W and R; a meter shows R + W − N, and the stale-read gauge stays at zero while that value is positive. Part-way through, the store is reconfigured to R = W = 2 so stale reads appear on their own; afterwards, killing replicas below W makes writes get rejected."
    />
  );
}
