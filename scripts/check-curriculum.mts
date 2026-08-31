/**
 * CI invariant: the curriculum registry is the single source of truth, and
 * everything downstream of it (routes, pages, figures, sims, quizzes) agrees.
 *
 * This script *imports* the registry and the lesson sims directly (via tsx,
 * which resolves the "@/" alias from tsconfig.json) rather than regex-parsing
 * TypeScript source. The old regex scan silently dropped entries whose fields
 * were reordered; a real import cannot.
 *
 * Checks
 *   1. route parity      — available ⇒ page.tsx under its OWN track; every route
 *                          folder registered; coming-soon ⇒ no route folder;
 *                          every track has a landing page
 *   2. section parity    — registry sections ↔ <LessonSection id> in page.tsx
 *   3. companion files   — <slug>-figure.tsx and <slug>.ts exist
 *   4. slug integrity    — slugs unique, moduleSlug matches nesting
 *   5. prerequisites     — resolve, and come strictly earlier in lesson order
 *   6. quiz integrity    — ids unique (per lesson + globally), at > 0,
 *                          correctChoiceId ∈ choices, sim.id === slug
 *   7. meter sanity      — metricKey non-empty, kind valid, keys unique
 *   8. algo integrity    — engine:"steps" lessons export a valid AlgoDef
 *                          (id prefixed by slug, code + counters present,
 *                          unique counter keys, coherent size range)
 *   9. readme sync       — README's generated curriculum table matches the
 *                          registry (module rows + headline lesson count)
 *
 * Run: npx tsx scripts/check-curriculum.mts
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { curriculum } from "@/curriculum/registry";
import type { LessonMeta, Module, Track } from "@/curriculum/types";
import { allLessons } from "@/lib/curriculum";
import type { LessonSim, MeterSpec, QuizCheckpoint } from "@/engine/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------ *
 * Failure collection
 * ------------------------------------------------------------------ */

type Category =
  | "route parity"
  | "section parity"
  | "companion files"
  | "slug integrity"
  | "prerequisites"
  | "quiz integrity"
  | "meter sanity"
  | "algo integrity"
  | "readme sync";

const failures: { category: Category; message: string }[] = [];

function fail(category: Category, message: string): void {
  failures.push({ category, message });
}

/** Path relative to the repo root, for readable messages. */
function rel(...segments: string[]): string {
  return segments.join("/");
}

