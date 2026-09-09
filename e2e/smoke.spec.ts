import { expect, test, type Page } from "@playwright/test";
import { trackPath, tracks } from "@/lib/curriculum";
import {
  announceSelection,
  selectedLegacyRoutes,
  selectedLessonRoutes,
} from "./_selection";

/**
 * Smoke coverage for the static export. Two jobs:
 *   1. every shipped route loads clean — no console errors, no hydration
 *      mismatch (the static HTML has no localStorage, so progress-reading
 *      components are the likely offenders);
 *   2. the simulation engine actually runs in a real browser — the transport
 *      play control advances the sim clock and puts packets on the stage.
 *
 * The route list is derived from the curriculum registry, so a lesson shipped
 * later is smoke-tested automatically without touching this file.
 */

const STATIC_ROUTES = ["/", "/learn", "/review", "/about"];

/** Every track landing — added to the sweep the moment a track is registered. */
const TRACK_ROUTES = tracks.map(trackPath);

/** Sampled on a PR, complete on the scheduled run — see `_selection.ts`. */
const LESSON_ROUTES = selectedLessonRoutes().map((entry) => entry.route);

/**
 * The pre-track URLs, which must keep resolving to a redirect stub rather than
 * 404 — see src/app/learn/[...legacy]/page.tsx. They are in the console sweep
 * because a stub that throws is worse than a dead link.
 */
const LEGACY = selectedLegacyRoutes();

const ROUTES = [...STATIC_ROUTES, ...TRACK_ROUTES, ...LESSON_ROUTES];

announceSelection("smoke");

const CLIENT_SERVER = "/learn/system-design-fundamentals/scaling/client-server";

/** React/Next phrase hydration failures in a few ways; catch all of them. */
const HYDRATION_RE = /hydrat/i;

/**
 * Console messages we deliberately tolerate. Empty on purpose — nothing has
 * needed suppressing. Add an entry ONLY with an inline comment saying why the
 * noise is benign and where it comes from.
 */
const BENIGN_CONSOLE: RegExp[] = [];

interface ConsoleWatcher {
  /** console.error + uncaught page exceptions. */
  errors: string[];
  /** Any console message (any level) mentioning hydration. */
  hydration: string[];
}

/** Collects console errors and hydration complaints for the life of the page. */
function watchConsole(page: Page): ConsoleWatcher {
  const watcher: ConsoleWatcher = { errors: [], hydration: [] };

  page.on("console", (msg) => {
    const text = msg.text();
    if (BENIGN_CONSOLE.some((re) => re.test(text))) return;
    if (HYDRATION_RE.test(text)) watcher.hydration.push(`[${msg.type()}] ${text}`);
    if (msg.type() === "error") watcher.errors.push(`[console.error] ${text}`);
  });

  page.on("pageerror", (err) => {
    const text = `${err.name}: ${err.message}`;
    if (BENIGN_CONSOLE.some((re) => re.test(text))) return;
    if (HYDRATION_RE.test(text)) watcher.hydration.push(`[pageerror] ${text}`);
    watcher.errors.push(`[pageerror] ${text}`);
  });

  return watcher;
}

/**
 * Load a route and give the client bundle time to hydrate — hydration
 * mismatches are reported during hydration, which happens after the JS chunks
 * settle, so `networkidle` plus a short beat is what makes the assertion real.
 */
async function gotoAndSettle(page: Page, route: string) {
  const response = await page.goto(route);
  expect(response, `no response for ${route}`).not.toBeNull();
  expect(
    response!.ok(),
    `${route} responded ${response!.status()}`,
  ).toBeTruthy();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  return response!;
}

test.describe("every route loads clean", () => {
  for (const route of ROUTES) {
    test(`${route} renders with no console errors`, async ({ page }) => {
      const watcher = watchConsole(page);

      await gotoAndSettle(page, route);

      // Something actually rendered (guards against a blank shell passing).
      await expect(page.locator("main, body > div")).not.toHaveCount(0);

      expect(watcher.hydration, `hydration warnings on ${route}`).toEqual([]);
      expect(watcher.errors, `console errors on ${route}`).toEqual([]);
    });
  }
});

test.describe("pre-track URLs still resolve", () => {
  /**
   * Lessons moved from `/learn/<module>/<slug>` to
   * `/learn/<track>/<module>/<slug>`. A static host cannot 301, so the old URLs
   * are generated redirect stubs. Every one of them must land on its lesson —
   * a sample would let a single missing param go unnoticed, and the whole set
   * is cheap because the stubs are static HTML.
   */
  for (const { legacy, target } of LEGACY) {

    test(`${legacy} redirects to ${target}`, async ({ page }) => {
      const watcher = watchConsole(page);

      await page.goto(legacy);
      // The stub replaces the history entry client-side, so wait for the URL
      // rather than for a network response.
      await expect(page).toHaveURL(new RegExp(`${target}/?$`));

      expect(watcher.errors, `console errors redirecting ${legacy}`).toEqual([]);
    });
  }
});

