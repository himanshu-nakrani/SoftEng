"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { StuffingView } from "@/engine/algo/views/StuffingView";
import {
  credentialStuffingAlgo,
  credentialStuffingUserAlgo,
} from "./credential-stuffing";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function NoneFigure() {
  return (
    <SectionAlgoFigure
      def={credentialStuffingAlgo}
      view={StuffingView}
      description="Six password guesses at ada from rotating IPs a, b, and c. No rate limit. Skip to the end: attempts 6, stolen 1, blocked 0. Attempt 5 reads ok. The last caption is Stuffing succeeded. Stamp stolen."
    />
  );
}

export function UserFigure() {
  return (
    <SectionAlgoFigure
      def={credentialStuffingUserAlgo}
      view={StuffingView}
      description="The same six guesses, bucketed on the username ada with cap 3. Skip to the end: attempts 6, stolen 0, blocked 3. Attempts 4 through 6 read block, so the correct password never runs. Stamp 3 blocked."
    />
  );
}
