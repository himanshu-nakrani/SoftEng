/**
 * Shared headless test harness.
 *
 * Not a test file (vitest only picks up `*.test.ts`) — this is the plumbing
 * both `invariants.test.ts` and `../../lessons/__tests__/goldens.test.ts` sit
 * on: the registry→sim resolution map, a tick-by-tick driver over
 * `createRunner`, and the two state projections the suites compare
 * (determinism = everything that must be bit-identical; golden = the small,
 * human-readable summary that gets committed).
 */

import { createRunner, type SimRunner } from "@/engine/runner";
import type {
  LessonSim,
  NodeHealth,
  Packet,
  QuizCheckpoint,
  SimState,
} from "@/engine/types";
import { allLessons } from "@/lib/curriculum";
import type { LessonMeta } from "@/curriculum/types";

import { cachingSim } from "@/lessons/data/caching";
import { consistentHashingSim } from "@/lessons/data/consistent-hashing";
import { replicationSim } from "@/lessons/data/replication";
import { shardingSim } from "@/lessons/data/sharding";
import { capTheoremSim } from "@/lessons/distributed/cap-theorem";
import { messageQueuesSim } from "@/lessons/distributed/message-queues";
import { rateLimitingSim } from "@/lessons/distributed/rate-limiting";
import { clientServerSim } from "@/lessons/scaling/client-server";
import { loadBalancingSim } from "@/lessons/scaling/load-balancing";
import { scalingStrategiesSim } from "@/lessons/scaling/scaling-strategies";

/* ------------------------------------------------------------------ *
 * Registry → sim resolution
 * ------------------------------------------------------------------ */

/**
 * `LessonSim<L>` is invariant in `L` (covariant `init`, contravariant `step`),
 * so a heterogeneous collection of lesson sims has no common supertype. Widen
 * once here exactly the way `createRunner` does internally, then treat lesson
 * state as opaque — the harness never reads `state.lesson`.
 */
function widen<L>(sim: LessonSim<L>): LessonSim<unknown> {
  return sim as unknown as LessonSim<unknown>;
}

/**
 * THE static import map: `"<moduleSlug>/<slug>"` → the lesson's `LessonSim`.
 *
 * The *list* of lessons under test is driven by the curriculum registry (see
 * `lessonsUnderTest` below), so a new `status: "available"` lesson is picked up
 * automatically — but its sim module cannot be resolved by convention alone
 * (a static export map keeps `tsc` and the bundler honest, and vitest's node
 * loader will not resolve a template-literal import). So:
 *
 *   ADDING A LESSON? Add one line here. `invariants.test.ts` fails loudly with
 *   the missing key if you forget — it is not a silent skip.
 */
const SIM_BY_KEY: Record<string, LessonSim<unknown>> = {
  "scaling/client-server": widen(clientServerSim),
  "scaling/scaling-strategies": widen(scalingStrategiesSim),
  "scaling/load-balancing": widen(loadBalancingSim),
  "data/caching": widen(cachingSim),
  "data/replication": widen(replicationSim),
  "data/sharding": widen(shardingSim),
  "data/consistent-hashing": widen(consistentHashingSim),
  "distributed/rate-limiting": widen(rateLimitingSim),
  "distributed/message-queues": widen(messageQueuesSim),
  "distributed/cap-theorem": widen(capTheoremSim),
};

export interface LessonUnderTest {
  /** `"<moduleSlug>/<slug>"` — the import-map key and the test's display name. */
  key: string;
  /** `"<moduleSlug>--<slug>"` — the golden file's basename. */
  goldenName: string;
  meta: LessonMeta;
  sim: LessonSim<unknown>;
}

export const lessonKey = (l: LessonMeta) => `${l.moduleSlug}/${l.slug}`;

/** Every `status: "available"` lesson in the registry, in curriculum order. */
export const availableLessons: LessonMeta[] = allLessons.filter(
  (l) => l.status === "available",
);

/** Available lessons that have no entry in `SIM_BY_KEY` (asserted empty). */
export const unmappedLessonKeys: string[] = availableLessons
  .map(lessonKey)
  .filter((key) => !(key in SIM_BY_KEY));

/** Available lessons whose sim resolved — the actual test matrix. */
export const lessonsUnderTest: LessonUnderTest[] = availableLessons
  .filter((l) => lessonKey(l) in SIM_BY_KEY)
  .map((meta) => ({
    key: lessonKey(meta),
    goldenName: `${meta.moduleSlug}--${meta.slug}`,
    meta,
    sim: SIM_BY_KEY[lessonKey(meta)],
  }));

/** Import-map keys with no matching available lesson (stale entries). */
export const orphanSimKeys: string[] = Object.keys(SIM_BY_KEY).filter(
  (key) => !availableLessons.some((l) => lessonKey(l) === key),
);

/* ------------------------------------------------------------------ *
 * Driving a run
 * ------------------------------------------------------------------ */

