import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis, UL } from "@/components/lesson/prose";
import { OutboxPatternFigure } from "@/lessons/distributed/outbox-pattern-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("outbox-pattern");

export default function OutboxPatternPage() {
  return (
    <Lesson slug="outbox-pattern">
      <LessonSection id="two-writes">
        <Lead>
          A service handles a request and has to do two things: commit a row to its
          database, and publish an event so the rest of the system hears about it.
          Those are two writes to two different systems, and no transaction spans both.
        </Lead>
        <P>
          Think of an order being placed. <Term>orders-svc</Term> writes the row to{" "}
          <Term>orders-db</Term> and publishes an <Strong>order-placed</Strong> event to
          a broker that fulfilment, billing, and analytics all read. A local database
          transaction covers the row. It cannot cover the broker — the broker is a
          different process on a different machine, and there is no shared commit
          protocol between them. So the two writes happen one after another, and the
          moment between them is unprotected.
        </P>
        <P>
          A crash in that moment leaves the two systems disagreeing, and there are two
          ways it can go depending on which write you do first:
        </P>
        <UL>
          <LI>
            <Strong>Commit, then publish.</Strong> Crash after the commit and before the
            publish, and the row exists with no event. Downstream never hears about the
            order. This is a <Strong>lost event</Strong>: silent, because nothing is
            obviously broken — the data is right, only the notification is missing.
          </LI>
          <LI>
            <Strong>Publish, then commit.</Strong> Crash after the publish and before the
            commit, and an event describes a row that was never written. This is a{" "}
            <Strong>phantom</Strong>: downstream acts on an order that does not exist.
          </LI>
        </UL>
        <P>
          Either ordering is unsafe, because the flaw is not the order — it is that there
          are two writes at all. The figure below models the first, more common shape:
          commit first, then publish.
        </P>
      </LessonSection>

      <LessonSection id="dual-write">
        <TryThis>
          <LI>Press play and watch the amber commits and cyan events flow. Leave the write path on dual write.</LI>
          <LI>Let the scripted crash land, then read the unpublished and lost-events meters. They do not return to zero.</LI>
        </TryThis>
        <OutboxPatternFigure />
        <P>
          The scripted crash catches the service in the gap: a row has committed and its
          publish has not yet left. At that instant the counters read{" "}
          <Strong>committed 36, published 35</Strong>, and <Term>lost events</Term> ticks
          to <Strong>1</Strong>. The service restarts a moment later and traffic resumes,
          but that one event never comes back — through the rest of the run the{" "}
          <Term>unpublished</Term> meter stays pinned at <Strong>1</Strong> and lost
          events never falls.
        </P>
        <Callout kind="insight">
          The commit already succeeded, so there is nothing to roll back, and the publish
          never happened, so there is nothing to retry. No component holds a record that
          this event is owed. The service does not know it crashed mid-sequence; the
          broker never heard a thing. The inconsistency is permanent and invisible — no
          meter in the real system would even be wrong enough to notice.
        </Callout>
      </LessonSection>

      <LessonSection id="outbox">
        <Lead>
          The fix is to stop having two writes. Make the event part of the same
          transaction as the row, then let a separate process publish it.
        </Lead>
        <P>
          In the outbox path the commit writes <Strong>two rows</Strong> in one local
          transaction: the order row, and an <Term>outbox</Term> record describing the
          event to publish. Because they commit together, the event is durable the exact
          instant the data is — there is no window where one exists without the other. A
          separate <Term>relay</Term> then reads the outbox and publishes each record to
          the broker, marking it done once the broker has it.
        </P>
        <TryThis>
          <LI>Switch the write path to outbox + relay and watch the relay drain the outbox to the broker.</LI>
          <LI>With no crash, let it run: unpublished settles to zero, lost events stays at zero.</LI>
        </TryThis>
        <OutboxPatternFigure />
        <P>
          Left running without a crash, the outbox path loses nothing: over a full run{" "}
          <Term>lost events</Term> and <Term>duplicate events</Term> both stay at{" "}
          <Strong>0</Strong>, and <Term>unpublished</Term> tracks only the transient
          relay backlog, which drains back to zero. The event can no longer be lost,
          because it was committed with the data that justifies it.
        </P>
        <Callout kind="insight">
          The relay can crash, restart, or fall behind, and correctness does not depend on
          it — a slow relay is a delayed event, not a missing one. The unpublished meter is
          now a backlog gauge, not a wound: everything it counts is still owed and will be
          sent.
        </Callout>
      </LessonSection>

      <LessonSection id="at-least-once">
        <Lead>
          The outbox removes lost events. It does not give you exactly-once — it gives you
          at-least-once, and the difference shows up as duplicates.
        </Lead>
        <P>
          The relay does two things that are not atomic: publish the record to the broker,
          and mark the outbox row done. Crash between them and the event is already at the
          broker, but the row still looks unpublished — so after restart the relay sends
          it again. In the figure, crashing the service while the relay is mid-publish
          produces exactly this: <Term>lost events</Term> stays at{" "}
          <Strong>0</Strong> while <Term>duplicate events</Term> climbs above zero.
          Nothing was lost; something was repeated.
        </P>
        <P>
          This is not a bug in the outbox — it is the same wall the previous lesson hit.
          The publish and the mark-done cannot be made atomic across the network, so you
          choose which failure you tolerate. Marking the row done before the publish would
          trade the duplicate for a lost event, which is the thing you built the outbox to
          prevent. So you keep the duplicate and push the problem one step further:
        </P>
        <UL>
          <LI>
            The outbox guarantees the event is <Strong>published at least once</Strong> —
            never lost.
          </LI>
          <LI>
            Consumers must be <Strong>idempotent</Strong>: recognise an event id they have
            already processed and treat the repeat as a no-op. That is the exactly-once{" "}
            <Strong>effect</Strong>, built at the consumer, not the exactly-once delivery,
            which does not exist.
          </LI>
        </UL>
        <Callout kind="warning">
          Do not read the outbox as exactly-once. It converts a silent, unrecoverable loss
          into a loud, recoverable duplicate — a strictly better failure, but still a
          failure the consumer has to handle.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
