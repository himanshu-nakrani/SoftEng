"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { realtimeDeliverySim } from "./realtime-delivery";

/**
 * Client boundary for the realtime-delivery sim. The figure lives in
 * "pick-transport" (whose subject is the transport selector, so engaging with
 * the figure at all completes it); the restart button, the jitter toggle and
 * the reconnect checkpoint belong to "reconnect-storm" further down the page.
 */
export function RealtimeDeliveryFigure() {
  return (
    <SectionFigure
      sim={realtimeDeliverySim}
      completes={[
        { on: "button-press", id: "restart", section: "reconnect-storm" },
        { on: "param-change", id: "jitter", section: "reconnect-storm" },
        { on: "quiz-answered", id: "rtd-reconnect", section: "reconnect-storm" },
      ]}
      description="Three clients — phone, laptop, tablet — each on its own wire to a chat server that receives messages to deliver. A transport selector switches between short-poll (amber requests on a timer, most answered by a small grey empty packet), long-poll (one request per client that parks at the server, counted by a chip on chat-1, and is answered the instant a message arrives) and websocket (nothing travels up; green messages simply arrive). Sliders set the poll interval and the message rate. A restart button — also fired by a scripted deploy at t=18 — takes the server down for a second, severing every client: they all turn orange and schedule a retry. With reconnect jitter off every retry lands on the same tick and the server's load bar pegs; with jitter on the retries are spread over two seconds. Meters show message latency, wasted requests per second, connections held, and total delivered."
    />
  );
}
