"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { incidentTriageSim } from "./incident-triage";
import { metricsLogsTracesSim } from "./metrics-logs-traces";
import { slosErrorBudgetsSim } from "./slos-error-budgets";

export function MetricsLogsTracesFigure() {
  return (
    <SectionFigure
      sim={metricsLogsTracesSim}
      completes={[
        { on: "param-change", id: "signal", section: "follow-trace" },
        { on: "button-press", id: "inject-slow-query", section: "follow-trace" },
        {
          on: "quiz-answered",
          id: "signals-root-cause",
          correctOnly: true,
          section: "follow-trace",
        },
      ]}
      description="A checkout request moves from the browser to checkout-api, orders-worker, and orders-db before a response returns. The request-rate and normal database-latency controls alter the workload. Selecting metrics, logs, or traces records the chosen investigation signal; injecting a slow query makes orders-db slower, fills its queue, and raises p95 latency. The database can also be clicked to fail. Meters show p95 latency, error rate, database queue depth, and completed requests."
    />
  );
}

export function SlosErrorBudgetsFigure() {
  return (
    <SectionFigure
      sim={slosErrorBudgetsSim}
      completes={[
        { on: "param-change", id: "canary", section: "burn-rate" },
        { on: "button-press", id: "pause-rollout", section: "release-decision" },
        {
          on: "quiz-answered",
          id: "slo-burn-rate",
          correctOnly: true,
          section: "release-decision",
        },
      ]}
      description="Search requests travel from users through an edge service and search-api to the search index. A scheduled new-release rollout sends the selected canary percentage of traffic to a deterministic defective release. Increasing canary traffic raises failures and consumes the 99.9 percent availability error budget. The pause-rollout button stops additional release traffic. Meters show availability, remaining error budget, budget burn rate, and release traffic."
    />
  );
}

export function IncidentTriageFigure() {
  return (
    <SectionFigure
      sim={incidentTriageSim}
      completes={[
        { on: "param-change", id: "retry-policy", section: "mitigate" },
        { on: "button-press", id: "shed-load", section: "mitigate" },
        {
          on: "quiz-answered",
          id: "triage-retry-storm",
          correctOnly: true,
          section: "mitigate",
        },
      ]}
      description="Checkout traffic travels from users through a gateway and checkout-api to payments. A scripted payments outage turns the payments node dead; requests fail, the retry queue grows according to the selected retry policy, and checkout p99 rises. The user can set the downstream timeout, replace immediate retries with exponential backoff, shed non-critical load, or click payments to revive the service. Meters show checkout p99, error rate, retry queue depth, and completed request throughput."
    />
  );
}
