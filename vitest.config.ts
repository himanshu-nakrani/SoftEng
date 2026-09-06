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
    projects: [
      {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
        test: {
          name: "node",
          environment: "node",
          pool: "forks",
          include: ["src/**/__tests__/**/*.test.ts"],
          exclude: ["src/**/__tests__/**/*.render.test.{ts,tsx}"],
          testTimeout: 20_000,
        },
      },
      {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
        test: {
          name: "rendering",
          environment: "jsdom",
          include: ["src/**/__tests__/**/*.render.test.{ts,tsx}"],
          testTimeout: 20_000,
        },
      },
    ],
  },
});
