import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  StrengthenedFigure,
  WeakAssertionsFigure,
} from "@/lessons/test-quality/coverage-vs-correctness-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("coverage-vs-correctness");

export default function CoverageVsCorrectnessPage() {
  return (
    <Lesson slug="coverage-vs-correctness">
      <LessonSection id="green-suite">
        <Lead>
          A coverage report says which lines ran. It cannot say whether any test
          would have noticed if a line had been wrong — and those are not the same
          claim.
        </Lead>
        <P>
          The function below grades a score into a band: A, B, C, D or F. Four
          tests — one high score, one middling, one just passing, one failing —
          execute every line of it. A coverage tool prints{" "}
          <Strong>100%</Strong> and turns the file green. The report is not lying;
          every line really did run. It is just answering a question about the{" "}
          <Term>tests</Term>, not a question about the code.
        </P>
        <P>
          <Term>Mutation testing</Term> asks the other question. It changes the
          code on purpose — one small break at a time, a <Strong>mutant</Strong> —
          and reruns the suite. If a test fails, the mutant is{" "}
          <Term>killed</Term>: something noticed. If the whole suite still passes,
          the mutant <Term>survived</Term>, and that survivor is a precise,
          nameable hole: a change to the code that your tests sleep through.
        </P>
        <Callout kind="insight">
          Coverage is necessary but not sufficient. A line that never runs cannot
          be checked — but a line that runs under an assertion that asks nothing of
          the result is not checked either. The figures below hold coverage fixed
          at 100% and vary only the assertions.
        </Callout>
      </LessonSection>

      <LessonSection id="weak-assertions">
        <P>
          Here is the grader under a suite whose four tests each check only that a
          letter came back — that the result is one of A, B, C, D or F. Every line
          runs; coverage is 100%. Six mutants are then tried against it, one per
          row of the grid.
        </P>
        <TryThis>
          <LI>
            Read the score line at the bottom of the grid:{" "}
            <Strong>0 killed, 6 survived</Strong>. Every row stays red.
          </LI>
          <LI>
            The surprise is <Strong>always returns B</Strong> — a grader that hands
            every student the same grade. It survives too, because &ldquo;B&rdquo;
            is a letter, and a letter is all these tests ever ask for.
          </LI>
        </TryThis>
        <WeakAssertionsFigure />
        <P>
          Nothing here is a bug in the tests&rsquo; <Strong>reach</Strong>. They
          touch every branch. The defect is in what they <Strong>assert</Strong>:
          checking that a value has the right shape is not checking that it has the
          right value, and a mutant only has to keep the shape to walk past.
        </P>
      </LessonSection>

      <LessonSection id="strengthened">
        <P>
          The same grader, the same six mutants, the same four inputs. The only
          change is the assertion: each test now demands the{" "}
          <Strong>exact</Strong> grade — 95 is an A, 85 is a B, 75 is a C, 50 is an
          F. Line coverage is byte-for-byte identical to the run above.
        </P>
        <TryThis>
          <LI>
            The score line now reads <Strong>6 killed, 0 survived</Strong>. Every
            row turned green.
          </LI>
          <LI>
            Watch which column does the killing. Three of the six mutants —
            including &ldquo;always returns B&rdquo; — are caught by the very first
            test, <Strong>95 is an A</Strong>. It was there in the weak suite too;
            it just was not asking for an A.
          </LI>
        </TryThis>
        <StrengthenedFigure />
        <Callout kind="insight">
          Two suites, identical coverage, opposite verdicts:{" "}
          <Strong>0 of 6</Strong> against <Strong>6 of 6</Strong>. Coverage could
          not distinguish them because coverage never looked at the assertions —
          and the assertions were the whole difference.
        </Callout>
      </LessonSection>

      <LessonSection id="reading-survivors">
        <Lead>
          A mutation score is more useful than a coverage number because a
          surviving mutant is a sentence, not a percentage.
        </Lead>
        <P>
          &ldquo;100% covered&rdquo; tells you nothing to act on. &ldquo;The mutant
          that makes the A band return B survived&rdquo; tells you exactly which
          test to write. Each survivor names a specific behaviour no test defends,
          which is why reading the survivors matters more than reading the total:
          the total is a temperature, the list is a to-do.
        </P>
        <P>
          Strengthening the assertions closed every hole here because every hole
          was an <Strong>assertion</Strong> hole — the inputs already reached the
          mutated code. The next lesson takes the opposite case: assertions that
          are exact, but inputs that never arrive at the value where the bug lives.
        </P>
      </LessonSection>
    </Lesson>
  );
}
