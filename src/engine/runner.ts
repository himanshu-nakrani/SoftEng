/**
 * The React-free simulation core.
 *
 * A `SimRunner` owns everything that makes a lesson advance: the live
 * `SimState`, the param values handed to `step`, the timeline/caption
 * bookkeeping and the quiz-checkpoint detection. It is headless-safe — this
 * module imports only `./types` and `./rng`, never React, never a component —
 * so lessons can be driven from a script (golden runs, determinism checks,
 * balance tuning) exactly the way the browser drives them.
 *
 * `useSimulation` is a thin binding over this: it adds the rAF accumulator,
 * React state mirrors, the snapshot store and the play/pause policy. The
 * runner deliberately has no notion of "playing" — it reports a crossed quiz
 * checkpoint and lets the caller decide whether to halt.
 */

import { mulberry32 } from "./rng";
import type {
  LessonSim,
  NodeRuntime,
  ParamValue,
  ParamValues,
  QuizCheckpoint,
  SimState,
} from "./types";
import { TICK } from "./types";

/** Sim-seconds a timeline caption stays up (before `setCaptionScale`). */
export const CAPTION_DURATION = 4;

export interface TickResult {
  /**
   * The quiz checkpoint this tick crossed, if any. At most one per tick — the
   * runner marks it fired and stops scanning; the caller decides what to do
   * (the hook hard-pauses, headless callers keep going).
   */
  firedQuiz: QuizCheckpoint<unknown> | null;
  /** Caption visible *after* this tick — null once it has expired. */
  caption: string | null;
}

export interface RunnerOptions {
  /** Same seed ⇒ identical run (mulberry32). Default 42. */
  seed?: number;
  /** Overrides on top of the lesson's `defaultValue`s. */
  params?: Partial<ParamValues>;
}

export interface SimRunner {
  /**
   * The live, mutable world. Same object identity across ticks (`step`
   * mutates in place); replaced wholesale by `restart()`.
   */
  readonly state: SimState<unknown>;
  /** Current param values. Replaced (copy-on-write) by setParam/pressButton. */
  readonly params: ParamValues;
  /** Caption currently visible, or null. Owned by the runner's tick. */
  readonly caption: string | null;
  setParam: (key: string, value: ParamValue) => void;
  /** Momentary "button" params: sets true; the lesson's step resets it. */
  pressButton: (key: string) => void;
  /**
   * Multiplier on `CAPTION_DURATION`, applied when a caption is *set*
   * (default 1). Purely display-cosmetic: it moves the expiry of
   * `caption` and touches nothing else — no `SimState` field, no RNG draw, no
   * timeline or quiz gate — so a headless run is byte-identical whatever the
   * scale, and the default keeps existing behaviour exactly.
   *
   * It exists because caption expiry is measured in *sim* seconds while
   * reading is done in *wall* seconds: at 2x speed a 4 sim-second caption is
   * on screen for 2 real seconds. The browser binding passes the speed
   * multiplier here so display time stays constant (see `useSimulation`'s
   * `setSpeed`). Headless callers can ignore it.
   *
   * Applies to captions set from now on; a caption already up keeps the
   * deadline it was given. Survives `restart()` — it is a viewing preference,
   * not run state. Non-finite or non-positive values are ignored.
   */
  setCaptionScale: (scale: number) => void;
  /** Advance exactly one TICK: step → clock → timeline → quiz detection. */
  tick: () => TickResult;
  /**
   * Tick until `state.t >= t`, returning every tick's result in order.
   * Quiz checkpoints are *reported* but never block — headless callers run
   * past them (the browser hook is the thing that hard-pauses).
   *
   * Note for golden runs and other tooling: a timeline event or checkpoint
   * carrying a `when` gate fires only once its condition holds, so a run may
   * legitimately end with some of `sim.quiz` never reported. Never assert
   * "every checkpoint fired" — assert on the ones your scenario provokes.
   */
  runTo: (t: number) => TickResult[];
  /** Fresh state from the same seed; fired sets and caption cleared. */
  restart: () => void;
}

