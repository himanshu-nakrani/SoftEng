import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { MessageQueuesFigure } from "@/lessons/distributed/message-queues-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Message Queues & Backpressure",
};

export default function MessageQueuesPage() {
  return (
    <Lesson slug="message-queues">
      <LessonSection id="decouple">
        <Lead>
          Everything so far has been request/response: ask, wait, answer.
          A <Term>message queue</Term> breaks that handshake — the producer
          drops work into a buffer and moves on; the consumer drains it on
          its own schedule.
        </Lead>
        <P>
          That buffer buys the property this lesson is about:{" "}
          <Strong>the producer&apos;s fate is decoupled from the
          consumer&apos;s</Strong>. A slow consumer, a crashed consumer, a
          consumer mid-deploy — the producer neither knows nor cares. The
          queue absorbs the difference.
        </P>
      </LessonSection>

      <LessonSection id="race">
        <P>
          Two sliders, one race. While <Term>consumer rate</Term> wins, the
          queue hovers near empty. Nudge the producer ahead and watch the
          depth bar — and note that it doesn&apos;t explode instantly. A
          queue turns a rate mismatch into <Strong>growing latency</Strong>{" "}
          long before it becomes failure.
        </P>
        <MessageQueuesFigure />
        <Callout kind="insight">
          Check <Term>delivery lag</Term>: depth ÷ drain rate. A queue 40
          deep at 8 msg/s means every new message waits ~5 seconds. Queues
          don&apos;t eliminate overload — they convert it into delay you
          can see coming.
        </Callout>
      </LessonSection>

      <LessonSection id="deploy">
        <P>
          Now the famous move: flip <Term>pause consumer</Term> — a deploy,
          a crash, a stuck worker. The producer keeps publishing like
          nothing happened; the backlog climbs. Un-pause with the consumer
          faster than the producer, and the mountain drains without losing
          a message.
        </P>
        <P>
          And if the queue fills anyway? Red bounces:{" "}
          <Strong>backpressure</Strong>. Something must give — reject new
          work, drop old work, or block the producer. A bounded queue forces
          you to choose the failure mode on purpose; an unbounded one just
          chooses memory exhaustion for you.
        </P>
        <Callout kind="warning">
          The metric that pages you at 3am is not queue depth — it&apos;s
          depth <em>growing</em> while drain rate isn&apos;t. Depth is a
          snapshot; the derivative is the forecast.
        </Callout>
      </LessonSection>

    </Lesson>
  );
}
