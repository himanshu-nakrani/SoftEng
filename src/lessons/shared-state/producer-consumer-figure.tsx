"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { backpressureAlgo, producerConsumerAlgo } from "./producer-consumer";

export function ProducerConsumerFigure() {
  return (
    <SectionAlgoFigure
      def={producerConsumerAlgo}
      view={ThreadsView}
      description="A producer and a consumer hand four items across a bounded buffer. A put blocks while the buffer is full and a take blocks while it is empty, so at capacity 1 the two threads are forced to alternate. Raise the capacity and the producer can run ahead instead of waiting."
    />
  );
}

export function BackpressureFigure() {
  return (
    <SectionAlgoFigure
      def={backpressureAlgo}
      view={ThreadsView}
      description="The same buffer at capacity 2, but each item now costs the consumer three operations instead of one. The producer fills the buffer and then blocks repeatedly, so the whole pipeline advances at the consumer's pace — the buffer transmitting the slow end's limit back to the fast end."
    />
  );
}
