import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  MockSuiteFigure,
  StateSuiteFigure,
} from "@/lessons/test-quality/brittle-mocks-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("brittle-mocks");

export default function BrittleMocksPage() {
  return (
    <Lesson slug="brittle-mocks">
      <LessonSection id="mock-fragility">
        <Lead>
          When tests assert how an operation executes rather than what it
          produces, safe refactorings break and real bugs go unnoticed.
        </Lead>
        <P>
          In unit testing, developers often reach for <Term>mocks</Term> and{" "}
          <Term>spies</Term> to assert interaction details: that a specific
          internal method was called, that it received certain arguments, or
          that methods were called in an exact sequence.
        </P>
        <P>
          The risk of interaction testing is <Strong>implementation coupling</Strong>.
          When a test suite mirrors the exact lines of code in the implementation,
          any refactoring—even one that leaves the observable behavior
          completely unchanged—breaks the tests. Worse, by focusing on call
          mechanics, the test often forgets to verify the final outcome.
        </P>
        <Callout kind="insight">
          A test suite should be an anchor for refactoring, not a barrier to it.
          When tests assert internal steps, refactoring becomes expensive because
          every code change requires rewriting test assertions.
        </Callout>
      </LessonSection>

      <LessonSection id="mock-suite">
        <P>
          Below is an order total calculation that emits three events:{" "}
          <code>validate</code>, <code>charge</code>, and <code>record</code>.
          The mock-heavy suite asserts that exactly three events were emitted in
          that exact order, but never checks the returned dollar total.
        </P>
        <TryThis>
          <LI>
            Look at the score line: <Strong>3 killed, 3 survived</Strong>.
          </LI>
          <LI>
            Look at what died: all three <Strong>refactoring</Strong> mutants
            were failed by the tests. Consolidating events, reordering independent
            calls, or omitting redundant validation broke the test suite, even
            though every single customer would receive the exact same bill.
          </LI>
          <LI>
            Look at what survived: all three <Strong>calculation bugs</Strong>.
            Subtracting the fee, dropping the fee, or doubling the fee all
            passed cleanly, because every broken variant still emitted the three
            expected events.
          </LI>
        </TryThis>
        <MockSuiteFigure />
        <P>
          The mock suite produced the worst possible combination: false alarms
          on safe improvements, and silent passes on financial errors.
        </P>
      </LessonSection>

      <LessonSection id="state-suite">
        <P>
          Now test the same function using <Term>state verification</Term>.
          Instead of spying on internal event emissions, the tests assert the
          final total: 100 + 10 is 110, 50 + 5 is 55, 200 + 0 is 200, and 0 + 15
          is 15.
        </P>
        <TryThis>
          <LI>
            The score line still reads <Strong>3 killed, 3 survived</Strong>, but
            the rows have completely flipped.
          </LI>
          <LI>
            All three refactoring mutants now <Strong>survive</Strong>. You can
            optimize event emissions, combine steps, or clean up helpers without
            a single test turning red.
          </LI>
          <LI>
            All three calculation bugs are <Strong>killed</Strong>. The moment a
            mutant corrupts the total, the test catches it on the first check.
          </LI>
        </TryThis>
        <StateSuiteFigure />
        <Callout kind="insight">
          State verification tests the contract with callers. Interaction
          testing tests the implementation against itself. Testing the contract
          gives you the freedom to change the implementation.
        </Callout>
      </LessonSection>

      <LessonSection id="state-vs-interaction">
        <Lead>
          Assert state at the boundary; mock only when the boundary is an external dependency.
        </Lead>
        <P>
          Mocks have a legitimate purpose: isolating code from non-deterministic
          or external boundaries, such as hardware clocks, third-party payment
          gateways, and network sockets.
        </P>
        <P>
          The problem arises when mocks are used across internal function
          boundaries within the same module. Wherever possible, execute real
          code and verify observable inputs and outputs. A suite grounded in
          state verification survives refactorings, catches regressions, and
          lets your architecture evolve.
        </P>
      </LessonSection>
    </Lesson>
  );
}
