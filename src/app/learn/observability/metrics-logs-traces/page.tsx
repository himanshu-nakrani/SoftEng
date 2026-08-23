import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Compare,
  CompareCol,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import { MetricsLogsTracesFigure } from "@/lessons/observability/figures";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("metrics-logs-traces");

export default function MetricsLogsTracesPage() {
  return (
    <Lesson slug="metrics-logs-traces">
      <LessonSection id="three-signals">
        <Lead>
          A user says checkout is slow. That names a symptom, not a cause. The
          system might be busy, one dependency might be late, or one request
          might have followed an unusual path. Observability turns that symptom
          into evidence.
        </Lead>
        <P>
          <Strong>Metrics</Strong> are aggregates: rates, ratios, percentiles,
          and queue depth. They answer <em>is the system healthy?</em> cheaply
          and continuously. <Strong>Logs</Strong> are discrete events with
          context: a request id, an error message, a customer, or a query. They
          answer <em>what happened to this event?</em> <Strong>Traces</Strong>
          connect work across service boundaries. They answer <em>where did this
          request spend its time?</em>
        </P>
        <Compare>
          <CompareCol title="metrics">
            <P>
              A rising <Term>p95</Term> warns that a meaningful tail of users is
              waiting too long. It tells you that the system changed; it does
              not identify the request or dependency that caused the change.
            </P>
          </CompareCol>
          <CompareCol title="traces">
            <P>
              A trace is a timed tree of spans. The slowest child span gives a
              causal route from a user request to the downstream dependency
              that consumed the time.
            </P>
          </CompareCol>
        </Compare>
      </LessonSection>

      <LessonSection id="inspect-incident">
        <P>
          This checkout path has three service hops. Let it run normally, then
          trigger a slow query at <Term>orders-db</Term>. The first useful
          signal is the <Term>p95 latency</Term> meter: it establishes that real
          users are affected. The queue tells you the downstream work is no
          longer draining at the same pace.
        </P>
        <MetricsLogsTracesFigure />
        <TryThis>
          <li>Press <Term>inject slow query</Term> and watch p95 rise.</li>
          <li>Switch the signal selector from metrics to logs, then traces.</li>
          <li>Click orders-db to compare a slow dependency with a failed one.</li>
        </TryThis>
        <Callout kind="warning">
          A dashboard full of healthy-looking averages can hide a severe tail.
          Averages answer “what is typical?” while percentile latency asks “how
          bad is the experience for the slower users?”
        </Callout>
      </LessonSection>

      <LessonSection id="follow-trace">
        <P>
          In an incident, use the signals in sequence. Start with metrics to
          establish scope and urgency. Use a trace or correlated request id to
          locate the expensive hop. Then use logs at that hop to recover the
          local detail: the query, error, tenant, deployment, or configuration
          that explains <em>why</em> the span was slow.
        </P>
        <P>
          That sequence avoids two expensive mistakes. Starting with logs means
          searching an enormous event stream without a hypothesis. Stopping at
          metrics means knowing that customers are slow without knowing which
          dependency to repair. A trace supplies the missing causal bridge.
        </P>
        <Callout kind="insight">
          Instrument boundaries, not just components. A useful trace preserves
          the handoff from browser to API, worker, and database; a useful metric
          labels the operation and outcome; a useful log carries the same
          correlation id. The three signals become one investigation rather
          than three unrelated tools.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
