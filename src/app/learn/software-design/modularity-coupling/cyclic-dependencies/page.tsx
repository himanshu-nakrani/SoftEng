import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { CyclicDependenciesFigure } from "@/lessons/modularity-coupling/cyclic-dependencies-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("cyclic-dependencies");

export default function CyclicDependenciesPage() {
  return (
    <Lesson slug="cyclic-dependencies">
      <LessonSection id="the-import-cycle">
        <Lead>TODO: The circular dependency.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>

      <LessonSection id="breaking-cycles">
        <TryThis>
          <LI>TODO: the first thing to do.</LI>
          <LI>TODO: the thing that surprises.</LI>
        </TryThis>
        <CyclicDependenciesFigure />
        <Callout kind="insight">TODO: what the figure just proved.</Callout>
      </LessonSection>

      <LessonSection id="acyclic-principle">
        <Lead>TODO: Topological release order.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>
    </Lesson>
  );
}
