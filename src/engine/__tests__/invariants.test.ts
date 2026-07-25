/**
 * Engine invariants, enforced against EVERY available lesson.
 *
 * The matrix is driven by the curriculum registry (`allLessons`, filtered to
 * `status: "available"`), so shipping a lesson automatically puts it under
 * test. Resolving its module is the one manual step: add a line to
 * `SIM_BY_KEY` in `./harness.ts`. The first test below fails with the exact
 * missing key if you don't.
 *
 * These are the rules from CLAUDE.md's "Engine invariants" section, expressed
 * as executable checks: seeded determinism, the packet-pool cap, topology
 * referential integrity, meters resolving to real metrics, quiz-checkpoint
 * firing discipline, and `bornAt` stamping.
 */

import { describe, expect, it } from "vitest";
import { PACKET_POOL, TICK } from "@/engine/types";
import {
  GOLDEN_SEED,
  RUN_TO,
  availableLessons,
  lessonsUnderTest,
  orphanSimKeys,
  projectForDeterminism,
  quizzesOf,
  runLesson,
  unmappedLessonKeys,
} from "./harness";

/** Where in a run a checkpoint fired. */
interface FireMoment {
  index: number;
  t: number;
}

describe("test matrix", () => {
  it("covers every available lesson in the registry", () => {
    expect(
      unmappedLessonKeys,
      "Available lesson(s) with no sim in SIM_BY_KEY (src/engine/__tests__/harness.ts). " +
        "Add one line per lesson: \"<module>/<slug>\": widen(<camelCase>Sim).",
    ).toEqual([]);
    expect(
      orphanSimKeys,
      "SIM_BY_KEY entries that are no longer available lessons — remove them.",
    ).toEqual([]);
    expect(lessonsUnderTest.length).toBe(availableLessons.length);
    expect(lessonsUnderTest.length).toBeGreaterThan(0);
  });
});

