"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { outboxPatternSim } from "./outbox-pattern";

export function OutboxPatternFigure() {
  return (
    <SectionFigure
      sim={outboxPatternSim}
      description="An orders service handling requests. Each amber dot is a commit to orders-db, the source of truth; each cyan dot is the event published to the events broker. In the dual-write path the two are independent writes: the row commits, then a separate publish flies to the broker, and a scripted crash lands in the gap between them — the row is committed but its event is lost, and the unpublished and lost-events meters stick above zero. Switch the write path to outbox + relay and the commit also writes an outbox row in the same transaction; the relay node then drains the outbox to the broker. The service can be crashed with the button or by clicking it. In outbox mode a crash while the relay is mid-publish leaves the outbox row unmarked, so the event is published again after restart — the duplicate-events meter rises while lost events stays at zero. Meters show committed rows, published events, unpublished rows, lost events and duplicate events."
    />
  );
}
