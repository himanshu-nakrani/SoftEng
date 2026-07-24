// CI invariant: curriculum registry ↔ route folders stay in sync.
// - Every lesson with status "available" must have src/app/learn/<module>/<slug>/page.tsx
// - Every route folder under src/app/learn/*/*/ must be a registered lesson
//   (catches typos and forgotten registry entries).
//
// The registry is TypeScript, so we extract slugs/status with a tolerant
// regex scan rather than importing it (keeps this script dependency-free).

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registrySrc = readFileSync(
  join(root, "src/curriculum/registry.ts"),
  "utf8",
);

// Parse lesson blocks: capture slug, moduleSlug, status per lesson entry.
const lessonRe =
  /slug:\s*"([^"]+)",\s*\n\s*moduleSlug:\s*"([^"]+)",[\s\S]*?status:\s*"([^"]+)"/g;

const registered = new Map(); // "module/slug" -> status
for (const m of registrySrc.matchAll(lessonRe)) {
  const [, slug, moduleSlug, status] = m;
  registered.set(`${moduleSlug}/${slug}`, status);
}

if (registered.size === 0) {
  console.error("check-curriculum: failed to parse any lessons from registry.ts");
  process.exit(1);
}

const errors = [];

// 1. Every available lesson has a route folder.
for (const [path, status] of registered) {
  const page = join(root, "src/app/learn", path, "page.tsx");
  if (status === "available" && !existsSync(page)) {
    errors.push(`lesson "${path}" is "available" but ${page} does not exist`);
  }
  if (status === "coming-soon" && existsSync(page)) {
    errors.push(`lesson "${path}" has a route but is still marked "coming-soon"`);
  }
}

// 2. Every route folder is a registered lesson.
const learnDir = join(root, "src/app/learn");
if (existsSync(learnDir)) {
  for (const moduleName of readdirSync(learnDir)) {
    const moduleDir = join(learnDir, moduleName);
    if (!statSync(moduleDir).isDirectory()) continue;
    for (const lessonName of readdirSync(moduleDir)) {
      const lessonDir = join(moduleDir, lessonName);
      if (!statSync(lessonDir).isDirectory()) continue;
      if (!existsSync(join(lessonDir, "page.tsx"))) continue;
      if (!registered.has(`${moduleName}/${lessonName}`)) {
        errors.push(
          `route src/app/learn/${moduleName}/${lessonName}/ is not in the curriculum registry`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("check-curriculum FAILED:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

console.log(
  `check-curriculum OK — ${registered.size} lessons registered, ` +
    `${[...registered.values()].filter((s) => s === "available").length} available`,
);
