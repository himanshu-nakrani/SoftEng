import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Flat config REPLACES a rule's options rather than merging them, so any block
 * that re-declares `no-restricted-imports` has to restate this ban too.
 */
const LEGACY_MOTION = {
  name: "framer-motion",
  message:
    "Import from motion/react — framer-motion is the legacy package and is not a dependency of this project.",
};

/** Node/runner globals for test + e2e code (which never runs in the browser). */
const NODE_GLOBALS = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  structuredClone: "readonly",
  performance: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  queueMicrotask: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  global: "readonly",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "next-env.d.ts",
      // Generated run artifacts (Playwright reports, vitest coverage).
      "playwright-report/**",
      "test-results/**",
      "blob-report/**",
      "coverage/**",
    ],
  },

  /* ---------------------------------------------------------------------
     Engine invariant: determinism.

     Same seed ⇒ identical run is what replay, prediction quizzes and any
     golden-run tooling stand on. One `Math.random()` anywhere in sim code
     silently breaks all three, and the failure is unreproducible by
     definition — so it is a lint error, not a review note.
  --------------------------------------------------------------------- */
  {
    files: [
      "src/engine/**",
      "src/lessons/**",
      "src/components/landing/hero-sim.ts",
    ],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Use SimState.rng (seeded mulberry32) — Math.random breaks deterministic replay and prediction quizzes",
        },
      ],
    },
  },

  /* ---------------------------------------------------------------------
     Project-wide: one motion package. `motion/react` is the maintained
     entry point; `framer-motion` is the legacy name and importing it would
     load a second animation runtime (if it resolved at all).
  --------------------------------------------------------------------- */
  {
    rules: {
      "no-restricted-imports": ["error", { paths: [LEGACY_MOTION] }],
    },
  },

  /* ---------------------------------------------------------------------
     Layering: lessons are data + a step function.

     A lesson may import the contract (`@/engine/types`), the author verbs
     (`@/engine/sim-helpers`), the snapshot shape a `stageOverlay` receives
     (`@/engine/snapshot`) and the figure wrapper
     (`@/components/lesson/SectionFigure`) — those are the layer's public
     surface. Reaching past them into the render internals (the simulation
     hook, the stage components) inverts the dependency order the whole
     engine is built on, so it is banned at the import site.
  --------------------------------------------------------------------- */
  {
    files: ["src/lessons/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [LEGACY_MOTION],
          patterns: [
            {
              group: [
                "@/engine/useSimulation",
                "@/engine/runner",
                "@/engine/components/*",
                "**/engine/useSimulation",
                "**/engine/runner",
                "**/engine/components/*",
              ],
              message:
                "Lessons never touch render internals: compose <SectionFigure sim={...}> (which owns InteractiveFigure/useSimulation) and import types + sim-helpers only.",
            },
          ],
        },
      ],
    },
  },

  /* ---------------------------------------------------------------------
     Test + e2e code: node, not the app.

     Headless sim tests (vitest, the `__tests__` dirs under src) and specs
     (`e2e/**`) are tooling, not product code — they run in node, contain no
     components, and are allowed unseeded randomness (fuzzing seeds is a
     legitimate way to *prove* determinism). The authoring bans above exist
     to protect shipped sim code, so they are lifted here.
  --------------------------------------------------------------------- */
  {
    files: ["src/**/__tests__/**", "e2e/**"],
    languageOptions: {
      globals: NODE_GLOBALS,
    },
    rules: {
      "no-restricted-properties": "off",
      "react-hooks/rules-of-hooks": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
