/**
 * Lesson scaffolder.
 *
 *   npx tsx scripts/new-lesson.mts <track>/<module>/<slug> --title "Some Title" \
 *     [--engine flow|steps] [--minutes 12] [--difficulty intermediate] \
 *     [--prereq a,b] [--sections id:kind:Title,id:kind:Title,...]
 *
 * NOTE: `--sections` splits on commas, so a section TITLE may not contain one.
 * The parser reports the offending entry rather than silently dropping it.
 *
 * WHY THIS EXISTS. Shipping a lesson touches seven places, and `npm run check`
 * fails on any one of them being missed: the registry, the sim or def, the
 * `-figure.tsx` wrapper, the page (whose `<LessonSection id>` blocks must match
 * the registry exactly), the OG route, a learning-guide entry, and — for
 * packet-engine lessons only — `simBySlug` plus the test harness's `SIM_BY_KEY`.
 * Doing that by hand is how the section-parity and matrix guards earn their
 * keep, but it is also just plumbing.
 *
 * DESIGN NOTE. The inserts are anchored text edits, not an AST rewrite, and they
 * FAIL LOUDLY when an anchor is missing rather than guessing. That is safe here
 * because the output is validated immediately by `npm run check` — tsc, the
 * curriculum check's route/section/companion parity, and the test matrix all run
 * over whatever this produced. A silent bad edit is not a failure mode; a
 * confusing one is, so the errors name the file and the anchor.
 *
 * It never overwrites: an existing file or a duplicate registry slug aborts the
 * whole run before anything is written.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------ *
 * Arguments
 * ------------------------------------------------------------------ */

type Engine = "flow" | "steps";

interface Section {
  id: string;
  kind: "concept" | "interactive";
  title: string;
}

function die(message: string): never {
  console.error(`new-lesson: ${message}`);
  process.exit(1);
}

const argv = process.argv.slice(2);

/**
 * Walk the arguments once, so a flag's VALUE is never mistaken for a positional
 * — `--title "Spin Locks"` must not read as a second path argument.
 */
const flags = new Map<string, string>();
const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg.startsWith("--")) {
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      die(`--${arg.slice(2)} needs a value`);
    }
    flags.set(arg.slice(2), next);
    i += 1;
  } else {
    positional.push(arg);
  }
}

const flag = (name: string): string | undefined => flags.get(name);

if (positional.length !== 1) {
  die(
    'expected one path argument, e.g. "concurrency/shared-state/spin-locks" (see the header for flags)',
  );
}

const [trackSlug, moduleSlug, slug] = positional[0].split("/");
if (!trackSlug || !moduleSlug || !slug) {
  die(`"${positional[0]}" is not <track>/<module>/<slug>`);
}
for (const [what, value] of [
  ["track", trackSlug],
  ["module", moduleSlug],
  ["lesson", slug],
] as const) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    die(`${what} slug "${value}" is not kebab-case`);
  }
}

const title = flag("title");
if (!title) die("--title is required (it is the registry's copy, and the page's)");

const engine = (flag("engine") ?? "steps") as Engine;
if (engine !== "flow" && engine !== "steps") {
  die(`--engine must be "flow" or "steps", got "${engine}"`);
}

