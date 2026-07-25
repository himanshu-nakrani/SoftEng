"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { messageQueuesSim } from "./message-queues";

export function MessageQueuesFigure() {
  return (
    <SectionFigure
      sim={messageQueuesSim}
      // "deploy" has no figure — pausing the consumer is the mid-deploy stall.
      completes={[{ on: "param-change", id: "paused", section: "deploy" }]}
      description="A producer publishing messages into a queue drained by a consumer. Sliders set both rates; a toggle pauses the consumer to simulate a deploy, letting the queue absorb the backlog and drain it afterwards. Meters show depth, in/out rates, and delivery lag."
    />
  );
}
