import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { BubbleFigure, InsertionFigure } from "@/lessons/algorithms/sort-figures";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sorting I: Bubble & Insertion",
};

export default function SortingBasicsPage() {
  return (
    <Lesson slug="sorting-basics">
      <LessonSection id="the-rules">
        <Lead>
          Sorting is the perfect first algorithm family: the goal is
          obvious, the moves are tiny —{" "}
          <Strong>compare two things, maybe swap them</Strong> — and every
          strategy is visible as it runs.
        </Lead>
        <P>
          Watch the counters, not the clock. <Term>comparisons</Term> and{" "}
          <Term>swaps</Term> are the currency of sorting; the previous
          lesson&apos;s shapes will show up in them. Use{" "}
          <Term>step-back</Term> liberally — being able to rewind a swap
          is exactly how these click.
        </P>
      </LessonSection>

      <LessonSection id="bubble">
        <P>
          <Strong>Bubble sort</Strong>: sweep left to right, swapping any
          adjacent pair that&apos;s out of order. Each pass carries the
          largest remaining value to its final home — watch it{" "}
          <em>bubble</em> rightward and settle green.
        </P>
        <BubbleFigure />
        <Callout kind="insight">
          Grow the array and watch <Term>comparisons</Term>: every extra
          bar makes each pass longer AND adds a pass. That&apos;s two
          multiplications — <Term>O(n²)</Term> — the red curve from last
          lesson, live.
        </Callout>
      </LessonSection>

      <LessonSection id="insertion">
        <P>
          <Strong>Insertion sort</Strong> plays a different game: keep a
          sorted prefix (green) and insert each new value by shifting it
          left to where it belongs — how most people sort cards in hand.
        </P>
        <InsertionFigure />
        <Callout kind="note">
          Still O(n²) worst case — but scrub an almost-sorted input and
          watch it finish in nearly n steps. That adaptiveness is why
          insertion sort survives inside production sorts (Timsort, used
          by Python and V8, hands small runs to it). &quot;Obsolete&quot;
          algorithms rarely are.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
