import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  SmokeSuiteFigure,
  AssertedSuiteFigure,
} from "@/lessons/test-quality/assertion-free-tests-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("assertion-free-tests");

export default function AssertionFreeTestsPage() {
  return (
    <Lesson slug="assertion-free-tests">
      <LessonSection id="line-coverage">
        <Lead>
          A test that asserts nothing executes every line, turns the coverage
          badge green, and leaves almost every logic bug undetected.
        </Lead>
        <P>
          In large codebases, teams frequently run <Term>smoke tests</Term>: test
          cases that invoke an API route, render a component, or call a service
          method without asserting any values on the return payload. If the code
          completes without throwing an exception, the test passes.
        </P>
        <P>
          Because standard coverage tools count every source line touched by an
          active call stack, an assertion-free smoke suite often achieves{" "}
          <Strong>100% line coverage</Strong>. But line coverage only measures
          execution, not verification. The code below calculates shipping rates
          with a weight multiplier and an express surcharge.
        </P>
        <Callout kind="insight">
          A test verifies only what it asserts. When a test asserts nothing, it
          is only a test that the code does not crash.
        </Callout>
      </LessonSection>

      <LessonSection id="smoke-suite">
        <P>
          Here is the shipping calculator under four smoke tests. They execute
          standard, express, and heavy orders. Every line of the calculation is
          visited; line coverage is 100%. Six mutants are tried against it.
        </P>
        <TryThis>
          <LI>
            Look at the score line: <Strong>2 killed, 4 survived</Strong>. Four
            rows stay red.
          </LI>
          <LI>
            Look at which mutants died: <Strong>throws on all inputs</Strong> and{" "}
            <Strong>express throws an error</Strong>. Both died because an
            unhandled exception crashes the test runner.
          </LI>
          <LI>
            Look at the survivors: doubled shipping rates, doubled express
            surcharges, and even a mutant where <Strong>fee is always 0</Strong>.
            All four survived because returning a wrong number does not throw.
          </LI>
        </TryThis>
        <SmokeSuiteFigure />
        <P>
          The smoke suite caught the two crashes and slept through every single
          calculation error. To a coverage tool, all six mutants ran under
          covered lines.
        </P>
      </LessonSection>

      <LessonSection id="with-assertions">
        <P>
          Now run the exact same four inputs, but assert the expected dollar fee
          for each: 5kg standard is $10, 5kg express is $25, 20kg standard is
          $40, and 20kg express is $55. Line coverage is unchanged.
        </P>
        <TryThis>
          <LI>
            The score line moves to <Strong>6 killed, 0 survived</Strong>. Every
            row turns green.
          </LI>
          <LI>
            Watch how early the kills occur. The calculation mutants that
            survived all four smoke tests are caught on the very first test they
            encounter.
          </LI>
        </TryThis>
        <AssertedSuiteFigure />
        <Callout kind="insight">
          Coverage did not change by a single line between the two runs: both
          were 100%. The difference between a 33% mutation score and a 100%
          mutation score was entirely in the assertions.
        </Callout>
      </LessonSection>

      <LessonSection id="assertion-density">
        <Lead>
          High coverage with low assertion density is a false sense of security.
        </Lead>
        <P>
          Smoke suites are valuable for catching boot failures, unhandled promise
          rejections, and integration crashes. But treating a smoke test as
          proof of functional correctness confuses <Strong>reach</Strong> with{" "}
          <Strong>verification</Strong>.
        </P>
        <P>
          When evaluating a test suite, measure what is asserted, not merely what
          was executed. A suite with 80% coverage and rigorous assertions caught
          more real bugs than a 100% assertion-free suite that only proved the
          process did not exit.
        </P>
      </LessonSection>
    </Lesson>
  );
}