function isDir(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

/* ------------------------------------------------------------------ *
 * Flatten the registry (all tracks, not just the first)
 * ------------------------------------------------------------------ */

interface Entry {
  lesson: LessonMeta;
  mod: Module;
  track: Track;
  /** Position in flattened curriculum order. */
  order: number;
}

const entries: Entry[] = [];
const allModules: { mod: Module; track: Track }[] = [];

for (const track of curriculum.tracks) {
  for (const mod of track.modules) {
    allModules.push({ mod, track });
    for (const lesson of mod.lessons) {
      entries.push({ lesson, mod, track, order: entries.length });
    }
  }
}

if (entries.length === 0) {
  console.error("check-curriculum FAILED: the registry contains no lessons.");
  process.exit(1);
}

/** slug -> entry (first wins; duplicates are reported by check 4). */
const bySlug = new Map<string, Entry>();
for (const e of entries) {
  if (!bySlug.has(e.lesson.slug)) bySlug.set(e.lesson.slug, e);
}

const available = entries.filter((e) => e.lesson.status === "available");

/* ------------------------------------------------------------------ *
 * 4. Slug integrity
 * ------------------------------------------------------------------ */

{
  const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  // Track slugs: kebab-case and unique — they are the first path segment.
  const seenTrack = new Set<string>();
  for (const track of curriculum.tracks) {
    if (!track.slug || !KEBAB.test(track.slug)) {
      fail(
        "slug integrity",
        `track slug ${JSON.stringify(track.slug)} is not a non-empty kebab-case slug`,
      );
    }
    if (seenTrack.has(track.slug)) {
      fail("slug integrity", `track slug "${track.slug}" is used more than once`);
    }
    seenTrack.add(track.slug);
    if (track.modules.length === 0) {
      fail("slug integrity", `track "${track.slug}" has no modules`);
    }
  }

  /*
   * Module slugs must be unique ACROSS tracks, not just within one. Routes
   * would tolerate duplicates (the track segment disambiguates), but
   * `getModule()` in src/lib/curriculum.ts is a flat slug → module map, and
   * the landing page + review deck read modules through it. A duplicate would
   * silently resolve to whichever track was registered first.
   */

  const seenLesson = new Map<string, string[]>(); // slug -> owning module slugs
  for (const { lesson, mod } of entries) {
    if (!lesson.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lesson.slug)) {
      fail(
        "slug integrity",
        `lesson slug ${JSON.stringify(lesson.slug)} (module "${mod.slug}") is not a non-empty kebab-case slug`,
      );
    }
    if (lesson.moduleSlug !== mod.slug) {
      fail(
        "slug integrity",
        `lesson "${lesson.slug}" declares moduleSlug "${lesson.moduleSlug}" but is nested under module "${mod.slug}"`,
      );
    }
    const owners = seenLesson.get(lesson.slug) ?? [];
    owners.push(mod.slug);
    seenLesson.set(lesson.slug, owners);
  }
  for (const [slug, owners] of seenLesson) {
    if (owners.length > 1) {
      fail(
        "slug integrity",
        `lesson slug "${slug}" is used ${owners.length}× (modules: ${owners.join(", ")}) — slugs must be globally unique (they key progress and routing)`,
      );
    }
  }

  const seenModule = new Map<string, string[]>(); // module slug -> owning tracks
  for (const { mod, track } of allModules) {
    if (!mod.slug || !KEBAB.test(mod.slug)) {
      fail(
        "slug integrity",
        `module slug ${JSON.stringify(mod.slug)} (track "${track.slug}", "${mod.title}") is not a non-empty kebab-case slug`,
      );
    }
    const owners = seenModule.get(mod.slug) ?? [];
    owners.push(track.slug);
    seenModule.set(mod.slug, owners);
  }
  for (const [slug, owners] of seenModule) {
    if (owners.length > 1) {
      fail(
        "slug integrity",
        `module slug "${slug}" is used ${owners.length}× (tracks: ${owners.join(", ")}) — module slugs must be globally unique across tracks, because getModule() in src/lib/curriculum.ts is a flat slug → module map`,
      );
    }
  }

  // `allLessons` is a cross-track flattening; this pins it to the registry's
  // own order so a selector refactor can't silently drop or reorder a track.
  if (allLessons.length !== entries.length) {
    fail(
      "slug integrity",
      `src/lib/curriculum.ts exposes ${allLessons.length} lessons but the registry defines ${entries.length} — allLessons must flatten EVERY track, or lessons outside tracks[0] become invisible to the app`,
    );
  } else {
    for (let i = 0; i < entries.length; i++) {
      if (allLessons[i]?.slug !== entries[i].lesson.slug) {
        fail(
          "slug integrity",
          `flattened lesson order drifted at index ${i}: registry has "${entries[i].lesson.slug}", src/lib/curriculum.ts has "${allLessons[i]?.slug}"`,
        );
        break;
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 5. Prerequisite integrity
 *
 * POLICY. Cross-track prerequisites are ALLOWED — a databases lesson may
 * legitimately build on track 01's replication — and the "strictly earlier in
 * curriculum order" rule below is what makes them safe: a cross-track
 * prerequisite can only point at an earlier track, so no cycle is expressible.
 *
 * They remain a SOFT gate (a suggestion and a visual hint, never a lock), and
 * `prerequisiteLabels` in src/lib/curriculum.ts annotates one from another track
 * with that track's title, so "after Database Replication" is not a dead end for
 * a reader who does not know where it lives.
 * ------------------------------------------------------------------ */

for (const { lesson, order } of entries) {
  for (const prereq of lesson.prerequisites) {
    const target = bySlug.get(prereq);
    if (!target) {
      fail(
        "prerequisites",
        `lesson "${lesson.slug}" lists prerequisite "${prereq}", which is not a registered lesson slug`,
      );
      continue;
    }
    if (prereq === lesson.slug) {
      fail("prerequisites", `lesson "${lesson.slug}" lists itself as a prerequisite`);
      continue;
    }
    if (target.order >= order) {
      fail(
        "prerequisites",
        `lesson "${lesson.slug}" (position ${order + 1}) requires "${prereq}" (position ${target.order + 1}) — prerequisites must appear strictly earlier in curriculum order`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 1. Route parity (registry → filesystem)
 *
 * Routes are `/learn/<track>/<module>/<slug>`. The track segment is part of
 * the contract: a lesson's folder must sit under its OWN track, so two tracks
 * can reuse a module name without colliding on disk.
 * ------------------------------------------------------------------ */

const learnDir = join(root, "src/app/learn");

/** Catch-all that renders redirect stubs for the pre-track URLs. */
const LEGACY_ROUTE_DIR = "[...legacy]";

for (const { lesson, track } of entries) {
  const routeDir = join(learnDir, track.slug, lesson.moduleSlug, lesson.slug);
  const page = join(routeDir, "page.tsx");
  const routePath = rel("src/app/learn", track.slug, lesson.moduleSlug, lesson.slug);

  if (lesson.status === "available") {
    if (!existsSync(page)) {
      fail("route parity", `lesson "${lesson.slug}" is "available" but ${routePath}/page.tsx does not exist`);
    }
  } else if (lesson.status === "coming-soon") {
    if (isDir(routeDir)) {
      fail(
        "route parity",
        `lesson "${lesson.slug}" is "coming-soon" but the route folder ${routePath}/ exists — flip status to "available" or remove the folder`,
      );
    }
  } else {
    fail("route parity", `lesson "${lesson.slug}" has unknown status ${JSON.stringify(lesson.status)}`);
  }
}

/* Every track needs its own landing page. */
for (const track of curriculum.tracks) {
  const landing = join(learnDir, track.slug, "page.tsx");
  if (!existsSync(landing)) {
    fail(
      "route parity",
      `track "${track.slug}" has no landing page at ${rel("src/app/learn", track.slug, "page.tsx")}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 1b. Route parity (filesystem → registry)
 * ------------------------------------------------------------------ */

const trackSlugs = new Set(curriculum.tracks.map((t) => t.slug));
/** "<track>/<module>" for every registered module. */
const moduleRouteKeys = new Set(allModules.map((m) => `${m.track.slug}/${m.mod.slug}`));
/** "<track>/<module>/<lesson>" for every registered lesson. */
const lessonRouteKeys = new Set(
  entries.map((e) => `${e.track.slug}/${e.lesson.moduleSlug}/${e.lesson.slug}`),
);

if (isDir(learnDir)) {
  for (const trackName of readdirSync(learnDir)) {
    const trackDir = join(learnDir, trackName);
    if (!isDir(trackDir)) continue; // layout.tsx / page.tsx at the learn root
    if (trackName === LEGACY_ROUTE_DIR) continue;

    if (!trackSlugs.has(trackName)) {
      fail(
        "route parity",
        `route folder src/app/learn/${trackName}/ does not match any registered track slug`,
      );
      continue;
    }

    for (const moduleName of readdirSync(trackDir)) {
      const moduleDir = join(trackDir, moduleName);
      if (!isDir(moduleDir)) continue; // the track's own page.tsx

      if (!moduleRouteKeys.has(`${trackName}/${moduleName}`)) {
        fail(
          "route parity",
          `route folder src/app/learn/${trackName}/${moduleName}/ does not match any module registered under that track`,
        );
        continue;
      }

      for (const lessonName of readdirSync(moduleDir)) {
        const lessonDir = join(moduleDir, lessonName);
        if (!isDir(lessonDir)) continue;

        const routePath = `src/app/learn/${trackName}/${moduleName}/${lessonName}`;
        if (!lessonRouteKeys.has(`${trackName}/${moduleName}/${lessonName}`)) {
          fail("route parity", `route folder ${routePath}/ is not in the curriculum registry`);
        }
        // A registered folder that is missing page.tsx is already reported by
        // check 1 (available ⇒ page.tsx) or by the coming-soon rule above.
      }
    }
  }
} else {
  fail("route parity", "src/app/learn/ does not exist");
}

/* ------------------------------------------------------------------ *
 * 2. Section ↔ page parity + 3. companion files
 * ------------------------------------------------------------------ */

/** Every `<LessonSection …>` opening tag in a page, with its literal id. */
function extractSectionIds(source: string, pagePath: string): string[] {
  const ids: string[] = [];
  const tagRe = /<LessonSection\b([^>]*)>/g;
  for (const tag of source.matchAll(tagRe)) {
    const attrs = tag[1] ?? "";
    const idMatch = /\bid\s*=\s*"([^"]*)"/.exec(attrs);
    if (!idMatch || !idMatch[1]) {
      fail(
        "section parity",
        `${pagePath}: a <LessonSection> has no literal id="…" attribute (ids must be static so the registry can be checked against them)`,
      );
      continue;
    }
    ids.push(idMatch[1]);
  }
  return ids;
}

const VALID_SECTION_KINDS = new Set(["concept", "interactive", "quiz"]);

let totalSections = 0;

for (const { lesson, track } of entries) {
  const sectionIds = lesson.sections.map((s) => s.id);
  totalSections += sectionIds.length;

  // Section ids unique within the lesson + well-formed.
  const seen = new Set<string>();
  for (const section of lesson.sections) {
    if (!section.id) {
      fail("section parity", `lesson "${lesson.slug}" has a section with an empty id`);
    } else if (seen.has(section.id)) {
      fail(
        "section parity",
        `lesson "${lesson.slug}" declares section id "${section.id}" more than once — ids must be unique within a lesson (they key progress)`,
      );
    }
    seen.add(section.id);

    if (!section.title) {
      fail("section parity", `lesson "${lesson.slug}" section "${section.id}" has an empty title`);
    }
    if (!VALID_SECTION_KINDS.has(section.kind)) {
      fail(
        "section parity",
        `lesson "${lesson.slug}" section "${section.id}" has invalid kind ${JSON.stringify(section.kind)} (expected ${[...VALID_SECTION_KINDS].join(" | ")})`,
      );
    }
  }

  if (lesson.sections.length === 0) {
    fail("section parity", `lesson "${lesson.slug}" declares no sections — progress % would divide by zero`);
  }

  if (lesson.status !== "available") continue;

  // 3. Companion files.
  const figurePath = rel("src/lessons", lesson.moduleSlug, `${lesson.slug}-figure.tsx`);
  const simPath = rel("src/lessons", lesson.moduleSlug, `${lesson.slug}.ts`);
  if (!existsSync(join(root, figurePath))) {
    fail("companion files", `lesson "${lesson.slug}" is "available" but ${figurePath} does not exist`);
  }
  if (!existsSync(join(root, simPath))) {
    fail("companion files", `lesson "${lesson.slug}" is "available" but ${simPath} does not exist`);
  }

  // 2. Registry sections ↔ page <LessonSection> blocks.
  const pagePath = rel("src/app/learn", track.slug, lesson.moduleSlug, lesson.slug, "page.tsx");
  const pageFile = join(root, pagePath);
  if (!existsSync(pageFile)) continue; // already reported by check 1

  const pageIds = extractSectionIds(readFileSync(pageFile, "utf8"), pagePath);

  const pageSeen = new Set<string>();
  for (const id of pageIds) {
    if (pageSeen.has(id)) {
      fail("section parity", `${pagePath}: renders <LessonSection id="${id}"> more than once`);
    }
    pageSeen.add(id);
  }

  for (const id of sectionIds) {
    if (!pageSeen.has(id)) {
      fail(
        "section parity",
        `lesson "${lesson.slug}": registry section "${id}" has no <LessonSection id="${id}"> in ${pagePath}`,
      );
    }
  }
  for (const id of pageSeen) {
    if (!seen.has(id)) {
      fail(
        "section parity",
        `${pagePath}: renders <LessonSection id="${id}"> which is not in the registry's sections for "${lesson.slug}" (progress would never count it)`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 6. Quiz integrity + 7. meter sanity (needs the real sim modules)
 * ------------------------------------------------------------------ */

const VALID_METER_KINDS = new Set(["counter", "bar", "gauge", "sparkline"]);

/** Structural duck-type: the exported LessonSim of a lesson module. */
function isLessonSim(value: unknown): value is LessonSim<never> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.topology === "object" &&
    v.topology !== null &&
    typeof v.step === "function" &&
    typeof v.init === "function"
  );
}

/** Structural duck-type: an archetype-B `AlgoDef` (engine: "steps"). */
function isAlgoDef(value: unknown): value is {
  id: string;
  title: string;
  code: unknown;
  counters: unknown;
  size?: unknown;
  generateInput: unknown;
  run: unknown;
} {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    Array.isArray(v.code) &&
    Array.isArray(v.counters) &&
    typeof v.generateInput === "function" &&
    typeof v.run === "function"
  );
}

/**
 * Archetype-B lessons: the analogue of the sim/quiz/meter checks below.
 *
 * A `steps` lesson exports one or more `AlgoDef`s rather than a single
 * `LessonSim` — one per figure, because a lesson often contrasts two runs (the
 * unguarded and the guarded version of the same program). So the rule is "at
 * least one", and each is validated on its own.
 */
for (const { lesson } of available.filter((e) => e.lesson.engine === "steps")) {
  const defPath = rel("src/lessons", lesson.moduleSlug, `${lesson.slug}.ts`);
  if (!existsSync(join(root, defPath))) continue; // reported by check 3

  let mod: Record<string, unknown>;
  try {
    mod = (await import(`@/lessons/${lesson.moduleSlug}/${lesson.slug}`)) as Record<string, unknown>;
  } catch (err) {
    fail("algo integrity", `${defPath}: failed to import — ${(err as Error).message}`);
    continue;
  }

  const defs = Object.entries(mod).filter(([, v]) => isAlgoDef(v));
  if (defs.length === 0) {
    fail(
      "algo integrity",
      `${defPath}: lesson declares engine "steps" but exports no AlgoDef (looked for an exported object with id/code/counters/generateInput/run)`,
    );
    continue;
  }

  for (const [exportName, value] of defs) {
    const def = value as {
      id: string;
      code: unknown[];
      counters: { key?: unknown; label?: unknown }[];
      size?: { min?: unknown; max?: unknown; default?: unknown };
    };

    // The lesson's PRIMARY def keys off the slug, exactly as archetype A's sim
    // does; extra defs on the page are suffixed (`<slug>-guarded`).
    if (!def.id.startsWith(lesson.slug)) {
      fail(
        "algo integrity",
        `${defPath}: ${exportName}.id is "${def.id}" but must start with the lesson slug "${lesson.slug}" so a def can be traced back to its registry entry`,
      );
    }
    if (def.code.length === 0) {
      fail("algo integrity", `${defPath}: ${exportName} has empty \`code\` — the code panel would render blank`);
    }

    /*
     * Code-panel width.
     *
     * Derived from the component, not guessed: the panel column is 240px
     * (`lg:grid-cols-[1fr_240px]` in AlgoFigure, 237px of content), and each row
     * in CodePanel spends 12px padding twice, a 16px line-number gutter and a
     * 12px gap — leaving 185px. The mono face advances 6.62px per character at
     * 11px, so 27 characters fit.
     *
     * This is a real check rather than a comment because the constraint was
     * documented and then violated in three consecutive lessons: a longer line
     * does not wrap, it slides under the panel edge where the author never sees
     * it (the figure is authored in a .ts file, and the clipping only shows at
     * lg and above).
     */
    const CODE_MAX_CHARS = 27;
    for (const [i, line] of def.code.entries()) {
      if (typeof line !== "string") {
        fail("algo integrity", `${defPath}: ${exportName}.code[${i}] is not a string`);
        continue;
      }
      if (line.trim().length === 0) {
        fail(
          "algo integrity",
          `${defPath}: ${exportName}.code[${i}] is blank — the panel renders an empty numbered line.\n` +
            `        this usually means the array was PADDED so a command's codeLine would line up;\n` +
            `        shorten the array and give the command the right index instead`,
        );
        continue;
      }
      if (line.length > CODE_MAX_CHARS) {
        fail(
          "algo integrity",
          `${defPath}: ${exportName}.code[${i}] is ${line.length} chars — the code panel fits ${CODE_MAX_CHARS} and clips the rest.\n` +
            `        ${JSON.stringify(line)}\n` +
            `        shorten it or drop the trailing comment (the figure's lanes and captions carry that detail)`,
        );
      }
    }
    if (def.counters.length === 0) {
      fail("algo integrity", `${defPath}: ${exportName} declares no counters`);
    }

    const seenKeys = new Set<string>();
    for (const counter of def.counters) {
      if (typeof counter.key !== "string" || counter.key.length === 0) {
        fail("algo integrity", `${defPath}: ${exportName} has a counter with a non-empty key missing`);
        continue;
      }
      if (seenKeys.has(counter.key)) {
        fail("algo integrity", `${defPath}: ${exportName} declares counter key "${counter.key}" twice`);
      }
      seenKeys.add(counter.key);
      if (typeof counter.label !== "string" || counter.label.length === 0) {
        fail("algo integrity", `${defPath}: ${exportName} counter "${counter.key}" has no label`);
      }
    }

    const size = def.size;
    if (size) {
      const { min, max, default: def_ } = size;
      if (typeof min !== "number" || typeof max !== "number" || typeof def_ !== "number") {
        fail("algo integrity", `${defPath}: ${exportName}.size needs numeric min/max/default`);
      } else if (min >= max || def_ < min || def_ > max) {
        fail(
          "algo integrity",
          `${defPath}: ${exportName}.size is inconsistent (min ${min}, max ${max}, default ${def_})`,
        );
      }
    }
  }
}

const quizOwner = new Map<string, string>(); // quiz id -> lesson slug
let totalQuizzes = 0;

for (const { lesson } of available.filter((e) => e.lesson.engine !== "steps")) {
  const simPath = rel("src/lessons", lesson.moduleSlug, `${lesson.slug}.ts`);
  const simFile = join(root, simPath);
  if (!existsSync(simFile)) continue; // already reported by check 3

  let simModule: Record<string, unknown>;
  try {
    simModule = (await import(`@/lessons/${lesson.moduleSlug}/${lesson.slug}`)) as Record<string, unknown>;
  } catch (err) {
    fail("quiz integrity", `${simPath}: failed to import — ${(err as Error).message}`);
    continue;
  }

  const sims = Object.entries(simModule).filter(([, value]) => isLessonSim(value));
  if (sims.length === 0) {
    fail(
      "quiz integrity",
      `${simPath}: exports no LessonSim (looked for an exported object with id/topology/init/step)`,
    );
    continue;
  }
  if (sims.length > 1) {
    fail(
      "quiz integrity",
      `${simPath}: exports ${sims.length} LessonSim-shaped objects (${sims.map(([k]) => k).join(", ")}) — a lesson module must export exactly one`,
    );
    continue;
  }

  const [exportName, simValue] = sims[0];
  const sim = simValue as LessonSim<never>;

  // Convention (holds for every shipped lesson): sim.id === lesson slug, so a
  // sim can be traced back to its registry entry from a debugger snapshot.
  if (sim.id !== lesson.slug) {
    fail(
      "quiz integrity",
      `${simPath}: ${exportName}.id is "${sim.id}" but the lesson slug is "${lesson.slug}" — the sim id must equal the slug`,
    );
  }

  // --- quizzes ---
  const quiz: QuizCheckpoint<never>[] = sim.quiz ?? [];
  totalQuizzes += quiz.length;

  const localIds = new Set<string>();
  for (const [i, q] of quiz.entries()) {
    const where = `${simPath}: quiz[${i}]`;

    if (!q.id) {
      fail("quiz integrity", `${where} has an empty id`);
    } else if (localIds.has(q.id)) {
      fail("quiz integrity", `${where}: duplicate checkpoint id "${q.id}" within lesson "${lesson.slug}"`);
    } else {
      const owner = quizOwner.get(q.id);
      if (owner) {
        fail(
          "quiz integrity",
          `${where}: checkpoint id "${q.id}" is already used by lesson "${owner}" — quiz ids must be globally unique`,
        );
      } else {
        quizOwner.set(q.id, lesson.slug);
      }
    }
    localIds.add(q.id);

    if (!(typeof q.at === "number" && Number.isFinite(q.at) && q.at > 0)) {
      fail(
        "quiz integrity",
        `${where} ("${q.id}") has at=${String(q.at)} — a checkpoint must fire at a positive sim time`,
      );
    }

    const choices = Array.isArray(q.choices) ? q.choices : [];
    if (choices.length < 2) {
      fail("quiz integrity", `${where} ("${q.id}") has ${choices.length} choice(s) — a prediction needs at least 2`);
    }
    const choiceIds = new Set<string>();
    for (const c of choices) {
      if (!c.id) {
        fail("quiz integrity", `${where} ("${q.id}") has a choice with an empty id`);
      } else if (choiceIds.has(c.id)) {
        fail("quiz integrity", `${where} ("${q.id}") has duplicate choice id "${c.id}"`);
      }
      choiceIds.add(c.id);
      if (!c.label) {
        fail("quiz integrity", `${where} ("${q.id}") choice "${c.id}" has an empty label`);
      }
    }
    if (!choiceIds.has(q.correctChoiceId)) {
      fail(
        "quiz integrity",
        `${where} ("${q.id}"): correctChoiceId "${q.correctChoiceId}" is not one of its choices (${[...choiceIds].join(", ") || "none"})`,
      );
    }
  }

  // --- meters ---
  const meters: MeterSpec[] = Array.isArray(sim.meters) ? sim.meters : [];
  if (meters.length === 0) {
    fail("meter sanity", `${simPath}: ${exportName} declares no meters`);
  }
  const metricKeys = new Set<string>();
  for (const [i, m] of meters.entries()) {
    const where = `${simPath}: meters[${i}]`;
    if (!m.metricKey || typeof m.metricKey !== "string") {
      fail("meter sanity", `${where} has an empty metricKey`);
    } else if (metricKeys.has(m.metricKey)) {
      fail("meter sanity", `${where}: duplicate metricKey "${m.metricKey}" in the same meter row`);
    }
    metricKeys.add(m.metricKey);

    if (!m.label) {
      fail("meter sanity", `${where} ("${m.metricKey}") has an empty label`);
    }
    if (!VALID_METER_KINDS.has(m.kind)) {
      fail(
        "meter sanity",
        `${where} ("${m.metricKey}") has invalid kind ${JSON.stringify(m.kind)} (expected ${[...VALID_METER_KINDS].join(" | ")})`,
      );
    }
    if ((m.kind === "bar" || m.kind === "gauge") && !(typeof m.max === "number" && m.max > 0)) {
      fail(
        "meter sanity",
        `${where} ("${m.metricKey}") is a "${m.kind}" meter but has no positive max — it cannot be scaled`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 9. README curriculum table
 *
 * The README claimed 10 lessons in 3 modules while the registry held 26 in 5.
 * Prose drifts silently, so the table is GENERATED from the registry and pinned
 * here: the fix for documentation rot is a failing check, not a promise to
 * remember. Run with `--write-readme` to regenerate it.
 * ------------------------------------------------------------------ */

{
  const START =
    "<!-- CURRICULUM:START — generated by scripts/check-curriculum.mts --write-readme. Do not edit by hand. -->";
  const END = "<!-- CURRICULUM:END -->";
  const readmePath = "README.md";
  const readmeFile = join(root, readmePath);

  /** The block the registry implies, markers included. */
  const render = (): string => {
    const parts: string[] = [START];
    for (const [i, track] of curriculum.tracks.entries()) {
      const live = track.modules
        .flatMap((m) => m.lessons)
        .filter((l) => l.status === "available");
      const minutes = live.reduce((sum, l) => sum + l.estimatedMinutes, 0);
      const label = `Track ${String(i + 1).padStart(2, "0")}`;
      // "0h 12m" reads like a bug; a young track is just minutes.
      const duration =
        minutes >= 60
          ? `about ${Math.floor(minutes / 60)}h ${minutes % 60}m end to end`
          : `about ${minutes} minutes end to end`;

      parts.push(
        "",
        `### ${label} — ${track.title}`,
        "",
        `${live.length} lesson${live.length === 1 ? "" : "s"} across ` +
          `${track.modules.length} module${track.modules.length === 1 ? "" : "s"}, ` +
          `${duration}.`,
        "",
        "| Module | Lessons |",
        "|---|---|",
      );
      for (const mod of track.modules) {
        const titles = mod.lessons
          .filter((l) => l.status === "available")
          .map((l) => l.title)
          .join(" · ");
        parts.push(`| **${mod.title}** | ${titles} |`);
      }
    }
    parts.push("", END);
    return parts.join("\n");
  };

  const expected = render();

  if (!existsSync(readmeFile)) {
    fail("readme sync", `${readmePath} does not exist`);
  } else {
    const readme = readFileSync(readmeFile, "utf8");
    const start = readme.indexOf(START);
    const end = readme.indexOf(END);

    if (start === -1 || end === -1 || end < start) {
      fail(
        "readme sync",
        `${readmePath} is missing the CURRICULUM:START/END markers that fence the generated table — run \`npx tsx scripts/check-curriculum.mts --write-readme\``,
      );
    } else {
      const found = readme.slice(start, end + END.length);
      if (found !== expected) {
        if (process.argv.includes("--write-readme")) {
          writeFileSync(
            readmeFile,
            readme.slice(0, start) + expected + readme.slice(end + END.length),
          );
          console.log(`check-curriculum: regenerated the ${readmePath} curriculum block`);
        } else {
          // Point at the first differing line: a whole-block diff is noise.
          const wantLines = expected.split("\n");
          const gotLines = found.split("\n");
          const at = wantLines.findIndex((line, i) => gotLines[i] !== line);
          fail(
            "readme sync",
            `${readmePath}'s curriculum block is stale — run \`npx tsx scripts/check-curriculum.mts --write-readme\`.\n` +
              `        first difference at block line ${at + 1}:\n` +
              `        expected: ${wantLines[at] ?? "(end of block)"}\n` +
              `        found:    ${gotLines[at] ?? "(end of block)"}`,
          );
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

if (failures.length > 0) {
  const order: Category[] = [
    "route parity",
    "section parity",
    "companion files",
    "slug integrity",
    "prerequisites",
    "quiz integrity",
    "meter sanity",
    "algo integrity",
    "readme sync",
  ];
  const lines: string[] = [];
  for (const category of order) {
    const group = failures.filter((f) => f.category === category);
    if (group.length === 0) continue;
    lines.push(`  ${category}:`);
    for (const f of group) lines.push(`    - ${f.message}`);
  }
  console.error(
    `check-curriculum FAILED — ${failures.length} problem${failures.length === 1 ? "" : "s"}:\n` + lines.join("\n"),
  );
  process.exit(1);
}

console.log(
  `check-curriculum OK — ${entries.length} lessons registered, ` +
    `${available.length} available, ${totalSections} sections, ${totalQuizzes} quizzes`,
);
