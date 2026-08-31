/**
 * Post-deployment route monitor.
 *
 *   npm run monitor:routes            # against the deployed site
 *   BASE_URL=http://localhost:4173 npm run monitor:routes
 *
 * WHY IT IS TYPESCRIPT NOW. The route list used to be thirty paths written out by
 * hand. It went stale the moment a lesson shipped — by the time this was rewritten
 * it was missing all fourteen lessons of tracks 02 and 03, and `/playground`, so
 * the monitor was reporting green on a curriculum a third larger than it knew
 * about. A monitor that silently checks less than it claims is worse than none,
 * because it is trusted.
 *
 * So the list is DERIVED, exactly like the sitemap, the e2e suites and the test
 * matrix. Shipping a lesson extends the monitor for free.
 */

import {
  allLessons,
  legacyLessonPath,
  lessonPath,
  trackPath,
  tracks,
} from "@/lib/curriculum";

const baseUrl = (
  process.env.BASE_URL ?? "https://himanshu-nakrani.github.io/SoftEng"
).replace(/\/$/, "");
const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 15000);

const available = allLessons.filter((lesson) => lesson.status === "available");

/** Hand-listed because they are not derivable: the app's non-curriculum surfaces. */
const STATIC_ROUTES = ["/", "/about", "/learn", "/review", "/playground"];

const routes = [
  ...STATIC_ROUTES,
  ...tracks.map(trackPath),
  ...available.map(lessonPath),
  // The pre-migration URLs are a promise to anyone holding an old link, so they
  // are monitored too — a redirect stub that 404s is a broken promise.
  ...available
    .filter((lesson) => lesson.moduleSlug !== "shared-state" && lesson.moduleSlug !== "transactions")
    .map(legacyLessonPath),
];

/**
 * Content markers, not just status codes.
 *
 * A 200 proves the host served bytes; it does not prove the page hydrated or that
 * a feature still exists. Each marker is a string that would disappear if the
 * feature behind it broke.
 */
const contentChecks: { route: string; markers: string[] }[] = [
  {
    route: lessonPath(available.find((l) => l.slug === "scaling-strategies")!),
    markers: ["learning journal", "Save reflection", "Can explain it"],
  },
  {
    route: "/review",
    markers: ["Every prediction, in one deck", "Import", "Export"],
  },
  {
    // One archetype-B lesson, so a break in the discrete-step engine's page
    // rendering is caught as well as the packet engine's.
    route: lessonPath(available.find((l) => l.slug === "data-races")!),
    markers: ["counter++", "read counter"],
  },
];

interface Result {
  route: string;
  status: number;
  ok: boolean;
  body: string;
  error?: string;
}

async function fetchText(route: string): Promise<Result> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      signal: controller.signal,
      headers: { "user-agent": "syslab-post-deployment-monitor/2.0" },
    });
    const body = await response.text();
    return { route, status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timer);
  }
}

const results: Result[] = await Promise.all(
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

const failures: string[] = [];

for (const result of results) {
  const suffix = result.error ? ` (${result.error})` : "";
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.status} ${result.route}${suffix}`);
  if (!result.ok) failures.push(`${result.route} responded ${result.status}`);
}

for (const check of contentChecks) {
  const result = results.find((candidate) => candidate.route === check.route);
  for (const marker of check.markers) {
    const present = result?.body.includes(marker) ?? false;
    console.log(
      `${present ? "PASS" : "FAIL"} marker ${JSON.stringify(marker)} on ${check.route}`,
    );
    if (!present) failures.push(`missing ${JSON.stringify(marker)} on ${check.route}`);
  }
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      routeCount: routes.length,
      lessonCount: available.length,
      trackCount: tracks.length,
      failedChecks: failures.length,
      checkedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(`\n${failures.length} failed check(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
}
