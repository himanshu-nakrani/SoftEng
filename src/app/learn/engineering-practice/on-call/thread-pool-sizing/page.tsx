import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { ThreadPoolSizingFigure } from "@/lessons/on-call/thread-pool-sizing-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("thread-pool-sizing");

export default function ThreadPoolSizingPage() {
  return (
    <Lesson slug="thread-pool-sizing">
      <LessonSection id="latency-spike">
        <Lead>When downstream response times spike from 10ms to 400ms, concurrency math breaks down instantly.</Lead>
        <P>
          Under normal operations, a service calling a 10ms downstream dependency can sustain high
          throughput with a modest worker pool. By <Term>Little&apos;s Law</Term> (capacity = concurrency / latency),
          16 threads each completing a request in 10ms can process up to 1,600 requests per second.
          With inbound traffic at 80 requests per second, the thread pool is mostly idle and requests
          flow without waiting.
        </P>
        <P>
          Then the downstream payment or database cluster degrades. Latency spikes 40x to 400ms. Suddenly,
          each request holds a thread 40 times longer. Your 16 threads can now sustain at most 40 requests
          per second (16 threads / 0.4s). Because incoming traffic remains 80 requests per second, work
          arrives twice as fast as your capacity to drain it.
        </P>
        <P>
          The pager wakes you at 2am with pool saturation alerts. You have three policies to choose from:
          expand the thread pool to 200, buffer backlogged requests in a deep unbounded queue, or keep
          the pool bounded at 16 threads and shed excess traffic with fast HTTP 503 rejections.
        </P>
      </LessonSection>

      <LessonSection id="queue-vs-threads">
        <TryThis>
          <LI>Slide to <Strong>Expand thread pool to 200</Strong> — watch thread context switching and memory bloat inflate latency to 1600–2400ms, meeting SLA in only 29 of 200 runs.</LI>
          <LI>Slide to <Strong>Buffer requests in deep unbounded queue</Strong> — queue delay explodes to 30s, causing client timeouts across all 200 runs (0 of 200).</LI>
          <LI>Slide to <Strong>Keep pool bounded &amp; shed excess</Strong> — admitted requests finish cleanly at 400ms, holding SLA in all 200 runs.</LI>
        </TryThis>
        <ThreadPoolSizingFigure />
        <Callout kind="insight">
          Expanding threads causes CPU scheduler thrashing, while deep queues accumulate requests until
          clients time out. Only a bounded pool paired with immediate load shedding guarantees that
          admitted requests finish on time and downstream capacity is never wasted.
        </Callout>
      </LessonSection>

      <LessonSection id="fail-fast">
        <Lead>Shedding excess traffic is not an outage; it is how you keep the system alive.</Lead>
        <P>
          Buffering in a deep queue feels intuitive: why drop a request when you can hold it until a worker
          is ready? The answer is that <Term>client timeouts</Term> do not wait for your queue. When a client
          with a 1-second timeout sends a request that sits in your queue for 15 seconds, the client abandons
          the connection long before your thread picks it up. When the worker thread finally executes the
          request, it spends 400ms calling downstream to generate a response for a closed socket. Unbounded
          queues turn slow dependencies into useless zombie work.
        </P>
        <P>
          Expanding the thread pool runs into operating system realities. Two hundred concurrent OS threads
          competing for CPU cores spend more time swapping registers and invalidating L1/L2 caches than
          executing instructions. Thread stacks and allocation churn trigger garbage collection stalls,
          driving p99 latency well past client timeouts.
        </P>
        <P>
          Keeping the thread pool bounded at 16 and capping the queue at 4 slots guarantees that admitted
          requests wait at most 100ms before execution, finishing within the 400ms baseline. Excess traffic
          receives an immediate <Strong>HTTP 503 Service Unavailable</Strong> in under 1ms. Failing fast
          frees upstream callers to retry against other replicas or fall back gracefully, preserving
          useful system throughput while the dependency recovers.
        </P>
      </LessonSection>
    </Lesson>
  );
}
