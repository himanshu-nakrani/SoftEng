import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Compare,
  CompareCol,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import { BulkheadsFigure } from "@/lessons/resilience/bulkheads-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("bulkheads");

export default function BulkheadsPage() {
  return (
    <Lesson slug="bulkheads">
      <LessonSection id="one-pool">
        <Lead>
          A ship survives a hull breach because it is divided into sealed
          compartments — flood one and the rest stay dry. The{" "}
          <Term>bulkhead</Term> is that idea applied to a resource pool.
        </Lead>
        <P>
          Most services reach their dependencies through a shared, bounded set
          of <Strong>concurrency slots</Strong>: a connection pool, a fixed set
          of worker threads, a semaphore. A call has to hold one slot for as
          long as its dependency takes to answer. While every dependency is
          fast, one pool for all of them is the efficient choice — a slot freed
          by one call is instantly available to any other.
        </P>
        <P>
          The trouble is that <Strong>a slow dependency holds its slots
          longer</Strong>. If one dependency stalls, its calls stop returning
          their slots, the pool drains to empty, and calls to every{" "}
          <em>other</em> dependency — however healthy — arrive to find nothing
          free. This lesson stages exactly that: two dependencies,{" "}
          <Term>dep-a</Term> and <Term>dep-b</Term>, behind one pool, and then
          the partition that contains the damage.
        </P>
      </LessonSection>

      <LessonSection id="shared">
        <P>
          One shared pool of eight slots. Both dependencies are fast, offered
          load is light, and the pool sits comfortably below full — peaking
          around three-quarters and rejecting nothing. Then dep-a stalls.
        </P>
        <TryThis>
          <LI>
            Let it autoplay. dep-a is killed at the ten-second mark, so its
            calls hang and hold their slots. Watch <Strong>slots held by
            dep-a</Strong> climb to all eight.
          </LI>
          <LI>
            Now watch <Strong>dep-b throughput</Strong> — which was never
            touched — fall to zero, and <Strong>dep-b rejected</Strong> start
            counting. That is the surprise: a healthy dependency going dark
            because a different one is slow.
          </LI>
        </TryThis>
        <BulkheadsFigure />
        <Callout kind="insight">
          Once dep-a seizes all eight slots, dep-b&apos;s throughput collapses
          to zero and its rejection counter climbs past two dozen within a
          dozen seconds of the stall. dep-b never failed — it was simply never
          let in. A shared pool couples the availability of everything behind it
          to the <Strong>latency of the slowest thing</Strong> behind it.
        </Callout>
      </LessonSection>

      <LessonSection id="isolated">
        <P>
          Same traffic, same stall — now flip <Term>isolate the pool</Term> on.
          The eight slots split into two reserved halves of four: dep-a may use
          only its own four, and dep-b&apos;s four are untouchable.
        </P>
        <TryThis>
          <LI>
            Turn <Strong>isolate the pool</Strong> on, then turn{" "}
            <Strong>dep-a stalls</Strong> on. dep-a fills its four slots and
            stops there — it can no longer reach across into dep-b&apos;s half.
          </LI>
          <LI>
            Watch <Strong>dep-b throughput</Strong> hold up while dep-a is stuck.
            With the same stall, dep-b now keeps serving and its rejected count
            barely moves — a single rejection where the shared pool had dozens.
          </LI>
        </TryThis>
        <BulkheadsFigure consumesSeekParam={false} />
        <Callout kind="insight">
          The bulkhead did not make dep-a any faster or fix its stall. It moved
          the <Strong>boundary of the blast radius</Strong>: dep-a&apos;s
          failure can now exhaust only dep-a&apos;s compartment. dep-b keeps
          serving because its slots were never dep-a&apos;s to take.
        </Callout>
      </LessonSection>

      <LessonSection id="sizing">
        <Lead>Isolation is not free, and the cost is real.</Lead>
        <P>
          Splitting the pool means a reserved slot sits idle whenever its
          dependency is quiet — dep-b&apos;s four slots do nothing while only
          dep-a is busy, and one pool of eight could have lent them out.
          Measured over a healthy run, the shared pool averages about 72% slot
          utilisation; the partitioned one averages about 52% for the same
          work. You have traded <Strong>peak efficiency for containment</Strong>.
        </P>
        <Compare>
          <CompareCol title="One shared pool">
            Higher utilisation — any free slot serves any dependency, so a burst
            to one can borrow the whole pool. The price is coupling: one slow
            dependency can starve all the others.
          </CompareCol>
          <CompareCol title="Partitioned pools">
            Lower utilisation — reserved slots sit idle when their dependency is
            quiet, and a burst to one dependency is rejected while the other
            half stands empty. The reward is isolation: a failure is confined to
            its own compartment.
          </CompareCol>
        </Compare>
        <P>
          So the sizing question is the whole engineering problem. Too many
          compartments and each is too small to absorb a normal burst; too few
          and a single stall still takes down a group. The honest default is to
          bulkhead the dependencies whose failure you cannot afford to spread —
          and to size each compartment for that dependency&apos;s own load, not
          for an even split.
        </P>
        <Callout kind="note">
          This is a believable model, not queueing theory. Service time is one
          fixed number per regime rather than a drawn distribution, the split is
          a static 50/50, and a call that finds no slot is refused instantly
          rather than queued for a moment. The shapes are honest — a slow
          dependency really does hold its slots longer, and partitioning really
          does trade utilisation for containment — but the exact rejection
          counts are the model&apos;s, not a production system&apos;s.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
