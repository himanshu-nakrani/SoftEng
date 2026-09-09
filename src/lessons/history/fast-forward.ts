import { REPO_COUNTERS, runRepoScript, type RepoCommand, type RepoScript } from "@/engine/algo/repo";
import type { AlgoDef } from "@/engine/algo/types";
import type { RepoState } from "@/engine/algo/views/repo";

/**
 * Fast-Forward — archetype E (`runRepoScript`), rendered by `RepoView`.
 *
 * Two figures run the SAME command, `git merge feature`, and get opposite
 * results. The difference is not the command; it is whether `main` has moved.
 *
 * In the first, `feature` is strictly ahead of `main` and `main` has no commits
 * the branch does not already contain. There is nothing to reconcile, so git
 * FAST-FORWARDS: it slides the `main` pointer to the feature tip and makes NO
 * new commit. A learner who expects a merge commit here does not get one.
 *
 * In the second, `main` has gained a commit of its own after the branch point,
 * so the histories have diverged. Now a fast-forward is impossible — there is
 * no straight line to slide along — and git records a real two-parent merge
 * commit.
 *
 * That is the lesson: divergence, not the command you typed, decides whether a
 * merge commit appears. `runRepoScript` takes no rng — git is not random.
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
const merge: RepoCommand = {
  label: "git merge feature",
  op: { kind: "merge", from: "feature" },
  codeLine: 3,
};

/**
 * Fast-forward case. `main` never moves after `feature` branches off it, so
 * `feature` = base → work1 → work2 and `main` = base. Merging is a slide.
 */
const ffScript: RepoScript = {
  commands: [
    commit("base"),
    branch("feature"),
    checkout("feature"),
    commit("add cache"),
    commit("add flush"),
    checkout("main"),
    merge,
  ],
};

/**
 * No-fast-forward case. Identical feature work, but `main` gains "hotfix" after
 * the branch point. The histories diverge, so the same merge cannot slide and a
 * real merge commit is created instead.
 */
const noFfScript: RepoScript = {
  commands: [
    commit("base"),
    branch("feature"),
    checkout("feature"),
    commit("add cache"),
    commit("add flush"),
    checkout("main"),
    commit("hotfix"),
    merge,
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

/** Merge that fast-forwards: the pointer moves, no commit is created. */
export const fastForwardAlgo: AlgoDef<RepoState, RepoScript> = {
  // The id must start with the lesson slug — check-curriculum enforces it.
  id: "fast-forward",
  title: "fast-forward",
  code: CODE,
  counters,
  generateInput: () => ffScript,
  run: (script) => runRepoScript(script),
};

/** Merge that cannot fast-forward: main diverged, so a merge commit appears. */
export const fastForwardDivergedAlgo: AlgoDef<RepoState, RepoScript> = {
  id: "fast-forward-diverged",
  title: "no fast-forward",
  code: CODE,
  counters,
  generateInput: () => noFfScript,
  run: (script) => runRepoScript(script),
};
