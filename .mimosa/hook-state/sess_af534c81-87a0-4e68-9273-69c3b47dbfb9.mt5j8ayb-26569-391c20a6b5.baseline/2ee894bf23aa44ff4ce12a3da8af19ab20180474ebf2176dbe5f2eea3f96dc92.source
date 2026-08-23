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
  },
});
