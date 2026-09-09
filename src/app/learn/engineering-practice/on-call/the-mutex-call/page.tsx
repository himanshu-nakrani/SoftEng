import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { TheMutexCallFigure } from "@/lessons/on-call/the-mutex-call-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("the-mutex-call");

export default function TheMutexCallPage() {
  return (
    <Lesson slug="the-mutex-call">
      <LessonSection id="the-page">
        <Lead>An engineering decision is only worth studying if it changes an outcome you can measure.</Lead>
        <P>
          A prediction quiz asks what you <Strong>think</Strong> will happen and reveals an answer.
          That is useful, and <code>/review</code> does it well. This is different: the choice you
          make here sets a real <Term>parameter</Term> of a running simulation, and the figure shows
          what actually happened when that parameter was fed to two hundred runs. There is no
          consequence paragraph to reveal — only a measured result.
        </P>
        <P>
          The situation: a shared counter drifts low under load. Two workers each read it, add one,
          and write it back — and when their reads interleave, one increment is silently lost. You
          have two calls: leave the race because the window is small, or wrap the increment in a
          mutex.
        </P>
      </LessonSection>

      <LessonSection id="make-the-call">
        <TryThis>
          <LI>Move the slider to <Strong>leave it</Strong> and read the measured bar — correct in only 54 of 200 runs.</LI>
          <LI>Move it to <Strong>the mutex</Strong> — correct in all 200.</LI>
          <LI>Note that both options were measured, so you compare your call against the one you did not make.</LI>
        </TryThis>
        <TheMutexCallFigure />
        <Callout kind="insight">
          Leaving the race is correct in 54 of 200 interleavings; the lock is correct in all 200.
          That gap is not asserted — it is the outcome of running the real scheduler on each choice.
          A choice that only changed the wording of an explanation could never produce a number that
          moves.
        </Callout>
      </LessonSection>

      <LessonSection id="what-the-run-measured">
        <Lead>The lock is not free — but the race is not cheap either.</Lead>
        <P>
          This figure deliberately does not model the <Strong>cost</Strong> of the mutex: the
          contention and latency a lock adds are real, and pretending &ldquo;always lock&rdquo; is
          free would be its own lie. What it does show honestly is the correctness gap, because that
          is the axis the decision turns on at 2am. The right answer here is the lock; the point of
          the track is that you reached it by watching the numbers diverge, not by being told.
        </P>
        <P>
          Every scenario in this module works the same way. A choice sets a parameter of a real run,
          the run is measured over a sample of seeds, and the alternatives are measured beside it.
          If a scenario could only ever reveal text, it would not ship here — it would be a quiz.
        </P>
      </LessonSection>
    </Lesson>
  );
}
