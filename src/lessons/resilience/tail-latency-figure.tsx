"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { tailLatencySim } from "./tail-latency";

export function TailLatencyFigure() {
  return (
    <SectionFigure
      sim={tailLatencySim}
      // "fanout-amplification" has no figure of its own — its subject is the
      // FAN-OUT toggle and the prediction that goes with it, and both live
      // here, in "find-the-tail"'s figure.
      completes={[
        { on: "param-change", id: "fanout", section: "fanout-amplification" },
        { on: "quiz-answered", id: "tl-fanout", section: "fanout-amplification" },
      ]}
      description="Clients send requests to lb-1, which forwards them to three identical api servers. Each server answers in about 40ms, but on a small percentage of requests — set by the slow requests slider, 2% by default and drawn independently per server per request — it stalls instead for the better part of a second, the way a real server does during a garbage collection pause or a lock wait. Amber dots are requests and green dots are answers; a stalled answer is a fat orange dot that visibly crawls back along its edge, and the server holding it turns degraded while it does. Every request's latency is measured end to end, from the client to the answer's return, and the meters read that measured distribution: the sparkline is one sample per completed request with the mean as its readout, and p50 and p99 are percentiles over a sliding window of the last 120 samples. p50 stays flat near 40ms almost regardless of what happens; p99 is the meter that moves. The FAN-OUT toggle sends every request to all three servers at once and completes it only when the slowest leg returns, so a 2% per-server stall rate becomes a 5.9% per-request one and p99 goes from an occasional spike to a permanent plateau. The HEDGE toggle instead sends a second violet copy to a different server for any request still running when it passes the measured p95, taking whichever answer comes back first, which caps the tail at roughly that deadline plus one more round trip for a few percent more requests on the wire. The timeline turns fan-out on at 11 seconds, kills api-2 at 15 and revives it at 17 to show that fewer legs means a thinner tail, then switches to hedging at 19 seconds. Any server can be clicked dead or alive at any time; lb-1 routes around a dead server immediately."
    />
  );
}
