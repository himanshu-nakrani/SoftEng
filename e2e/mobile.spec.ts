import { expect, test, type Locator, type Page } from "@playwright/test";
import { getLesson, lessonPath } from "@/lib/curriculum";

/**
 * Mobile-viewport coverage for the static export. The smoke suite drives a
 * desktop window, so three phone-only affordances ship untested by it:
 *
 *   1. the slide-over nav drawer (`MobileNav`) — the ONLY way to reach another
 *      lesson below `md`, where the sidebar is hidden;
 *   2. the expand-to-full-screen stage (`InteractiveFigure`) — the small-screen
 *      answer to an 880x450 viewBox, and the one place a *running* sim survives
 *      a class swap on its own container;
 *   3. the padded 44px slider hit areas (`.sim-slider` in globals.css), which
 *      are invisible geometry: nothing about them renders, so only a measured
 *      box proves they exist.
 *
 * Plus the invariant that holds the whole layout together at 390px: no page
 * scrolls sideways — not on its own, not with the drawer open, not with a
 * figure expanded.
 *
 * VIEWPORT DECISION: file-level `test.use` rather than a second Playwright
 * project. The mobile context is a property of these tests, not of a run mode,
 * so `npx playwright test e2e/mobile.spec.ts` is all it takes — no project
 * flag, no `testIgnore` to keep the desktop project off this file, and
 * playwright.config.ts stays exactly as the smoke suite needs it.
 */

/** iPhone 14-ish CSS pixels. Below `md` (48rem), so the drawer owns nav. */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/**
 * Touch/mobile emulation is a Chromium capability, and this repo lets a
 * sandbox point Playwright at a pinned local browser (`PW_CHROMIUM_PATH`).
 * If such a build ever rejects the device options, set
 * `PW_NO_MOBILE_EMULATION=1`: the tests then run at the same 390px viewport
 * with plain desktop input. Nothing below asserts on touch — clicks and keys
 * drive everything — so the coverage degrades to "narrow window" rather than
 * disappearing.
 */
const EMULATE_DEVICE = !process.env.PW_NO_MOBILE_EMULATION;

test.use({
  viewport: MOBILE_VIEWPORT,
  ...(EMULATE_DEVICE
    ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
    : {}),
});

/** The lesson these tests drive: one figure, a breakable node, two sliders. */
const DRIVEN = lessonMeta("client-server");
/** The drawer's navigation target — a different module row in the same tree. */
const TARGET = lessonMeta("load-balancing");

/** Routes swept for the no-horizontal-scroll invariant. */
const ROUTES = ["/", "/learn", DRIVEN.route, TARGET.route];

const HYDRATION_RE = /hydrat/i;

/** Same policy as the smoke suite: nothing is tolerated until it earns it. */
const BENIGN_CONSOLE: RegExp[] = [];

interface ConsoleWatcher {
  errors: string[];
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

/** Assert the page stayed quiet. Called at the end of every test here. */
function expectQuiet(watcher: ConsoleWatcher, where: string) {
  expect(watcher.hydration, `hydration warnings ${where}`).toEqual([]);
  expect(watcher.errors, `console errors ${where}`).toEqual([]);
}

/** Load a route and let the client bundle hydrate before asserting on it. */
async function gotoAndSettle(page: Page, route: string) {
  const response = await page.goto(route);
  expect(response, `no response for ${route}`).not.toBeNull();
  expect(response!.ok(), `${route} responded ${response!.status()}`).toBeTruthy();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

/**
 * The layout invariant at 390px: the document may scroll down, never sideways.
 * `clientWidth` is the layout viewport (unchanged by an overflowing child),
 * `scrollWidth` is the content — 1px of slack for subpixel layout rounding.
 */
async function expectNoHorizontalScroll(page: Page, where: string) {
  const measure = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(
    measure.scrollWidth,
    `${where} scrolls horizontally (scrollWidth ${measure.scrollWidth} > viewport ${measure.clientWidth}; innerWidth ${measure.innerWidth})`,
  ).toBeLessThanOrEqual(measure.clientWidth + 1);
}

/**
 * `<body style="overflow: hidden">` is the scroll lock both overlays take.
 * Released means the inline value is gone entirely — the drawer and the
 * expanded figure each restore the *previous* value rather than blanking it,
 * so "" is what a clean release looks like from a fresh page.
 */
async function expectBodyScrollLocked(page: Page, where: string) {
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow), {
      message: `body scroll should be locked ${where}`,
    })
    .toBe("hidden");
}