const minutes = Number(flag("minutes") ?? 12);
const difficulty = flag("difficulty") ?? "intermediate";
const prereqs = (flag("prereq") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const sections: Section[] = (
  flag("sections") ??
  "the-idea:concept:The idea,try-it:interactive:Try it,what-it-costs:concept:What it costs"
)
  .split(",")
  .map((spec) => {
    const [id, kind, ...rest] = spec.split(":");
    if (!id || !kind || rest.length === 0) {
      die(
        `bad --sections entry "${spec}"; use id:kind:Title. ` +
          `Note that entries are comma-separated, so a title cannot contain a comma.`,
      );
    }
    if (kind !== "concept" && kind !== "interactive") {
      die(`section "${id}" kind must be concept or interactive, got "${kind}"`);
    }
    return { id, kind, title: rest.join(":") };
  });

/** `spin-locks` → `spinLocks`, for identifiers. */
const camel = slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
/** `spin-locks` → `SpinLocks`, for components. */
const pascal = camel[0].toUpperCase() + camel.slice(1);

/* ------------------------------------------------------------------ *
 * Planned writes — collected first, applied only if everything is safe
 * ------------------------------------------------------------------ */

const writes: { path: string; body: string }[] = [];
const edits: { path: string; anchor: string; insert: string; label: string }[] = [];

function plan(relPath: string, body: string): void {
  const abs = join(root, relPath);
  if (existsSync(abs)) die(`${relPath} already exists — refusing to overwrite`);
  writes.push({ path: abs, body });
}

function planEdit(relPath: string, anchor: string, insert: string, label: string): void {
  const abs = join(root, relPath);
  if (!existsSync(abs)) die(`${relPath} does not exist`);
  const source = readFileSync(abs, "utf8");
  if (!source.includes(anchor)) {
    die(`could not find the ${label} anchor in ${relPath}\n  looked for: ${anchor.trim().slice(0, 80)}`);
  }
  edits.push({ path: abs, anchor, insert, label });
}

/* ---- 1. the sim or def ---- */

const defPath = `src/lessons/${moduleSlug}/${slug}.ts`;

plan(
  defPath,
  engine === "steps"
    ? `import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * ${title} — archetype B (\`engine: "steps"\` in the registry).
 *
 * TODO: describe what this teaches, and WHY the figure shows it rather than
 * asserting it. Measure any number the prose will claim before writing it.
 *
 * Code lines must be <= 27 characters (the \`algo integrity\` check enforces it).
 */

const CODE = ["step one", "step two"];

function program(): Program {
  return {
    memory: { counter: 0 },
    threads: [
      {
        id: "T1",
        name: "T1",
        ops: [
          {
            label: "counter + 1",
            codeLine: 0,
            effect: (memory) => {
              memory.counter += 1;
            },
          },
        ],
      },
    ],
  };
}

export const ${camel}Algo: AlgoDef<ConcurrencyState, Program> = {
  // The id must start with the lesson slug — check-curriculum enforces it.
  id: "${slug}",
  title: "${title.toLowerCase()}",
  code: CODE,
  counters: [{ key: CONCURRENCY_COUNTERS.steps, label: "ops executed" }],
  generateInput: () => program(),
  run: (input, rng) => interleave(input, rng),
};
`
    : `import type { LessonSim } from "@/engine/types";
import { advancePackets, shouldSpawn, spawnPacket } from "@/engine/sim-helpers";

/**
 * ${title} — archetype A (the packet engine).
 *
 * TODO: topology, params, step. All randomness through \`state.rng\`;
 * \`Math.random\` is lint-banned here. Verify any prediction checkpoint's premise
 * at seed 42 by driving \`createRunner\` before trusting the prose.
 */

interface Params {
  rate: number;
}

export const ${camel}Sim: LessonSim<Record<string, never>> = {
  id: "${slug}",
  topology: {
    nodes: [
      { id: "client", kind: "client", label: "Client", x: 120, y: 160 },
      { id: "server", kind: "server", label: "Server", x: 520, y: 160 },
    ],
    edges: [{ id: "req", from: "client", to: "server" }],
  },
  params: [
    { key: "rate", label: "requests / sec", min: 1, max: 20, step: 1, value: 6 },
  ],
  init: () => ({}),
  step: (state, dt, params: Params) => {
    if (shouldSpawn(state, dt, params.rate)) {
      spawnPacket(state, { edgeId: "req", kind: "request" });
    }
    advancePackets(state, dt);
  },
  meters: [{ metricKey: "inFlight", label: "in flight", kind: "counter" }],
};
`,
);

/* ---- 2. the figure wrapper ---- */

plan(
  `src/lessons/${moduleSlug}/${slug}-figure.tsx`,
  engine === "steps"
    ? `"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { ${camel}Algo } from "./${slug}";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function ${pascal}Figure() {
  return (
    <SectionAlgoFigure
      def={${camel}Algo}
      view={ThreadsView}
      description="TODO: what a reader should watch for, in one or two sentences. This is the figure's accessible description."
    />
  );
}
`
    : `"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { ${camel}Sim } from "./${slug}";

export function ${pascal}Figure() {
  return (
    <SectionFigure
      sim={${camel}Sim}
      description="TODO: what a reader should watch for, in one or two sentences."
    />
  );
}
`,
);

/* ---- 3. the page ---- */

plan(
  `src/app/learn/${trackSlug}/${moduleSlug}/${slug}/page.tsx`,
  `import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { ${pascal}Figure } from "@/lessons/${moduleSlug}/${slug}-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("${slug}");

export default function ${pascal}Page() {
  return (
    <Lesson slug="${slug}">
${sections
  .map((s) =>
    s.kind === "interactive"
      ? `      <LessonSection id="${s.id}">
        <TryThis>
          <LI>TODO: the first thing to do.</LI>
          <LI>TODO: the thing that surprises.</LI>
        </TryThis>
        <${pascal}Figure />
        <Callout kind="insight">TODO: what the figure just proved.</Callout>
      </LessonSection>`
      : `      <LessonSection id="${s.id}">
        <Lead>TODO: ${s.title}.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>`,
  )
  .join("\n\n")}
    </Lesson>
  );
}
`,
);

/* ---- 4. the OG route ---- */

plan(
  `src/app/learn/${trackSlug}/${moduleSlug}/${slug}/opengraph-image.tsx`,
  `import { lessonOg } from "@/lib/og";

const og = lessonOg("${slug}");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
`,
);

/* ---- 5. the registry entry ---- */

const registry = readFileSync(join(root, "src/curriculum/registry.ts"), "utf8");
if (registry.includes(`slug: "${slug}"`)) {
  die(`the registry already has a lesson with slug "${slug}"`);
}

const moduleAnchor = `          slug: "${moduleSlug}",`;
if (!registry.includes(moduleAnchor)) {
  die(
    `no module with slug "${moduleSlug}" in the registry — add the module (and its track) first`,
  );
}

/**
 * Insert as the LAST lesson of the module.
 *
 * The end of the module's `lessons` array is found by matching brackets from its
 * opening `[`, skipping string literals. An earlier version anchored on a
 * `\n          ],` line, which read the registry's formatting as a contract and
 * broke immediately on a module whose array was still empty (`lessons: [],` on
 * one line) — the exact case a new track hits first.
 */
const moduleAt = registry.indexOf(moduleAnchor);
const lessonsOpen = registry.indexOf("lessons: [", moduleAt);
if (lessonsOpen === -1) {
  die(`module "${moduleSlug}" has no \`lessons: [\` array`);
}

let depth = 0;
let inString: string | null = null;
let lessonsEnd = -1;
for (let i = lessonsOpen + "lessons: ".length; i < registry.length; i++) {
  const ch = registry[i];
  if (inString) {
    if (ch === "\\") i += 1;
    else if (ch === inString) inString = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === "`") {
    inString = ch;
    continue;
  }
  if (ch === "[") depth += 1;
  else if (ch === "]") {
    depth -= 1;
    if (depth === 0) {
      lessonsEnd = i;
      break;
    }
  }
}
if (lessonsEnd === -1) {
  die(`could not find the end of module "${moduleSlug}"'s lessons array`);
}
/** True when the array is `[]` — the new-module case needs no leading newline. */
const lessonsEmpty = registry.slice(lessonsOpen, lessonsEnd).trim() === "lessons: [";

const entry = `            {
              slug: "${slug}",
              moduleSlug: "${moduleSlug}",
              title: "${title}",
              tagline:
                "TODO: one line that states the tension, not the topic.",
              difficulty: "${difficulty}",
              estimatedMinutes: ${minutes},
              prerequisites: [${prereqs.map((p) => `"${p}"`).join(", ")}],
              status: "available",${engine === "steps" ? `\n              engine: "steps",` : ""}
              sections: [
${sections
  .map(
    (s) =>
      `                { id: "${s.id}", title: "${s.title}", kind: "${s.kind}" },`,
  )
  .join("\n")}
              ],
            },`;

/** Byte offset to splice the entry in at: just before the array's closing `]`. */
const registryInsertAt = lessonsEnd;

/* ---- 6. the learning guide ---- */

planEdit(
  "src/curriculum/learning.ts",
  "\n};",
  `  "${slug}": guide(
    "TODO: the question this lesson answers?",
    "TODO: what changed, in one sentence.",
    "TODO: why it matters.",
    "TODO: what to try next.",
    [${prereqs.map((p) => `{ slug: "${p}", relation: "builds on" }`).join(", ")}],
  ),`,
  "guides map end",
);

/* ---- 7. flow-engine only: the two lookup maps ---- */

if (engine === "flow") {
  planEdit(
    "src/lessons/index.ts",
    "\n};",
    `  "${slug}": widen(${camel}Sim),`,
    "simBySlug end",
  );
  planEdit(
    "src/engine/__tests__/harness.ts",
    "\n};",
    `  "${moduleSlug}/${slug}": widen(${camel}Sim),`,
    "SIM_BY_KEY end",
  );
}

/* ------------------------------------------------------------------ *
 * Apply
 * ------------------------------------------------------------------ */

for (const { path, body } of writes) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

// Registry: splice the entry in before the closing bracket. An empty array has no
// trailing newline of its own, so one is added; a populated one already ends with
// the previous entry's newline and indentation.
{
  const abs = join(root, "src/curriculum/registry.ts");
  const source = readFileSync(abs, "utf8");
  const body = lessonsEmpty ? `\n${entry}\n          ` : `${entry}\n          `;
  writeFileSync(
    abs,
    source.slice(0, registryInsertAt) + body + source.slice(registryInsertAt),
  );
}

/*
 * The rest: insert before the LAST occurrence of the anchor, which for these files
 * is the closing brace of the object literal being extended.
 *
 * The trailing newline is not cosmetic. Without it the inserted block and the
 * closing `};` end up on one line (`  ),};`) — still valid TypeScript, so the
 * whole gate passes, and the damage only shows up on the NEXT run when the
 * `\n};` anchor no longer exists. A silent edit that breaks a later run is the
 * worst failure mode this script has, so the shape of the output is asserted
 * rather than assumed.
 */
for (const { path, anchor, insert, label } of edits) {
  const source = readFileSync(path, "utf8");
  const at = source.lastIndexOf(anchor);
  if (at === -1) die(`lost the ${label} anchor while applying`);
  const next = source.slice(0, at + 1) + insert + "\n" + source.slice(at + 1);
  if (!next.includes(`${insert}\n${anchor.trimStart()}`)) {
    die(`the ${label} insert did not land on its own line in ${path}`);
  }
  writeFileSync(path, next);
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

console.log(`new-lesson: scaffolded "${slug}" (${engine} engine)\n`);
for (const { path } of writes) console.log(`  created  ${path.slice(root.length + 1)}`);
console.log(`  edited   src/curriculum/registry.ts`);
console.log(`  edited   src/curriculum/learning.ts`);
if (engine === "flow") {
  console.log(`  edited   src/lessons/index.ts`);
  console.log(`  edited   src/engine/__tests__/harness.ts`);
}
console.log(`
Next:
  1. Fill in the def, the prose, and the TODOs. Measure any number the prose
     claims BEFORE writing it.
  2. npx tsx scripts/check-curriculum.mts --write-readme
  3. npm run check && npm run build
  4. Screenshot the figure and look at it. Headless tests do not see layout.
`);
if (engine === "flow") {
  console.log(
    `  Note: the flow template imports \`${camel}Sim\` in two map files. Add the import lines\n  at the top of src/lessons/index.ts and src/engine/__tests__/harness.ts.\n`,
  );
}
