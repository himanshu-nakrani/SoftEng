import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { DuplicatedLogicFigure } from "@/lessons/refactoring/duplicated-logic-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("duplicated-logic");

export default function DuplicatedLogicPage() {
  return (
    <Lesson slug="duplicated-logic">
      <LessonSection id="copy-paste">
        <Lead>The same guard, pasted into two handlers, is one bug waiting for one of the copies to be forgotten.</Lead>
        <P>
          <code>createUser</code> and <code>updateUser</code> both open with the identical validation
          branch. The module reports one <Term>duplicated block</Term>: two copies of a structure
          that should be one. The danger is not the extra lines, it is that a fix applied to one copy
          silently misses the other.
        </P>
      </LessonSection>

      <LessonSection id="de-duplicate">
        <TryThis>
          <LI>Note <Strong>duplication</Strong> reads 1 — one surplus copy of the guard.</LI>
          <LI>Step once to extract the guard from the first handler into a shared function.</LI>
          <LI>Step again to point the <Strong>second</Strong> handler at that same function, and watch both duplication and decision points fall.</LI>
        </TryThis>
        <DuplicatedLogicFigure />
        <Callout kind="insight">
          After the reuse, duplication is 0 and the module&apos;s total decision points drop from 4 to
          2. Unlike a plain extraction, de-duplication <Strong>deletes</Strong> a copy rather than
          moving it — so the total genuinely falls. There is now exactly one place the rule lives.
        </Callout>
      </LessonSection>

      <LessonSection id="what-moved">
        <Lead>Extracting a copy is not the same as removing one.</Lead>
        <P>
          The trap is in the second step. Had you extracted the second handler&apos;s guard into its{" "}
          <Strong>own</Strong> new function, you would have two identical helpers and the duplication
          count would not have moved — the figure would have shown it stuck at 1. De-duplication only
          happens when the second site <Term>reuses</Term> the function the first one created.
        </P>
        <P>
          This is why the metric earns its place beside complexity. Extract Function lowers the hot
          spot but conserves total decision points; removing duplication is the one refactoring that
          actually reduces them, because a whole decision was living in two bodies and now lives in
          one.
        </P>
      </LessonSection>
    </Lesson>
  );
}
