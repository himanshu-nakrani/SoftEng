import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { CouplingMetricsFigure } from "@/lessons/modularity-coupling/coupling-metrics-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("coupling-metrics");

export default function CouplingMetricsPage() {
  return (
    <Lesson slug="coupling-metrics">
      <LessonSection id="module-boundaries">
        <Lead>TODO: Incoming vs outgoing dependencies.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>

      <LessonSection id="measuring-coupling">
        <TryThis>
          <LI>TODO: the first thing to do.</LI>
          <LI>TODO: the thing that surprises.</LI>
        </TryThis>
        <CouplingMetricsFigure />
        <Callout kind="insight">TODO: what the figure just proved.</Callout>
      </LessonSection>

      <LessonSection id="coupling-sensitivity">
        <Lead>TODO: The blast radius of change.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>
    </Lesson>
  );
}
