import {
  REPO_COUNTERS,
  runRepoScript,
  type RepoCommand,
  type RepoScript,
} from "@/engine/algo/repo";
import type { AlgoDef } from "@/engine/algo/types";
import type { RepoState } from "@/engine/algo/views/repo";

/**
 * Three-Way Merge & Conflicts — archetype E (`runRepoScript`), rendered by `RepoView`.
 *
 * Setup: common ancestor commit `base` on main.
 * Branch `feature` branches from `base` and adds 2 commits (`feat 1`, `feat 2`).
 * `main` advances with 1 commit (`main 1`).
 *
 * Two defs:
 *   - Def 1 (`threeWayMergeCleanAlgo`): `main` and `feature` touched non-overlapping
 *     parts. `git merge feature` cleanly integrates with merge base LCA, creating
 *     a 2-parent merge commit.
 *   - Def 2 (`threeWayMergeFastForwardAlgo`): where feature is merged when main
 *     has NOT diverged, demonstrating fast-forward (pointer slides, 0 merge commits)
 *     vs 3-way merge.
 *
 * Code lines must be <= 27 characters (the `algo integrity` check enforces it).
 */

const commit = (message: string): RepoCommand => ({
  label: `git commit -m "${message}"`,
  op: { kind: "commit", message },
  codeLine: 0,
});
const branch = (name: string): RepoCommand => ({
  label: `git branch ${name}`,
  op: { kind: "branch", name },
  codeLine: 1,
});
const checkout = (name: string): RepoCommand => ({
  label: `git checkout ${name}`,
  op: { kind: "checkout", name },
  codeLine: 2,
});
const merge = (from: string): RepoCommand => ({
  label: `git merge ${from}`,
  op: { kind: "merge", from },
  codeLine: 3,
});

/**
 * Shared setup:
 *   main:    base
 *   feature: base -> feat 1 -> feat 2
 */
const SETUP: RepoCommand[] = [
  commit("base"),
  branch("feature"),
  checkout("feature"),
  commit("feat 1"),
  commit("feat 2"),
  checkout("main"),
];

/**
 * Clean 3-way merge:
 * main advances with "main 1". Both sides diverged from base (LCA).
 * Merging feature produces a 2-parent merge commit (c5).
 */
const cleanMergeScript: RepoScript = {
  commands: [
    ...SETUP,
    commit("main 1"),
    merge("feature"),
  ],
};

/**
 * Fast-forward case:
 * main has NOT diverged (it is still at base).
 * git merge feature slides the main pointer to feat 2 (c3) with 0 merge commits.
 */
const fastForwardScript: RepoScript = {
  commands: [
    ...SETUP,
    merge("feature"),
  ],
};

const CODE = [
  "git commit",
  "git branch feature",
  "git checkout <branch>",
  "git merge feature",
];

const counters = [
  { key: REPO_COUNTERS.commits, label: "commits made" },
  { key: REPO_COUNTERS.merges, label: "merge commits" },
];

/** Diverged branches merged cleanly via LCA into a 2-parent merge commit. */
export const threeWayMergeCleanAlgo: AlgoDef<RepoState, RepoScript> = {
  id: "three-way-merge",
  title: "three-way merge",
  code: CODE,
  counters,
  generateInput: () => cleanMergeScript,
  run: (script) => runRepoScript(script),
};

/** Undiverged trunk: pointer slides to feature tip, 0 merge commits created. */
export const threeWayMergeFastForwardAlgo: AlgoDef<RepoState, RepoScript> = {
  id: "three-way-merge-fast-forward",
  title: "fast-forward",
  code: CODE,
  counters,
  generateInput: () => fastForwardScript,
  run: (script) => runRepoScript(script),
};

export const threeWayMergeAlgo = threeWayMergeCleanAlgo;
