import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  EveryHoleClosedFigure,
  PartialSuiteFigure,
} from "@/lessons/test-quality/equivalent-mutants-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("equivalent-mutants");

export default function EquivalentMutantsPage() {
  return (
    <Lesson slug="equivalent-mutants">
      <LessonSection id="chasing-100">
        <Lead>
          The first lesson said a survivor is always a nameable hole. That is
          almost right. Some survivors are holes you can close — and some are
          changes no test could ever catch, because they do not change anything.
        </Lead>
        <P>
          A mutant is <Term>equivalent</Term> when the broken code computes the
          exact same answer as the original for every input. Nothing distinguishes
          the two, so no test can distinguish them either. An equivalent mutant
          survives a weak suite, survives a strong suite, and survives a perfect
          suite — not because a test is missing, but because the test that would
          kill it cannot exist.
        </P>
        <P>
          That has a blunt consequence: a mutation score of{" "}
          <Strong>100%</Strong> is usually not reachable, and chasing it means
          spending effort trying to write tests for mutants that are unkillable by
          construction. The goal is not to kill every mutant. It is to kill every
          mutant that <Strong>can</Strong> be killed, and to recognise the rest.
        </P>
        <Callout kind="insight">
          The function below clamps a score into 0–100: below zero becomes zero,
          above one hundred becomes one hundred, everything else passes through.
          Five mutants are tried against it. Two of them are equivalent — and the
          figures let you tell those two apart from the real holes.
        </Callout>
      </LessonSection>

      <LessonSection id="unkillable">
        <P>
          Here is the clamp under a partial suite: it checks that a mid-range score
          passes through and that a negative score clamps to zero. Five mutants are
          tried, one per row. The score line reads{" "}
          <Strong>2 killed, 3 survived</Strong>.
        </P>
        <TryThis>
          <LI>
            Find the two survivors labelled{" "}
            <Strong>score &lt; 0 became score &lt;= 0</Strong> and{" "}
            <Strong>score &gt; 100 became score &gt;= 100</Strong>. These are the
            equivalent mutants.
          </LI>
          <LI>
            Reason about why no test kills them. At a score of 0 the original
            returns the score, which <Strong>is</Strong> 0 — the same value the
            mutant returns one branch earlier. At 100 the same coincidence holds at
            the upper edge. The boundary value maps to itself, so the two branches
            never disagree.
          </LI>
        </TryThis>
        <PartialSuiteFigure />
        <P>
          You cannot fix these with a better test, because there is no input where
          they are wrong. We did not take that on faith: each mutant was diffed
          against the original over every integer score from &minus;1000 to 2000,
          and these two matched on every one. Over the domain this function
          accepts, they are provably indistinguishable — though deciding
          equivalence for arbitrary code is, in general, undecidable.
        </P>
      </LessonSection>

      <LessonSection id="real-holes">
        <P>
          The other survivor in that same grid is a different animal. One mutant —{" "}
          <Strong>the high clamp returns 99</Strong> — is genuinely wrong: it
          clamps every score above 100 to 99 instead of 100. It survived only
          because the partial suite never sent it a score above 100. That is a real
          hole, and unlike the equivalent pair it has a killing test waiting to be
          written.
        </P>
        <TryThis>
          <LI>
            Add the missing probe. The completed suite below keeps the same five
            mutants but adds one test — a score of 200 clamps to 100. The score line
            moves to <Strong>3 killed, 2 survived</Strong>.
          </LI>
          <LI>
            Watch where it stops. The real hole dies; the two equivalent mutants do
            not. No fourth test would move the number, because the survivors that
            remain are the two that cannot be killed.
          </LI>
        </TryThis>
        <EveryHoleClosedFigure />
        <Callout kind="insight">
          Same grid, two kinds of red. One survivor named a test you had not
          written yet. The other two named nothing — they are the score&rsquo;s
          floor, not its to-do list.
        </Callout>
      </LessonSection>

      <LessonSection id="reading-the-score">
        <Lead>
          A mutation score is a ceiling minus the equivalents, not a percentage to
          drive to 100.
        </Lead>
        <P>
          After the real hole is closed, this suite kills 3 of 5 — a score of{" "}
          <Strong>60%</Strong> — and it is stuck there. The gap to 100% is not two
          missing tests; it is two mutants that no test can reach. Reading the score
          means splitting the survivors into two piles: the ones that name a test to
          write, and the ones you mark equivalent and set aside. The first pile is
          work. The second is the reason the number will never be 100.
        </P>
        <P>
          This is the counterweight to the first lesson. There, every survivor was a
          hole and closing them all was the job. Here, some survivors are holes and
          some are illusions of holes, and the skill is telling them apart — because
          a team that treats the equivalent pile as work will burn hours writing
          tests that can never fail, and a team that treats the real pile as noise
          will ship the bug the mutant was pointing at.
        </P>
      </LessonSection>
    </Lesson>
  );
}
