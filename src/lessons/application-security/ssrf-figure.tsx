"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { InjectView } from "@/engine/algo/views/InjectView";
import { ssrfAlgo, ssrfAllowAlgo } from "./ssrf";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function OpenFigure() {
  return (
    <SectionAlgoFigure
      def={ssrfAlgo}
      view={InjectView}
      description="Open server-side fetch. The slider is the target host, 0 or 1, default 1. Target 1 is 169.254.169.254: fetched 1 leaked 1, stamp metadata, the run marked fail. Target 0 is api.example.com: fetched 1 leaked 0, stamp fetched. The figure never talks to a real network."
    />
  );
}

export function AllowFigure() {
  return (
    <SectionAlgoFigure
      def={ssrfAllowAlgo}
      view={InjectView}
      description="The same two hosts against an allowlist of api.example.com. Default target 1: blocked 1 leaked 0, stamp blocked, FETCH none. Target 0 still fetches the app host, leaked 0. A host check, not a DNS lookup."
    />
  );
}
