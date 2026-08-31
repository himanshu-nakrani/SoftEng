"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { tcpHandshakeSim } from "./tcp-handshake";

export function TcpHandshakeFigure() {
  return (
    <SectionFigure
      sim={tcpHandshakeSim}
      completes={[
        // The lossy-link section has no figure of its own: raising the loss
        // slider, or answering the checkpoint after loss turns on, is what
        // demonstrates the retransmit-timeout cost.
        { on: "param-change", id: "loss", section: "lossy-links" },
        { on: "quiz-answered", id: "tcp-lost-syn", section: "lossy-links" },
      ]}
      description="A browser on the left and a server on the right, joined by a single wire. Every new connection opens with a three-way handshake drawn as three packets in turn: a cyan SYN out to the server, a violet SYN-ACK back, and an amber ACK returning — one full round trip spent agreeing to talk before any data moves. The moment the client has the SYN-ACK it sends its request, so time-to-first-byte on a fresh connection is about two round trips. Sliders set the one-way latency, the packet-loss rate, and how many new connections open per second; meters show time-to-send (one RTT), time-to-first-byte, the worst first byte seen so far, and cumulative retransmits. Raise the loss slider and setup packets start vanishing on the wire as fading red drops — but nothing reacts until a retransmit timeout fires, which is several round trips long, so the worst-case latency explodes while the average barely moves."
    />
  );
}
