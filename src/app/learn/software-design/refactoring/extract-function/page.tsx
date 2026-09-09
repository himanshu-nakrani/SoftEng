import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { ExtractFunctionFigure } from "@/lessons/refactoring/extract-function-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("extract-function");

export default function ExtractFunctionPage() {
  return (
    <Lesson slug="extract-function">
      <LessonSection id="the-long-method">
        <Lead>&ldquo;This function is doing too much&rdquo; is a feeling. A metric turns it into a number.</Lead>
        <P>
          The <Term>cyclomatic complexity</Term> of a function is one plus the number of{" "}
          <Strong>decision points</Strong> in it — every <code>if</code>, loop, <code>&&</code>,{" "}
          <code>||</code>, and switch arm where control can go two ways. It counts the independent
          paths through the code, which is why it tracks how hard the function is to test and to
          hold in your head.
        </P>
        <P>
          The <code>handle</code> function below opens with a validation block: two guard clauses
          and a loop, stacked on top of the routing it actually exists to do. Every one of those is
          a decision point, and they all belong to <code>handle</code>. Its complexity is 7.
        </P>
      </LessonSection>

      <LessonSection id="extract-it">
        <TryThis>
          <LI>Read <code>handle&apos;s</code> complexity in its header — cc 7 — and count the tinted decision lines against it.</LI>
          <LI>Step forward once to extract the validate block into its own function.</LI>
          <LI>Watch <Strong>max complexity</Strong> fall from 7 to 6, and <Strong>decision points</Strong> hold.</LI>
        </TryThis>
        <ExtractFunctionFigure />
        <Callout kind="insight">
          <code>handle</code> drops from complexity 7 to 2, and the new <code>validate</code> arrives
          at 6. The decision points did not vanish — they <Strong>moved</Strong>. That is why the
          module&apos;s total decision-point count is unchanged: extraction relocates complexity, it
          does not destroy it.
        </Callout>
      </LessonSection>

      <LessonSection id="what-moved">
        <Lead>The number is folded over the code, not typed beside it.</Lead>
        <P>
          Every frame of the figure recomputes complexity by walking the syntax tree and counting
          decision points. Nothing about the metric is authored per step — which is the only reason
          it is worth showing. The proof is the <Term>conservation</Term> you just watched: a pure
          extraction moves decision points between functions and the module total stays fixed. If
          the numbers were hand-written, they could not obey that law by construction.
        </P>
        <P>
          Extraction lowered the <Strong>maximum</Strong> complexity — the hot spot — while raising
          the function count. That trade is the whole point: seven paths through one function is
          worse than six through one and two through another, because a reader and a test only ever
          face one function at a time.
        </P>
      </LessonSection>
    </Lesson>
  );
}
