import { StepRecorder } from "@/engine/algo/recorder";
import type {
  AlgoCounter,
  AlgoDef,
  AlgoSizeControl,
  AlgoStep,
} from "@/engine/algo/types";
import type { AlgoHighlight, ArrayAlgoState } from "@/engine/algo/views/array";

/**
 * Property Shrinking — archetype B (`engine: "steps"` in the registry).
 *
 * Demonstrates how property-based testing turns a noisy, randomized
 * counterexample into the minimal failing test case via three discrete phases:
 * 1. Bisection: rapid chunk removal (halving search space in O(log N)).
 * 2. Element deletion: 1-by-1 pruning of irrelevant elements.
 * 3. Value decrementing: binary reduction of scalar values towards boundary (50).
 *
 * Code panel budget: every line in `def.code` MUST be <= 27 characters.
 */

export const SHRINK_COUNTERS = {
  tests: "tests",
  shrinks: "shrinks",
} as const;

const COUNTERS: AlgoCounter[] = [
  { key: SHRINK_COUNTERS.tests, label: "tests run" },
  { key: SHRINK_COUNTERS.shrinks, label: "shrinks accepted" },
];

const ARRAY_SIZE: AlgoSizeControl = {
  label: "initial array size",
  min: 6,
  max: 16,
  default: 10,
};

const CODE = [
  "prop = (xs) => all(x < 50)",
  "# 1. bisect chunks",
  "while can_bisect(xs):",
  "  if fails(h): xs = h",
  "# 2. delete elements",
  "for x in xs:",
  "  if fails(xs - x): drop",
  "# 3. decrement values",
  "while fails(x - d): x -= d",
  "return xs  # minimal repro",
];

class Recorder {
  private readonly rec: StepRecorder<ArrayAlgoState>;
  private a: number[];
  private highlight: AlgoHighlight = {};

  constructor(initial: number[]) {
    this.a = [...initial];
    this.rec = new StepRecorder<ArrayAlgoState>(() => ({
      array: [...this.a],
      highlight: { ...this.highlight },
    }));
    const failVal = this.a.find((x) => x >= 50) ?? 50;
    this.rec.record({
      codeLine: 0,
      note: `Random ${this.a.length}-element input fails invariant (element ${failVal} >= 50)`,
    });
  }

  get array(): number[] {
    return this.a;
  }

  get steps(): AlgoStep<ArrayAlgoState>[] {
    return this.rec.steps;
  }

  setArray(next: number[]): void {
    this.a = [...next];
  }

  setElement(i: number, val: number): void {
    this.a[i] = val;
  }

  record(highlight: AlgoHighlight, codeLine?: number, note?: string): void {
    this.highlight = highlight;
    this.rec.record({ codeLine, note });
  }

  bump(key: string): void {
    this.rec.bump(key);
  }

  count(key: string): number {
    return this.rec.count(key);
  }
}

export function generateShrinkInput(rng: () => number, size = 10): number[] {
  const count = size && size >= 4 ? size : 10;
  const arr: number[] = [];
  for (let i = 0; i < count; i++) {
    // Passing values safely under 50 (10..44)
    arr.push(10 + Math.floor(rng() * 35));
  }
  // Guarantee an invariant-violating element (>= 50) in the second half
  const failIdx =
    Math.floor(count / 2) + Math.floor(rng() * Math.ceil(count / 2));
  arr[Math.min(failIdx, count - 1)] = 70 + Math.floor(rng() * 25);
  return arr;
}

