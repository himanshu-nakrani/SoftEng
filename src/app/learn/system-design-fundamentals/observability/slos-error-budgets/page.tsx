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
import { SlosErrorBudgetsFigure } from "@/lessons/observability/figures";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("slos-error-budgets");

export default function SlosErrorBudgetsPage() {
  return (
    <Lesson slug="slos-error-budgets">
      <LessonSection id="availability-target">
        <Lead>
          An SLO is an agreement about user experience over time. It says more
          than “the service is up”: it names the operation, the target, and the
          window in which that target must hold.
        </Lead>
        <P>
          A <Term>99.9% availability SLO</Term> permits 0.1% of eligible
          requests to fail. That allowance is the <Strong>error budget</Strong>.
          It is not a prize for outages; it is the bounded risk a team can spend
          on change, experiments, and ordinary production failure.
        </P>
        <P>
          The important number during an incident is often the <Strong>burn
          rate</Strong>: how quickly the present failure rate would consume the
          budget. A short outage can be urgent even while the displayed average
          availability still looks acceptable. The calendar remembers the
          failures after the dashboard headline has recovered.
        </P>
      </LessonSection>

      <LessonSection id="burn-rate">
        <P>
          A new search-api release begins with a small canary. It contains a
          deterministic defect, so shifting more traffic to it raises the error
          rate. Notice how the availability gauge moves slowly while the budget
          burn meter reacts immediately to the risk of continuing the rollout.
        </P>
        <SlosErrorBudgetsFigure />
        <TryThis>
          <li>Increase the canary percentage in small steps.</li>
          <li>Compare the remaining budget with the burn-rate meter.</li>
          <li>Change the SLO window and observe why a fixed failure rate has a different operating meaning.</li>
        </TryThis>
        <Callout kind="insight">
          SLOs make reliability a product decision. A budget that is burning too
          fast is evidence that the system has lost its capacity for further
          risky change, even before it has visibly crossed the target.
        </Callout>
      </LessonSection>

      <LessonSection id="release-decision">
        <P>
          A rollout should not continue merely because the average is still
          close to target. If the burn rate predicts that the error budget will
          be exhausted far sooner than the SLO window, pause or roll back the
          change. That limits the blast radius and preserves capacity to learn
          from the incident.
        </P>
        <P>
          Press <Term>pause rollout</Term> after raising the canary. The release
          traffic drops to zero, preventing it from adding new failures while
          the team investigates the defect. The error budget does not instantly
          regenerate; an SLO is accounting for user experience, not a reset
          button. The point is to stop the slope.
        </P>
        <Callout kind="warning">
          Error budgets work only when the SLI is honest. Measure the user
          operation that matters—such as a successful search result—not a
          convenient internal heartbeat that remains green while customers fail.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
