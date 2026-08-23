import type { EdgeSpec, Topology } from "./types";

/**
 * Edge geometry. Edges are quadratic Béziers authored from node coords, so
 * packet positions are computed analytically — exact, cheap, no DOM
 * measurement (`getPointAtLength`) ever.
 */
export interface EdgePath {
  ax: number;
  ay: number;
  cx: number;
  cy: number;
  bx: number;
  by: number;
  /** SVG path string for rendering. */
  d: string;
}

export type PathRegistry = Map<string, EdgePath>;

function buildEdgePath(
  edge: EdgeSpec,
  a: { x: number; y: number },
  b: { x: number; y: number },
): EdgePath {
  const curve = edge.curve ?? 0;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // Control point offset perpendicular to the segment, scaled by length.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * curve * len * 0.3;
  const cy = my + (dx / len) * curve * len * 0.3;
  return {
    ax: a.x,
    ay: a.y,
    cx,
    cy,
    bx: b.x,
    by: b.y,
    d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
  };
}

export function buildPaths(topology: Topology): PathRegistry {
  const byId = new Map(topology.nodes.map((n) => [n.id, n]));
  const registry: PathRegistry = new Map();
  for (const edge of topology.edges) {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) {
      throw new Error(`Edge ${edge.id} references unknown node`);
    }
    registry.set(edge.id, buildEdgePath(edge, a, b));
  }
  return registry;
}

/** Point on a quadratic Bézier at t ∈ [0,1]. `reverse` flips direction. */
export function pointAt(
  path: EdgePath,
  t: number,
  reverse = false,
): { x: number; y: number } {
  const u = reverse ? 1 - t : t;
  const v = 1 - u;
  return {
    x: v * v * path.ax + 2 * v * u * path.cx + u * u * path.bx,
    y: v * v * path.ay + 2 * v * u * path.cy + u * u * path.by,
  };
}