export function runPropertyShrinking(
  input: number[],
): AlgoStep<ArrayAlgoState>[] {
  const r = new Recorder(input);
  const fails = (xs: number[]) => xs.some((x) => x >= 50);

  if (!fails(r.array)) {
    r.record({}, 0, "Input already satisfies invariant (all < 50)");
    return r.steps;
  }

  // Phase 1: Bisection (halving chunks)
  while (r.array.length >= 4) {
    const mid = Math.floor(r.array.length / 2);
    const left = r.array.slice(0, mid);
    const right = r.array.slice(mid);

    // Test left half
    r.bump(SHRINK_COUNTERS.tests);
    if (fails(left)) {
      r.bump(SHRINK_COUNTERS.shrinks);
      r.record(
        {
          range: [0, mid - 1],
          compare: Array.from({ length: mid }, (_, i) => i),
        },
        3,
        `Bisect: left half [0..${mid - 1}] fails! Discarding ${right.length} items`,
      );
      r.setArray(left);
      r.record(
        { swap: Array.from({ length: r.array.length }, (_, i) => i) },
        3,
        `Bisected: kept left half; candidate length is now ${r.array.length}`,
      );
      continue;
    } else {
      r.record(
        { range: [0, mid - 1] },
        2,
        `Bisect: left half [0..${mid - 1}] passes (bug lost; search right)`,
      );
    }

    // Test right half
    r.bump(SHRINK_COUNTERS.tests);
    if (fails(right)) {
      r.bump(SHRINK_COUNTERS.shrinks);
      r.record(
        {
          range: [mid, r.array.length - 1],
          compare: Array.from({ length: right.length }, (_, i) => mid + i),
        },
        3,
        `Bisect: right half [${mid}..${r.array.length - 1}] fails! Discarding ${mid} items`,
      );
      r.setArray(right);
      r.record(
        { swap: Array.from({ length: r.array.length }, (_, i) => i) },
        3,
        `Bisected: kept right half; candidate length is now ${r.array.length}`,
      );
      continue;
    } else {
      r.record(
        { range: [mid, r.array.length - 1] },
        2,
        `Bisect: right half passes; cannot bisect further without losing failure`,
      );
      break;
    }
  }

  // Phase 2: Element deletion (individual item removal)
  for (let i = r.array.length - 1; i >= 0; i--) {
    if (r.array.length <= 1) break;
    const val = r.array[i];
    const candidate = r.array.filter((_, idx) => idx !== i);
    r.bump(SHRINK_COUNTERS.tests);
    if (fails(candidate)) {
      r.bump(SHRINK_COUNTERS.shrinks);
      r.record(
        { compare: [i] },
        6,
        `Try deleting element ${val} at index ${i}: remainder still fails!`,
      );
      r.setArray(candidate);
      r.record(
        { swap: [Math.min(i, r.array.length - 1)] },
        6,
        `Deleted unused element ${val}; array length is now ${r.array.length}`,
      );
    } else {
      r.record(
        { compare: [i] },
        6,
        `Try deleting element ${val} at index ${i}: passes (element required, keeping)`,
      );
    }
  }

  // Phase 3: Value decrementing (shrink scalar towards 0 / threshold)
  for (let i = 0; i < r.array.length; i++) {
    if (r.array[i] > 50) {
      let lo = 0;
      let hi = r.array[i];
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const candidate = [...r.array];
        candidate[i] = mid;
        r.bump(SHRINK_COUNTERS.tests);
        if (fails(candidate)) {
          r.bump(SHRINK_COUNTERS.shrinks);
          hi = mid;
          r.setElement(i, mid);
          r.record(
            { swap: [i] },
            8,
            `Reduce value to ${mid}: still fails (>= 50)! Shrink accepted`,
          );
        } else {
          lo = mid;
          r.record(
            { compare: [i] },
            8,
            `Try reducing value to ${mid}: passes (< 50, rejected)`,
          );
        }
      }
    }
  }

  r.record(
    { sorted: Array.from({ length: r.array.length }, (_, i) => i) },
    9,
    `Minimal counterexample: [${r.array.join(", ")}] (${r.count(SHRINK_COUNTERS.shrinks)} shrinks across ${r.count(SHRINK_COUNTERS.tests)} tests)`,
  );

  return r.steps;
}

export const propertyShrinkingAlgo: AlgoDef<ArrayAlgoState, number[]> = {
  id: "property-shrinking",
  title: "property shrinking",
  code: CODE,
  counters: COUNTERS,
  size: ARRAY_SIZE,
  generateInput: generateShrinkInput,
  run: (input) => runPropertyShrinking(input),
};
