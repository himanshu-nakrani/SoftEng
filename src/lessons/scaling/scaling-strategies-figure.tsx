"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { scalingStrategiesSim } from "./scaling-strategies";

export function ScalingStrategiesFigure() {
  return (
    <SectionFigure
      sim={scalingStrategiesSim}
      description="Traffic flowing to either one large server (vertical scaling) or several small servers (horizontal scaling). A scale slider grows either setup; servers can be clicked to kill them, showing the difference in blast radius. Meters show throughput, live capacity, drops, and cost."
    />
  );
}
