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
  CoarseLockFigure,
  FineLockFigure,
} from "@/lessons/shared-state/lock-granularity-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("lock-granularity");

export default function LockGranularityPage() {
  return (
    <Lesson slug="lock-granularity">
      <LessonSection id="one-lock-for-everything">
        <Lead>
          One lock is the safest thing to write and the easiest to reason about.
          It also means threads that share nothing wait for each other.
        </Lead>
        <P>
          The program here is deliberately trivial and, more importantly,{" "}
          <Strong>partitioned</Strong>: half the threads only ever touch counter{" "}
          <Term>a</Term>, the other half only <Term>b</Term>. They share no data.
          Nothing about the problem requires them to coordinate at all.
        </P>
        <P>
          So any blocking you see is not a property of the work — it is a property
          of how the locking was drawn. That is what <Term>granularity</Term>{" "}
          means: not how careful the locking is, but how much of the program each
          lock speaks for.
        </P>
      </LessonSection>

      <LessonSection id="contention">
        <TryThis>
          <LI>
            Step through with 4 threads. Watch a thread touching <Term>a</Term>{" "}
            wait for a thread touching <Term>b</Term> — for no reason.
          </LI>
          <LI>
            Read <Term>times blocked</Term>: 6. Now raise threads to 6 and replay
            — it jumps to 15.
          </LI>
          <LI>
            Note <Term>ops executed</Term> as you do it. The work is unchanged.
          </LI>
        </TryThis>
        <CoarseLockFigure />
        <Callout kind="insight">
          Blocked turns go 1, 6, 15 at two, four and six threads — that is every
          pair of threads meeting once, or n(n−1)/2. Contention under a shared
          lock grows with the <Strong>square</Strong> of the threads sharing it,
          while the useful work grows linearly. Doubling the threads on one lock
          roughly quadruples the waiting.
        </Callout>
      </LessonSection>

      <LessonSection id="splitting-the-lock">
        <P>
          Give each counter its own lock and the partition in the data becomes a
          partition in the locking. Same threads, same twelve operations, but
          threads on <Term>a</Term> can no longer be delayed by threads on{" "}
          <Term>b</Term>.
        </P>
        <FineLockFigure />
        <P>
          Blocked turns fall from 6 to 2 at four threads, and from 15 to 6 at six.
          Splitting one lock into two leaves each with half the threads, and since
          contention scales with the square, halving the population{" "}
          <Strong>quarters</Strong> the waiting. At two threads it reaches zero:
          they touch different counters and never meet.
        </P>
        <Callout kind="warning">
          This is the trade the previous lesson set up, seen from the other side.
          One lock cannot deadlock — there is no second lock to wait for. Two locks
          can, the moment any thread needs both, and now the acquisition order
          matters everywhere. Finer locks buy throughput with{" "}
          <Strong>reasoning cost</Strong>: more states, more orderings, and a
          class of bug that only appears on some interleavings. Split along
          boundaries the data already has — per key, per shard, per connection —
          and be suspicious of any thread that has to hold two.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
