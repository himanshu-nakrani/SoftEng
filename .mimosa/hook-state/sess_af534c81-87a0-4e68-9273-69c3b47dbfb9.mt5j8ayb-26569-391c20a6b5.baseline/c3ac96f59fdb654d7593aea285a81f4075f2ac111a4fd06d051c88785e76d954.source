/**
 * Golden-run regression for every available lesson.
 *
 * WHAT IT PINS
 * ------------
 * Each lesson is driven headlessly from seed 42 to t=30. At every ungated quiz
 * checkpoint's `at` — the moments the lesson's pedagogy actually depends on,
 * since the resumed sim is what proves the learner's prediction — and again at
 * t=30, we capture a compact summary: rounded metrics, in-flight packet count,
 * `nextPacketId` (a proxy for total spawns, i.e. RNG consumption) and every
 * node's health. Those summaries live in `./goldens/<module>--<slug>.json`.
 *
 * A diff here means simulation *behavior* changed. That is either a bug you
 * just introduced, or a change you meant to make.
 *
 * THE PROTOCOL (how later stages re-baseline)
 * -------------------------------------------
 *   1. Golden file MISSING → the test writes it and passes, warning
 *      "golden created". This is bootstrap mode; commit the new file.
 *   2. Golden file PRESENT and matching → pass.
 *   3. Golden file PRESENT and different → FAIL with a per-field diff.
 *   4. The change was deliberate → re-baseline:
 *
 *          UPDATE_GOLDENS=1 npx vitest run
 *
 *      which rewrites every golden and passes. Commit the rewritten files as
 *      part of the same change, and treat the diff as reviewable evidence of
 *      what your edit did to the simulation.
 *
 * Never regenerate to make a red test green without reading the diff first —
 * the diff IS the regression report.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GOLDEN_SEED,
  RUN_TO,
  captureGolden,
  lessonsUnderTest,
  runLesson,
  ungatedQuizzes,
  type GoldenCheckpoint,
} from "@/engine/__tests__/harness";

const GOLDEN_DIR = fileURLToPath(new URL("./goldens", import.meta.url));
const UPDATE = process.env.UPDATE_GOLDENS === "1";

interface GoldenFile {
  lesson: string;
  seed: number;
  runTo: number;
  checkpoints: GoldenCheckpoint[];
}

function goldenPath(name: string): string {
  return join(GOLDEN_DIR, `${name}.json`);
}

function writeGolden(name: string, golden: GoldenFile): void {
  mkdirSync(GOLDEN_DIR, { recursive: true });
  writeFileSync(goldenPath(name), `${JSON.stringify(golden, null, 2)}\n`);
}

function readGolden(name: string): GoldenFile {
  return JSON.parse(readFileSync(goldenPath(name), "utf8")) as GoldenFile;
}

/* ---------- diffing ---------- */

/** Flatten a checkpoint to `path → value` so mismatches read as single lines. */
function flatten(cp: GoldenCheckpoint): Map<string, string> {
  const out = new Map<string, string>();
  out.set("t", String(cp.t));
  out.set("packets", String(cp.packets));
  out.set("nextPacketId", String(cp.nextPacketId));
  for (const [k, v] of Object.entries(cp.metrics)) {
    out.set(`metrics.${k}`, String(v));
  }
  for (const [k, v] of Object.entries(cp.nodes)) out.set(`nodes.${k}`, v);
  return out;
}

function diffGolden(actual: GoldenFile, expected: GoldenFile): string[] {
  const lines: string[] = [];
  if (actual.seed !== expected.seed) {
    lines.push(`seed: ${expected.seed} → ${actual.seed}`);
  }
  if (actual.runTo !== expected.runTo) {
    lines.push(`runTo: ${expected.runTo} → ${actual.runTo}`);
  }

  const labels = [
    ...new Set([
      ...expected.checkpoints.map((c) => c.label),
      ...actual.checkpoints.map((c) => c.label),
    ]),
  ];
  for (const label of labels) {
    const a = actual.checkpoints.find((c) => c.label === label);
    const e = expected.checkpoints.find((c) => c.label === label);
    if (!e) {
      lines.push(`[${label}] new checkpoint (not in golden)`);
      continue;
    }
    if (!a) {
      lines.push(`[${label}] checkpoint disappeared`);
      continue;
    }
    const av = flatten(a);
    const ev = flatten(e);
    for (const key of new Set([...ev.keys(), ...av.keys()])) {
      const was = ev.get(key);
      const now = av.get(key);
      if (was === now) continue;
      lines.push(`[${label}] ${key}: ${was ?? "(absent)"} → ${now ?? "(absent)"}`);
    }
  }
  return lines;
}

/* ---------- the run ---------- */

describe("golden runs", () => {
  it("has at least one lesson under test", () => {
    expect(lessonsUnderTest.length).toBeGreaterThan(0);
  });

  describe.each(lessonsUnderTest)("$key", ({ key, goldenName, sim }) => {
    it(`matches ./goldens/${goldenName}.json`, () => {
      // Capture points: each ungated quiz's `at`, plus the end of the run.
      // Gated checkpoints are deliberately excluded — a `when` gate may never
      // pass, so pinning one would encode a coin flip as a golden.
      const pending = ungatedQuizzes(sim)
        .filter((q) => q.at <= RUN_TO)
        .map((q) => ({ at: q.at, label: `quiz:${q.id}@${q.at}` }))
        .sort((a, b) => a.at - b.at);

      const checkpoints: GoldenCheckpoint[] = [];
      let next = 0;
      const { state } = runLesson(sim, {
        seed: GOLDEN_SEED,
        until: RUN_TO,
        onTick: (s) => {
          // First tick at or past each `at`, in order. Exact comparison, no
          // epsilon: this must be the same tick the runner fires the
          // checkpoint on (`s.t < q.at` there), so the golden pins the state
          // the learner is actually looking at when the sim hard-pauses.
          while (next < pending.length && s.t >= pending[next].at) {
            checkpoints.push(captureGolden(pending[next].label, s));
            next += 1;
          }
        },
      });
      checkpoints.push(captureGolden(`t=${RUN_TO}`, state));

      const actual: GoldenFile = {
        lesson: key,
        seed: GOLDEN_SEED,
        runTo: RUN_TO,
        checkpoints,
      };

      if (!existsSync(goldenPath(goldenName))) {
        writeGolden(goldenName, actual);
        console.warn(
          `golden created: src/lessons/__tests__/goldens/${goldenName}.json ` +
            `(${checkpoints.length} checkpoints) — review and commit it.`,
        );
        return;
      }

      if (UPDATE) {
        writeGolden(goldenName, actual);
        return;
      }

      const expected = readGolden(goldenName);
      const diff = diffGolden(actual, expected);
      const message =
        diff.length === 0
          ? ""
          : [
              `Simulation behavior changed for "${key}" (${diff.length} field(s)):`,
              ...diff.map((line) => `  ${line}`),
              "",
              "If this was deliberate: UPDATE_GOLDENS=1 npx vitest run",
            ].join("\n");
      expect(actual, message).toStrictEqual(expected);
    });
  });
});
