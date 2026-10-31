"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { InjectView } from "@/engine/algo/views/InjectView";
import { xssAlgo, xssEncodeAlgo } from "./xss";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function RawFigure() {
  return (
    <SectionAlgoFigure
      def={xssAlgo}
      view={InjectView}
      description={
        "A greeting interpolates a name as raw HTML. Default payload 1 is the string <script>: it becomes a script node, scripts 1, stamp script. Payload 0 is Ada, a text node, scripts 0, stamp text. The figure never executes the payload; it is a chip."
      }
    />
  );
}

export function EncodeFigure() {
  return (
    <SectionAlgoFigure
      def={xssEncodeAlgo}
      view={InjectView}
      description={
        "The same greeting, with the name encoded first. Default payload 1 still opens as Hello, <script>. After encode it stays a text node: scripts 0, stamp text, result &lt;script&gt;. Payload 0 is Ada, text, same as raw. The figure never executes a script."
      }
    />
  );
}
