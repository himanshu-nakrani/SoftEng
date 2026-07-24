import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { IdempotencyFigure } from "@/lessons/distributed/idempotency-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Idempotency",
};

export default function IdempotencyPage() {
  return (
    <Lesson slug="idempotency">
      <LessonSection id="the-ambiguity">
        <Lead>
          Last lesson ended with a rule: <em>retry only idempotent
          operations</em>. Here&apos;s why. You send a payment. No answer.{" "}
          <Strong>Did it go through?</Strong>
        </Lead>
        <P>
          You genuinely cannot know — silence looks identical whether the{" "}
          <em>request</em> died on the way in (safe to retry) or the{" "}
          <em>confirmation</em> died on the way back (the charge already
          happened). This isn&apos;t a bug to fix; it&apos;s a property of
          networks. The only question is what your retry does to a server
          that already did the work.
        </P>
      </LessonSection>

      <LessonSection id="double-charge">
        <P>
          Watch the red fades — confirmations dying on the wire. Each one
          triggers a timeout and a retry, and the server, seeing a
          perfectly normal payment request, charges again. Compare{" "}
          <Term>charges made</Term> against <Term>confirmed</Term>, then
          flip <Term>idempotency keys</Term> on.
        </P>
        <IdempotencyFigure />
        <Callout kind="insight">
          After the flip, retries still happen — the network is just as
          lossy — but duplicates stop dead. The violet responses are the
          server saying <em>&quot;seen this key, here&apos;s the original
          result&quot;</em>: the retry becomes a safe question instead of a
          repeated action.
        </Callout>
      </LessonSection>

      <LessonSection id="the-mechanism">
        <P>
          The fix is almost embarrassingly small: the <em>client</em>{" "}
          attaches a unique key to the operation&apos;s <em>intent</em> —{" "}
          <Term>pay-order-8412</Term> — and reuses it on every retry of
          that intent. The server keeps a ledger of processed keys; a
          familiar key returns the stored result instead of redoing the
          work. Same request twice, work done once:{" "}
          <Strong>f(f(x)) = f(x)</Strong>.
        </P>
        <Callout kind="note">
          This is why Stripe&apos;s API takes an{" "}
          <Term>Idempotency-Key</Term> header, why message queues promise
          &quot;at-least-once&quot; delivery and make <em>you</em> dedupe,
          and why &quot;exactly-once&quot; is best understood as
          at-least-once delivery + idempotent processing. The retry storms
          of last lesson are only survivable because retries can be made
          harmless.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
