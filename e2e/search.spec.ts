import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { allLessons, lessonPath, trackOfLesson } from "@/lib/curriculum";

/**
 * The ⌘K curriculum search — one interaction spec against the built export.
 *
 * WHAT THIS PINS, and why each matters:
 *   1. It opens from a learn-area page via the keyboard alone (Cmd+K / Ctrl+K),
 *      which is the whole point: a lesson in another track is unreachable by
 *      browsing the active-track sidebar, so the palette is the cross-track jump.
 *   2. The combobox a11y contract is wired: role=combobox owning the listbox,
 *      aria-activedescendant tracking the active role=option, arrows moving it,
 *      Enter navigating.
 *   3. It disambiguates across tracks — a query is shown with its TRACK badge,
 *      and Enter lands on `lessonPath()` for a lesson in a DIFFERENT track than
 *      the one we started on.
 *   4. Escape closes and restores focus to the trigger (no keyboard trap).
 *   5. axe is clean (wcag2a/aa) with the dialog open.
 *
 * The palette trigger lives in the desktop sidebar (≥ md), so this runs at a
 * desktop viewport. The open shortcut is a document listener and works
 * regardless, but the visible trigger and focus-restore target need md.
 */

// A track-01 lesson to start on, and a lesson in a DIFFERENT track to jump to —
// both derived from the registry so a curriculum reshuffle cannot rot them.
const available = allLessons.filter((l) => l.status === "available");
const START = available.find(
  (l) => trackOfLesson(l).slug === "system-design-fundamentals",
)!;
// A concurrency (track 02) lesson: proves the cross-track reach.
const TARGET = available.find(
  (l) => trackOfLesson(l).slug === "concurrency",
)!;

const START_ROUTE = lessonPath(START);
const TARGET_ROUTE = lessonPath(TARGET);

// A modifier that is Meta on macOS, Control elsewhere. The component listens
// for either; Control works on the Linux CI browser.
const OPEN = "Control+k";

async function open(page: Page) {
  await page.keyboard.press(OPEN);
  const dialog = page.getByRole("dialog", { name: "Search the curriculum" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe("⌘K curriculum search", () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto(START_ROUTE);
    expect(response?.ok(), `${START_ROUTE} did not load`).toBeTruthy();
    await page.waitForLoadState("networkidle");
    // Hydration gate: the trigger is client-rendered.
    await expect(
      page.getByRole("button", { name: "Search lessons" }),
    ).toBeVisible();
  });

  test("opens with the keyboard and jumps to a lesson in another track", async ({
    page,
  }) => {
    const dialog = await open(page);

    const input = dialog.getByRole("combobox");
    await expect(input).toBeFocused();
    // Combobox contract: it owns a listbox and is expanded.
    await expect(input).toHaveAttribute("aria-expanded", "true");
    const listboxId = await input.getAttribute("aria-controls");
    expect(listboxId).toBeTruthy();
    await expect(dialog.locator(`#${listboxId}`)).toHaveRole("listbox");

    // Narrow to the cross-track target, then confirm it is actually there with
    // its TRACK label — disambiguation is the feature.
    await input.fill(TARGET.title);
    const options = dialog.getByRole("option");
    await expect(options.first()).toBeVisible();
    await expect(dialog.getByRole("option", { name: new RegExp(escapeRe(TARGET.title)) }))
      .toBeVisible();
    await expect(
      dialog.getByText(trackOfLesson(TARGET).title, { exact: false }),
    ).toBeVisible();

    // aria-activedescendant points at a real option that is aria-selected.
    const activeId = await input.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    await expect(dialog.locator(`#${activeId}`)).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Enter navigates via lessonPath() to the OTHER track's lesson.
    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${escapeRe(TARGET_ROUTE)}/?$`));
    // And the dialog is gone.
    await expect(
      page.getByRole("dialog", { name: "Search the curriculum" }),
    ).toHaveCount(0);
  });

  test("arrow keys move the active option and the live region announces counts", async ({
    page,
  }) => {
    const dialog = await open(page);
    const input = dialog.getByRole("combobox");

    const firstActive = await input.getAttribute("aria-activedescendant");
    await input.press("ArrowDown");
    const secondActive = await input.getAttribute("aria-activedescendant");
    expect(secondActive).not.toEqual(firstActive);
    await expect(dialog.locator(`#${secondActive}`)).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // ArrowUp returns to the first option.
    await input.press("ArrowUp");
    await expect(input).toHaveAttribute("aria-activedescendant", firstActive!);

    // Polite live region reports the count as the query narrows.
    const status = dialog.getByRole("status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await input.fill("zzzznomatch");
    await expect(status).toContainText(/0 lessons found/i);
    await expect(dialog.getByRole("option")).toHaveCount(1); // the empty-state row
  });

  test("Escape closes and restores focus to the trigger", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Search the curriculum" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Search lessons" }),
    ).toBeFocused();
  });

  test("the open dialog has no WCAG A/AA violations", async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByRole("combobox").fill("cache");
    await expect(dialog.getByRole("option").first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const ids = results.violations.map((v) => v.id);
    expect(ids, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});

/** Escape a string for use inside a RegExp. */
function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
