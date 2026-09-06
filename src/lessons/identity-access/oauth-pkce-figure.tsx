"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { AuthView } from "@/engine/algo/views/AuthView";
import { oauthPkceAlgo, oauthPkceNoneAlgo } from "./oauth-pkce";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function OauthPkceNoneFigure() {
  return (
    <SectionAlgoFigure
      def={oauthPkceNoneAlgo}
      view={AuthView}
      description="Authorization-code exchange without PKCE. Authz issues code C9. Default intercept 1: the attacker steals C9 and exchanges it for token T1. stolen is 1, issued is 0, stamp stolen. Drag intercept to 0: the client gets T1, issued 1."
    />
  );
}

export function OauthPkceFigure() {
  return (
    <SectionAlgoFigure
      def={oauthPkceAlgo}
      view={AuthView}
      description="Authorization-code exchange with PKCE. Client holds verifier V4; the challenge is 77, a toy, not S256. Authz issues C9. Default intercept 1: the attacker has C9 but no verifier, so the exchange is rejected; the client still exchanges C9 for T1. stolen is 0, rejected 1, issued 1, stamp client holds."
    />
  );
}
