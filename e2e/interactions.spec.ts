import { expect, test, type Locator, type Page } from "@playwright/test";

const LOAD_BALANCING = "/learn/scaling/load-balancing";

async function gotoAndSettle(page: Page, route: string) {
  const response = await page.goto(route);
  expect(response, `no response for ${route}`).not.toBeNull();
  expect(response!.ok(), `${route} responded ${response!.status()}`).toBeTruthy();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
}

/** `t=12.3s` → 12.3, avoiding false positives from nested container text. */
async function readClock(clock: Locator): Promise<number> {
  const text = (await clock.textContent()) ?? "";
  const match = text.match(/t=(\d+(?:\.\d+)?)s/);
  return match ? Number(match[1]) : Number.NaN;
}

test.describe("interactive learning flows", () => {
  test("simulation controls expose state, respond to parameters, and support keyboard node failures", async ({
    page,
  }) => {
    await gotoAndSettle(page, LOAD_BALANCING);

    const figure = page.locator("figure").first();
    await figure.scrollIntoViewIfNeeded();

    // Figures may have scroll-autoplayed far enough to open a checkpoint while
    // the page settled. Restart establishes the same deterministic, paused
    // frame every run, so this test exercises controls rather than viewport
    // timing.
    await figure.getByRole("button", { name: "Restart simulation" }).click();

    const play = figure.getByRole("button", { name: "Play simulation" });
    const pause = figure.getByRole("button", { name: "Pause simulation" });
    const clock = figure.locator("span.tech-num").filter({
      hasText: /^t=\d+(\.\d+)?s$/,
    });

    await expect(play).toBeEnabled();
    await expect(play).toHaveAttribute("aria-pressed", "false");
    await play.click();
    await expect(pause).toBeVisible();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await expect(figure.getByText("Simulation playing.")).toHaveCount(1);

    const before = await readClock(clock);
    await expect
      .poll(() => readClock(clock), { timeout: 3_000 })
      .toBeGreaterThan(before);

    await pause.click();
    await expect(play).toBeVisible();
    await expect(figure.getByText(/Simulation paused at \d+\.\d+ seconds\./)).toHaveCount(1);

    const strategy = figure.getByRole("radiogroup", { name: "strategy" });
    const leastConnections = strategy.getByRole("radio", { name: "least-conn" });
    await leastConnections.click();
    await expect(leastConnections).toHaveAttribute("aria-checked", "true");

    const api2 = figure.locator(
      'svg[data-sim-stage] [role="button"][aria-label^="api-2"]',
    );
    await api2.focus();
    await page.keyboard.press("Enter");
    await expect(api2).toHaveAttribute("aria-label", /status: dead/);
    await page.keyboard.press("Enter");
    await expect(api2).toHaveAttribute("aria-label", /status: healthy/);
  });

  test("workbench event path seeks deterministically and exposes a static state view", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/learn/scaling/client-server");
    const figure = page.locator("figure").first();
    await figure.scrollIntoViewIfNeeded();
    await figure.getByRole("button", { name: "Restart simulation" }).click();

    const impact = figure.getByRole("button", {
      name: /Queue growth becomes user latency/,
    });
    await impact.click();

    await expect(impact).toHaveAttribute("aria-pressed", "true");
    await expect(figure.getByRole("heading", { name: "Queue growth becomes user latency" })).toBeVisible();
    await expect(figure.getByRole("slider", { name: "Timeline" })).toHaveValue("15.2");
    await expect(figure.getByText("Simulation paused at 15.2 seconds.")).toBeVisible();

    const staticState = figure.locator(".causal-static-toggle");
    await expect(staticState).toHaveAttribute("aria-pressed", "false");
    await staticState.click();
    await expect(staticState).toHaveAttribute("aria-pressed", "true");
    await expect(staticState).toHaveAccessibleName("Live motion");
  });

  test("an answered prediction checkpoint can close without advancing the simulation", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/learn/scaling/scaling-strategies");
    const figure = page.locator("figure").first();
    await figure.scrollIntoViewIfNeeded();
    await figure.getByRole("button", { name: "Restart simulation" }).click();

    // Seek immediately before the checkpoint, then play through the real tick
    // that fires it. Seeking past a checkpoint intentionally forfeits it.
    const timeline = figure.getByRole("slider", { name: "Timeline" });
    await timeline.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!setter) throw new Error("no native range value setter");
      setter.call(input, String(value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, 12.9);

    await figure.getByRole("button", { name: "Play simulation" }).click();
    const quiz = figure.getByRole("alertdialog");
    await expect(quiz).toBeVisible();
    await expect(quiz).toHaveAttribute("aria-modal", "true");
    await expect(quiz).toHaveAccessibleDescription(
      "Choose one prediction. The simulation is paused until you answer.",
    );

    const firstChoice = quiz.getByRole("button", {
      name: "Vertical — the one big box IS the fleet: capacity → 0",
    });
    const lastChoice = quiz.getByRole("button", {
      name: "Same either way: capacity is capacity",
    });
    await expect(firstChoice).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(lastChoice).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(firstChoice).toBeFocused();
    await firstChoice.click();

    await expect(
      quiz.locator("p:not(.sr-only)").filter({
        hasText: /Vertical concentrates every request/,
      }),
    ).toBeVisible();
    const close = quiz.getByRole("button", { name: "Close and inspect" });
    const resume = quiz.getByRole("button", { name: "Watch it happen" });
    await expect(close).toBeVisible();
    await expect(resume).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(resume).toBeFocused();

    const clock = figure.locator("span.tech-num").filter({
      hasText: /^t=\d+(\.\d+)?s$/,
    });
    await page.keyboard.press("Escape");

    await expect(quiz).toHaveCount(0);
    const play = figure.getByRole("button", { name: "Play simulation" });
    await expect(play).toBeVisible();
    await expect(figure).toBeFocused();
    // Snapshot publication can land one final 10Hz readout just as the dialog
    // closes. Sample after the new paused state is visible, then prove it holds.
    const pausedAt = await clock.textContent();
    await page.waitForTimeout(250);
    await expect(clock).toHaveText(pausedAt ?? "");
  });

  test("appearance control changes the document theme and persists the learner preference", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/");

    const root = page.locator("html");
    const before = await root.getAttribute("data-theme");
    expect(before === "light" || before === "dark").toBeTruthy();
    const after = before === "dark" ? "light" : "dark";

    await page
      .getByRole("button", { name: `Switch to ${after} mode` })
      .click();
    await expect(root).toHaveAttribute("data-theme", after);
    await expect(
      page.getByRole("button", {
        name: `Switch to ${before === "dark" ? "dark" : "light"} mode`,
      }),
    ).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(root).toHaveAttribute("data-theme", after);
  });

  test("personalization panel saves a custom accent and reading size", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/");

    await page
      .getByRole("button", { name: "Customize color and reading size" })
      .click();

    await page.getByRole("radio", { name: "Plum accent" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.style.getPropertyValue("--user-accent"),
        ),
      )
      .toBe("#7453A6");

    await page.getByTitle("Comfortable").click();
    await expect(page.locator("html")).toHaveAttribute("data-reading-size", "comfortable");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-reading-size", "comfortable");
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.style.getPropertyValue("--user-accent"),
        ),
      )
      .toBe("#7453A6");
  });

  test("lesson wayfinding exposes learning state, concept links, and calibration mode", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/learn/scaling/scaling-strategies");

    const article = page
      .locator("article")
      .filter({
        has: page.getByRole("heading", { name: "Vertical vs Horizontal Scaling" }),
      })
      .first();
    await expect(article.getByText("learning state", { exact: true })).toBeVisible();
    await expect(article.getByText("Where this idea goes next", { exact: true })).toBeVisible();
    await expect(
      article.getByRole("link", { name: "leads to Load Balancing" }),
    ).toBeVisible();

    const readingMode = article
      .locator('button[aria-pressed]')
      .filter({ hasText: /Reading mode|Return to experiment/ });
    await expect(readingMode).toHaveAccessibleName("Enter reading mode");
    await readingMode.click();
    await expect(readingMode).toHaveAttribute("aria-pressed", "true");
    await expect(article).toHaveAttribute("data-calibration", "true");
    await expect(article.locator(".calibration-secondary").first()).toBeHidden();
    await expect(article.getByText("Event path", { exact: true })).toBeVisible();

    const experimentMode = article.getByRole("button", { name: "Return to experiment mode" });
    await experimentMode.click();
    await expect(article).not.toHaveAttribute("data-calibration", "true");
    await expect(article.getByRole("button", { name: "Enter reading mode" })).toBeVisible();
  });

  test("review answers reveal explanation and can be retried without recording progress", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/review");

    const firstChoice = page.getByRole("button", {
      name: "Latency climbs, then requests start getting dropped",
    });
    await firstChoice.click();

    await expect(firstChoice).toBeDisabled();
    const visibleVerdict = page
      .locator("p:not(.sr-only)")
      .filter({
        hasText:
          /Correct — that is the system behavior to expect\.|Not quite — the correct answer was/,
      });
    await expect(visibleVerdict).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask again" })).toBeVisible();

    await page.getByRole("button", { name: "Ask again" }).click();
    await expect(firstChoice).toBeEnabled();
    await expect(visibleVerdict).toHaveCount(0);
  });

  test("personalization radios support keyboard selection and return focus on Escape", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/");

    const trigger = page.getByRole("button", {
      name: "Customize color and reading size",
    });
    await trigger.click();
    const panel = page.getByRole("region", { name: "Appearance preferences" });
    const reset = panel.getByRole("button", { name: "Reset" });
    await expect(reset).toBeFocused();

    const cobalt = panel.getByRole("radio", { name: "Cobalt accent" });
    const teal = panel.getByRole("radio", { name: "Teal accent" });
    await cobalt.focus();
    await page.keyboard.press("ArrowRight");
    await expect(teal).toBeFocused();
    await expect(teal).toHaveAttribute("aria-checked", "true");

    const defaultSize = panel.getByRole("radio", { name: "Default reading size" });
    const comfortable = panel.getByRole("radio", { name: "Comfortable reading size" });
    await defaultSize.focus();
    await page.keyboard.press("End");
    await expect(comfortable).toBeFocused();
    await expect(comfortable).toHaveAttribute("aria-checked", "true");

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("review feedback moves focus to recovery and back to the first answer", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/review");

    const firstChoice = page.getByRole("button", {
      name: "Latency climbs, then requests start getting dropped",
    });
    await firstChoice.click();
    const askAgain = page.getByRole("button", { name: "Ask again" });
    await expect(askAgain).toBeFocused();

    await askAgain.click();
    await expect(firstChoice).toBeFocused();
    await expect(firstChoice).toBeEnabled();
  });

  test("progress import reports a merge and reset requires deliberate confirmation", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/learn");

    const payload = {
      app: "syslab",
      version: 2,
      exportedAt: "2026-01-01T00:00:00.000Z",
      state: {
        completedSections: { "scaling/client-server": ["why"] },
        quizAnswers: {},
        lastVisited: { lessonSlug: "scaling/client-server", sectionId: "why" },
      },
    };

    await page.locator('input[type="file"]').setInputFiles({
      name: "syslab-progress.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(payload)),
    });

    await expect(page.getByText(/Merged 1 section and 0 checkpoints across 1 lesson\./)).toBeVisible();

    const reset = page.getByRole("button", { name: "Reset all" });
    await expect(reset).toBeEnabled();
    await reset.click();

    const confirm = page.getByRole("textbox", { name: "Type reset to confirm" });
    await expect(confirm).toBeVisible();
    await confirm.fill("reset");
    await page.getByRole("button", { name: "Erase everything" }).click();
    await expect(page.getByText("All progress cleared on this device.")).toBeVisible();
  });
});
