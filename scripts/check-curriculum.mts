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
 *   1. route parity      — available ⇒ page.tsx; every route folder registered;
 *                          coming-soon ⇒ no route folder
 *   2. section parity    — registry sections ↔ <LessonSection id> in page.tsx
 *   3. companion files   — <slug>-figure.tsx and <slug>.ts exist
 *   4. slug integrity    — slugs unique, moduleSlug matches nesting
 *   5. prerequisites     — resolve, and come strictly earlier in lesson order
 *   6. quiz integrity    — ids unique (per lesson + globally), at > 0,
 *                          correctChoiceId ∈ choices, sim.id === slug
 *   7. meter sanity      — metricKey non-empty, kind valid, keys unique
 *
 * Run: npx tsx scripts/check-curriculum.mts
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { curriculum } from "@/curriculum/registry";
import type { LessonMeta, Module } from "@/curriculum/types";
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
  | "meter sanity";

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
  /** Position in flattened curriculum order. */
  order: number;
}

const entries: Entry[] = [];
const allModules: { mod: Module }[] = [];

for (const track of curriculum.tracks) {
  for (const mod of track.modules) {
    allModules.push({ mod });
    for (const lesson of mod.lessons) {
      entries.push({ lesson, mod, order: entries.length });
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

  const seenModule = new Map<string, number>();
  for (const { mod } of allModules) {
    if (!mod.slug) {
      fail("slug integrity", `module "${mod.title}" has an empty slug`);
    }
    seenModule.set(mod.slug, (seenModule.get(mod.slug) ?? 0) + 1);
  }
  for (const [slug, count] of seenModule) {
    if (count > 1) {
      fail("slug integrity", `module slug "${slug}" is used ${count}× — module slugs must be unique`);
    }
  }

  // The app's helpers (src/lib/curriculum.ts) flatten track[0] only; if the
  // registry grows a second track they would silently ignore it.
  if (allLessons.length !== entries.length) {
    fail(
      "slug integrity",
      `src/lib/curriculum.ts exposes ${allLessons.length} lessons but the registry defines ${entries.length} — allLessons assumes a single track, so lessons outside tracks[0] are invisible to the app`,
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
 * ------------------------------------------------------------------ */

const learnDir = join(root, "src/app/learn");

for (const { lesson } of entries) {
  const routeDir = join(learnDir, lesson.moduleSlug, lesson.slug);
  const page = join(routeDir, "page.tsx");
  const routePath = rel("src/app/learn", lesson.moduleSlug, lesson.slug);

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

/* ------------------------------------------------------------------ *
 * 1b. Route parity (filesystem → registry)
 * ------------------------------------------------------------------ */

const moduleSlugs = new Set(allModules.map((m) => m.mod.slug));
const lessonRouteKeys = new Set(entries.map((e) => `${e.lesson.moduleSlug}/${e.lesson.slug}`));

if (isDir(learnDir)) {
  for (const moduleName of readdirSync(learnDir)) {
    const moduleDir = join(learnDir, moduleName);
    if (!isDir(moduleDir)) continue; // layout.tsx / page.tsx at the learn root

    if (!moduleSlugs.has(moduleName)) {
      fail("route parity", `route folder src/app/learn/${moduleName}/ does not match any registered module slug`);
      continue;
    }

    for (const lessonName of readdirSync(moduleDir)) {
      const lessonDir = join(moduleDir, lessonName);
      if (!isDir(lessonDir)) continue;

      const routePath = `src/app/learn/${moduleName}/${lessonName}`;
      if (!lessonRouteKeys.has(`${moduleName}/${lessonName}`)) {
        fail("route parity", `route folder ${routePath}/ is not in the curriculum registry`);
      }
      // A registered folder that is missing page.tsx is already reported by
      // check 1 (available ⇒ page.tsx) or by the coming-soon rule above.
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

for (const { lesson } of entries) {
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
  const pagePath = rel("src/app/learn", lesson.moduleSlug, lesson.slug, "page.tsx");
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

const quizOwner = new Map<string, string>(); // quiz id -> lesson slug
let totalQuizzes = 0;

for (const { lesson } of available) {
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
