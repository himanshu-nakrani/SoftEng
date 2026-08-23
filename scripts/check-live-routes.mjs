#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL ?? "https://himanshu-nakrani.github.io/SoftEng").replace(/\/$/, "");
const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 15000);

const routes = [
  "/",
  "/about",
  "/learn",
  "/review",
  "/learn/scaling/client-server",
  "/learn/scaling/scaling-strategies",
  "/learn/scaling/load-balancing",
  "/learn/scaling/autoscaling",
  "/learn/scaling/realtime-delivery",
  "/learn/data/caching",
  "/learn/data/cache-stampede",
  "/learn/data/cdn-edge",
  "/learn/data/replication",
  "/learn/data/sharding",
  "/learn/data/consistent-hashing",
  "/learn/resilience/tail-latency",
  "/learn/resilience/retries-timeouts",
  "/learn/resilience/circuit-breaker",
  "/learn/observability/metrics-logs-traces",
  "/learn/observability/slos-error-budgets",
  "/learn/observability/incident-triage",
  "/learn/distributed/rate-limiting",
  "/learn/distributed/message-queues",
  "/learn/distributed/delivery-guarantees",
  "/learn/distributed/fanout",
  "/learn/distributed/cap-theorem",
  "/learn/distributed/leader-election",
  "/learn/distributed/gossip",
  "/learn/distributed/two-phase-commit",
  "/learn/distributed/geo-replication",
];

const contentChecks = [
  {
    route: "/learn/scaling/scaling-strategies",
    markers: ["learning journal", "Save reflection", "Can explain it"],
  },
  {
    route: "/review",
    markers: ["Every prediction, in one deck", "Import", "Export"],
  },
];

async function fetchText(route) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      signal: controller.signal,
      headers: { "user-agent": "syslab-post-deployment-monitor/1.0" },
    });
    const body = await response.text();
    return { route, status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(
  routes.map(async (route) => {
    try {
      return await fetchText(route);
    } catch (error) {
      return {
        route,
        status: 0,
        ok: false,
        body: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }),
);

const failures = results.filter((result) => !result.ok);
for (const result of results) {
  const suffix = result.error ? ` (${result.error})` : "";
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.status} ${result.route}${suffix}`);
}

for (const check of contentChecks) {
  const result = results.find((candidate) => candidate.route === check.route);
  for (const marker of check.markers) {
    const present = result?.body.includes(marker) ?? false;
    console.log(`${present ? "PASS" : "FAIL"} marker ${JSON.stringify(marker)} on ${check.route}`);
    if (!present) {
      failures.push({ route: check.route, marker, ok: false });
    }
  }
}

const summary = {
  baseUrl,
  routeCount: routes.length,
  failedChecks: failures.length,
  checkedAt: new Date().toISOString(),
};
console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) process.exitCode = 1;
