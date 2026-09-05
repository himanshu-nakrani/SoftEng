"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { httpPipeliningHolSim } from "./http-pipelining-hol";

export function HttpPipeliningHolFigure() {
  return (
    <SectionFigure
      sim={httpPipeliningHolSim}
      completes={[
        { on: "param-change", id: "pipelining", section: "fifo-head-of-line" },
        { on: "param-change", id: "connections", section: "fifo-head-of-line" },
      ]}
      description="A browser and origin server exchanging a batch of four resources over one or two HTTP/1.1 connections. Under pipelining, all requests fly to the server immediately without waiting for previous responses. When the first request is slow, the server finishes computing fast requests 2, 3, and 4 in tens of milliseconds but is forbidden by RFC 2616 from transmitting them until response 1 clears. The HOL delay meter measures the hundreds of milliseconds fast responses sit trapped in the server buffer. Opening a second connection routes fast requests around the blocked lane, dropping HOL delay to zero."
    />
  );
}
