import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AxeResults, Result } from "axe-core";
import { allLessons, lessonPath } from "@/lib/curriculum";

/**
 * Automated accessibility scanning (axe-core) over the shipped static export.
 *
 * SCOPE, honestly stated. axe catches roughly a third of WCAG failures — the
 * machine-checkable third: missing names, broken ARIA, contrast, heading and
 * landmark structure, orphaned form controls. It cannot judge whether the
 * stage's live description is *useful*, whether the caption region announces
 * at a readable pace, or whether a killed node is discoverable by keyboard.
 * Those are covered, as far as they can be, by the mobile suite's focus
 * assertions and by review. A green run here means "no known-broken
 * semantics", not "accessible".
 *
 * WHAT THE PAGES CONTAIN that is worth watching: the stage is an
 * `svg[role="img"]` whose `aria-label` is regenerated per snapshot; breakable
 * nodes are `role="button"` `<g>`s *inside* it; the caption is a
 * `role="status"` live region; meters use `role="meter"`; the prediction quiz
 * is an `alertdialog`. All of that is legitimate ARIA, and axe is expected to
 * be quiet about it — but it is exactly the sort of hand-rolled semantics that
 * a refactor breaks silently, which is why this suite exists.
 *
 * COVERAGE: the two hub routes and every lesson route in the curriculum. Shared
 * primitives make representative sampling useful during early development, but
 * a release-quality audit must also catch authored controls, labels, meter
 * units, captions, and workbench metadata unique to an individual lesson.
 * `/review` is scanned when it ships and skipped, loudly, until then.
 *
 * FAILURE POLICY: a violation here is a bug report about product code, and
 * product code is not this file's to change. A genuine finding gets recorded
 * verbatim in the failure message (rule id, impact, help URL, and the target
 * selector + html of every offending node) so it is actionable from the run
 * output alone.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FORMER FINDINGS  (fixed and now enforced)
 * ─────────────────────────────────────────────────────────────────────────
 * The initial scan identified two serious WCAG failures: low-contrast
 * secondary text and focusable server controls nested under an SVG `img` role.
 * Product code now uses an accessible faint-text token, avoids low-opacity
 * status copy, and gives interactive SVG stages a labelled `group` role so
 * their server controls remain available to assistive technology. The
 * suppression list below is intentionally empty; any recurrence fails this
 * suite on every sampled route.
 */

/**
 * The two tag families that mean "this is a conformance failure", not a
 * suggestion. Deliberately NOT including `best-practice`: it flags things like
 * "all content should be in a landmark", which is a design opinion rather than
 * a WCAG failure, and folding opinions into a red build is how a11y suites get
 * disabled.
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa"] as const;

/**
 * Rules with an OPEN, documented finding (see the header). Excluded from the
 * live assertions so the suite is green and every *other* rule is genuinely
 * asserted; each is separately pinned by a `test.fixme` below, which is what
 * keeps them from being quietly forgotten.
 *
 * Deleting an entry from this list is the last step of fixing it — do that,
 * drop the matching `test.fixme`, and the rule is enforced from then on.
 */
// Contrast tokens and interactive-stage semantics are fixed in product code.
// Keep this list empty so every WCAG A/AA rule, including the former findings,
// is enforced on every sampled route.
const KNOWN_FINDINGS: string[] = [];

/** Static hub routes. */
const HUB_ROUTES = ["/", "/learn"];

/** Registry-resolved lesson routes — every authored interactive surface. */
const LESSON_ROUTES: { slug: string; route: string }[] = allLessons.map(
  (lesson) => ({ slug: lesson.slug, route: lessonPath(lesson) }),
);

/** Built by a sibling; scanned the moment it exists (see the test). */
const REVIEW_ROUTE = "/review";

/**
 * How long a figure gets to autoplay itself before we conclude it is not
 * going to. Generous relative to the ~300ms hydration takes, short enough
 * that a page full of `autoplay={false}` figures does not stall the run.
 */
const AUTOPLAY_TIMEOUT_MS = 5_000;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

async function gotoAndSettle(page: Page, route: string) {
  const response = await page.goto(route);
  expect(response, `no response for ${route}`).not.toBeNull();
  await page.waitForLoadState("networkidle");
  return response!;
}

/**
 * Stop the lesson's sim before scanning.
 *
 * A running figure rewrites the stage's `aria-label`, the caption live region
 * and every meter's `aria-valuenow` ~10 times a second. axe walks a live DOM,
 * so scanning mid-run is both slower and capable of producing results that
 * describe a tree that no longer exists. Pausing costs one click and makes the
 * scan describe a single, quiet frame.
 *
 * Waiting for the transport to flip to "Pause" is also the hydration gate the
 * smoke suite uses — scanning the un-hydrated HTML would miss every
 * client-rendered control.
 *
 * A figure that never flips is not treated as a failure: `autoplay={false}`
 * is a legitimate prop, and this helper also runs over pages this suite does
 * not own (/review). In that case the transport must still be sitting on
 * "Play" — which is a weaker gate, but a figure that never rendered a
 * transport at all still fails.
 */
