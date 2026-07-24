import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { MergeFigure, QuickFigure } from "@/lessons/algorithms/sort-figures";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sorting II: Divide & Conquer",
};

export default function DivideAndConquerPage() {
  return (
    <Lesson slug="divide-and-conquer">
      <LessonSection id="split-it">
        <Lead>
          Bubble and insertion fight the whole array at once and pay{" "}
          <Term>O(n²)</Term> for it. The escape is a strategy, not a
          trick: <Strong>split the problem, solve the halves, combine</Strong>.
        </Lead>
        <P>
          Halving means ~<Term>log n</Term> levels of splitting; each
          level touches every element about once — <Term>n</Term> work per
          level. Multiply: <Term>O(n log n)</Term>. Same counters, new
          shape — watch them prove it.
        </P>
      </LessonSection>

      <LessonSection id="merge">
        <P>
          <Strong>Merge sort</Strong> splits first, thinks later: divide
          until trivial (the violet band tracks the active piece), then
          merge sorted halves by repeatedly taking the smaller front
          element. Compare its final counter against bubble sort&apos;s on
          the same size.
        </P>
        <MergeFigure />
      </LessonSection>

      <LessonSection id="quick">
        <P>
          <Strong>Quicksort</Strong> thinks first, splits later: pick a{" "}
          <Term>pivot</Term> (violet bar), partition everything smaller to
          its left, and drop the pivot into its final home — settled green
          in one move. Then conquer each side.
        </P>
        <QuickFigure />
        <Callout kind="insight">
          Merge sort&apos;s split is mechanical (always the middle);
          quicksort&apos;s depends on the pivot&apos;s luck. Scrub a run
          and notice partitions of wildly different sizes — a terrible
          pivot streak is how quicksort degrades to O(n²), and why real
          implementations randomize pivots. Determinism for learning,
          randomness for safety.
        </Callout>
        <Callout kind="note">
          The divide-and-conquer instinct is bigger than sorting —
          it&apos;s binary search, it&apos;s merge joins in databases,
          it&apos;s MapReduce splitting work across the fleets you built
          in Track 1.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
