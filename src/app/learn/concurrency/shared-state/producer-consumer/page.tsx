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
  BackpressureFigure,
  ProducerConsumerFigure,
} from "@/lessons/shared-state/producer-consumer-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("producer-consumer");

export default function ProducerConsumerPage() {
  return (
    <Lesson slug="producer-consumer">
      <LessonSection id="handoff">
        <Lead>
          Two threads that must hand work to each other do not need to run at the
          same speed. They need a <Term>buffer</Term> between them — and a rule
          for what happens when it is full or empty.
        </Lead>
        <P>
          The rule is not a lock. A lock answers &ldquo;may I touch this?&rdquo;,
          and the question here is different: <Strong>is there anything for me
          yet?</Strong> So each side waits on a <Term>condition</Term> instead. A
          put parks while the buffer is full; a take parks while it is empty. A
          parked thread consumes nothing — it is not spinning, it is simply not
          runnable until the condition it needs becomes true.
        </P>
        <P>
          That pairing is what makes the two threads independent. Neither has to
          know the other&apos;s speed, and neither has to poll. The buffer holds
          the difference between them, up to its capacity — and what happens at
          that limit is the interesting part.
        </P>
      </LessonSection>

      <LessonSection id="watch-the-buffer">
        <TryThis>
          <LI>
            Step through at <Strong>capacity 1</Strong>. The threads are forced to
            alternate: every put must be taken before the next put fits.
          </LI>
          <LI>
            Watch a lane read <Term>waiting for room</Term> or{" "}
            <Term>waiting for an item</Term> — that thread is parked, not
            spinning.
          </LI>
          <LI>
            Raise capacity to 4 and replay. Blocking drops from seven times to
            three, and the producer can finish its run without stopping.
          </LI>
        </TryThis>
        <ProducerConsumerFigure />
        <Callout kind="insight">
          Capacity buys <Strong>independence</Strong>, not throughput. Four items
          still take four puts and four takes however big the buffer is; what
          changes is how often one thread has to stop because of the other. A
          buffer of one is a handshake. A buffer of four lets the producer work
          ahead and absorb a burst.
        </Callout>
      </LessonSection>

      <LessonSection id="backpressure">
        <P>
          Now make the consumer slower — three operations per item instead of one
          — and keep the buffer small. The producer fills it, blocks, is woken by
          a take, fills it again, blocks again. Across many runs it blocks about{" "}
          <Strong>twice as often</Strong> as the consumer does.
        </P>
        <BackpressureFigure />
        <P>
          The pipeline now runs at the consumer&apos;s pace, and the buffer is what
          communicated that. This is <Term>backpressure</Term>: a full queue is
          not a failure, it is the slow end telling the fast end to wait. The
          producer being blocked is the system working correctly.
        </P>
        <Callout kind="warning">
          The tempting fix — make the buffer unbounded so puts never block — does
          not remove the limit, it hides it. The consumer is still the bottleneck,
          so the queue grows without end: memory climbs, and every item waits
          behind a longer line, so latency grows with it. You have traded a
          visible pause for an invisible, unbounded delay. Track 01&apos;s{" "}
          <Term>Message Queues &amp; Backpressure</Term> lesson shows the same
          trade at system scale, between services rather than threads.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