function defaultParams(specs: LessonSim<unknown>["params"]): ParamValues {
  return Object.fromEntries(specs.map((p) => [p.key, p.defaultValue]));
}

/** Seed → a complete SimState (engine-owned fields + `sim.init`'s lesson state). */
export function buildInitialState(
  sim: LessonSim<unknown>,
  seed: number,
): SimState<unknown> {
  const rng = mulberry32(seed);
  const nodes: Record<string, NodeRuntime> = {};
  for (const spec of sim.topology.nodes) {
    nodes[spec.id] = {
      health: "healthy",
      load: 0,
      ...sim.initialNodes?.[spec.id],
    };
  }
  return {
    t: 0,
    packets: [],
    nodes,
    metrics: {},
    series: {},
    lesson: sim.init(rng),
    rng,
    nextPacketId: 1,
  };
}

/**
 * Build a runner for a lesson. Generic in `L` purely for ergonomics —
 * `LessonSim<L>` is invariant in `L`, so the runner widens once here and
 * treats lesson state opaquely from then on (as every engine consumer does).
 */
export function createRunner<L>(
  sim: LessonSim<L>,
  opts: RunnerOptions = {},
): SimRunner {
  const { seed = 42 } = opts;
  const lesson = sim as unknown as LessonSim<unknown>;

  let state = buildInitialState(lesson, seed);
  let params: ParamValues = defaultParams(lesson.params);
  for (const [key, value] of Object.entries(opts.params ?? {})) {
    if (value !== undefined) params[key] = value;
  }

  let captionText: string | null = null;
  let captionUntil = 0;
  let captionScale = 1;
  const firedQuizzes = new Set<string>();
  const firedEvents = new Set<number>();

  const tick = (): TickResult => {
    const s = state;
    lesson.step(s, TICK, params);
    s.t += TICK;

    // Timeline events crossing t (indexed by array position for the Set).
    // An event with a `when` gate stays pending until the gate also passes.
    lesson.timeline?.forEach((ev, i) => {
      if (s.t < ev.at || firedEvents.has(i)) return;
      if (ev.when && !ev.when(s, params)) return; // gate shut — stays pending
      firedEvents.add(i);
      ev.apply?.(s);
      if (ev.caption) {
        captionText = ev.caption;
        captionUntil = s.t + CAPTION_DURATION * captionScale;
      }
    });
    if (captionText && s.t > captionUntil) {
      captionText = null;
    }

    // Quiz checkpoints: report exactly when t crosses, at most one per tick.
    // Same `when` gate as timeline events — a gated checkpoint waits (possibly
    // forever) for its condition instead of firing on the clock alone.
    if (lesson.quiz) {
      for (const q of lesson.quiz) {
        if (s.t < q.at || firedQuizzes.has(q.id)) continue;
        if (q.when && !q.when(s, params)) continue; // gate shut — stays pending
        firedQuizzes.add(q.id);
        return { firedQuiz: q, caption: captionText };
      }
    }
    return { firedQuiz: null, caption: captionText };
  };

  return {
    get state() {
      return state;
    },
    get params() {
      return params;
    },
    get caption() {
      return captionText;
    },
    setParam: (key, value) => {
      params = { ...params, [key]: value };
    },
    pressButton: (key) => {
      params = { ...params, [key]: true };
    },
    setCaptionScale: (scale) => {
      if (Number.isFinite(scale) && scale > 0) captionScale = scale;
    },
    tick,
    runTo: (until) => {
      const results: TickResult[] = [];
      while (state.t < until) results.push(tick());
      return results;
    },
    restart: () => {
      state = buildInitialState(lesson, seed);
      firedQuizzes.clear();
      firedEvents.clear();
      captionText = null;
      captionUntil = 0;
    },
  };
}
