"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { AuthView } from "@/engine/algo/views/AuthView";
import { sessionCookiesAlgo } from "./session-cookies";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function SessionCookiesFigure() {
  return (
    <SectionAlgoFigure
      def={sessionCookiesAlgo}
      view={AuthView}
      description="Sid S7. The slider is flags, 0 through 3, default 0: HttpOnly on, Secure on, SameSite=Strict, stolen 0, csrf 0, stamp cookie. 1 turns HttpOnly off — XSS steals S7 (stolen 1). 2 turns Secure off — HTTP leaks it (stolen 1). 3 sets SameSite=None — a cross-site POST sends it (csrf 1, stolen 0)."
    />
  );
}
