import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { RetriesTimeoutsFigure } from "@/lessons/resilience/retries-timeouts-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Timeouts & Retries",
};

export default function RetriesTimeoutsPage() {
  return (
    <Lesson slug="retries-timeouts">
      <LessonSection id="why-timeouts">
        <Lead>
          A call that never comes back is worse than one that fails. Failure
          is information — you can log it, fall back, tell the user. Waiting
          is nothing at all, and it is not free: you are holding a
          connection, a thread, a slab of memory and a person, for as long
          as the other side stays quiet.
        </Lead>
        <P>
          A <Term>timeout</Term> is the deadline you attach to someone
          else&apos;s promise. It converts <Strong>unbounded waiting</Strong>{" "}
          into a <Strong>known failure at a moment you chose</Strong>. That
          is the whole trade: you give up the small chance the answer was
          about to arrive, and you get your resources and a decision back.
          Every call you make over a network has a timeout — the only
          question is whether you picked it or inherited someone&apos;s
          60-second default.
        </P>
        <P>
          The number is not arbitrary. Set it below the latency you actually
          expect and every healthy call fails. Set it far above and one slow
          dependency drags your service down with it, one held thread at a
          time. Aim just past the <Term>p99</Term> of the thing you are
          calling — and keep it under your own caller&apos;s deadline, or
          you will be doing work for someone who already gave up.
        </P>
      </LessonSection>

      <LessonSection id="tune-retries">
        <P>
          Clients ask <Term>api-1</Term> for something at a steady 5 req/s;
          api-1 calls <Term>pg-main</Term>, which serves 12. Amber dots are
          first attempts, orange dots are <Strong>retries</Strong>, and a red
          dot is a call that died — pg-main returning an error, or the
          deadline running out. The chip on api-1 counts retries waiting for
          their backoff; the chip on pg-main is its queue.
        </P>
        <RetriesTimeoutsFigure />
        <P>
          Drag <Term>timeout</Term> under about 500ms — less than a single
          hop out to the database — and watch every call die at its deadline
          without a single success. Then push <Term>max retries</Term> up and
          watch the gauge on the left. <Term>amplification</Term> is the load
          pg-main is offered divided by the load the clients actually asked
          for: it sits at 1x when nothing is retrying, and climbs toward{" "}
          <Strong>1 + max retries</Strong> when everything is.
        </P>
        <Callout kind="insight">
          A retry is a decision to <em>multiply your load</em> at the exact
          moment the system is least able to absorb it. That is fine when
          failures are rare and independent — a dropped packet, one bad
          host. It is catastrophic when failures are correlated, because
          then every client retries at once.
        </Callout>
      </LessonSection>

      <LessonSection id="retry-storm">
        <P>
          At <Term>t=14</Term> the database stops answering. Notice how it
          fails: it does not refuse the connection, it goes quiet. There is
          nothing to react to, so every call in flight has to wait out its
          full timeout before api-1 learns anything — and then retries. The
          offered-load trace climbs to three or four times what anyone
          asked for while pg-main is serving exactly nothing.
        </P>
        <P>
          Then, at <Term>t=19</Term>, the database comes back. The fault is
          gone. Watch what does <em>not</em> happen: served stays at zero,
          amplification stays near 4x, and the{" "}
          <Term>wasted work</Term> counter starts climbing at pg-main&apos;s
          full service rate. The clients never asked for more than 5 req/s
          in their lives, the database can do 12, and the system stays on
          the floor.
        </P>
        <P>
          The mechanism is in that wasted counter. pg-main serves its queue
          in order and has no idea anyone left, so the request at the head
          of a deep queue is always the oldest one — the one whose caller
          timed out seconds ago. Every unit of capacity goes into producing
          answers nobody will read, so nothing succeeds, so everything
          retries, so the queue stays deep.{" "}
          <Strong>100% busy, 0% useful.</Strong>
        </P>
        <Callout kind="warning">
          This is a <Term>metastable failure</Term>: the trigger is gone and
          the system stays down, because the load is now the system&apos;s
          own retries. It is why &quot;the database is healthy again&quot;
          does not end an incident, and why recovery so often needs a
          deliberate load shed — drop traffic, let the queue empty, then
          let it back in.
        </Callout>
      </LessonSection>

      <LessonSection id="backoff">
        <P>
          The exit is not more capacity, it is less load.{" "}
          <Term>Exponential backoff</Term> doubles the wait after each
          failure — 100ms, 200ms, 400ms, 800ms — so a client that keeps
          failing keeps asking less often. Switch the sim&apos;s{" "}
          <Term>backoff</Term> control to <Term>exp + jitter</Term> and
          replay the outage: the same timeouts happen, but the retries
          spread out far enough that pg-main can outrun its queue, and the
          amplification gauge falls back to 1x on its own.
        </P>
        <P>
          Then try <Term>fixed</Term>, and watch it stay broken. A constant
          half-second delay is still a delay every failed caller waits for
          in unison: they all failed at the same instant, so they all come
          back at the same instant. That is why{" "}
          <Term>jitter</Term> — randomising each wait inside its window — is
          not a refinement. It is the part that breaks the herd apart, and
          it costs one call to a random number generator.
        </P>
        <Callout kind="insight">
          The rule of thumb: <Strong>cap retries</Strong> (two is usually
          plenty — the third attempt almost never succeeds when the first
          two failed for the same reason),{" "}
          <Strong>always jitter</Strong>, <Strong>budget retries
          globally</Strong> so they can never exceed a small fraction of
          normal traffic, and <Strong>retry at one layer only</Strong> —
          three layers each retrying three times is 27 requests for one
          click.
        </Callout>
        <P>
          One last thing the sim will show you: retries are only safe if the
          work is <Term>idempotent</Term>. A timeout does not tell you the
          request failed — it tells you that <em>you stopped waiting</em>.
          Look at the wasted counter again and remember every one of those
          was a request the database really did execute. Retrying a read is
          free; retrying a payment had better carry the same idempotency key.
        </P>
      </LessonSection>
    </Lesson>
  );
}
