"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { retriesTimeoutsSim } from "./retries-timeouts";

export function RetriesTimeoutsFigure() {
  return (
    <SectionFigure
      sim={retriesTimeoutsSim}
      // "retry-storm" has no figure of its own — its subject is the backoff
      // control and the prediction, both of which live in this one.
      completes={[
        { on: "param-change", id: "backoff", section: "retry-storm" },
        { on: "quiz-answered", id: "rt-metastable", section: "retry-storm" },
      ]}
      description="Clients call api-1 at a steady 5 requests per second, and api-1 calls the pg-main database, which serves 12 per second. Every call api-1 makes carries a deadline set by the timeout slider: amber dots are first attempts, orange dots are retries, and a red dot is a call that died — either an error from pg-main or a deadline that ran out. The count chip on api-1 is retries waiting for their backoff; the chip on pg-main is its queue depth. The amplification gauge is the load pg-main is offered divided by the load the clients actually asked for. pg-main is killed on the timeline at 14 seconds and revived at 19, and can also be clicked dead at any time; with the default no-backoff setting the retries that pile up during the outage keep the database saturated long after it is healthy again — a retry storm — while exponential backoff with jitter lets the queue drain."
    />
  );
}
