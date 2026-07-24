"use client";

import type { EdgePath } from "../paths";

interface EdgeLineProps {
  path: EdgePath;
  /** Dim the edge (e.g. its target node is dead). */
  dimmed?: boolean;
}

/** A connection between nodes: hairline Bézier the packets travel along. */
export function EdgeLine({ path, dimmed }: EdgeLineProps) {
  return (
    <path
      d={path.d}
      fill="none"
      stroke="var(--color-border-bright)"
      strokeWidth={1.25}
      strokeOpacity={dimmed ? 0.25 : 0.7}
      style={{ transition: "stroke-opacity 300ms" }}
    />
  );
}
