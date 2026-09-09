import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Headless simulation tests only — the engine core is React-free by design
 * (see `src/engine/runner.ts`), so the whole suite runs in plain node.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    /**
     * The per-lesson invariant tests drive thousands of sim ticks; the slowest
     * (`observability/slos-error-budgets`) sits around 2.5s on an idle laptop
     * and has crossed vitest's 5s default on a loaded machine. CI runners are
     * slower and shared, so the default turns a slow test into a false failure.
     */
    testTimeout: 20_000,
  },
});
