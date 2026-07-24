import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { CircuitBreakersFigure } from "@/lessons/distributed/circuit-breakers-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Circuit Breakers & Retry Storms",
};

export default function CircuitBreakersPage() {
  return (
    <Lesson slug="circuit-breakers">
      <LessonSection id="the-instinct">
        <Lead>
          A call to a dependency fails. Every instinct says:{" "}
          <Strong>try again</Strong>. And for a blip — a dropped packet, a
          restarting pod — retrying is exactly right. This lesson is about
          what the same instinct does during a <em>real</em> failure.
        </Lead>
        <P>
          When a service is failing because it&apos;s <Term>overloaded</Term>,
          a retry is not a second chance — it&apos;s a second request. Send
          enough of them and the callers finish the job the overload
          started. That&apos;s a <Strong>retry storm</Strong>: well-meaning
          clients converting a brownout into an outage.
        </P>
      </LessonSection>

      <LessonSection id="watch-the-storm">
        <P>
          At the 10-second mark, <Term>payments</Term> browns out — 70% of
          calls start failing. Keep your eye on the{" "}
          <Term>downstream</Term> meter with each retry policy. Then flip
          the <Term>circuit breaker</Term> on and watch what a fail-fast
          posture does to both meters.
        </P>
        <CircuitBreakersFigure />
        <Callout kind="insight">
          The uncomfortable truth in the meters: immediate retries genuinely{" "}
          <em>raise</em> checkout success (three attempts beat one) — while
          loading the struggling service at ~2×. Retries spend the
          dependency&apos;s scarcest resource to buy the caller&apos;s
          success. Backoff spreads that cost; only the breaker stops
          spending.
        </Callout>
      </LessonSection>

      <LessonSection id="how-breakers-work">
        <P>
          A <Term>circuit breaker</Term> is a state machine wrapped around a
          dependency call. <Strong>Closed</Strong>: traffic flows, failures
          are counted. Too many failures in the window? <Strong>Open</Strong>:
          every call fails instantly at the caller — no packet even leaves
          the building (watch <Term>orders-api</Term> turn orange). After a
          cooldown, <Strong>half-open</Strong>: one violet probe goes
          through. Success closes the circuit; failure re-opens it.
        </P>
        <P>
          Failing fast feels like giving up. It&apos;s actually two gifts:
          the user gets an honest error in milliseconds instead of a
          timeout in seconds, and the dependency gets the one thing that
          heals overload — <Strong>less traffic</Strong>.
        </P>
        <Callout kind="warning">
          The production checklist: cap retry attempts, use exponential
          backoff <em>with jitter</em> (synchronized retries are their own
          storm), retry only idempotent operations — next lesson — and put
          a breaker around anything you can&apos;t afford to make worse.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
