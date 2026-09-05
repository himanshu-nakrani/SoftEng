import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { CircuitBreakerHysteresisFigure } from "@/lessons/on-call/circuit-breaker-hysteresis-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("circuit-breaker-hysteresis");

export default function CircuitBreakerHysteresisPage() {
  return (
    <Lesson slug="circuit-breaker-hysteresis">
      <LessonSection id="dependency-flapping">
        <Lead>When a recovering service meets a thundering herd, rebooting is indistinguishable from crashing.</Lead>
        <P>
          A critical downstream microservice suffers a failure. The caller&apos;s circuit breaker trips
          <Strong>open</Strong>, failing fast to shed load and give the downstream system breathing
          room. After several seconds, the downstream process restarts. Its thread pools are fresh,
          its internal caches are cold, and its database connections are not yet established.
        </P>
        <P>
          The service is fragile: it can handle single-digit canary requests, but cannot survive full
          production traffic. If your circuit breaker reopens the floodgates the instant a single
          health check ping succeeds, the sudden influx of queued requests creates a connection
          stampede that immediately crashes the recovering process. The dependency enters a
          <Term>flapping loop</Term> — oscillating between brief recovery and repeated failure.
        </P>
      </LessonSection>

      <LessonSection id="probe-policy">
        <TryThis>
          <LI>Slide to <Strong>immediate full close</Strong> — succeeds in 0 of 200 runs as incoming traffic repeatedly crushes the warming dependency.</LI>
          <LI>Slide to <Strong>fixed 60-second cooldown</Strong> — avoids crashing, but meets the recovery SLA in only 100 of 200 runs because healthy capacity sits idle.</LI>
          <LI>Slide to <Strong>half-open rate-ramping</Strong> — succeeds in all 200 runs by probing at 5% load and gradually ramping traffic as health stabilizes.</LI>
        </TryThis>
        <CircuitBreakerHysteresisFigure />
        <Callout kind="insight">
          Immediate full close recovers cleanly in 0 of 200 runs; a fixed 60-second cooldown succeeds
          in 100 of 200 runs; half-open rate-ramping recovers cleanly in all 200. A circuit breaker
          cannot use symmetric trip and reset thresholds without inducing oscillation.
        </Callout>
      </LessonSection>

      <LessonSection id="hysteresis">
        <Lead>Hysteresis: make tripping fast and recovery damped.</Lead>
        <P>
          In physical systems, <Term>hysteresis</Term> prevents rapid chattering around a boundary. A home
          thermostat does not disengage the heater the instant the ambient temperature rises by 0.1
          degrees; doing so would cycle the mechanical relay dozens of times an hour. It requires a
          deadband between the turn-on and turn-off setpoints.
        </P>
        <P>
          Distributed circuit breakers require the identical asymmetry. Tripping <Strong>open</Strong>
          must be aggressive and fast to protect callers from latency amplification and cascading
          collapse. But transitioning back to <Strong>closed</Strong> must be heavily damped:
          entering a <Term>half-open</Term> trial state, testing with a trickle of canary traffic,
          backing off exponentially on failure, and ramping load in stages so cold caches warm
          smoothly under control.
        </P>
      </LessonSection>
    </Lesson>
  );
}
