import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import {
  DataRacesFigure,
  DataRacesGuardedFigure,
} from "@/lessons/shared-state/data-races-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("data-races");

export default function DataRacesPage() {
  return (
    <Lesson slug="data-races">
      <LessonSection id="three-operations">
        <Lead>
          <Term>counter++</Term> looks like one thing. It is three: read the
          value, add one, write it back. The scheduler is allowed to cut between
          any two of them.
        </Lead>
        <P>
          A thread does not own the processor. Between any two operations the
          operating system may suspend it and run somebody else — and that
          somebody may be another thread running the same three operations on the
          same variable. If two threads both read <Strong>7</Strong> before
          either writes, both compute 8, both store 8, and one increment
          vanishes. Nothing crashed. No error was returned. The count is simply
          wrong.
        </P>
        <P>
          This is a <Term>data race</Term>, and it is the hardest class of bug to
          find by reading code, because the code is not what is wrong — the{" "}
          <Strong>order</Strong> is. The order changes run to run, which is why a
          race can pass a thousand tests and fail in production.
        </P>
      </LessonSection>

      <LessonSection id="interleave-it">
        <TryThis>
          <LI>
            Step forward one operation at a time and watch which thread the
            scheduler picks.
          </LI>
          <LI>
            Read the final <Term>counter</Term>. Three threads each added one —
            did it reach 3?
          </LI>
          <LI>
            Press <Strong>shuffle</Strong> to reseed. Same program, different
            order, sometimes a different answer.
          </LI>
          <LI>
            Found a run that loses an update? Step <Strong>backward</Strong> to
            the moment two threads held the same <Term>tmp</Term>.
          </LI>
        </TryThis>
        <DataRacesFigure />
        <Callout kind="insight">
          Every interleaving here is legal. The scheduler owes you nothing beyond
          running each thread&apos;s operations in its own order — it may
          interleave threads however it likes. A program that is only correct
          under some interleavings is not <Strong>sometimes correct</Strong>; it
          is broken, and you have been lucky.
        </Callout>
        <P>
          The simulation is seeded, so a run replays exactly. That is the
          difference between watching a race and studying one: the interleaving
          that lost an update is still there when you step back to it.
        </P>
      </LessonSection>

      <LessonSection id="mutual-exclusion">
        <P>
          The fix is not to make the three operations faster. It is to make them{" "}
          <Strong>uninterruptible as a group</Strong> — a{" "}
          <Term>critical section</Term> that only one thread may be inside at a
          time. A <Term>mutex</Term> enforces exactly that: acquire it before the
          read, release it after the write, and any other thread that arrives
          meanwhile waits.
        </P>
        <DataRacesGuardedFigure />
        <P>
          Threads still interleave — look at the context-switch counter, which
          does not drop to zero. What changed is that the interleaving can no
          longer happen <Strong>inside</Strong> the read-add-write group. Reseed
          as many times as you like: the counter reaches the number of threads
          every time.
        </P>
        <Callout kind="warning">
          Locks are not free. The <Term>lock waits</Term> counter is time threads
          spent doing nothing, and a critical section is a piece of your program
          that cannot use more than one core. Correctness first — but a lock held
          too long turns a parallel program back into a serial one, and two locks
          taken in different orders deadlock.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
