import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  IncrementalGcFigure,
  IncrementalGcSlicedFigure,
} from "@/lessons/memory-management/incremental-gc-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("incremental-gc");

export default function IncrementalGcPage() {
  return (
    <Lesson slug="incremental-gc">
      <LessonSection id="pause">
        <Lead>The mutator waits.</Lead>
        <P>
          Four live objects: <Term>a→b→c→d</Term>, rooted at{" "}
          <Term>a</Term>. Nothing is swept — the heap is all live. The
          lesson is how long the <Term>mutator</Term> sits out the mark.
        </P>
        <P>
          <Term>Stop-the-world</Term> marks all four in one pause of{" "}
          <Strong>4</Strong>. Incremental with budget <Strong>1</Strong>{" "}
          marks the same four in four slices: pause <Strong>1</Strong>,
          slices <Strong>4</Strong>. The work is the same{" "}
          <Strong>4</Strong> marks; the pause is the slice.
        </P>
        <P>
          The pause meter is the longest slice, not the total work. The
          mutator waits for the current slice, not for the whole heap.
        </P>
      </LessonSection>

      <LessonSection id="stw">
        <TryThis>
          <LI>
            The first caption is &quot;Stop-the-world mark of 4.&quot;
            pause, slices, and marked are still <Strong>0</Strong>.
          </LI>
          <LI>
            Skip to the end. pause <Strong>4</Strong>, slices{" "}
            <Strong>1</Strong>, marked <Strong>4</Strong>. The last
            caption is &quot;One pause of 4.&quot; The stamp reads{" "}
            <Strong>pause 4</Strong>.
          </LI>
        </TryThis>
        <IncrementalGcFigure />
        <Callout kind="insight">
          One pause of 4. The mutator sat out the whole mark.
        </Callout>
      </LessonSection>

      <LessonSection id="sliced">
        <P>
          The slider is the budget, 1 through 4. Default{" "}
          <Strong>1</Strong> is four slices of one.
        </P>
        <TryThis>
          <LI>
            Leave budget at <Strong>1</Strong>. Skip to the end: pause{" "}
            <Strong>1</Strong>, slices <Strong>4</Strong>, marked{" "}
            <Strong>4</Strong>. The stamp reads{" "}
            <Strong>max 1 × 4</Strong>. The last caption is &quot;4
            slices, budget 1.&quot;
          </LI>
          <LI>
            Drag to <Strong>4</Strong>. pause <Strong>4</Strong>, slices{" "}
            <Strong>1</Strong> — the same as STW. Budget 4 is one slice
            of four.
          </LI>
          <LI>
            Drag to <Strong>3</Strong>. It marks 3, then 1. pause stays{" "}
            <Strong>3</Strong>, slices <Strong>2</Strong>, marked{" "}
            <Strong>4</Strong>. The pause is the max slice, not the sum.
          </LI>
        </TryThis>
        <IncrementalGcSlicedFigure />
        <Callout kind="insight">
          Budget 1 is four slices, pause 1. Budget 4 is one slice, pause
          4 — the same as STW. The work is the same 4 marks; the pause
          is the slice.
        </Callout>
        <Callout kind="warning">
          Four objects, no tri-colour, no mutator writing between
          slices. The figure counts the pause. It is not a collector.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
