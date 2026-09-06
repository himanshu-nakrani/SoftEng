import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { DependencyInversionFigure } from "@/lessons/architecture-boundaries/dependency-inversion-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("dependency-inversion");

export default function DependencyInversionPage() {
  return (
    <Lesson slug="dependency-inversion">
      <LessonSection id="concrete-coupling">
        <Lead>TODO: Coupling domain to infrastructure.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>

      <LessonSection id="ports-and-adapters">
        <TryThis>
          <LI>TODO: the first thing to do.</LI>
          <LI>TODO: the thing that surprises.</LI>
        </TryThis>
        <DependencyInversionFigure />
        <Callout kind="insight">TODO: what the figure just proved.</Callout>
      </LessonSection>

      <LessonSection id="boundary-isolation">
        <Lead>TODO: Independent testability and swappability.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>
    </Lesson>
  );
}
