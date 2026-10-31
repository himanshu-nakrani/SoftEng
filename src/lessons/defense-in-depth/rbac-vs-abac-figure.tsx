"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { PolicyView } from "@/engine/algo/views/PolicyView";
import { rbacVsAbacAlgo, rbacVsAbacAttrAlgo } from "./rbac-vs-abac";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function RbacFigure() {
  return (
    <SectionAlgoFigure
      def={rbacVsAbacAlgo}
      view={PolicyView}
      description="Three subjects write bob's doc1. Default subject 2 is mallory, an editor who does not own it. RBAC grants every editor the write: allowed 1, escalation 1, stamp escalation."
    />
  );
}

export function AbacFigure() {
  return (
    <SectionAlgoFigure
      def={rbacVsAbacAttrAlgo}
      view={PolicyView}
      description="The same write, same default: mallory, subject 2. ABAC grants only admin or owner, so mallory is denied: allowed 0, escalation 0, stamp deny."
    />
  );
}
