import { REPO_COUNTERS, runRepoScript, type RepoCommand, type RepoScript } from "@/engine/algo/repo";
import type { AlgoDef } from "@/engine/algo/types";
import type { RepoState } from "@/engine/algo/views/repo";

/**
 * Merge vs Rebase — archetype E (`runRepoScript`), rendered by `RepoView`.
 *
 * Both figures run the IDENTICAL work: `main` gets one commit after the branch
 * point, `feature` gets two. The histories have diverged — neither branch is an
 * ancestor of the other — which is the only interesting case, because it is the
 * only one where merge and rebase produce genuinely different shapes.
 *
 * `merge` records a two-parent commit and keeps both lines of history intact.
 * `rebase` COPIES the feature commits onto the tip of `main`, chaining them
 * oldest-first, and leaves the originals reachable by no branch — orphaned,
 * with `rewriteOf` set on each copy pointing back at the commit it replaced.
 *
 * That is the whole lesson: the same three commits of work, two different DAGs.
 * A def's `run` ignores the second (rng) argument — git is not random.
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

/**
 * The shared setup, identical in both scripts:
 *   main:    base → api
 *   feature: base → login → logout   (branched at base)
 * Both sides have moved past the branch point, so the two histories diverge.
 */
const DIVERGED: RepoCommand[] = [
  commit("base"),
  branch("feature"),
  commit("add api"),
  checkout("feature"),
  commit("add login"),
  commit("add logout"),
];

/** Integrate feature into main with a merge commit. */
const mergeScript: RepoScript = {
  commands: [
    ...DIVERGED,
    checkout("main"),
    {
      label: "git merge feature",
      op: { kind: "merge", from: "feature" },
      codeLine: 3,
    },
  ],
};

/** Replay feature's commits onto main's tip — new ids, originals orphaned. */
const rebaseScript: RepoScript = {
  commands: [
    ...DIVERGED,
    {
      label: "git rebase main",
      op: { kind: "rebase", onto: "main" },
      codeLine: 4,
    },
  ],
};

const CODE = [
  "git commit",
  "git branch feature",
  "git checkout <branch>",
  "git merge feature",
  "git rebase main",
];

const counters = [
  { key: REPO_COUNTERS.commits, label: "commits made" },
  { key: REPO_COUNTERS.merges, label: "merge commits" },
  { key: REPO_COUNTERS.replayed, label: "commits copied" },
];

/** Integration by merge: a two-parent commit, both histories preserved. */
export const mergeVsRebaseAlgo: AlgoDef<RepoState, RepoScript> = {
  // The id must start with the lesson slug — check-curriculum enforces it.
  id: "merge-vs-rebase",
  title: "by merge",
  code: CODE,
  counters,
  generateInput: () => mergeScript,
  run: (script) => runRepoScript(script),
};

/** Integration by rebase: commits copied onto a new base, originals orphaned. */
export const mergeVsRebaseRebasedAlgo: AlgoDef<RepoState, RepoScript> = {
  id: "merge-vs-rebase-rebased",
  title: "by rebase",
  code: CODE,
  counters,
  generateInput: () => rebaseScript,
  run: (script) => runRepoScript(script),
};
