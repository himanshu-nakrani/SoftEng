"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { realtimeSim } from "./realtime";

export function RealtimeFigure() {
  return (
    <SectionFigure
      sim={realtimeSim}
      description="A browser and an events service on one wire. In polling mode the client sends requests on a timer, most returning empty; in websocket mode the server pushes events the instant they occur. Meters show delivery latency, empty-poll percentage, events delivered, and polls sent."
    />
  );
}
