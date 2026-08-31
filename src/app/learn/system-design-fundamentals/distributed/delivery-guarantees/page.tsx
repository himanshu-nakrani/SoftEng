import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { DeliveryGuaranteesFigure } from "@/lessons/distributed/delivery-guarantees-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("delivery-guarantees");

export default function DeliveryGuaranteesPage() {
  return (
    <Lesson slug="delivery-guarantees">
      <LessonSection id="at-least-once">
        <Lead>
          The last lesson&apos;s queue never lost a message — but that was a
          promise about the <em>buffer</em>. It said nothing about the message
          a worker had already picked up when it died halfway through. Who
          owns that one?
        </Lead>
        <P>
          Exactly one thing decides: the <Term>ack</Term>. A queue does not
          delete a message when it hands it out — it deletes it when the
          consumer says <em>done</em>. So the guarantee your system provides
          is not a vendor feature or a config flag. It is{" "}
          <Strong>which line of the consumer sends the ack</Strong>, and there
          are only two places to put it.
        </P>
        <P>
          <Strong>at-most-once</Strong> — <Term>ack → work</Term>. Take the
          message, tell the queue you have it, then do the job. The queue
          forgets immediately, so a crash in the gap leaves nothing to retry.
          No duplicate is possible; no one will ever learn that the work
          didn&apos;t happen.
        </P>
        <P>
          <Strong>at-least-once</Strong> — <Term>work → ack</Term>. Do the job
          first, ack only once it is durable. The queue holds the message
          until it hears back, so a crash in the gap means the next worker
          gets the same message again. Nothing is ever lost; the side effect
          can run twice.
        </P>
        <P>
          Notice that neither ordering is safe — they are two different
          unsafeties, and you are picking one. There is no third line to put
          the ack on, because &quot;exactly once&quot; would require the ack
          and the side effect to commit atomically while sitting on opposite
          sides of a network. Anything advertising exactly-once delivery is
          running at-least-once with deduplication underneath, and the second
          half is the part you have to build.
        </P>
      </LessonSection>

      <LessonSection id="crash-consumer">
        <P>
          A payments pipeline, one message at a time so you can follow it:{" "}
          <Term>checkout</Term> publishes, <Term>payments-q</Term> holds,{" "}
          <Term>worker-1</Term> takes one, charges the card at{" "}
          <Term>payments-db</Term>, and acks. Watch for the small cyan dot
          flying back up to the queue — that is the ack, and where it leaves
          in the sequence is the only thing on this stage that matters.
        </P>
        <DeliveryGuaranteesFigure />
        <P>
          A few seconds in, the run kills worker-1 in the worst possible
          instant: <Strong>after the charge landed, before the ack went
          out</Strong>. The card has been debited and payments-q has no idea.
          A supervisor restarts the worker ~1.5s later, the queue redelivers
          the message it never got an ack for — drawn orange, because it is
          the second copy — and <Term>double charged</Term> ticks to 1.
        </P>
        <P>
          Then do it yourself: hit <Term>crash consumer</Term> (or click
          worker-1) and switch <Term>ack mode</Term> to at-most-once. Same
          crash, opposite failure — the ack goes out at take, so the queue has
          already deleted a message nobody ever paid, and{" "}
          <Term>lost payments</Term> climbs instead. The two counters are the
          lesson: you can move the damage, not remove it.
        </P>
        <Callout kind="warning">
          The vulnerable window looks tiny on the stage, and it is — a few
          hundred milliseconds between the write committing and the ack
          landing. At ten thousand messages a second, &quot;a few hundred
          milliseconds of exposure&quot; means you are living inside that
          window continuously. Rare per-message is certain per-day.
        </Callout>
      </LessonSection>

      <LessonSection id="idempotency">
        <P>
          Since duplicates cannot be prevented, they have to be made{" "}
          <em>harmless</em>. Put ack mode back to at-least-once, flip{" "}
          <Term>idempotency keys</Term> on, and crash the worker again. The
          redelivery still happens. The orange duplicate still crosses the
          wire and still arrives at payments-db. What changes is what the
          database does with it: it recognises the key, refuses to charge
          again, flashes <Term>DEDUPED</Term>, and returns the same answer it
          returned the first time. Double charges stay at zero.
        </P>
        <P>
          That is the whole technique.{" "}
          <Strong>Every message carries a stable id, and the operation is
          written so that applying it twice equals applying it once.</Strong>{" "}
          Delivery stays at-least-once forever — you have simply stopped
          caring, because the second delivery is a no-op. This is what people
          actually mean when they say &quot;exactly once&quot;: not
          exactly-once <em>delivery</em>, which is impossible, but an
          exactly-once <em>effect</em>, which is ordinary engineering.
        </P>
        <Callout kind="insight">
          Idempotency has a shape you will recognise everywhere once you look:
          an <Term>Idempotency-Key</Term> header on a payments API, so a
          retried POST returns the original charge instead of making a new
          one; <Term>INSERT … ON CONFLICT DO NOTHING</Term> and upserts keyed
          on a natural id; a <Strong>dedup window</Strong> in the consumer or
          broker that drops message ids it has seen recently; and the{" "}
          <Term>transactional outbox</Term>, which makes the state change and
          the &quot;I published it&quot; record commit in one database
          transaction so they can never disagree.
        </Callout>
        <Callout kind="warning">
          Read the badge on payments-db: <Term>keys N</Term>. That set is
          bounded — 50 here, an hour or a day in real brokers. A dedup window
          is a <em>window</em>, not eternity, so a redelivery that arrives
          after the key is evicted charges the card exactly as if you had
          never built any of this. If duplicates must be impossible rather
          than merely unlikely, the key belongs in durable storage next to the
          data it protects — a unique constraint on the payments table beats
          any amount of in-memory cleverness.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