/** The canonical seed for every committed golden and determinism check. */
export const GOLDEN_SEED = 42;
/** Sim-seconds every lesson is driven to. */
export const RUN_TO = 30;

export interface TickRecord {
  /** 1-based tick index within the run. */
  index: number;
  /** `state.t` *after* this tick (floats — `t` accumulates by TICK). */
  t: number;
  /** In-flight packets after this tick. */
  packetCount: number;
  /** Quiz reported by this tick, if any. The runner reports ≤1 per tick. */
  firedQuizId: string | null;
}

export interface RunResult {
  runner: SimRunner;
  state: SimState<unknown>;
  ticks: TickRecord[];
}

export interface RunOptions {
  seed?: number;
  until?: number;
  /**
   * Called after every tick with the *live* (mutable) state. Assert or capture
   * here; do not retain the object — `step` mutates it in place.
   */
  onTick?: (state: SimState<unknown>, tick: TickRecord) => void;
}

/**
 * Drive a lesson tick-by-tick to `until` sim-seconds. Uses `runner.tick()`
 * rather than `runTo` so callers see per-tick state; quiz checkpoints are
 * reported and never block, exactly as documented on `SimRunner.runTo`.
 */
export function runLesson(
  sim: LessonSim<unknown>,
  opts: RunOptions = {},
): RunResult {
  const { seed = GOLDEN_SEED, until = RUN_TO, onTick } = opts;
  const runner = createRunner(sim, { seed });
  const ticks: TickRecord[] = [];

  let index = 0;
  while (runner.state.t < until) {
    const result = runner.tick();
    index += 1;
    const tick: TickRecord = {
      index,
      t: runner.state.t,
      packetCount: runner.state.packets.length,
      firedQuizId: result.firedQuiz?.id ?? null,
    };
    ticks.push(tick);
    onTick?.(runner.state, tick);
  }

  return { runner, state: runner.state, ticks };
}

/* ------------------------------------------------------------------ *
 * Projections
 * ------------------------------------------------------------------ */

/** Node fields the engine owns (excludes lesson-private `meta`/`ghost`). */
export interface NodeProjection {
  health: NodeHealth;
  load: number;
  queueDepth: number | undefined;
}

/**
 * Everything two runs of the same seed must reproduce exactly. `rng` (a
 * closure) and `lesson` (lesson-private, arbitrarily shaped) are excluded;
 * every observable the render layers read is in here.
 */
export interface DeterminismProjection {
  t: number;
  metrics: Record<string, number>;
  packets: Packet[];
  nextPacketId: number;
  nodes: Record<string, NodeProjection>;
  series: Record<string, number[]>;
}

export function projectForDeterminism(
  state: SimState<unknown>,
): DeterminismProjection {
  const nodes: Record<string, NodeProjection> = {};
  for (const [id, n] of Object.entries(state.nodes)) {
    nodes[id] = { health: n.health, load: n.load, queueDepth: n.queueDepth };
  }
  return {
    t: state.t,
    metrics: { ...state.metrics },
    // structuredClone keeps every packet field, `payload` included.
    packets: structuredClone(state.packets),
    nextPacketId: state.nextPacketId,
    nodes,
    series: structuredClone(state.series),
  };
}

/** Kill float noise so goldens survive a platform's last-bit differences. */
export function round6(n: number): number {
  return Number.isFinite(n) ? Number(n.toFixed(6)) : n;
}

export function roundMetrics(
  metrics: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(metrics).sort()) out[key] = round6(metrics[key]);
  return out;
}

/** The compact, committed summary of a moment in a run. */
export interface GoldenCheckpoint {
  /** `"quiz:<id>@<at>"` or `"t=30"`. */
  label: string;
  t: number;
  metrics: Record<string, number>;
  packets: number;
  nextPacketId: number;
  nodes: Record<string, NodeHealth>;
}

export function captureGolden(
  label: string,
  state: SimState<unknown>,
): GoldenCheckpoint {
  const nodes: Record<string, NodeHealth> = {};
  for (const id of Object.keys(state.nodes).sort()) {
    nodes[id] = state.nodes[id].health;
  }
  return {
    label,
    t: round6(state.t),
    metrics: roundMetrics(state.metrics),
    packets: state.packets.length,
    nextPacketId: state.nextPacketId,
    nodes,
  };
}

/* ------------------------------------------------------------------ *
 * Quiz helpers
 * ------------------------------------------------------------------ */

export const quizzesOf = (sim: LessonSim<unknown>): QuizCheckpoint<unknown>[] =>
  sim.quiz ?? [];

/**
 * Checkpoints with no `when` gate — the only ones guaranteed to fire on the
 * clock, and therefore the only ones a golden may pin. A gated checkpoint may
 * legitimately never fire (see the note on `SimRunner.runTo`).
 */
export const ungatedQuizzes = (
  sim: LessonSim<unknown>,
): QuizCheckpoint<unknown>[] => quizzesOf(sim).filter((q) => !q.when);