async function expectBodyScrollReleased(page: Page, where: string) {
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow), {
      message: `body scroll lock should be released ${where}`,
    })
    .toBe("");
}

/**
 * Computed `position` of the figure. Full screen is exactly `fixed`; in flow it
 * is whatever a normal block is — `static` today, `relative` if the figure ever
 * needs to anchor something, and either answer means "back in the page".
 */
async function expectFigureInFlow(figure: Locator, where: string) {
  await expect
    .poll(
      () => figure.evaluate((el) => getComputedStyle(el).position),
      { message: `figure should be in normal flow ${where}` },
    )
    .toMatch(/^(static|relative)$/);
}

test.describe("mobile nav drawer", () => {
  test("opens, traps a nav tree, closes on Escape and on navigation", async ({
    page,
  }) => {
    const watcher = watchConsole(page);
    await gotoAndSettle(page, DRIVEN.route);

    // The mobile top bar is `md:hidden`, so its presence is itself an
    // assertion that we are under the breakpoint.
    const menu = page.getByRole("button", { name: "Navigation menu" });
    await expect(menu, "menu button should be visible at 390px").toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");

    const drawer = page.getByRole("dialog", { name: "Site navigation" });
    await expect(drawer).toHaveCount(0);

    // --- open ---------------------------------------------------------
    await menu.click();
    await expect(drawer).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    // The registry-driven tree is really in there (not an empty panel).
    // Substring match on purpose: every lesson row's accessible name is
    // prefixed by its progress ring ("Lesson not started Load Balancing"),
    // and that prefix changes as the dwell observer completes sections.
    const targetLink = drawer.getByRole("link", { name: TARGET.title });
    await expect(targetLink).toBeVisible();
    await expect(targetLink).toHaveAttribute("href", TARGET.route);
    await expect(drawer.getByRole("link", { name: "Learning path" })).toBeVisible();

    // The appearance control lives in the drawer footer. Its own Escape key
    // closes the preference panel, not the navigation context that contains it.
    await drawer
      .getByRole("button", { name: "Customize color and reading size" })
      .click();
    const preferences = drawer.getByRole("region", { name: "Appearance preferences" });
    await expect(preferences).toBeVisible();
    await preferences.getByRole("radio", { name: "Teal accent" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.style.getPropertyValue("--user-accent"),
        ),
      )
      .toBe("#167C7A");
    await page.keyboard.press("Escape");
    await expect(preferences).toHaveCount(0);
    await expect(drawer).toBeVisible();

    // A modal drawer that pushes the page sideways would be worse than none,
    // and the lesson behind it must not scroll under the learner's thumb.
    await expectNoHorizontalScroll(page, "lesson page with the drawer open");
    await expectBodyScrollLocked(page, "while the drawer is open");

    // --- Escape closes and hands focus back ---------------------------
    await page.keyboard.press("Escape");
    await expect(drawer, "Escape should dismiss the drawer").toHaveCount(0);
    await expect(menu).toHaveAttribute("aria-expanded", "false");

    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el
        ? { tag: el.tagName, label: el.getAttribute("aria-label") }
        : null;
    });
    expect(
      focused,
      "focus must return to the trigger, not fall back to <body>",
    ).toEqual({ tag: "BUTTON", label: "Navigation menu" });
    await expectBodyScrollReleased(page, "after Escape");

    // --- reopen, navigate --------------------------------------------
    await menu.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: TARGET.title }).click();

    await expect(page).toHaveURL(new RegExp(`${TARGET.route}/?$`));
    await expect(
      drawer,
      "the drawer must not survive the navigation it caused",
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1, name: TARGET.title }),
    ).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expectBodyScrollReleased(page, "after navigating from the drawer");
    await expectNoHorizontalScroll(page, TARGET.route);

    expectQuiet(watcher, "while driving the drawer");
  });
});

