"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { MtlsView } from "@/engine/algo/views/MtlsView";
import { mtlsAlgo, mtlsPerimeterAlgo } from "./mtls";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function PerimeterFigure() {
  return (
    <SectionAlgoFigure
      def={mtlsPerimeterAlgo}
      view={MtlsView}
      description="Perimeter trust between svc-a and svc-b. Default client cert 1 is missing: the server presents, the client presents nothing, and the perimeter accepts anyone on the network. connected is 1, verified is 0, stamp connected. Drag 0 and 2: every run still connects."
    />
  );
}

export function MtlsFigure() {
  return (
    <SectionAlgoFigure
      def={mtlsAlgo}
      view={MtlsView}
      description="Mutual TLS between svc-a and svc-b. Default client cert 0 is from this CA: connected 1, verified 1, stamp connected. Drag to 1 (no cert) or 2 (other-ca): rejected 1, connected 0, stamp reject."
    />
  );
}
