import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { PropertyShrinkingFigure } from "@/lessons/property-testing/property-shrinking-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("property-shrinking");

export default function PropertyShrinkingPage() {
  return (
    <Lesson slug="property-shrinking">
      <LessonSection id="failing-inputs">
        <Lead>TODO: The random counterexample.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>

      <LessonSection id="shrink-strategies">
        <TryThis>
          <LI>TODO: the first thing to do.</LI>
          <LI>TODO: the thing that surprises.</LI>
        </TryThis>
        <PropertyShrinkingFigure />
        <Callout kind="insight">TODO: what the figure just proved.</Callout>
      </LessonSection>

      <LessonSection id="minimal-repro">
        <Lead>TODO: The minimal failing case.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>
    </Lesson>
  );
}
