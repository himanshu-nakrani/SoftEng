import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import { IncidentTriageFigure } from "@/lessons/observability/figures";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("incident-triage");

export default function IncidentTriagePage() {
  return (
    <Lesson slug="incident-triage">
      <LessonSection id="symptoms">
        <Lead>
          The first minutes of an incident are not a search for a perfect
          explanation. They are a search for a safe next action: confirm the
          user impact, contain the blast radius, and preserve enough evidence to
          understand the system after it is stable.
        </Lead>
        <P>
          Symptoms are often linked by a feedback loop. A dependency slows or
          fails, requests wait until a timeout, callers retry, and the retries
          create new work for the already unhealthy dependency. The dashboard
          now shows high p99 latency, rising error rate, and a growing queue—but
          those are connected effects, not three separate incidents.
        </P>
        <P>
          Triage means forming a small causal model from those signals. Which
          dependency changed first? Which queue is accumulating? Is the service
          doing useful work, or merely repeating failed work? Good mitigation
          reduces pressure before it attempts a permanent fix.
        </P>
      </LessonSection>

      <LessonSection id="find-feedback">
        <P>
          Payments fails in this checkout path. Let the incident begin and
          watch the retry queue. With <Term>immediate retry</Term>, each failed
          call becomes another near-immediate attempt at the same dead service.
          That turns a dependency failure into a wider API outage.
        </P>
        <IncidentTriageFigure />
        <TryThis>
          <li>Wait for the payments outage, then observe p99, error rate, and retry queue together.</li>
          <li>Switch from immediate retry to exponential backoff.</li>
          <li>Click payments to revive it after comparing the policies.</li>
        </TryThis>
        <Callout kind="warning">
          A longer timeout is not automatically kinder. It keeps resources tied
          up for longer and can deepen a queue. Timeouts, retries, and queues
          must be tuned as one feedback system.
        </Callout>
      </LessonSection>

      <LessonSection id="mitigate">
        <P>
          During a dependency outage, the correct first move is usually to
          reduce work. <Strong>Exponential backoff</Strong> slows the retry
          feedback loop. <Strong>Load shedding</Strong> protects the most
          important requests by declining non-critical work before it consumes
          scarce capacity. Together, they make recovery possible instead of
          competing with it.
        </P>
        <P>
          Apply both controls, then compare the retry queue with the immediate
          retry run. The objective is not zero errors while payments is dead;
          that is impossible. The objective is a bounded, understandable failure
          mode that keeps checkout-api responsive enough to return an honest
          result and lets the downstream dependency recover.
        </P>
        <Callout kind="insight">
          A concise incident update should say what users experience, what the
          signals show, what mitigation is active, and when the next update will
          arrive. This is operational observability too: a shared model prevents
          every responder from chasing a different symptom.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
