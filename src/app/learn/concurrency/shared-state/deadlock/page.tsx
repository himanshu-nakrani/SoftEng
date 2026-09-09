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
  DeadlockFigure,
  DeadlockOrderedFigure,
} from "@/lessons/shared-state/deadlock-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("deadlock");

export default function DeadlockPage() {
  return (
    <Lesson slug="deadlock">
      <LessonSection id="circular-wait">
        <Lead>
          Locks fixed the data race. Now two threads hold one lock each and want
          the other&apos;s — and both wait forever.
        </Lead>
        <P>
          Two transfers run between the same pair of accounts: one moves money
          from A to B, the other from B to A. Each takes the lock for both
          accounts it touches, which is exactly right — an unguarded transfer
          would lose money the way the last lesson lost an increment.
        </P>
        <P>
          Nothing is unsynchronised here. Every critical section is properly
          protected, and that is the point worth sitting with:{" "}
          <Strong>a deadlock is not missing synchronisation</Strong>. It is two
          correct threads taking correct locks in different orders. Four
          conditions have to hold at once — mutual exclusion, holding one
          resource while waiting for another, no preemption, and a cycle in
          &ldquo;who waits for whom&rdquo;. Break any one and the hang cannot
          happen.
        </P>
      </LessonSection>

      <LessonSection id="watch-it-hang">
        <TryThis>
          <LI>
            Step forward. Watch <Term>T1</Term> take A and <Term>T2</Term> take
            B.
          </LI>
          <LI>
            Keep stepping. Both lanes turn red and the run stops — neither thread
            can ever get its second lock.
          </LI>
          <LI>
            Press <Strong>shuffle</Strong> repeatedly. Some seeds hang; others
            finish cleanly with both balances back at 100.
          </LI>
        </TryThis>
        <DeadlockFigure />
        <Callout kind="insight">
          Roughly half the interleavings complete. That is what makes deadlock so
          expensive to find: the same binary, the same input, and the bug appears
          only on the orders where both threads get their first lock before
          either gets its second. &ldquo;It works on my machine&rdquo; is a
          statement about scheduling luck, not about correctness.
        </Callout>
        <P>
          Notice what the run does <Strong>not</Strong> do: crash, log, or return
          an error. It simply stops making progress while both threads are still
          alive and, from the outside, busy. A request times out somewhere far
          away and the cause is two threads politely waiting for each other.
        </P>
      </LessonSection>

      <LessonSection id="break-the-cycle">
        <P>
          The fix is not a bigger lock, and it is not a timeout — a timeout turns
          a hang into a retry storm and leaves the cycle intact. Remove the{" "}
          <Term>cycle</Term> instead, by giving every lock a global order and
          requiring threads to acquire in that order. If everyone takes A before
          B, a thread holding B must already hold A, so it can always finish.
        </P>
        <DeadlockOrderedFigure />
        <P>
          The <Term>lock waits</Term> counter is still non-zero: one thread does
          block while the other holds A. Waiting was never the problem —{" "}
          <Strong>waiting in a cycle</Strong> was. Reseed as often as you like;
          every interleaving now completes and both balances return to 100.
        </P>
        <Callout kind="warning">
          Ordering is a discipline, not a mechanism: nothing in the code enforces
          it, so it holds only while every call site agrees. That is why real
          systems reach for coarser strategies too — one lock over both accounts,
          a lock-free transfer, or funnelling transfers through a single owner —
          each trading concurrency for a guarantee that is harder to break by
          accident.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