describe.each(lessonsUnderTest)("$key", ({ sim }) => {
  it("is deterministic for a fixed seed", () => {
    const a = runLesson(sim, { seed: GOLDEN_SEED, until: RUN_TO });
    const b = runLesson(sim, { seed: GOLDEN_SEED, until: RUN_TO });

    expect(projectForDeterminism(b.state)).toStrictEqual(
      projectForDeterminism(a.state),
    );
    // Per-tick shape too: identical seeds must diverge at no point, not just
    // agree at the finish line.
    expect(b.ticks).toStrictEqual(a.ticks);
  });

  it("never exceeds the packet pool", () => {
    runLesson(sim, {
      onTick: (state, tick) => {
        expect(
          state.packets.length,
          `t=${tick.t}: in-flight packets exceeded PACKET_POOL`,
        ).toBeLessThanOrEqual(PACKET_POOL);
      },
    });
  });

  it("keeps packets and nodes referentially valid against the topology", () => {
    const edgeIds = new Set(sim.topology.edges.map((e) => e.id));
    const nodeIds = new Set(sim.topology.nodes.map((n) => n.id));

    // Edges must themselves point at real nodes, or edge-id validity is hollow.
    for (const edge of sim.topology.edges) {
      expect(nodeIds.has(edge.from), `edge ${edge.id}.from`).toBe(true);
      expect(nodeIds.has(edge.to), `edge ${edge.id}.to`).toBe(true);
    }

    runLesson(sim, {
      onTick: (state, tick) => {
        for (const p of state.packets) {
          expect(
            edgeIds.has(p.edgeId),
            `t=${tick.t}: packet ${p.id} (${p.type}) on unknown edge "${p.edgeId}"`,
          ).toBe(true);
        }
        for (const id of Object.keys(state.nodes)) {
          expect(
            nodeIds.has(id),
            `t=${tick.t}: state.nodes has "${id}", absent from topology.nodes`,
          ).toBe(true);
        }
      },
    });
  });

  it("stamps bornAt, never in the future", () => {
    runLesson(sim, {
      onTick: (state, tick) => {
        for (const p of state.packets) {
          expect(
            typeof p.bornAt,
            `t=${tick.t}: packet ${p.id} has no bornAt`,
          ).toBe("number");
          expect(Number.isFinite(p.bornAt)).toBe(true);
          expect(p.bornAt).toBeGreaterThanOrEqual(0);
          // `spawnPacket` stamps the tick's *start* time; the runner advances
          // the clock after `step`, so bornAt trails `t` by up to one TICK.
          expect(
            p.bornAt,
            `t=${tick.t}: packet ${p.id} born in the future (${p.bornAt})`,
          ).toBeLessThanOrEqual(state.t + 1e-9);
        }
      },
    });
  });

  it("populates every metric its meters read", () => {
    const { state } = runLesson(sim);
    for (const meter of sim.meters) {
      const inMetrics = meter.metricKey in state.metrics;
      if (meter.kind === "sparkline") {
        // Sparklines read the series ring; the counter readout may come from
        // either side, so satisfying one of the two is enough.
        expect(
          inMetrics || meter.metricKey in state.series,
          `meter "${meter.label}" reads "${meter.metricKey}", present in neither metrics nor series`,
        ).toBe(true);
      } else {
        expect(
          inMetrics,
          `meter "${meter.label}" reads metrics["${meter.metricKey}"], never written`,
        ).toBe(true);
      }
      if (inMetrics) {
        expect(
          Number.isFinite(state.metrics[meter.metricKey]),
          `metrics["${meter.metricKey}"] is not finite (${state.metrics[meter.metricKey]})`,
        ).toBe(true);
      }
    }
  });

  it("fires quiz checkpoints at most once, on the first eligible tick", () => {
    const quizzes = quizzesOf(sim);
    const quizIds = new Set(quizzes.map((q) => q.id));
    const { ticks } = runLesson(sim);

    const firedAt = new Map<string, FireMoment>();
    for (const tick of ticks) {
      if (!tick.firedQuizId) continue;
      // ⊆ sim.quiz
      expect(
        quizIds.has(tick.firedQuizId),
        `runner reported unknown quiz "${tick.firedQuizId}"`,
      ).toBe(true);
      // at most once
      expect(
        firedAt.has(tick.firedQuizId),
        `quiz "${tick.firedQuizId}" fired twice (t=${tick.t})`,
      ).toBe(false);
      firedAt.set(tick.firedQuizId, { index: tick.index, t: tick.t });
    }

    for (const q of quizzes) {
      const fired = firedAt.get(q.id);
      if (!fired) {
        // A `when`-gated checkpoint may legitimately never fire. An ungated
        // one inside the run window must.
        expect(
          q.when !== undefined || q.at > ticks[ticks.length - 1].t,
          `ungated quiz "${q.id}" (at=${q.at}) never fired within t<=${RUN_TO}`,
        ).toBe(true);
        continue;
      }

      expect(
        fired.t,
        `quiz "${q.id}" fired at t=${fired.t}, before its at=${q.at}`,
      ).toBeGreaterThanOrEqual(q.at);

      if (q.when) continue; // gate decides the moment, not the clock

      // First eligible tick, with slack: the runner reports at most one
      // checkpoint per tick, so N checkpoints crossing together serialize over
      // N ticks. Anything later than that is a real regression.
      //
      // The comparison is deliberately exact (no epsilon) — it must mirror the
      // runner's own `s.t < q.at` test. `t` accumulates by repeated `+= TICK`,
      // so it undershoots: after 360 ticks t is 11.999999999999863, not 12,
      // and the checkpoint at `at: 12` really does fire on tick 361. That is
      // deterministic IEEE-754 behavior, identical on every platform; an
      // epsilon here would assert a tick the engine never fires on.
      const firstEligible = ticks.find((tk) => tk.t >= q.at);
      if (!firstEligible) throw new Error(`no tick reaches at=${q.at}`);
      const slack = Math.max(quizzes.length - 1, 0);
      expect(
        fired.index,
        `quiz "${q.id}" fired ${fired.index - firstEligible.index} ticks ` +
          `(${TICK}s each) after the first tick where t >= ${q.at}`,
      ).toBeLessThanOrEqual(firstEligible.index + slack);
    }
  });
});
