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
  ThreadPerRequestFigure,
  ThreadPoolFigure,
} from "@/lessons/shared-state/thread-pools-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("thread-pools");

export default function ThreadPoolsPage() {
  return (
    <Lesson slug="thread-pools">
      <LessonSection id="a-thread-each">
        <Lead>
          A thread per request is the obvious design, and it works right up to the
          point where the thing the threads need is finite.
        </Lead>
        <P>
          Here that thing is two database connections. Six requests arrive, six
          threads start, and two of them get to work. The other four exist in
          order to wait — consuming a stack, a scheduler slot, and a place in
          somebody&apos;s mental model, while accomplishing nothing.
        </P>
        <P>
          The usual argument for a <Term>pool</Term> is that threads are expensive
          to create. The better argument is this one: past the limit of the
          resource behind them, more threads do not buy throughput. They buy{" "}
          <Strong>queueing</Strong>, and queueing you cannot see is worse than
          queueing you can.
        </P>
      </LessonSection>

      <LessonSection id="threads-that-wait">
        <TryThis>
          <LI>
            Step through and count how many lanes read{" "}
            <Term>waiting for a free connection</Term> at once.
          </LI>
          <LI>
            Watch <Term>free</Term> in shared memory. It never exceeds two, no
            matter how many threads are running.
          </LI>
          <LI>
            Raise <Strong>requests</Strong> from 4 to 8. Blocked turns go from
            under three to nineteen.
          </LI>
        </TryThis>
        <ThreadPerRequestFigure />
        <Callout kind="insight">
          Adding threads did not add capacity, because capacity was never about
          threads. Two connections serve two queries at a time whether six threads
          or six hundred are asking — the extra threads only make the queue longer
          and move it somewhere nobody is measuring.
        </Callout>
      </LessonSection>

      <LessonSection id="sizing-to-the-resource">
        <P>
          Now run the same six requests through a pool of two workers — one per
          connection. The <Strong>operation counts are identical</Strong>: 18
          either way, six queries served either way.
        </P>
        <ThreadPoolFigure />
        <P>
          But blocked turns fall to <Strong>zero</Strong>, at every request count.
          Nothing waits, because no thread was created that could not immediately
          do work. The queue did not disappear — the requests still take turns —
          but it moved somewhere explicit, where it can be measured, bounded, and
          shed under load.
        </P>
        <Callout kind="warning">
          Sizing a pool means naming the resource you are protecting, and the
          answer differs by workload: for CPU-bound work it is roughly the core
          count, and for I/O-bound work it is the connection or file-handle limit,
          which is usually far smaller than the number of requests. Two failure
          modes bracket the choice — too small and the queue grows without bound;
          too large and you are back to threads that exist to wait. And a pooled
          task that blocks on <Strong>another pooled task</Strong> can deadlock the
          pool itself: every worker occupied, all of them waiting for work that
          needs a worker.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
