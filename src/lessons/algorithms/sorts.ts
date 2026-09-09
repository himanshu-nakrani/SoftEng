import { StepRecorder } from "@/engine/algo/recorder";
import type { AlgoCounter, AlgoDef, AlgoSizeControl, AlgoStep } from "@/engine/algo/types";
import type { AlgoHighlight, ArrayAlgoState } from "@/engine/algo/views/array";
import { shuffledInput } from "@/engine/algo/views/array";

/**
 * Sorting definitions — the reference consumers of archetype B, and the
 * fixtures its engine tests run against.
 *
 * Not registered as lessons: the DSA track is deferred. They stay because they
 * are what proves `AlgoDef`/`StepRecorder`/`ArrayView` actually compose, and
 * because deleting a working reference implementation costs more than keeping
 * one (see the algo notes in CLAUDE.md).
 */

/** Every sort reports the same two totals; only the write verb differs. */
function counters(writeLabel: string): AlgoCounter[] {
  return [
    { key: "comparisons", label: "comparisons" },
    { key: "writes", label: writeLabel },
  ];
}

const ARRAY_SIZE: AlgoSizeControl = {
  label: "array size",
  min: 5,
  max: 30,
  default: 12,
};

type SortDef = AlgoDef<ArrayAlgoState, number[]>;

/**
 * Array-flavoured wrapper over the engine's `StepRecorder`.
 *
 * Adds the vocabulary sorting wants (compare / swap / write) on top of the
 * generic bump-and-snapshot core, and owns the array copy so no recorded frame
 * aliases live state.
 */
class Recorder {
  private readonly rec: StepRecorder<ArrayAlgoState>;
  private highlight: AlgoHighlight = {};

  constructor(private a: number[]) {
    this.rec = new StepRecorder<ArrayAlgoState>(() => ({
      array: [...this.a],
      highlight: this.highlight,
    }));
    this.record({}, undefined, "the unsorted input");
  }

  get steps(): AlgoStep<ArrayAlgoState>[] {
    return this.rec.steps;
  }
  get array() {
    return this.a;
  }
  get comparisons() {
    return this.rec.count("comparisons");
  }
  get swaps() {
    return this.rec.count("writes");
  }

  record(highlight: AlgoHighlight, codeLine?: number, note?: string) {
    this.highlight = highlight;
    this.rec.record({ codeLine, note });
  }
  compare(highlight: AlgoHighlight, codeLine?: number, note?: string) {
    this.rec.bump("comparisons");
    this.record(highlight, codeLine, note);
  }
  swap(i: number, j: number, extra: AlgoHighlight = {}, codeLine?: number) {
    [this.a[i], this.a[j]] = [this.a[j], this.a[i]];
    this.rec.bump("writes");
    this.record({ ...extra, swap: [i, j] }, codeLine);
  }
  write(i: number, value: number, extra: AlgoHighlight = {}, codeLine?: number) {
    this.a[i] = value;
    this.rec.bump("writes");
    this.record({ ...extra, swap: [i] }, codeLine);
  }
}

/* ---------------- bubble sort ---------------- */

export const bubbleSort: SortDef = {
  id: "bubble-sort",
  title: "bubble sort",
  counters: counters("swaps"),
  size: ARRAY_SIZE,
  code: [
    "for pass in 0 .. n-1:",
    "  for i in 0 .. n-pass-2:",
    "    if a[i] > a[i+1]:",
    "      swap a[i], a[i+1]",
    "done — largest bubbled right",
  ],
  generateInput: shuffledInput,
  run: (input) => {
    const r = new Recorder([...input]);
    const n = input.length;
    const sorted: number[] = [];
    for (let pass = 0; pass < n - 1; pass++) {
      let swapped = false;
      for (let i = 0; i < n - pass - 1; i++) {
        r.compare({ compare: [i, i + 1], sorted: [...sorted] }, 2);
        if (r.array[i] > r.array[i + 1]) {
          r.swap(i, i + 1, { sorted: [...sorted] }, 3);
          swapped = true;
        }
      }
      sorted.unshift(n - 1 - pass);
      r.record({ sorted: [...sorted] }, 4, `pass ${pass + 1}: largest settled`);
      if (!swapped) break;
    }
    r.record(
      { sorted: Array.from({ length: n }, (_, i) => i) },
      4,
      `sorted — ${r.comparisons} comparisons, ${r.swaps} swaps`,
    );
    return r.steps;
  },
};

/* ---------------- insertion sort ---------------- */

