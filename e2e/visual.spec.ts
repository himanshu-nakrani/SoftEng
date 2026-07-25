import { expect, test, type Locator, type Page } from "@playwright/test";
import { allLessons, getLesson, lessonPath } from "@/lib/curriculum";
import type { LessonMeta } from "@/curriculum/types";

/**
 * Pixel regression for the simulation stage.
 *
 * WHY THIS IS POSSIBLE HERE AT ALL. A lesson run is a pure function of
 * (seed, params, tick count) — `SimRunner.seekTo` is documented as exactly
 * that: `restart()` plus silent ticks. The transport bar exposes it as a
 * range input (aria-label "Timeline") whose change handler calls `seekTo`.
 * So "the stage of lesson X at seed 42, t=12" is a single, reproducible
 * world, and once the sim is paused there nothing on the stage moves:
 * packets are attribute-driven from the sim clock by `PacketLayer` (never
 * CSS/WAAPI), and the 10Hz snapshot store only publishes while playing.
 *
 * WHAT IT CATCHES that nothing else in this repo does: design-token and CSS
 * regressions (a packet colour that stopped resolving `--color-*`, a meter
 * fill that inverted), overlay drift (the hash ring, the keyspace strip, the
 * token gauge, the boot countdown — all hand-built SVG geometry with no unit
 * test), and layout breaks inside the figure. The goldens in
 * `src/lessons/__tests__/goldens/` pin the *numbers*; this pins the picture.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * REGEN PROTOCOL  (mirrors the goldens' — see CLAUDE.md)
 * ─────────────────────────────────────────────────────────────────────────
 * A missing snapshot bootstraps itself on first run, exactly like a golden.
 * After a DELIBERATE visual change:
 *
 *     npm run build                                   # snapshots pin the export
 *     npx playwright test e2e/visual.spec.ts --update-snapshots
 *     git diff --stat e2e/visual.spec.ts-snapshots    # eyeball EVERY png
 *
 * then commit the pngs with the change that caused them. A diff you cannot
 * explain in one sentence is a regression, not an update — the same rule the
 * golden runs live by. Re-run once more without the flag: a clean second run
 * is the only proof the new baseline is stable.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HONEST LIMITS — read before trusting a red run
 * ─────────────────────────────────────────────────────────────────────────
 * These pngs are RASTERIZER-DEPENDENT. They pin (a) the Chromium build, and
 * (b) the host's FreeType/fontconfig, which decides how every glyph is
 * antialiased and hinted. Playwright already namespaces snapshots by project
 * and platform (`…-chromium-linux.png`), but that is a *platform* tag, not a
 * distro tag: the same Chromium on a different Linux renders text a hair
 * differently. So:
 *
 *   - LOCAL DETERMINISM IS THE CONTRACT. On one machine, with one browser,
 *     these are exact — that is what makes them a useful review gate.
 *   - `maxDiffPixelRatio` (below) buys back subpixel noise, not layout. A
 *     moved node or a changed hue blows past it immediately.
 *   - Two glyph classes fall OUTSIDE the self-hosted latin subset and land on
 *     a system fallback font, so they are the first thing to smear across
 *     machines: the superscript digits in the fanout stage
 *     (`SUPERSCRIPT` in fanout-figure.tsx, e.g. 10⁵) and the emoji/dingbats
 *     in timeline captions (☠ ⚡ 🚀 …). The caption is hidden for every shot
 *     below (see `hideCaption`); fanout's superscripts are drawn inside the
 *     stage itself and cannot be.
 *
 * CI: gated OFF by default (see CI_GATE). CI runs `npx playwright install
 * chromium`, which pins the same Chromium revision this repo's Playwright
 * wants — but on a GitHub `ubuntu-latest` image, whose font stack is not this
 * one. Bootstrapping a baseline here and asserting it there would be a
 * coin flip, and a red CI that nobody can reproduce is worse than no suite.
 * To turn it on, generate the baseline in the SAME image CI uses (the
 * `mcr.microsoft.com/playwright` container is the standard answer), commit
 * those pngs, then set PW_VISUAL=1 on the e2e step. Raising
 * `maxDiffPixelRatio` is the cheaper, blunter alternative.
 */

/* ------------------------------------------------------------------ *
 * Policy
 * ------------------------------------------------------------------ */

/**
 * Opt-in on CI. Locally this is always on; see the CI note above for what it
 * takes to flip it. `PW_VISUAL=1 npm run test:e2e` opts in anywhere.
 */
