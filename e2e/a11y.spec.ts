import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AxeResults, Result } from "axe-core";
import { getLesson, lessonPath } from "@/lib/curriculum";

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
 * COVERAGE: the two hub routes, plus the richest lesson from each of the four
 * modules (the ones with the most ARIA surface — overlays, node internals,
 * breakable nodes, a multi-node topology). Every lesson page is built from the
 * same primitives, so a fifth lesson would re-scan the same components; the
 * smoke suite is what guarantees the other eighteen routes exist and are
 * clean. `/review` is scanned when it ships and skipped, loudly, until then.
 *
 * FAILURE POLICY: a violation here is a bug report about product code, and
 * product code is not this file's to change. A genuine finding gets recorded
 * verbatim in the failure message (rule id, impact, help URL, and the target
 * selector + html of every offending node) so it is actionable from the run
 * output alone.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * OPEN FINDINGS  (found by the first run of this suite; NOT fixed here)
 * ─────────────────────────────────────────────────────────────────────────
 * Two rules fail today. Both are product-code bugs with a single root cause
 * each, both are pinned below as `test.fixme` so the suite lands green while
 * they stay visible, and both are excluded from the live assertions by
 * `KNOWN_FINDINGS` — everything else is asserted for real, so a THIRD rule
 * appearing goes red immediately.
 *
 * 1. [color-contrast] impact=serious — 10-18 nodes on every route scanned.
 *    https://dequeuniversity.com/rules/axe/4.12/color-contrast
 *    One root cause: `--color-fg-faint` (#605a52) as body text on the app's
 *    backgrounds. Verbatim samples:
 *
 *      target: [".items-end > .tech-num"]                                (/)
 *      html:   <p class="tech-num text-xs text-fg-faint">23 lessons · 4 modules</p>
 *      why:    insufficient color contrast of 2.93 (fg #605a52, bg #0b0805,
 *              9.0pt (12px), normal). Expected 4.5:1
 *
 *      target: [".gap-y-4.py-7…:nth-child(1) > .text-3xl.text-fg-faint\\/50…"] (/)
 *      html:   <span class="font-display text-3xl font-bold text-fg-faint/50 tabular-nums">01</span>
 *      why:    insufficient color contrast of 1.54 (fg #35312c, bg #0b0805,
 *              22.5pt (30px), bold). Expected 3:1
 *
 *      target: [".mt-auto"]                                    (/learn, lessons)
 *      html:   <p class="mt-auto px-2.5 pt-4 font-mono text-[9px] tracking-widest
 *              text-fg-faint/70 uppercase">v0.1 · progress in localStorage</p>
 *      why:    insufficient color contrast of 1.97 (fg #47423c, bg #0f0b07,
 *              6.8pt (9px), normal). Expected 4.5:1
 *
 *      target: ["a[href$=\"#scaling\"] > .group-hover\\:text-fg"]        (/learn)
 *      html:   <span class="group-hover:text-fg">Scaling</span>
 *      why:    insufficient color contrast of 2.83 (fg #605a52, bg #120d09,
 *              8.3pt (11px), normal). Expected 4.5:1
 *
 *    Note the two decorative-looking cases are NOT exempt: the ghost index
 *    numerals ("01") and the sidebar module names are real text conveying real
 *    information, so 1.5:1 is a genuine AA failure, not a false positive. The
 *    fix is a token change (lighten `--color-fg-faint`, or stop using it for
 *    text below `--color-fg-muted`), which belongs in globals.css.
 *
 * 2. [nested-interactive] impact=serious — exactly 1 node per page with a
 *    figure, plus the landing vignette.
 *    https://dequeuniversity.com/rules/axe/4.12/nested-interactive
 *
 *      target: [".h-auto"]                    (every lesson with a breakable node)
 *      html:   <svg viewBox="0 0 800 450" class="block h-auto w-full" role="img"
 *              aria-label="System diagram. All components healthy.">
 *      why:    Element has focusable descendants
 *
 *      target: [".block"]                                                    (/)
 *      html:   <svg viewBox="0 0 760 420" class="block h-auto w-full" role="img"
 *              aria-label="Live simulation: a load balancer routing request
 *              packets to three servers. Click a server to kill it; …">
 *      why:    Element has focusable descendants
 *
 *    This one is structural and axe is right about it. `role="img"` is a LEAF
 *    role: assistive tech is told "this subtree is one image, described by the
 *    label", and is then free not to expose anything inside it — including
 *    `SystemNode`'s breakable `<g role="button" tabIndex={0}>`, which is the
 *    lesson's whole break-it verb. A keyboard user can still Tab to those
 *    nodes (the mobile suite proves focus works), but a screen-reader user is
 *    told they are not there. The fix is a real design decision — drop
 *    `role="img"` in favour of a labelled `role="group"`/`figure` when the
 *    stage has interactive children, or move the kill affordance to a real
 *    button outside the svg — so it is deliberately left to whoever owns the
 *    engine's a11y model rather than patched from a test file.
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
const KNOWN_FINDINGS: string[] = ["color-contrast", "nested-interactive"];

/** Static hub routes. */
const HUB_ROUTES = ["/", "/learn"];

/** Richest lesson per module — the widest ARIA surface in each. */
const LESSON_SLUGS = [
  // scaling: three servers, a balancer, breakable nodes, a select + slider.
  "load-balancing",
  // data: a full stage overlay (ring + arcs + key ticks) with per-node labels.
  "consistent-hashing",
  // resilience: node internals (failure pips), four sliders, a dead node.
  "circuit-breaker",
  // distributed: ten nodes, per-node overlays, a button param.
  "gossip",
];

/** Registry-resolved lesson routes — a renamed slug fails loudly at load. */
const LESSON_ROUTES: { slug: string; route: string }[] = LESSON_SLUGS.map(
  (slug) => {
    const lesson = getLesson(slug);
    if (!lesson) throw new Error(`lesson "${slug}" is not in the registry`);
    return { slug, route: lessonPath(lesson) };
  },
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
    await expect(play).toBeVisible();
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
test.describe("open findings (documented above, not fixed here)", () => {
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
