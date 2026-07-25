import { expect, test, type Page } from "@playwright/test";
import { allLessons, lessonPath } from "@/lib/curriculum";

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

const STATIC_ROUTES = ["/", "/learn", "/about"];

const LESSON_ROUTES = allLessons
  .filter((lesson) => lesson.status === "available")
  .map(lessonPath);

const ROUTES = [...STATIC_ROUTES, ...LESSON_ROUTES];

const CLIENT_SERVER = "/learn/scaling/client-server";

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

test.describe("the simulation engine runs in the browser", () => {
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
    const clock = figure.getByText(/^t=\d+(\.\d+)?s$/);
    // PacketLayer's pool: circles in the stage svg's aria-hidden group.
    // `:visible` is Playwright's own check — pooled slots parked with
    // `visibility: hidden` do not count.
    const livePackets = figure.locator(
      'svg[role="img"] > g[aria-hidden="true"] > circle:visible',
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
      const stage = figure.locator('svg[role="img"]');
      await expect(stage).toBeVisible();
      await expect(stage.locator("text")).not.toHaveCount(0);
      await expect(figure.getByText(/^t=\d+(\.\d+)?s$/)).toBeVisible();
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
