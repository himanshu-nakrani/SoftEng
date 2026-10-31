"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { AuthView } from "@/engine/algo/views/AuthView";
import { jwtPitfallsAlgo, jwtPitfallsStrictAlgo } from "./jwt-pitfalls";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function NaiveFigure() {
  return (
    <SectionAlgoFigure
      def={jwtPitfallsAlgo}
      view={AuthView}
      description="Toy JWT, not JWS. Default token 0 is alg=HS256 sub=ada exp=20 sig=56. now=10. The naive verifier accepts: verified is 1 and the stamp reads accept. Drag 1 through 3: alg=none, exp=5, and sub=mallory with ada's sig 56 all still accept, verified 1."
    />
  );
}

export function StrictFigure() {
  return (
    <SectionAlgoFigure
      def={jwtPitfallsStrictAlgo}
      view={AuthView}
      description="The same four tokens against a verifier that checks alg, exp, and the signature. Default token 0 still accepts: verified 1, stamp accept. Drag 1: alg=none is rejected, rejected 1, verified 0, stamp reject. Drag 2: exp=5 against now=10 is rejected. Drag 3: sub=mallory carrying ada's sig 56 is rejected. Only token 0 verifies."
    />
  );
}
