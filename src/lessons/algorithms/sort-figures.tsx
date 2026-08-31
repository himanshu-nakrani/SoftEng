"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ArrayView } from "@/engine/algo/views/ArrayView";
import { bubbleSort, insertionSort, mergeSort, quickSort } from "./sorts";

export function BubbleFigure() {
  return (
    <SectionAlgoFigure
      def={bubbleSort}
      view={ArrayView}
      description="Bubble sort as a bar race: adjacent bars are compared (cyan) and swapped (amber); each pass settles the largest remaining value (green) at the right. Live pseudocode, comparison and swap counters, scrubbing and step-back."
    />
  );
}

export function InsertionFigure() {
  return (
    <SectionAlgoFigure
      def={insertionSort}
      view={ArrayView}
      description="Insertion sort: the sorted prefix grows from the left as each new value shifts leftward into place. Compare and write counters, live pseudocode, scrubbing and step-back."
    />
  );
}

export function MergeFigure() {
  return (
    <SectionAlgoFigure
      def={mergeSort}
      view={ArrayView}
      description="Merge sort: a violet band marks the active subrange as halves are split and merged back in sorted order. Comparison and write counters expose the n log n behavior."
    />
  );
}

export function QuickFigure() {
  return (
    <SectionAlgoFigure
      def={quickSort}
      view={ArrayView}
      description="Quicksort: the violet pivot partitions the active range; smaller values swap left, then the pivot lands in its final home (green). Counters and step-back reveal the partition mechanics."
    />
  );
}