const CI_GATE = Boolean(process.env.CI) && !process.env.PW_VISUAL;

/** Sim-second every lesson is seeked to unless T_OVERRIDES says otherwise. */
const DEFAULT_T = 12;

/**
 * Where a lesson's signature moment is NOT t=12. Each was chosen by reading
 * the sim's `timeline` and then replaying it headlessly at seed 42 to confirm
 * the frame is actually worth pinning — a frame with one packet on it pins
 * almost nothing. Preference order: a scripted failure is visible (dead or
 * degraded nodes, drop/limited packets), several packet *types* are in
 * flight, and the moment is not sitting exactly on a beat's tick.
 *
 * Every value must land inside the lesson's scrub range, which is
 * `max(furthestT, lastScriptedBeat + 2, 10)` — asserted per test, so a
 * shortened timeline fails loudly here instead of silently clamping.
 */
const T_OVERRIDES: Record<string, number> = {
  // t=12 is a single response dot mid-flight. 17 is inside the 3x spike:
  // requests, responses AND red drops on the wire, queue chip loaded.
  "client-server": 17,
  // The kill beat fires exactly ON t=12; 13.5 steps off the boundary and
  // catches api-3 dead while the health checks still route into the corpse.
  "load-balancing": 13.5,
  // The provisioning gap: two ghost nodes counting down their boot, queues
  // full, requests shedding. This is also the boot-countdown composite.
  autoscaling: 18.5,
  // Deploy severs every client: chat-1 dead + three degraded clients, which
  // is the only frame where this lesson renders a failed topology.
  "realtime-delivery": 18.5,
  // The remap preview lights the keyspace strip (remapped ≈ 81%); at t=12 the
  // strip is inert. Also the keyspace-strip composite.
  sharding: 13.5,
  // The retry storm after recovery — amplification ~4.6x, drops and retries
  // stacked on the wire. t=12 is a quiet, all-green frame.
  "retries-timeouts": 20,
  // Breaker OPEN: `limited` packets bouncing off the breaker, svc-1 dead.
  // The open state is the entire lesson; at t=12 it is still closed.
  "circuit-breaker": 16,
  // Bucket drained to 0.5 tokens with 18 `limited` 429s in flight. At t=12
  // the gauge is simply full, which pins nothing. Token-gauge composite.
  "rate-limiting": 16.5,
  // Peak hour with a real backlog (depth 14) — the queue-depth chip is the
  // lesson, and it reads 0 at t=12.
  "message-queues": 21,
  // The redelivery: the orange `dupe` packet in flight after the crash, the
  // one frame that shows at-least-once actually delivering twice.
  "delivery-guarantees": 13.5,
  // The celebrity post: fan-out queue degraded under a 5M backlog, with the
  // aggregate chips standing in for packets (the PACKET_POOL pattern).
  fanout: 17,
  // Mid-partition in AP mode, versions visibly drifting either side of the
  // divider overlay.
  "cap-theorem": 14,
  // Election in flight: vote / granted / denied packets — three lesson-owned
  // packet styles that exist in no other frame — plus the dead leader.
  "leader-election": 14,
  // Mid-spread: 3 of 10 infected, rumor and spent packets both on the wire.
  // By t=12 the rumor has saturated and the stage is empty.
  gossip: 6,
  // Coordinator dead after the votes and before the decision: three
  // participants degraded, blocked, still holding their lock pips.
  "two-phase-commit": 18.5,
};

/**
 * The overlay-heavy surfaces, screenshotted as the WHOLE figure rather than
 * the stage alone. `stageOverlay` / `nodeOverlay` geometry is hand-built SVG
 * that no unit test touches, and the instruments under it (legend, meters,
 * scrub track) are where a token change shows up first — so these four pin
 * stage + chrome together. Same seek moment as the stage shot above.
 */
const COMPOSITES: { slug: string; surface: string }[] = [
  { slug: "consistent-hashing", surface: "hash ring + ownership arcs" },
  { slug: "sharding", surface: "keyspace strip" },
  { slug: "rate-limiting", surface: "token-bucket gauge" },
  { slug: "autoscaling", surface: "ghost nodes + boot countdown" },
];

