import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { StranglerFigFigure } from "@/lessons/architecture-boundaries/strangler-fig-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("strangler-fig");

export default function StranglerFigPage() {
  return (
    <Lesson slug="strangler-fig">
      <LessonSection id="monolith-gravity">
        <Lead>TODO: The risk of big-bang rewrites.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>

      <LessonSection id="interceptor-routing">
        <TryThis>
          <LI>TODO: the first thing to do.</LI>
          <LI>TODO: the thing that surprises.</LI>
        </TryThis>
        <StranglerFigFigure />
        <Callout kind="insight">TODO: what the figure just proved.</Callout>
      </LessonSection>

      <LessonSection id="complete-cutover">
        <Lead>TODO: Decommissioning the legacy core.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>
    </Lesson>
  );
}
