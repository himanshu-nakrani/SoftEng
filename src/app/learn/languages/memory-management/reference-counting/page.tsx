import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Compare,
  CompareCol,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import {
  AcyclicFigure,
  CycleFigure,
} from "@/lessons/memory-management/reference-counting-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("reference-counting");

export default function ReferenceCountingPage() {
  return (
    <Lesson slug="reference-counting">
      <LessonSection id="rc">
        <Lead>
          Zero means free. A cycle is the count that never gets there.
        </Lead>
        <P>
          <Term>Reference counting</Term> stores a number on every object:
          how many pointers currently name it. Alloc starts at 1 — the
          variable that just received it. A store into another object&apos;s
          field increments the target. Dropping a variable decrements.
          Hitting 0 frees the object and drops whatever it pointed at.
        </P>
        <P>
          Two objects, A and B. The acyclic run does <Term>A.p=B</Term>{" "}
          then drops both. The cyclic run also does <Term>B.p=A</Term>.
          Same allocs, same drops. The only difference is that extra
          pointer. There is no size slider — the cycle is a second figure,
          not a control. Seed is ignored: a count is not a scheduler.
        </P>
        <Compare>
          <CompareCol title="acyclic · A.p=B">
            Drop both. Freed <Strong>2</Strong>, leaked <Strong>0</Strong>.
            Stamp <Strong>2 freed</Strong>.
          </CompareCol>
          <CompareCol title="cycle · A↔B">
            Drop both. Freed <Strong>0</Strong>, leaked <Strong>2</Strong>.
            Stamp <Strong>2 leaked</Strong>. Each still has rc 1.
          </CompareCol>
        </Compare>
      </LessonSection>

      <LessonSection id="acyclic">
        <P>
          A points at B, then both roots drop. B&apos;s count goes 1
          (alloc) → 2 (<Term>A.p=B</Term>) → 1 (A freed, dropping its
          pointer) → 0 (drop B).
        </P>
        <TryThis>
          <LI>
            The first caption is &quot;A.p=B, then drop both.&quot; Stamp{" "}
            <Strong>acyclic</Strong>. Allocs, freed, and leaked are still{" "}
            <Strong>0</Strong>.
          </LI>
          <LI>
            Step: &quot;Alloc A rc=1.&quot; then &quot;Alloc B rc=1.&quot;
            Allocs <Strong>2</Strong>.
          </LI>
          <LI>
            &quot;A.p = B. B rc=2.&quot; B now has two names: the root and
            A&apos;s field.
          </LI>
          <LI>
            Drop A: &quot;Free A.&quot; then &quot;Drop A. rc=0.&quot;
            Freed <Strong>1</Strong>. B&apos;s count has fallen from 2 to
            1 — A&apos;s pointer is gone.
          </LI>
          <LI>
            Drop B: &quot;Free B.&quot; then &quot;Drop B. rc=0.&quot; Skip
            to the end. Allocs <Strong>2</Strong>, freed <Strong>2</Strong>,
            leaked <Strong>0</Strong>. The last caption is &quot;Both
            freed.&quot; Stamp <Strong>2 freed</Strong>.
          </LI>
        </TryThis>
        <AcyclicFigure />
        <Callout kind="insight">
          A.p=B then drop both: freed 2, leaked 0. Zero means free, and
          both counts hit it.
        </Callout>
      </LessonSection>

      <LessonSection id="cycle">
        <Lead>
          Add one pointer the other way. A and B now keep each other alive.
        </Lead>
        <P>
          Same two allocs, same two drops. After <Term>A.p=B</Term> the
          run also does <Term>B.p=A</Term>, so each object&apos;s count is
          2 — one from its root, one from the other object. Dropping both
          roots leaves each at 1. The collector never sees a zero, so it
          never frees, so it never follows the remaining pointer.
        </P>
        <TryThis>
          <LI>
            The first caption is &quot;Cycle A.p=B, B.p=A.&quot; Stamp{" "}
            <Strong>cycle</Strong>.
          </LI>
          <LI>
            After both links: &quot;A.p = B. B rc=2.&quot; then &quot;B.p
            = A. A rc=2.&quot;
          </LI>
          <LI>
            Drop A: &quot;Drop A. rc=1.&quot; No free. Drop B: &quot;Drop
            B. rc=1.&quot; Still no free.
          </LI>
          <LI>
            Skip to the end. Allocs <Strong>2</Strong>, freed{" "}
            <Strong>0</Strong>, leaked <Strong>2</Strong>. The last caption
            is &quot;Leaked 2. rc never hit 0.&quot; Stamp{" "}
            <Strong>2 leaked</Strong>. Both chips still show rc1 pointing
            at the other.
          </LI>
        </TryThis>
        <CycleFigure />
        <Callout kind="insight">
          A.p=B and B.p=A then drop both: freed 0, leaked 2 — rc stays 1.
          A cycle is two objects each holding the last pointer to the
          other. Dropping the roots is not enough.
        </Callout>
        <Callout kind="warning">
          Two named objects, one pointer each. Not a real collector, not
          Swift ARC, not Python&apos;s cyclic GC. The argument that is
          here: the count only sees local increments and decrements, so a
          cycle looks live forever. Mark-sweep is the next lesson because
          it does not care.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
