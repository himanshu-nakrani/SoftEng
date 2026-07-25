import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { CircuitBreakerFigure } from "@/lessons/resilience/circuit-breaker-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Circuit Breakers",
};

export default function CircuitBreakerPage() {
  return (
    <Lesson slug="circuit-breaker">
      <LessonSection id="fail-fast">
        <Lead>
          A dependency that <em>refuses</em> you is an inconvenience. A
          dependency that <em>hangs</em> is an outage — and not only its own.
          Every call waiting on it is a thread, a connection, a socket you
          cannot use for anything else, held for the full timeout before it
          fails anyway.
        </Lead>
        <P>
          That is how one dead service takes a healthy one down with it. Your
          service is fine; it is just entirely made of threads parked on a
          two-second timeout, waiting for a machine that is never going to
          answer. The timeout saved you from waiting <em>forever</em>. It did
          not save you from waiting.
        </P>
        <P>
          A <Term>circuit breaker</Term> is the piece that notices. It wraps
          calls to one dependency, counts how they end, and when enough of them
          fail in a row it stops making them at all — every subsequent call
          fails <Strong>immediately</Strong>, without touching the network. It
          does not fix anything. It converts a 2000ms timeout into a 1ms
          refusal, which is the difference between a slow outage and a fast
          error you can actually handle: serve a cached answer, degrade the
          feature, show the user something.
        </P>
        <Callout kind="insight">
          The name is the electrical one, and it is exact. A breaker does not
          repair the short — it disconnects the circuit so the wiring behind it
          does not burn. Then a human, or a timer, decides when to try again.
        </Callout>
      </LessonSection>

      <LessonSection id="trip-it">
        <P>
          Below, every request crosses the breaker on its way to{" "}
          <Term>svc-1</Term>. While the chip reads <Term>CLOSED</Term> the
          breaker is pure pass-through: it forwards the call and only watches
          how it ends. Green comes back fast. A failure comes back{" "}
          <em>slowly</em> — that orange dot crawling home is one call hanging
          for its whole timeout, and it lights a pip.
        </P>
        <CircuitBreakerFigure />
        <P>
          The pips count <Strong>consecutive</Strong> failures, and one success
          wipes them. That is the whole trick to not tripping on noise: a
          service at 10% errors lights a pip and clears it all day long, while a
          service that is genuinely down never clears one. Watch the run kill
          svc-1 at <Term>t=12</Term> — the pips fill, the chip flips to{" "}
          <Term>OPEN</Term>, and the latency trace falls off a cliff from
          2000ms to 1ms while the <Term>failed fast</Term> counter starts
          climbing.
        </P>
        <P>
          Then take the controls. Click <Term>svc-1</Term> to kill it yourself
          at any moment and watch the streak fill in real time. Drag{" "}
          <Term>fail threshold</Term> to 2 and the breaker becomes a hair
          trigger that trips on ordinary noise; drag it to 10 and it sits
          through a long stretch of hanging calls before it admits anything is
          wrong. Push <Term>svc-1 failure rate</Term> up and watch a threshold
          that felt safe start tripping on its own.
        </P>
        <Callout kind="warning">
          Notice what <Term>svc-1 errors</Term> does while the breaker is open:
          nothing. It freezes. No calls are reaching svc-1, so the breaker has
          no idea whether it recovered ten seconds ago or is still on fire.
          Blindness is the price of not asking — which is exactly why the open
          state has to expire.
        </Callout>
      </LessonSection>

      <LessonSection id="half-open">
        <P>
          So the breaker has to guess when to trust svc-1 again, and it has
          exactly one safe way to find out: send <em>one</em> call. That is{" "}
          <Term>HALF-OPEN</Term> — when the open window expires, the breaker
          lets a single probe (the violet packet) cross while everything else
          keeps bouncing. One request is the entire experiment.
        </P>
        <P>
          The verdict is binary and immediate. A clean probe closes the breaker
          and readmits the full flood at once. A failed probe snaps it straight
          back to <Term>OPEN</Term> for another full window — you do not get a
          second opinion, because a second opinion means a second hanging call.
          In this run svc-1 comes back at <Term>t=17</Term> still erroring, so
          the first probe fails and the breaker re-opens; the probe after that
          one finds a genuinely healthy service and closes.
        </P>
        <P>
          The <Term>half-open probes</Term> slider is the knob for how much
          evidence you want. One probe is cheap and jumpy. Three probes is a
          steadier verdict that costs three hanging calls every time you are
          wrong — and on a big fleet, every instance runs this experiment
          independently, so &quot;one probe&quot; per instance is already a
          crowd arriving at a service that just got off the floor.
        </P>
        <Callout kind="note">
          Production practice, in three rules.{" "}
          <Strong>One breaker per dependency</Strong> — per host or per
          endpoint, never one global breaker, or a sick recommendations service
          takes checkout down with it.{" "}
          <Strong>Back the open window off</Strong> — grow it on each
          consecutive failed probe instead of hammering a dead service on a
          fixed interval. And{" "}
          <Strong>emit a metric on every state transition</Strong>: a breaker
          that opens is your fastest, cleanest signal that a specific
          dependency is down, and it fires long before anyone reads a latency
          graph. The counterpart matters too — a breaker that never opens is
          not proof of health, it is usually proof the threshold is too high to
          ever mean anything.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
