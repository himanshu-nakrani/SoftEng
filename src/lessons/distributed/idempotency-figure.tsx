"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { idempotencySim } from "./idempotency";

export function IdempotencyFigure() {
  return (
    <SectionFigure
      sim={idempotencySim}
      description="A checkout client sending payments to an API over a lossy network. Lost confirmations trigger client timeouts and retries; without idempotency keys the server charges again for each retry it cannot recognize, and a double-charges counter climbs. Enabling idempotency keys makes retries safe — duplicate requests return violet dedupe responses without new charges."
    />
  );
}
