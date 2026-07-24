"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { rateLimitingSim } from "./rate-limiting";

export function RateLimitingFigure() {
  return (
    <SectionFigure
      sim={rateLimitingSim}
      // "burst" has no figure — pressing the burst button is its whole point.
      completes={[{ on: "button-press", id: "burst", section: "burst" }]}
      description="A token-bucket rate limiter between clients and an API. Tokens refill at a slider-set rate; each forwarded request spends one, and requests arriving to an empty bucket bounce back red as 429s. A burst button floods the limiter with 30 requests."
    />
  );
}
