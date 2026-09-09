import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  IsolatedSetupFigure,
  TestPollutionFigure,
} from "@/lessons/flakiness/test-pollution-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("test-pollution");

export default function TestPollutionPage() {
  return (
    <Lesson slug="test-pollution">
      <LessonSection id="hidden-order">
        <Lead>
          A suite can be green for a reason nobody wrote down: one test quietly
          relies on another having run first.
        </Lead>
        <P>
          The previous lesson showed two tests <Strong>colliding</Strong> over one
          shared slot — each wrote its own value, and an unlucky order made a test
          read a value it never wrote. This one is the other shape, and it is a
          different smell: one test <Strong>seeds</Strong> shared state and another
          silently <Term>depends</Term> on it. The dependent test does no setup of
          its own, so it passes only when the seeding test happens to run before
          it. Reorder them and it fails — not because anything changed, but because
          the order it was leaning on was never guaranteed.
        </P>
        <P>
          Both tests below run against a shared users table. Test A inserts a row
          and then checks the table is non-empty — it is self-contained. Test B
          only checks the table is non-empty, and does no insert of its own. Read
          B on its own and nothing says &ldquo;A must run first&rdquo;; the
          dependence is invisible in the code.
        </P>
        <Callout kind="insight">
          A test that reads shared state it did not set up has outsourced its
          setup to whatever ran before it. That is <Term>test pollution</Term>:
          the verdict is a function of an order the runner chose, not of the code.
        </Callout>
      </LessonSection>

      <LessonSection id="polluted">
        <P>
          Here are the two tests interleaved. Test B is a single step — its
          assertion — because it does no setup. Whether it passes is decided
          entirely by where that one step falls relative to test A&rsquo;s insert.
        </P>
        <TryThis>
          <LI>
            The figure opens on a <Strong>failing</Strong> order: test B&rsquo;s
            assertion runs before test A&rsquo;s insert, so B reads an empty table
            and fails while A still passes.
          </LI>
          <LI>
            Reseed until the verdict flips. About <Strong>half</Strong> of the
            orders fail — 101 of the first 200 seeds, 495 of the first 1000 — and
            the other half pass with the identical code.
          </LI>
        </TryThis>
        <TestPollutionFigure />
        <P>
          There are only <Strong>two</Strong> orders that matter here, because test
          B has one step: its assertion lands either before test A&rsquo;s insert
          or after it. Before, B fails; after, B passes. Nothing in either
          test&rsquo;s code expresses that ordering, which is exactly why the flake
          is so hard to find — the bug is in a dependency that was never written.
        </P>
      </LessonSection>

      <LessonSection id="isolated">
        <P>
          The fix is not a retry and not a separate slot. Test B has to stop
          borrowing another test&rsquo;s setup and do its <Strong>own</Strong>: it
          inserts a row before it asserts. Now it does not care whether test A ran,
          ran first, or ran at all.
        </P>
        <TryThis>
          <LI>
            Test B now has an extra first step — <Strong>insert own user</Strong> —
            before its assertion. Step through and watch it pass regardless of
            where test A falls.
          </LI>
          <LI>
            Reseed as many times as you like. B fails in{" "}
            <Strong>0 of 1000</Strong> orders now: no schedule can leave the table
            empty when B asserts, because B filled it itself.
          </LI>
        </TryThis>
        <IsolatedSetupFigure />
        <Callout kind="insight">
          The dependence is gone because B no longer reads state it did not write.
          A test that owns its setup has a verdict that depends on its own code,
          which is the only verdict worth trusting.
        </Callout>
      </LessonSection>

      <LessonSection id="isolation-cost">
        <Lead>
          Isolation is the cure, and like the last lesson it is paid for in setup
          you run on every test, every run.
        </Lead>
        <P>
          The polluted run is <Strong>three</Strong> steps; the isolated run is{" "}
          <Strong>four</Strong> — the one extra insert that makes test B
          self-sufficient. That is the recurring trade in this module: an isolated
          suite does more work per run, and buys a verdict that does not depend on
          an order nobody chose.
        </P>
        <P>
          The general rule the two flakiness lessons share: a test&rsquo;s result
          must be a function of its own code and its own setup, never of what a
          sibling left behind. When it is not, &ldquo;run the tests in a random
          order&rdquo; is not cruelty — it is the cheapest way to surface a
          dependence the code refused to declare.
        </P>
      </LessonSection>
    </Lesson>
  );
}
