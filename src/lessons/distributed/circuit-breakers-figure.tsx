"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { circuitBreakersSim } from "./circuit-breakers";

export function CircuitBreakersFigure() {
  return (
    <SectionFigure
      sim={circuitBreakersSim}
      description="A checkout service calling a payments dependency through an orders API. The dependency browns out mid-run; a retry-policy selector shows how immediate retries amplify load onto the failing service, and a circuit-breaker toggle makes the API fail fast, shed load, and probe for recovery. Meters show checkout success rate, downstream request rate, and failed checkouts."
    />
  );
}
