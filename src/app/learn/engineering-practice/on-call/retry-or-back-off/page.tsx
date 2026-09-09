import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { RetryOrBackOffFigure } from "@/lessons/on-call/retry-or-back-off-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("retry-or-back-off");

export default function RetryOrBackOffPage() {
  return (
    <Lesson slug="retry-or-back-off">
      <LessonSection id="the-storm">
        <Lead>Some calls do not fail every time. They fail on the interleavings you did not test.</Lead>
        <P>
          Two services each need two locks, A and B, before they can do their work. One team writes
          the code to take A then B; another, working on the other service, naturally takes B then A.
          Both pass their tests. Then, under the right timing, each holds one lock and waits forever
          for the other — a <Term>deadlock</Term>. The decision on the table is whether to impose a
          single global lock <Strong>order</Strong> across both teams.
        </P>
      </LessonSection>

      <LessonSection id="make-the-call">
        <TryThis>
          <LI>Slide to <Strong>enforce one order</Strong> — both take A then B. Completes in all 200 runs.</LI>
          <LI>Slide to <Strong>each their own order</Strong> — one A→B, one B→A. Watch the bar drop to about half.</LI>
          <LI>The missing runs did not fail loudly; they deadlocked, which the scheduler records as an outcome.</LI>
        </TryThis>
        <RetryOrBackOffFigure />
        <Callout kind="insight">
          A consistent order completes every one of the 200 runs. Opposite orders complete about 102
          of them and deadlock in the rest. Nothing about the code each thread runs is different —
          only the order it takes its locks — and that single parameter moves the measured success
          rate from 200 to roughly half.
        </Callout>
      </LessonSection>

      <LessonSection id="what-diverged">
        <Lead>A distribution, not a verdict.</Lead>
        <P>
          The mutex call had a clean answer: one option was right in every run. This one is different
          on purpose. The unsafe choice does not always fail — it fails about half the time — and
          that is exactly why lock-ordering bugs survive code review and testing. An intermittent
          failure is the hardest kind to argue about, and a figure that runs the scheduler two
          hundred times settles the argument with a rate rather than an anecdote.
        </P>
        <P>
          The fix is boring and total: pick a global order for your locks and hold everyone to it.
          Boring and total is what you want from a policy that has to survive interleavings no test
          ever produced.
        </P>
      </LessonSection>
    </Lesson>
  );
}