/**
 * Shared screenshot policy.
 *
 * `animations: "disabled"` finishes CSS transitions and cancels the infinite
 * ones (`.break-pulse` on the breakable badge) to their first frame, so the
 * settle wait below only has to cover Motion's rAF-driven work.
 *
 * The tolerance is deliberately small: 1.5% of pixels is enough for
 * antialiasing churn along the stage's curved edges and text, and far too
 * little to hide a node that moved or a hue that changed.
 */
const SHOT = {
  animations: "disabled",
  caret: "hide",
  scale: "css",
  maxDiffPixelRatio: 0.015,
} as const;

/**
 * Wall-clock ms to wait after a seek, before the shutter.
 *
 * The seek publishes one snapshot; the structure layer then interpolates into
 * it — CSS transitions up to 300ms (`EdgeLine`, `Meter`, `SystemNode`'s load
 * bar) and Motion's 0.3s opacity/filter animations on `motion.g`/`motion.rect`,
 * which are rAF-driven for SVG and therefore NOT covered by
 * `animations: "disabled"`. 450ms clears both with room to spare, and
 * `toHaveScreenshot` re-shoots until two frames match anyway.
 */
const SETTLE_MS = 450;

const LESSONS: LessonMeta[] = allLessons.filter(
  (lesson) => lesson.status === "available",
);

/** Seek target for a lesson, in sim-seconds. */
const seekTarget = (slug: string): number => T_OVERRIDES[slug] ?? DEFAULT_T;

/* ------------------------------------------------------------------ *
 * Driving the figure
 * ------------------------------------------------------------------ */

/**
 * Load a lesson, wait for hydration, and hand back a PAUSED figure.
 *
 * The hydration gate is the same signal the smoke suite uses: the figure
 * autoplays from an effect once 35% of it is on screen, so the transport
 * flipping to "Pause" is proof the client bundle is live — a real event to
 * wait on instead of a sleep.
 *
 * Pausing by hand here is also what makes the rest of the test immune to
 * scrolling: `InteractiveFigure`'s IntersectionObserver only resumes a figure
 * it paused itself (`pausedByScroll`), and it has already spent its one
 * autoplay (`everPlayed`). Playwright scrolling the stage into view for the
 * shutter therefore cannot restart the clock.
 */
async function pausedFigure(page: Page, route: string): Promise<Locator> {
  const response = await page.goto(route);
  expect(response, `no response for ${route}`).not.toBeNull();
  expect(response!.ok(), `${route} responded ${response!.status()}`).toBeTruthy();
  await page.waitForLoadState("networkidle");

  const figure = page.locator("figure").first();
  await figure.scrollIntoViewIfNeeded();

  const pause = figure.getByRole("button", { name: "Pause simulation" });
  const play = figure.getByRole("button", { name: "Play simulation" });

  await expect(
    pause,
    "figure should autoplay once scrolled into view (our hydration gate)",
  ).toBeVisible();
  await pause.click();
  await expect(play, "the figure should be paused before seeking").toBeVisible();

  // Self-hosted woff2 files land after hydration; shooting before they do
  // would pin the fallback metrics.
  await page.evaluate(() => document.fonts.ready);
  // The pause click leaves focus on the transport button. Chromium does not
  // paint :focus-visible for a mouse click, but a stray focus ring is exactly
  // the kind of thing that would only show up as a mystery diff later.
  await page.evaluate(() => {
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  });

  return figure;
}

/**
 * Drive the transport's scrub input to `t` and wait for the stage to settle.
 *
 * A React-controlled input ignores a plain `element.value = x`: React's own
 * value tracker sees no change and swallows the event. The fix is the DOM's
 * native value setter (which bypasses the tracker) followed by a bubbling
 * `input` event, which is the event React 19 maps onto `onChange`. `change`
 * is dispatched too so the control behaves like a real release.
 *
 * `TransportBar` throttles seeks to ~10Hz on the leading edge, so a single
 * programmatic change seeks immediately — no flush needed.
 */
async function seekTo(figure: Locator, t: number): Promise<void> {
  const scrub = figure.getByRole("slider", { name: "Timeline" });
  await expect(scrub).toBeVisible();

  // The track spans `max(furthestT, lastBeat + 2, 10)`; a range input silently
  // clamps a value past its max, which would pin the wrong frame forever.
  const max = Number(await scrub.getAttribute("max"));
  expect(
    max,
    `scrub track ends at t=${max}s — cannot seek to t=${t}s. Either the ` +
      `lesson's timeline got shorter or this target needs revisiting.`,
  ).toBeGreaterThanOrEqual(t);

  await scrub.evaluate((el, value) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!setter) throw new Error("no native value setter on HTMLInputElement");
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, t);

  // Proof the replay landed where we asked. `seekTo` ticks until `t >= target`,
  // so it can overshoot by at most one TICK (0.033s) — well inside 0.05.
  const clock = figure.getByText(/^t=\d+(\.\d+)?s$/);
  await expect
    .poll(async () => readClock(clock), {
      message: `sim clock should read t=${t}s after the seek`,
    })
    .toBeCloseTo(t, 1);

  await figure.page().waitForTimeout(SETTLE_MS);
}

