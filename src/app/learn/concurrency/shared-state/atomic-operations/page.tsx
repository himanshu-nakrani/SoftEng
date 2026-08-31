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
  CasFigure,
  SpinLockFigure,
} from "@/lessons/shared-state/atomic-operations-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("atomic-operations");

export default function AtomicOperationsPage() {
  return (
    <Lesson slug="atomic-operations">
      <LessonSection id="indivisible">
        <Lead>
          A lock stops other threads from looking. An <Term>atomic</Term>{" "}
          operation instead makes the write conditional — so a thread that loses
          the race finds out, rather than silently overwriting.
        </Lead>
        <P>
          <Term>Compare-and-swap</Term> is one instruction that does two things
          indivisibly: check that a memory location still holds the value you
          read, and only then write the new one. If it changed, the swap fails and
          reports failure. Nothing is lost, because nothing was overwritten
          blindly.
        </P>
        <P>
          That failure is the whole design. It turns the invisible bug from the
          data-races lesson — an increment that vanished with no error — into a
          visible, handleable event: <Strong>you lost, read again, retry</Strong>.
          Correctness stops depending on scheduling luck without any thread ever
          being blocked.
        </P>
      </LessonSection>

      <LessonSection id="swap-or-retry">
        <TryThis>
          <LI>
            Step through until you see a <Term>CAS counter (retry)</Term> frame —
            that thread read a stale value and was refused.
          </LI>
          <LI>
            Check the final counter. It reaches the thread count every time, on
            every seed.
          </LI>
          <LI>
            Drag <Strong>threads</Strong> from 2 to 5 and watch{" "}
            <Term>failed attempts</Term> climb.
          </LI>
        </TryThis>
        <CasFigure />
        <Callout kind="insight">
          No thread ever waits here — there is no lock to hold, so a thread cannot
          be blocked by one, and a thread that dies mid-loop leaves nothing
          locked. What replaces waiting is <Strong>wasted work</Strong>: at two
          threads a failed attempt is uncommon, and by five it happens several
          times a run — roughly eight times as often. Optimism is cheap when
          contention is low and expensive when it is high.
        </Callout>
      </LessonSection>

      <LessonSection id="contention-cost">
        <P>
          Locks are not a layer beneath atomics — they are built{" "}
          <Strong>out of</Strong> them. A <Term>spin lock</Term> is one atomic
          test-and-set (claim the flag if it is free) plus the same retry loop:
          spin until you win, do the work, release.
        </P>
        <SpinLockFigure />
        <P>
          Same four threads, same correct total, far more failed attempts — at the
          default seed the compare-and-swap version needs 3 while the spin lock
          burns 11. The difference is what a retry accomplishes: a failed CAS
          means somebody else completed an increment, so the system moved forward.
          A failed test-and-set means somebody else is <Strong>still inside</Strong>{" "}
          the critical section, and the spinning thread has achieved nothing.
        </P>
        <Callout kind="warning">
          Two traps this figure cannot show. Retrying is not automatically fair —
          under heavy contention a thread can keep losing indefinitely while
          others progress, which is <Term>starvation</Term>, and if every thread
          keeps knocking the others back the whole system can spin without
          progressing at all: <Term>livelock</Term>, the busy cousin of deadlock.
          And CAS compares a <Strong>value</Strong>, not a history: a location
          changed from A to B and back to A passes a check it arguably should
          fail, which is the ABA problem.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