test.describe("the simulation engine runs in the browser", () => {
  /**
   * Lesson figures run to ~1150px tall — taller than the default 720px viewport.
   * That matters because this suite DRIVES the transport, whose controls sit at
   * the figure's bottom edge: in a short viewport, clicking them scrolls the
   * page, which moves the target mid-click and drops the figure below the
   * observer's 0.35 visibility threshold (measured at 0.332), so the engine
   * correctly pauses a figure the test still expects to be running.
   *
   * A viewport that fits the figure removes the geometry fight and keeps these
   * tests about the engine. Scroll-driven pause/resume behaviour is a separate
   * concern and belongs in its own test.
   */
  test.use({ viewport: { width: 1280, height: 1240 } });

  test("play advances the sim clock and puts packets on the stage", async ({
    page,
  }) => {
    const watcher = watchConsole(page);
    await gotoAndSettle(page, CLIENT_SERVER);

    const figure = page.locator("figure").first();
    const playButton = figure.getByRole("button", { name: "Play simulation" });
    const pauseButton = figure.getByRole("button", { name: "Pause simulation" });
    // The transport clock: `t=<seconds>s`, anchored so only the clock span
    // matches (ancestors carry the speed buttons' text too).
    const clock = figure.locator("span.tech-num").filter({
      hasText: /^t=\d+(\.\d+)?s$/,
    });
    // PacketLayer's pool: circles in the stage svg's aria-hidden group.
    // `:visible` is Playwright's own check — pooled slots parked with
    // `visibility: hidden` do not count.
    const livePackets = figure.locator(
      'svg[data-sim-stage] > g[aria-hidden="true"] > circle:visible',
    );

    // The figure autoplays from an effect once 35% of it is on screen, so the
    // transport flipping to "Pause" doubles as proof the bundle hydrated —
    // a real signal to wait on instead of a sleep. Pause it to get a still
    // clock, then drive the control by hand.
    await figure.scrollIntoViewIfNeeded();
    await expect(clock).toBeVisible();
    await expect(
      pauseButton,
      "figure should autoplay once scrolled into view (also our hydration gate)",
    ).toBeVisible();
    await pauseButton.click();

    await expect(playButton).toBeVisible();
    const before = await readClock(clock);

    await playButton.click();
    await expect(pauseButton).toBeVisible();

    await expect
      .poll(() => readClock(clock), {
        timeout: 3_000,
        message: "sim clock should advance after pressing play",
      })
      .toBeGreaterThan(before);

    await expect
      .poll(() => livePackets.count(), {
        timeout: 5_000,
        message: "at least one packet should be in flight on the stage",
      })
      .toBeGreaterThan(0);

    expect(watcher.hydration, "hydration warnings while driving the sim").toEqual([]);
    expect(watcher.errors, "console errors while driving the sim").toEqual([]);
  });

  test.describe("with reduced motion", () => {
    // Playwright 1.62 exposes the emulation through contextOptions; it is no
    // longer a top-level test option.
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("the stage still renders", async ({ page }) => {
      const watcher = watchConsole(page);
      await gotoAndSettle(page, CLIENT_SERVER);

      // Prove the emulation took, otherwise this is just a second copy of the
      // test above.
      await expect
        .poll(() =>
          page.evaluate(
            () => matchMedia("(prefers-reduced-motion: reduce)").matches,
          ),
        )
        .toBe(true);

      const figure = page.locator("figure").first();
      await figure.scrollIntoViewIfNeeded();

      // Stage, meters and transport are all present; only the animated packet
      // layer opts out (PacketLayer hides its pool under reduced motion).
      const stage = figure.locator("svg[data-sim-stage]");
      await expect(stage).toBeVisible();
      await expect(stage.locator("text")).not.toHaveCount(0);
      await expect(
        figure.locator("span.tech-num").filter({ hasText: /^t=\d+(\.\d+)?s$/ }),
      ).toBeVisible();
      await expect(
        figure.getByRole("button", { name: /(Play|Pause) simulation/ }),
      ).toBeVisible();

      expect(watcher.hydration, "hydration warnings under reduced motion").toEqual([]);
      expect(watcher.errors, "console errors under reduced motion").toEqual([]);
    });
  });
});

/** `t=12.3s` → 12.3 */
async function readClock(clock: ReturnType<Page["getByText"]>): Promise<number> {
  const text = (await clock.textContent()) ?? "";
  const match = text.match(/t=(\d+(?:\.\d+)?)s/);
  return match ? Number(match[1]) : Number.NaN;
}
