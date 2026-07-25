import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against the real static export, not the dev server: `npm run build`
 * writes `out/`, and `serve` hands it back exactly like a static host would.
 * That way the smoke suite exercises the artifact we actually deploy.
 */
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Escape hatch for sandboxes/dev boxes that ship a pinned Chromium which does
 * not match the build this Playwright version downloads. Unset everywhere else
 * (CI included), where Playwright resolves its own browser.
 */
const chromiumExecutable = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  // Keep traces/screenshots inside the (git-ignored) e2e folder rather than a
  // stray `test-results/` at the repo root.
  outputDir: "e2e/.artifacts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // A flaky smoke test is a bug report, not something to paper over.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      // Channel-less: uses the bundled Chromium (PLAYWRIGHT_BROWSERS_PATH
      // locally, `playwright install chromium` on CI runners).
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutable
          ? { launchOptions: { executablePath: chromiumExecutable } }
          : {}),
      },
    },
  ],
  webServer: {
    command: `npx serve out -l ${PORT} --no-clipboard`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