export const insertionSort: SortDef = {
  id: "insertion-sort",
  title: "insertion sort",
  counters: counters("writes"),
  size: ARRAY_SIZE,
  code: [
    "for i in 1 .. n-1:",
    "  key = a[i]",
    "  j = i - 1",
    "  while j >= 0 and a[j] > key:",
    "    a[j+1] = a[j]; j--",
    "  a[j+1] = key",
  ],
  generateInput: shuffledInput,
  run: (input) => {
    const r = new Recorder([...input]);
    const n = input.length;
    const prefix = (k: number) => Array.from({ length: k }, (_, x) => x);
    for (let i = 1; i < n; i++) {
      const key = r.array[i];
      r.record({ compare: [i], sorted: prefix(i) }, 1, `take a[${i}] = ${key}`);
      let j = i - 1;
      while (j >= 0) {
        r.compare({ compare: [j, j + 1], sorted: prefix(i) }, 3);
        if (r.array[j] <= key) break;
        r.write(j + 1, r.array[j], { sorted: prefix(i) }, 4);
        j--;
      }
      r.write(j + 1, key, { sorted: prefix(i + 1) }, 5);
    }
    r.record(
      { sorted: prefix(n) },
      5,
      `sorted — ${r.comparisons} comparisons, ${r.swaps} writes`,
    );
    return r.steps;
  },
};

/* ---------------- merge sort ---------------- */

export const mergeSort: SortDef = {
  id: "merge-sort",
  title: "merge sort",
  counters: counters("writes"),
  size: ARRAY_SIZE,
  code: [
    "sort(lo, hi):",
    "  if hi <= lo: return",
    "  mid = (lo + hi) / 2",
    "  sort(lo, mid), sort(mid+1, hi)",
    "  merge the two sorted halves",
  ],
  generateInput: shuffledInput,
  run: (input) => {
    const r = new Recorder([...input]);
    const n = input.length;

    const sort = (lo: number, hi: number) => {
      if (hi <= lo) return;
      const mid = (lo + hi) >> 1;
      r.record({ range: [lo, hi] }, 2, `split [${lo}..${hi}]`);
      sort(lo, mid);
      sort(mid + 1, hi);
      // merge
      const left = r.array.slice(lo, mid + 1);
      const right = r.array.slice(mid + 1, hi + 1);
      let i = 0;
      let j = 0;
      let k = lo;
      r.record({ range: [lo, hi] }, 4, `merge [${lo}..${mid}] + [${mid + 1}..${hi}]`);
      while (i < left.length && j < right.length) {
        r.compare({ range: [lo, hi], compare: [lo + i, mid + 1 + j] }, 4);
        if (left[i] <= right[j]) {
          r.write(k++, left[i++], { range: [lo, hi] }, 4);
        } else {
          r.write(k++, right[j++], { range: [lo, hi] }, 4);
        }
      }
      while (i < left.length) r.write(k++, left[i++], { range: [lo, hi] }, 4);
      while (j < right.length) r.write(k++, right[j++], { range: [lo, hi] }, 4);
    };

    sort(0, n - 1);
    r.record(
      { sorted: Array.from({ length: n }, (_, i) => i) },
      4,
      `sorted — ${r.comparisons} comparisons, ${r.swaps} writes`,
    );
    return r.steps;
  },
};

/* ---------------- quicksort ---------------- */

export const quickSort: SortDef = {
  id: "quicksort",
  title: "quicksort",
  counters: counters("swaps"),
  size: ARRAY_SIZE,
  code: [
    "quicksort(lo, hi):",
    "  pivot = a[hi]",
    "  i = lo  // boundary of < pivot",
    "  for j in lo .. hi-1:",
    "    if a[j] < pivot: swap a[i], a[j]; i++",
    "  swap a[i], a[hi]  // pivot home",
  ],
  generateInput: shuffledInput,
  run: (input) => {
    const r = new Recorder([...input]);
    const n = input.length;
    const settled: number[] = [];

    const sort = (lo: number, hi: number) => {
      if (lo > hi) return;
      if (lo === hi) {
        settled.push(lo);
        r.record({ sorted: [...settled] }, 0);
        return;
      }
      const pivotIdx = hi;
      r.record(
        { range: [lo, hi], pivot: pivotIdx, sorted: [...settled] },
        1,
        `pivot = ${r.array[hi]}`,
      );
      let i = lo;
      for (let j = lo; j < hi; j++) {
        r.compare(
          { range: [lo, hi], pivot: pivotIdx, compare: [j], sorted: [...settled] },
          4,
        );
        if (r.array[j] < r.array[hi]) {
          if (i !== j) {
            r.swap(i, j, { range: [lo, hi], pivot: pivotIdx, sorted: [...settled] }, 4);
          }
          i++;
        }
      }
      if (i !== hi) {
        r.swap(i, hi, { range: [lo, hi], sorted: [...settled] }, 5);
      }
      settled.push(i);
      r.record(
        { range: [lo, hi], sorted: [...settled] },
        5,
        `pivot placed at ${i}`,
      );
      sort(lo, i - 1);
      sort(i + 1, hi);
    };

    sort(0, n - 1);
    r.record(
      { sorted: Array.from({ length: n }, (_, i) => i) },
      5,
      `sorted — ${r.comparisons} comparisons, ${r.swaps} swaps`,
    );
    return r.steps;
  },
};
