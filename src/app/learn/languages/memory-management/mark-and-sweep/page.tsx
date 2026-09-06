import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { MarkAndSweepFigure } from "@/lessons/memory-management/mark-and-sweep-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("mark-and-sweep");

export default function MarkAndSweepPage() {
  return (
    <Lesson slug="mark-and-sweep">
      <LessonSection id="the-heap">
        <Lead>
          Live means reachable from a <Term>root</Term>. A pointer among
          garbage is not a root.
        </Lead>
        <P>
          Four heap objects: <Term>0</Term>, <Term>1</Term>,{" "}
          <Term>2</Term>, and <Term>3</Term>. <Term>0→1</Term> always.
          Default heap <Strong>0</Strong> has one root: <Term>0</Term>.{" "}
          <Term>2</Term> and <Term>3</Term> have no path from that root, so
          they are garbage.
        </P>
        <P>
          <Term>Mark-and-sweep</Term> walks from the roots and paints every
          object it can reach, then frees the rest. It does not count
          pointers. A cycle that no root can reach is still unmarked.
        </P>
      </LessonSection>

      <LessonSection id="collect">
        <P>
          The slider is which heap, from 0 to 2. Default{" "}
          <Strong>0</Strong> is the measured run.
        </P>
        <TryThis>
          <LI>
            Leave heap at <Strong>0</Strong>. The first caption is
            &quot;Root 0→1. 2 and 3 are garbage.&quot; Step:{" "}
            <Term>Mark 0</Term>, then <Term>Mark 1</Term>, then{" "}
            <Term>Sweep 2</Term>, then <Term>Sweep 3</Term>. Meters read{" "}
            <Strong>2</Strong> marked, <Strong>2</Strong> swept. The stamp
            reads <Strong>2 marked 2 swept</Strong>.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. An unrooted cycle{" "}
            <Term>2↔3</Term> appears. Same counts: <Strong>2</Strong>{" "}
            marked, <Strong>2</Strong> swept. The cycle is still swept.
            Stamp still <Strong>2 marked 2 swept</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. Roots <Term>0</Term> and{" "}
            <Term>2</Term>. Cycle <Term>2↔3</Term> is live. Meters:{" "}
            <Strong>4</Strong> marked, <Strong>0</Strong> swept. Stamp{" "}
            <Strong>4 marked 0 swept</Strong>.
          </LI>
        </TryThis>
        <MarkAndSweepFigure />
        <Callout kind="insight">
          Reachability from a root is the live set. A cycle with no root is
          garbage. That is the fact refcount could not see.
        </Callout>
      </LessonSection>

      <LessonSection id="cycles">
        <Lead>
          A cycle is still garbage. Refcount could not see that.
        </Lead>
        <P>
          Heap <Strong>1</Strong> is the same <Term>0→1</Term> chain plus
          an unrooted <Term>2↔3</Term> cycle. Mark still paints 0 and 1,
          then sweeps 2 and 3. Meters stay at <Strong>2</Strong> marked,{" "}
          <Strong>2</Strong> swept — the same counts as heap 0.
        </P>
        <P>
          The last lesson leaked both ends of a cycle: <Term>A↔B</Term>{" "}
          then drop both left rc at 1, leaked <Strong>2</Strong>.
          Mark-sweep does not care that 2 and 3 point at each other.
          Unreachable is unmarked, so both get swept.
        </P>
        <P>
          Heap <Strong>2</Strong> adds root <Term>2</Term>. Now the cycle
          is live. All four objects mark; nothing sweeps.{" "}
          <Strong>4</Strong> marked, <Strong>0</Strong> swept.
        </P>
        <Callout kind="warning">
          Four named objects, one pointer each. No allocator, no
          tri-colour, no concurrent mutator. The argument is what the
          collector counts — not a runtime.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
