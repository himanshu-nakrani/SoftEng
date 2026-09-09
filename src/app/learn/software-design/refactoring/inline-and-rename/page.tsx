import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { InlineAndRenameFigure } from "@/lessons/refactoring/inline-and-rename-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("inline-and-rename");

export default function InlineAndRenamePage() {
  return (
    <Lesson slug="inline-and-rename">
      <LessonSection id="over-abstracted">
        <Lead>Not every refactoring lowers a number. Some just make the code say what it means.</Lead>
        <P>
          Extraction has an inverse. <code>getX</code> is a one-line helper called from exactly one
          place — it adds a name and a jump without earning either. <Term>Inlining</Term> folds its
          body back into its single caller and deletes it. And <code>doThing</code> is a fine
          function with a useless name; renaming it changes nothing a compiler sees and everything a
          reader does.
        </P>
      </LessonSection>

      <LessonSection id="inline-it">
        <TryThis>
          <LI>Step once to inline <code>getX</code> into <code>render</code> — the function count falls and <code>render&apos;s</code> fan-out drops to 0.</LI>
          <LI>Step again to rename <code>doThing</code> to <code>commit</code>; watch every metric stay exactly where it was.</LI>
          <LI>Notice the rename touched every call site at once, not just the definition.</LI>
        </TryThis>
        <InlineAndRenameFigure />
        <Callout kind="insight">
          Inlining removed a function and one <Strong>coupling</Strong> edge; renaming moved no
          metric at all. Structure is a dial you can turn both ways — extraction and inlining are
          opposites, and which direction is right depends on whether the name is pulling its weight.
        </Callout>
      </LessonSection>

      <LessonSection id="structure-is-a-dial">
        <Lead>Metrics point; they do not decide.</Lead>
        <P>
          A complexity number tells you where the paths pile up. A fan-out number tells you which
          function knows about too many others. Neither can tell you that <code>getX</code> was too
          thin to keep or that <code>doThing</code> was a bad name — those are judgements the
          numbers <Strong>inform</Strong> rather than make. The renaming, which no metric even
          noticed, may be the most valuable change on this page.
        </P>
        <P>
          That is the honest limit of measuring structure. The figures across this track move real
          numbers computed from the code, and the numbers are worth watching — but a lower score is
          not the goal. A codebase a person can read is.
        </P>
      </LessonSection>
    </Lesson>
  );
}
