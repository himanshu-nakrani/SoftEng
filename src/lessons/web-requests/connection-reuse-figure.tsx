"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { connectionReuseSim } from "./connection-reuse";

export function ConnectionReuseFigure() {
  return (
    <SectionFigure
      sim={connectionReuseSim}
      completes={[
        // The later sections have no figure of their own: toggling keep-alive
        // off, or answering the checkpoint, is what demonstrates them.
        { on: "param-change", id: "reuse", section: "pool-under-load" },
        { on: "quiz-answered", id: "reuse-first-request", section: "pool-under-load" },
      ]}
      description="Two browsers on the left driven by the same request stream, and one server on the right. The top browser opens a new connection for every request; the bottom one keeps a single connection alive and reuses it. Each request that needs a fresh connection first sends a violet setup packet and waits a round trip for the handshake, then sends the amber request and receives the green response — about 700ms, two round trips. On the reused connection the setup is skipped, so every request after the first is a single round trip of roughly 350ms. Both clients are identical on the very first request, because neither has a connection yet, and then they diverge: the counters show the top client opening a new connection every time while the bottom client's stays at one. A toggle turns keep-alive off, at which point the bottom client handshakes every time too and the two lanes converge. Meters show each client's latest request latency and the number of connections each has opened."
    />
  );
}
