"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { conditionalRequestsSim } from "./conditional-requests";

export function ConditionalRequestsFigure() {
  return (
    <SectionFigure
      sim={conditionalRequestsSim}
      completes={[
        { on: "param-change", id: "useEtags", section: "not-modified-exchange" },
        { on: "param-change", id: "resourceModified", section: "not-modified-exchange" },
      ]}
      description="A browser and origin server demonstrating conditional HTTP validation. With unconditional GET requests, the client re-downloads the entire 50 KB payload every two seconds, consuming 300 KB across six requests. Enabling conditional If-None-Match sends the cached ETag validator: the origin confirms the hash is unchanged and returns a lightweight 304 Not Modified header with zero payload bytes. The 304 rate reaches 83%, cutting total wire transfer from 300 KB to 51.5 KB and saving 83% of total network bandwidth."
    />
  );
}