/** `t=12.3s` → 12.3 */
async function readClock(clock: Locator): Promise<number> {
  const text = (await clock.textContent()) ?? "";
  const match = text.match(/t=(\d+(?:\.\d+)?)s/);
  return match ? Number(match[1]) : Number.NaN;
}

/**
 * The stage: the one `svg[role="img"]` in the figure. Every other svg inside
 * (lucide icons, including the ones nested in `SystemNode`) ships without a
 * role, which is what makes this selector unambiguous.
 *
 * WORTH KNOWING: an element screenshot is the page screenshot CLIPPED to the
 * element's box — not an isolated render of its subtree. So the "stage" shots
 * also contain whatever is painted on top of that box: the corner ticks, the
 * `fig · <id> · seed 42` plate, the expand toggle and (until `hideCaption`
 * runs) the caption card. That is a feature here — those are stage chrome and
 * pinning them is free — but it is why the caption has to be dealt with for
 * every shot, not just the composites.
 */
const stageOf = (figure: Locator): Locator =>
  figure.locator('svg[role="img"]').first();

/**
 * Hide the timeline caption card before every shot.
 *
 * The card is `position: absolute`, so `display: none` costs no layout — the
 * figure is pixel-identical minus the card. Hidden on purpose, for two
 * reasons that both point the same way: the caption is prose, so a wording
 * tweak anywhere in a lesson would invalidate a baseline that has nothing to
 * do with the change; and it is the one place emoji and other non-latin
 * glyphs (☠ ⚡ 🚀 →) reach the screen, i.e. exactly the text that falls off
 * the self-hosted `latin` subset onto whatever the host has installed.
 *
 * What this gives up: the caption card's own chrome (border, backdrop blur,
 * the amber pip) is not pinned by this suite.
 */
async function hideCaption(page: Page): Promise<void> {
  await page.addStyleTag({
    content: 'figure [role="status"] > div { display: none !important; }',
  });
}

/* ------------------------------------------------------------------ *
 * Suites
 * ------------------------------------------------------------------ */

test.describe("stage renders identically at a fixed sim time", () => {
  test.skip(
    CI_GATE,
    "visual baselines are host-rasterizer-specific; set PW_VISUAL=1 once CI's baseline is generated in CI's own image",
  );

  for (const lesson of LESSONS) {
    const t = seekTarget(lesson.slug);

    test(`${lesson.moduleSlug}/${lesson.slug} at seed 42, t=${t}s`, async ({
      page,
    }) => {
      const figure = await pausedFigure(page, lessonPath(lesson));
      await seekTo(figure, t);
      await hideCaption(page);

      const stage = stageOf(figure);
      await expect(stage).toBeVisible();
      // A stage that rendered no text is an empty box that would still make a
      // stable, worthless baseline.
      await expect(stage.locator("text")).not.toHaveCount(0);

      await expect(stage).toHaveScreenshot(
        `stage--${lesson.moduleSlug}--${lesson.slug}.png`,
        SHOT,
      );
    });
  }
});

test.describe("overlay-heavy figures render identically", () => {
  test.skip(
    CI_GATE,
    "visual baselines are host-rasterizer-specific; set PW_VISUAL=1 once CI's baseline is generated in CI's own image",
  );

  for (const { slug, surface } of COMPOSITES) {
    const t = seekTarget(slug);

    test(`${slug} — ${surface} at t=${t}s`, async ({ page }) => {
      const lesson = getLesson(slug);
      expect(lesson, `lesson "${slug}" is not in the registry`).toBeTruthy();

      const figure = await pausedFigure(page, lessonPath(lesson!));
      await seekTo(figure, t);
      await hideCaption(page);

      // The whole instrument: stage + legend + meters + controls + transport.
      await expect(figure).toHaveScreenshot(`figure--${slug}.png`, SHOT);
    });
  }
});
