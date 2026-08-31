"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { loadSheddingSim } from "./load-shedding";

export function LoadSheddingFigure() {
  return (
    <SectionFigure
      sim={loadSheddingSim}
      description="Clients send more requests per second than api-1 can serve. First the server accepts everything: the queue and the queue-wait meter climb without bound while useful answers stall. Then admission control switches on and refuses excess requests at the door — an amber 429 reject, not a red drop — and the accepted work stays inside its deadline while useful answers recover. Click api-1 to kill it and watch every arrival get dropped instead of refused."
    />
  );
}
