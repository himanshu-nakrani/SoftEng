import { buildAlgoSteps, defaultAlgoSize } from "@/engine/algo/build";
import { StepRecorder } from "@/engine/algo/recorder";
import type { AlgoDef } from "@/engine/algo/types";
import { shuffledInput } from "@/engine/algo/views/array";
import type { ArrayAlgoState } from "@/engine/algo/views/array";
import {
  bubbleSort,
  insertionSort,
  mergeSort,
  quickSort,
} from "@/lessons/algorithms/sorts";
import { describe, expect, it } from "vitest";

/**
 * Archetype B (the discrete-step player) — the matrix guard for step lists,
 * mirroring what `engine/__tests__/invariants.test.ts` does for the packet sim.
 *
 * Everything here drives the React-free core (`buildAlgoSteps`), so the suite
 * runs in plain node like the rest of the engine tests.
 */

const SORTS: AlgoDef<ArrayAlgoState, number[]>[] = [
  bubbleSort,
  insertionSort,
  mergeSort,
  quickSort,
];

const SIZE = 12;
const SEED = 42;

describe.each(SORTS.map((def) => [def.id, def] as const))(
  "%s",
  (_id, def) => {
    const steps = buildAlgoSteps(def, SIZE, SEED);

    it("produces a non-empty run whose first step is the untouched input", () => {
      expect(steps.length).toBeGreaterThan(1);
      const input = shuffledInput(seededRng(SEED), SIZE);
      expect(steps[0].state.array).toEqual(input);
      // Nothing has happened yet, so every counter reads zero.
      for (const counter of def.counters) {
        expect(steps[0].counters[counter.key] ?? 0).toBe(0);
      }
    });

    it("is deterministic: same def, size and seed ⇒ identical steps", () => {
      expect(buildAlgoSteps(def, SIZE, SEED)).toEqual(steps);
    });

    it("changes the run when the seed changes", () => {
      const other = buildAlgoSteps(def, SIZE, SEED + 1);
      expect(other[0].state.array).not.toEqual(steps[0].state.array);
    });

    it("ends sorted, having preserved the multiset", () => {
      const first = steps[0].state.array;
      const last = steps[steps.length - 1].state.array;
      expect([...last]).toEqual([...first].sort((a, b) => a - b));
    });

    it("keeps every declared counter monotonic non-decreasing", () => {
      for (const counter of def.counters) {
        let prev = 0;
        for (const [i, step] of steps.entries()) {
          const value = step.counters[counter.key] ?? 0;
          expect(
            value,
            `${counter.key} decreased at step ${i}`,
          ).toBeGreaterThanOrEqual(prev);
          prev = value;
        }
        // A sort that never compares anything is a broken fixture.
        expect(prev).toBeGreaterThan(0);
      }
    });

    it("never aliases live state across frames", () => {
      // The classic recorder bug: every frame holding the same array, so the
      // whole run shows the final result and step-back looks broken.
      const arrays = new Set(steps.map((s) => s.state.array));
      expect(arrays.size).toBe(steps.length);
    });

    it("points codeLine at a real pseudocode line", () => {
      for (const step of steps) {
        if (step.codeLine === undefined) continue;
        expect(step.codeLine).toBeGreaterThanOrEqual(0);
        expect(step.codeLine).toBeLessThan(def.code.length);
      }
    });

    it("declares a size control whose default is inside its own range", () => {
      const size = def.size;
      if (!size) return;
      expect(size.min).toBeLessThan(size.max);
      expect(size.default).toBeGreaterThanOrEqual(size.min);
      expect(size.default).toBeLessThanOrEqual(size.max);
      expect(defaultAlgoSize(def)).toBe(size.default);
      expect(defaultAlgoSize(def, 7)).toBe(7);
    });

    it("runs at both ends of its size range", () => {
      const size = def.size;
      if (!size) return;
      for (const n of [size.min, size.max]) {
        const run = buildAlgoSteps(def, n, SEED);
        expect(run.length).toBeGreaterThan(0);
        expect(run[0].state.array).toHaveLength(n);
        const last = run[run.length - 1].state.array;
        expect([...last]).toEqual([...last].sort((a, b) => a - b));
      }
    });
  },
);

/**
 * The point of the generalization: the engine must carry state that is not an
 * array and has no notion of indices. This fixture is a tree, so if the engine
 * ever grows an array assumption again, this stops compiling or fails here.
 */
interface TreeState {
  nodes: { id: string; keys: number[] }[];
  visiting: string | null;
}

const treeWalk: AlgoDef<TreeState, string[]> = {
  id: "tree-walk",
  title: "tree walk",
  code: ["visit(node):", "  for child in node.children:", "    visit(child)"],
  counters: [{ key: "visits", label: "nodes visited" }],
  size: { label: "nodes", min: 2, max: 6, default: 3 },
  generateInput: (rng, size) =>
    Array.from({ length: size }, (_, i) => `n${i}${Math.floor(rng() * 10)}`),
  run: (ids) => {
    const nodes = ids.map((id) => ({ id, keys: [] as number[] }));
    let visiting: string | null = null;
    const rec = new StepRecorder<TreeState>(() => ({
      nodes: nodes.map((n) => ({ ...n, keys: [...n.keys] })),
      visiting,
    }));
    rec.record({ note: "before the walk" });
    for (const [i, node] of nodes.entries()) {
      visiting = node.id;
      node.keys.push(i);
      rec.bump("visits");
      rec.record({ codeLine: 0, note: `visit ${node.id}` });
    }
    return rec.steps;
  },
};

describe("a non-array state shape", () => {
  it("runs through the same engine, deterministically", () => {
    const steps = buildAlgoSteps(treeWalk, 4, SEED);
    expect(steps).toEqual(buildAlgoSteps(treeWalk, 4, SEED));
    expect(steps).toHaveLength(5); // one pre-walk frame + one per node
    expect(steps[0].state.visiting).toBeNull();
    expect(steps[4].state.visiting).toBe(steps[4].state.nodes[3].id);
    expect(steps[4].counters.visits).toBe(4);
  });

  it("snapshots deeply enough that earlier frames do not mutate", () => {
    const steps = buildAlgoSteps(treeWalk, 4, SEED);
    // Frame 1 saw exactly one visited node; by the last frame all four are
    // visited. If the recorder aliased, frame 1 would show four.
    expect(steps[1].state.nodes.filter((n) => n.keys.length > 0)).toHaveLength(1);
    expect(steps[4].state.nodes.filter((n) => n.keys.length > 0)).toHaveLength(4);
  });
});

describe("StepRecorder", () => {
  it("copies counters per frame instead of sharing one object", () => {
    const rec = new StepRecorder<number>(() => 0);
    rec.record();
    rec.bump("hits");
    rec.record();
    rec.bump("hits", 3);
    rec.record();

    expect(rec.steps.map((s) => s.counters.hits ?? 0)).toEqual([0, 1, 4]);
    expect(rec.count("hits")).toBe(4);
    expect(rec.count("never-bumped")).toBe(0);
  });
});

/** Local copy of the engine's seeding, to assert `buildAlgoSteps` uses it. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
