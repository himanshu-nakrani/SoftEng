"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { http3QuicSim } from "./http3-quic";

export function Http3QuicFigure() {
  return (
    <SectionFigure
      sim={http3QuicSim}
      completes={[
        { on: "param-change", id: "protocol", section: "independent-delivery" },
        { on: "param-change", id: "lossRate", section: "independent-delivery" },
      ]}
      description="A browser and server comparing HTTP/3 (QUIC over UDP) with HTTP/2 (over TCP) under packet loss. In HTTP/2, a dropped packet stalls the TCP engine, creating a 600ms head-of-line freeze across every stream. In HTTP/3, QUIC isolates loss recovery to the affected stream alone: Stream 2 completes in 833ms without interruption while Stream 1 retransmits in the background, keeping transport head-of-line delay pinned at exactly zero."
    />
  );
}
