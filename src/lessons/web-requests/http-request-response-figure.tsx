"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { httpRequestResponseSim } from "./http-request-response";

export function HttpRequestResponseFigure() {
  return (
    <SectionFigure
      sim={httpRequestResponseSim}
      completes={[
        // The later sections have no figure of their own: raising the
        // connections slider, toggling a slow resource, or answering the
        // checkpoint are what demonstrate them.
        { on: "param-change", id: "connections", section: "head-of-line" },
        { on: "param-change", id: "slowResource", section: "head-of-line" },
        { on: "quiz-answered", id: "http-hol", section: "head-of-line" },
      ]}
      description="A browser and a server joined by up to six parallel connection arcs. Each page load is a batch of eight resource requests — the HTML and its stylesheet, script and images. On a single connection the requests are sent strictly one at a time: each amber request crosses to the server, is processed, and returns green before the next may leave, so the requests queue at the browser and the page-load time is the sum of every round trip, close to 4800ms. The connections slider opens more independent lanes; at three the queue splits three ways and the page time falls to about 1800ms, at six to about 1200ms. A toggle marks one resource as slow: on a single connection everything queued behind it waits on it, while extra connections route around it. Meters show the page-load time, requests in flight, requests still queued, and resources loaded."
    />
  );
}
