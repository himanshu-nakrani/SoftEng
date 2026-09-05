import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { InstabilityAbstractnessFigure } from "@/lessons/modularity-coupling/instability-abstractness-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("instability-abstractness");

export default function InstabilityAbstractnessPage() {
  return (
    <Lesson slug="instability-abstractness">
      <LessonSection id="instability-metric">
        <Lead>TODO: The I metric.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>

      <LessonSection id="main-sequence">
        <TryThis>
          <LI>TODO: the first thing to do.</LI>
          <LI>TODO: the thing that surprises.</LI>
        </TryThis>
        <InstabilityAbstractnessFigure />
        <Callout kind="insight">TODO: what the figure just proved.</Callout>
      </LessonSection>

      <LessonSection id="zone-of-pain">
        <Lead>TODO: Stable concrete packages.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>
    </Lesson>
  );
}
