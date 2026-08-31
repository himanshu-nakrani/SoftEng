import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  FlakyTestsFigure,
  IsolatedTestsFigure,
} from "@/lessons/flakiness/flaky-tests-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("flaky-tests");

export default function FlakyTestsPage() {
  return (
    <Lesson slug="flaky-tests">
      <LessonSection id="shared-state">
        <Lead>A flaky test is rarely random. It is order-dependent.</Lead>
        <P>
          A suite that passes on your machine and fails in CI, then passes on the
          re-run, looks non-deterministic. Usually it is not. Two tests that
          touch the same mutable thing &mdash; a module-level{" "}
          <Term>cache</Term>, a database row, an environment variable, a
          singleton &mdash; can both pass in one order and one fail in another.
          Nothing about the code changed between the green run and the red one.
          The <Strong>order</Strong> did.
        </P>
        <P>
          The order is the part nobody chose. A test runner is free to schedule
          tests however it likes, and that schedule is rarely written down or
          held fixed. So the suite is doing exactly what a seeded scheduler does:
          picking one legal order out of many, and the outcome rides on which one
          it drew.
        </P>
        <Callout kind="note">
          That is why this lesson runs on the interleaving scheduler. Each test
          becomes a thread whose steps read and write shared state; a single
          seed replays one order exactly, and reseeding explores a different
          legal one. A flaky suite is in precisely that position &mdash; the flake
          is an interleaving, not bad luck.
        </Callout>
      </LessonSection>

      <LessonSection id="passing-order">
        <P>
          Here are two tests over one shared slot. Test A writes 7 and expects to
          read 7 back; test B writes 3 and expects 3. Both are correct in
          isolation. The reseed button below draws a new schedule; the run
          replays identically for any given seed.
        </P>
        <TryThis>
          <LI>
            Step through slowly and watch where the two writes fall relative to
            the two asserts.
          </LI>
          <LI>
            Find an order where each test writes and then immediately asserts
            before the other runs &mdash; both go green. The suite looks fine.
          </LI>
        </TryThis>
        <FlakyTestsFigure />
        <Callout kind="insight">
          When a test&rsquo;s write and its assert are not split apart by the
          other test, it reads its own value and passes. Some orders are simply
          safe &mdash; and if your runner keeps handing you one of them, the bug
          stays hidden.
        </Callout>
      </LessonSection>

      <LessonSection id="failing-order">
        <P>
          The figure opens at a seed where the two writes land back to back
          before either assert. Test A writes 7, test B overwrites it with 3, and
          now test A asserts &mdash; it reads 3 where it wrote 7 and fails, while
          test B, asserting against the value still sitting in the slot, passes.
          One failed, one passed, from the same two tests.
        </P>
        <TryThis>
          <LI>
            Run it once at the opening seed and read the verdict: one test fails.
          </LI>
          <LI>
            Reseed a few times. The verdict flips between one-fails and both-pass
            &mdash; the identical code, a different draw.
          </LI>
        </TryThis>
        <FlakyTestsFigure />
        <Callout kind="warning">
          Across many seeds, about half of the orders leave one test failing and
          the other half are clean. Nothing is broken half the time; the code is
          broken all the time, and the schedule only exposes it half the time.
          That gap is exactly what makes a flake so easy to wave away with a
          re-run.
        </Callout>
      </LessonSection>

      <LessonSection id="isolation">
        <Lead>Isolation is giving each test its own state &mdash; and it is not free.</Lead>
        <P>
          The fix is not a smarter runner or a retry. It is to stop sharing. When
          each test writes and reads its <Strong>own</Strong> slot and resets it
          afterwards, no interleaving can make one test observe the other&rsquo;s
          value. Every order passes. Reseed the figure below as many times as you
          like &mdash; the verdict never moves.
        </P>
        <IsolatedTestsFigure />
        <P>
          Look at the step counter. The shared suite ran in four steps; the
          isolated one takes six &mdash; the two extra teardown ops, one per test,
          on every single run. That is the trade. Per-test setup and teardown is
          slower, and a suite that is fast because its tests share a fixture is
          not free of the cost &mdash; it has spent a real property, determinism,
          to buy the speed, and it pays that debt back the first time CI goes red
          for no reason anyone can reproduce.
        </P>
        <Callout kind="note">
          This is a believable model, not a real runner. Real runners execute a
          whole test body before the next, so the true hazard is leakage between
          entire tests rather than a mid-assert switch; interleaving the two
          tests op by op is the exaggeration that puts the hazard on a diagram you
          can step through. The one thing it models faithfully is the one that
          matters: shared mutable state makes the verdict a function of an order
          nobody chose.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