test.describe("expand-to-full-screen stage", () => {
  test("keeps the same running sim across the toggle", async ({ page }) => {
    const watcher = watchConsole(page);
    await gotoAndSettle(page, DRIVEN.route);

    const figure = page.locator("figure").first();
    const clock = figure.locator("span.tech-num").filter({
      hasText: /^t=\d+(\.\d+)?s$/,
    });
    const play = figure.getByRole("button", { name: "Play simulation" });
    const pause = figure.getByRole("button", { name: "Pause simulation" });
    const expand = figure.getByRole("button", {
      name: "Expand the figure to full screen",
    });
    const collapse = figure.getByRole("button", {
      name: "Exit full screen and return the figure to the page",
    });

    await figure.scrollIntoViewIfNeeded();
    await expect(clock).toBeVisible();
    // Autoplay-on-scroll flipping the transport is the hydration gate (same
    // signal the smoke suite waits on). Pause, then press play by hand so the
    // run below starts from a known state.
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(play).toBeVisible();

    await expect(expand, "expand toggle should be visible at 390px").toBeVisible();
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expectFigureInFlow(figure, "before expanding");

    await play.click();
    await expect(pause).toBeVisible();

    // Let real sim time accumulate: a remount would restart at t=0, so the
    // reading has to be far enough from zero for that to be detectable.
    await expect
      .poll(() => readClock(clock), {
        timeout: 5_000,
        message: "sim clock should advance before expanding",
      })
      .toBeGreaterThan(1);
    const before = await readClock(clock);

    // --- expand -------------------------------------------------------
    await expand.click();
    await expect(collapse).toBeVisible();
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await expect(
      figure,
      "expanded figure should own the viewport",
    ).toHaveCSS("position", "fixed");

    const across = await readClock(clock);
    expect(
      across,
      `sim clock went backwards across the toggle (${before}s -> ${across}s) — the figure remounted instead of swapping classes in place`,
    ).toBeGreaterThanOrEqual(before);
    await expect
      .poll(() => readClock(clock), {
        timeout: 5_000,
        message: "sim should still be running while expanded",
      })
      .toBeGreaterThan(across);

    await expect(pause, "transport survives the expand").toBeVisible();
    await expectNoHorizontalScroll(page, "lesson page with the figure expanded");
    await expectBodyScrollLocked(page, "while the figure is expanded");

    // --- Escape exits -------------------------------------------------
    await page.keyboard.press("Escape");
    await expect(expand).toBeVisible();
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expectFigureInFlow(figure, "after Escape");
    await expectBodyScrollReleased(page, "after leaving full screen");

    const afterExit = await readClock(clock);
    expect(
      afterExit,
      "sim clock reset on the way out of full screen",
    ).toBeGreaterThanOrEqual(across);

    expectQuiet(watcher, "while toggling full screen");
  });
});

test.describe("meter readouts", () => {
  test("keeps each metric value and unit on one readable baseline", async ({ page }) => {
    const watcher = watchConsole(page);
    await gotoAndSettle(page, DRIVEN.route);

    const figure = page.locator("figure").first();
    await figure.scrollIntoViewIfNeeded();
    const throughputMeter = figure
      .getByText("throughput", { exact: true })
      .locator("..");
    const reading = throughputMeter.locator("[data-meter-reading]");
    const value = reading.locator("[data-meter-value]");
    const unit = reading.locator("[data-meter-unit]");

    await expect(reading).toBeVisible();
    await expect(value).toBeVisible();
    await expect(unit).toBeVisible();
    const readingLayout = await reading.evaluate((el) => {
      const style = getComputedStyle(el);
      return { display: style.display, alignItems: style.alignItems };
    });
    // As a flex item, CSS blockifies `inline-flex` to `flex`; the essential
    // contract is still the baseline-aligned flex pair, not its outer display.
    expect(readingLayout.display).toBe("flex");
    expect(readingLayout.alignItems).toBe("baseline");

    const [valueBox, unitBox] = await Promise.all([
      value.boundingBox(),
      unit.boundingBox(),
    ]);
    expect(valueBox, "throughput value needs a measurable box").not.toBeNull();
    expect(unitBox, "throughput unit needs a measurable box").not.toBeNull();
    expect(
      Math.abs(unitBox!.y - valueBox!.y),
      "throughput value and unit should remain on the same meter row",
    ).toBeLessThan(valueBox!.height);
    expect(
      unitBox!.x,
      "throughput unit should begin after the numeric value, not overlap it",
    ).toBeGreaterThanOrEqual(valueBox!.x + valueBox!.width);

    await expectNoHorizontalScroll(page, "lesson page with meter readouts");
    expectQuiet(watcher, "while measuring the throughput meter");
  });
});

