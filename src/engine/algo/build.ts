import { mulberry32 } from "../rng";
import type { AlgoDef, AlgoStep } from "./types";

/**
 * Build a run's step list. React-free on purpose — the same discipline as
 * `engine/runner.ts`: the core is testable and script-drivable, and
 * `useAlgoPlayer` is only a playback binding over it.
 *
 * Same `(def, size, seed)` ⇒ same steps, always. Prediction checkpoints and
 * golden tests over archetype B depend on that.
 *
 * One RNG instance is threaded through BOTH phases, so `run`'s choices are
 * downstream of `generateInput`'s draws. That is deliberate: it keeps a single
 * seed reproducing the whole run, and it means changing the input generator
 * also reshuffles a scheduler's decisions (a fact worth knowing when a golden
 * moves for no apparent reason).
 */
export function buildAlgoSteps<S, I>(
  def: AlgoDef<S, I>,
  size: number,
  seed: number,
): AlgoStep<S>[] {
  const rng = mulberry32(seed);
  const input = def.generateInput(rng, size);
  return def.run(input, rng);
}

/** The size the figure should open at: explicit prop → def default → 12. */
export function defaultAlgoSize<S, I>(
  def: AlgoDef<S, I>,
  override?: number,
): number {
  return override ?? def.size?.default ?? 12;
}
