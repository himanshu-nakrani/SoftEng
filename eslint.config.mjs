import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

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
  // eslint-config-next 16 ships flat config natively (arrays of config
  // objects), so these are spread directly — no FlatCompat/eslintrc shim.
  ...nextCoreWebVitals,
  ...nextTypescript,
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
      // The playground drives real sims too, so it is held to the same rule. Its
      // one legitimate use — picking a fresh seed for free play — carries an
      // inline disable with the reason, which is the point: an exemption you can
      // see beats a gap in the glob.
      "src/components/playground/**",
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
            {
              // Archetype B (the discrete-step player) gets the same layering.
              // A lesson may import the contract (`@/engine/algo/types`), the
              // author verb (`@/engine/algo/recorder`) and a view's state
              // contract (`@/engine/algo/views/<view>`); the player and the
              // figure belong to the render layer. A `-figure.tsx` wrapper is
              // the ONLY place allowed to name a view COMPONENT, because that
              // is the file that already owns "use client".
              group: [
                "@/engine/algo/AlgoFigure",
                "@/engine/algo/AlgoTransportBar",
                "@/engine/algo/CodePanel",
                "@/engine/algo/useAlgoPlayer",
                "**/engine/algo/AlgoFigure",
                "**/engine/algo/AlgoTransportBar",
                "**/engine/algo/CodePanel",
                "**/engine/algo/useAlgoPlayer",
              ],
              message:
                "Lessons never touch render internals: compose <SectionAlgoFigure def={...} view={...}> and import @/engine/algo/types, /recorder and a view's state module only.",
            },
          ],
        },
      ],
    },
  },

  /* ---------------------------------------------------------------------
     The render-loop layer: refs ARE the store, deliberately.

     react-hooks 7 (React Compiler lint) reports `react-hooks/refs` for reading
     or writing `ref.current` during render. That is the right default for
     product code, but it is the load-bearing mechanism of this engine's two
     update disciplines: the packet layer runs one rAF loop that reads live
     state, status and speed through refs so React never re-renders per frame,
     and the observer/event callbacks mirror props into refs to stay
     referentially stable (re-subscribing the IntersectionObserver would reset
     the autoplay-once bookkeeping it closes over).

     Restructuring to satisfy the rule would mean animating from React state —
     which breaks pause/step/speed, since packet positions must be computed
     from the sim clock, not wall time. So the rule is off for exactly these
     three files, listed rather than globbed so a new file has to opt in
     consciously. Everything else react-hooks 7 checks stays on here.
  --------------------------------------------------------------------- */
  {
    files: [
      "src/engine/useSimulation.ts",
      "src/engine/components/InteractiveFigure.tsx",
      "src/components/lesson/SectionFigure.tsx",
    ],
    rules: {
      "react-hooks/refs": "off",
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
      // Test tooling is allowed to drive the headless runner directly — that is
      // exactly how a flow lesson's prose is pinned (see networking-claims and
      // the engine harness). The authoring ban above protects shipped sim code,
      // not the tests that verify it.
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