test.describe("no horizontal scroll at 390px", () => {
  for (const route of ROUTES) {
    test(`${route} fits the viewport`, async ({ page }) => {
      const watcher = watchConsole(page);
      await gotoAndSettle(page, route);

      await expectNoHorizontalScroll(page, route);

      // Also at the bottom of the page: sticky/absolute decoration (the ghost
      // index numeral, the next-lesson card) sits below the first screenful.
      await page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight),
      );
      await page.waitForTimeout(200);
      await expectNoHorizontalScroll(page, `${route} (scrolled to the end)`);

      expectQuiet(watcher, `on ${route}`);
    });
  }
});

test.describe("touch targets", () => {
  test("every slider carries a 44px hit area", async ({ page }) => {
    const watcher = watchConsole(page);
    await gotoAndSettle(page, DRIVEN.route);

    const figure = page.locator("figure").first();
    await figure.scrollIntoViewIfNeeded();

    const sliders = figure.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count, "the driven lesson should ship sliders").toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const slider = sliders.nth(i);
      const label = (await slider.getAttribute("aria-valuetext")) ?? `#${i}`;

      // WCAG 2.5.5. The visible track is 4px; `content-box` + 20px of
      // `padding-block` is what makes the *hit* box 44 (and the negative
      // margins hand the space back, so the row height is unchanged).
      const box = await slider.boundingBox();
      expect(box, `slider ${label} has no box`).not.toBeNull();
      expect(
        box!.height,
        `slider ${label} hit area is ${box!.height}px tall, under the 44px minimum`,
      ).toBeGreaterThanOrEqual(43.5);
      expect(
        box!.width,
        `slider ${label} is too narrow to drag`,
      ).toBeGreaterThanOrEqual(44);

      // ...and it is the app's own slider treatment doing it, not a UA default.
      const styling = await slider.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          appearance: cs.appearance,
          boxSizing: cs.boxSizing,
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          className: el.className,
        };
      });
      expect(styling.appearance, `slider ${label} keeps the UA thumb`).toBe(
        "none",
      );
      expect(
        styling.className,
        `slider ${label} is missing the .sim-slider / accent-accent hook`,
      ).toMatch(/(^|\s)(sim-slider|accent-accent)(\s|$)/);
      expect(styling.boxSizing, `slider ${label} sizing`).toBe("content-box");
      expect(styling.paddingTop).toBe(styling.paddingBottom);
    }

    // The row itself must not push the figure sideways once the sliders wrap.
    await expectNoHorizontalScroll(page, "lesson page control panel");

    expectQuiet(watcher, "while measuring sliders");
  });
});

/** `t=12.3s` → 12.3 */
async function readClock(clock: Locator): Promise<number> {
  const text = (await clock.textContent()) ?? "";
  const match = text.match(/t=(\d+(?:\.\d+)?)s/);
  return match ? Number(match[1]) : Number.NaN;
}

/** Route + title straight from the registry, so a rename fails loudly here. */
function lessonMeta(slug: string): { route: string; title: string } {
  const lesson = getLesson(slug);
  if (!lesson) throw new Error(`lesson "${slug}" is not in the registry`);
  return { route: lessonPath(lesson), title: lesson.title };
}
