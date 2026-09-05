"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { http2MultiplexingSim } from "./http2-multiplexing";

export function Http2MultiplexingFigure() {
  return (
    <SectionFigure
      sim={http2MultiplexingSim}
      completes={[
        { on: "param-change", id: "multiplexing", section: "interleaved-multiplexing" },
        { on: "param-change", id: "lossRate", section: "interleaved-multiplexing" },
      ]}
      description="A browser and HTTP/2 origin server exchanging three concurrent streams (CSS, hero image, and an API JSON call) across a single TCP connection. When multiplexing is active, binary frames from all three streams interleave onto the wire: the lightweight API call completes in 733ms without waiting for the large image to finish. Toggling the loss rate slider reveals transport-level head-of-line blocking: when a single TCP segment is dropped, TCP halts delivery of all subsequent frames for 600ms until the retransmission arrives, freezing all streams simultaneously."
    />
  );
}
