import type { ParamSpec, ParamValue, ParamValues } from "@/engine/types";

/**
 * Playground share links: `?sim=<slug>&seed=<n>&p.<key>=<value>…`
 * Only params + seed are encoded — the engine's determinism invariant means
 * they reproduce the entire run (sim state itself is never serialized).
 */

export interface ShareState {
  sim: string;
  seed: number;
  params: ParamValues;
}

export function encodeShare(state: ShareState): string {
  const q = new URLSearchParams();
  q.set("sim", state.sim);
  q.set("seed", String(state.seed));
  for (const [key, value] of Object.entries(state.params)) {
    q.set(`p.${key}`, String(value));
  }
  return q.toString();
}

/** Decode params against the sim's specs so types survive the round trip. */
export function decodeParams(
  search: URLSearchParams,
  specs: ParamSpec[],
): ParamValues {
  const params: ParamValues = {};
  for (const spec of specs) {
    const raw = search.get(`p.${spec.key}`);
    if (raw === null) continue;
    let value: ParamValue;
    if (typeof spec.defaultValue === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) continue;
      value = spec.min !== undefined && spec.max !== undefined
        ? Math.min(Math.max(n, spec.min), spec.max)
        : n;
    } else if (typeof spec.defaultValue === "boolean") {
      value = raw === "true" || raw === "1";
    } else {
      // select: only accept known options
      if (spec.options && !spec.options.some((o) => o.value === raw)) continue;
      value = raw;
    }
    params[spec.key] = value;
  }
  return params;
}