async function pauseFigures(page: Page): Promise<void> {
  const figures = page.locator("figure");
  const count = await figures.count();

  for (let i = 0; i < count; i += 1) {
    const figure: Locator = figures.nth(i);
    await figure.scrollIntoViewIfNeeded();
    const pause = figure.getByRole("button", { name: "Pause simulation" });
    const play = figure.getByRole("button", { name: "Play simulation" });

    const autoplayed = await pause
      .waitFor({ state: "visible", timeout: AUTOPLAY_TIMEOUT_MS })
      .then(
        () => true,
        () => false,
      );

    if (!autoplayed) {
      await expect(
        play,
        `figure #${i} rendered no usable transport — it never hydrated`,
      ).toBeVisible();
      continue;
    }

    await pause.click();
    // Clicking the visible pause control is the transport contract this helper
    // needs before scanning. A deterministic figure can immediately change to
    // a quiz, restart, or another lesson-owned state, so its next label is not
    // a stable accessibility assertion here (dedicated interaction tests cover
    // that state transition).
    await page.waitForTimeout(50);
  }

  // Scroll back so the scan starts from the top of the document, and let the
  // dwell observers in `LessonSection` finish whatever they were going to do
  // to the progress rings.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

function scan(page: Page): Promise<AxeResults> {
  return new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
}

/**
 * Render violations so a failure is a bug report, not a number. One block per
 * rule, then every offending node's selector and its html — which is enough to
 * find the component without re-running anything.
 */
function report(route: string, violations: Result[]): string {
  const lines = [
    `${violations.length} axe violation(s) on ${route} at ${WCAG_TAGS.join(" + ")}:`,
  ];
  for (const v of violations) {
    lines.push(
      "",
      `  [${v.id}] impact=${v.impact ?? "n/a"} — ${v.help}`,
      `  ${v.helpUrl}`,
    );
    for (const node of v.nodes) {
      lines.push(`    target: ${JSON.stringify(node.target)}`);
      lines.push(`    html:   ${node.html}`);
      const detail = [...node.any, ...node.all, ...node.none]
        .map((c) => c.message)
        .filter(Boolean);
      for (const message of detail) lines.push(`    why:    ${message}`);
    }
  }
  return lines.join("\n");
}

/**
 * Scan and assert. `ignore` drops rules with an open finding (see the header);
 * everything else must be clean.
 *
 * Asserts on the rule IDS, not the raw `violations` array: axe's node objects
 * are deep, and `toEqual([])` against them buries the actual finding under
 * several screens of serialized diff. The ids keep the failure line readable;
 * `report` carries the evidence.
 */
async function expectNoViolations(
  page: Page,
  route: string,
  ignore: string[] = KNOWN_FINDINGS,
) {
  const results = await scan(page);
  const found = results.violations.filter((v) => !ignore.includes(v.id));
  expect(found.map((v) => v.id), report(route, found)).toEqual([]);
}

/* ------------------------------------------------------------------ *
 * Suites
 * ------------------------------------------------------------------ */

test.describe("hub routes have no WCAG A/AA violations", () => {
  for (const route of HUB_ROUTES) {
    test(`${route}`, async ({ page }) => {
      await gotoAndSettle(page, route);
      await expectNoViolations(page, route);
    });
  }
});

test.describe("lesson pages have no WCAG A/AA violations", () => {
  for (const { slug, route } of LESSON_ROUTES) {
    test(`${slug}`, async ({ page }) => {
      await gotoAndSettle(page, route);
      await pauseFigures(page);
      await expectNoViolations(page, route);
    });
  }
});

test.describe("review route", () => {
  test("has no WCAG A/AA violations", async ({ page }) => {
    const response = await page.goto(REVIEW_ROUTE);
    // The static export has no server-side routing: a route that has not
    // shipped is a 404 from the host. Skip rather than fail — this suite must
    // not go red for a page that does not exist yet — but skip *loudly*, so
    // the moment /review lands the run stops being silent about it.
    test.skip(
      !response || response.status() === 404,
      `${REVIEW_ROUTE} is not in the export yet — nothing to scan`,
    );

    await page.waitForLoadState("networkidle");
    await pauseFigures(page);
    await expectNoViolations(page, REVIEW_ROUTE);
  });
});

/**
 * The open findings, pinned one test per rule.
 *
 * `test.fixme` rather than `test.fail`: fixme says "known bug, do not run
 * this", which is the honest description — the assertion below is correct and
 * would fail today, and running it every time would print the same wall of
 * evidence forever. (`test.fail` is the self-cleaning alternative: it runs,
 * expects failure, and goes red the day someone fixes the product. Worth
 * switching to if these linger.)
 *
 * TO WORK ON ONE: delete `.fixme` from its test and run the file. Every other
 * known rule stays ignored, so the output is just that rule's offending nodes,
 * on every sampled route, with selectors and html.
 */
test.describe("former findings remain clean", () => {
  for (const rule of KNOWN_FINDINGS) {
    const others = KNOWN_FINDINGS.filter((id) => id !== rule);

    test.fixme(`${rule} is clean on every sampled route`, async ({ page }) => {
      for (const route of HUB_ROUTES) {
        await gotoAndSettle(page, route);
        await expectNoViolations(page, route, others);
      }
      for (const { route } of LESSON_ROUTES) {
        await gotoAndSettle(page, route);
        await pauseFigures(page);
        await expectNoViolations(page, route, others);
      }
    });
  }
});
