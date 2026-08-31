import { REPO_COUNTERS, runRepoScript, type RepoCommand, type RepoScript } from "@/engine/algo/repo";
import type { AlgoDef } from "@/engine/algo/types";
import type { RepoState } from "@/engine/algo/views/repo";

/**
 * Cherry-Pick and Revert — archetype E (`runRepoScript`), rendered by
 * `RepoView`. Two operations that act on ONE commit rather than a branch.
 *
 * `cherry-pick` COPIES a single commit onto the current branch: a new commit
 * with a new id and the same change. The original is untouched and still
 * reachable on its own branch, so the work now exists in two places. The copy
 * carries `copyOf` back to its source — deliberately NOT `rewriteOf`, because a
 * rebase copy orphans its original while a cherry-pick copy does not.
 *
 * `revert` does the inverse: it creates a NEW commit whose change undoes an
 * earlier one, leaving the original in place. The undo carries `revertOf`. That
 * additive shape is why revert is safe on published history where a reset —
 * which would erase the commit — is not.
 *
 * The cherry-pick figure runs the full payoff: the fix is cherry-picked onto
 * main, then the branch it came from is merged, so the same logical change
 * arrives a SECOND time — once as the copy, once as the original riding in on
 * the merge. Two commits for one change.
 *
 * LIMITS — this is a believable model, not git. It tracks commit identity,
 * parentage, reachability and branch tips; it does NOT diff file contents, so
 * it cannot detect that a cherry-pick would apply cleanly or that a merge of an
 * already-picked change conflicts. It shows the DUPLICATE (two commits, one
 * change) as structure; a real merge conflict is the same fact surfacing in the
 * working tree. `runRepoScript` takes no rng — git is not random.
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
const cherryPick = (id: string): RepoCommand => ({
  label: `git cherry-pick ${id}`,
  op: { kind: "cherryPick", commit: id },
  codeLine: 3,
});
const merge = (from: string): RepoCommand => ({
  label: `git merge ${from}`,
  op: { kind: "merge", from },
  codeLine: 4,
});
/*
 * NOTE the codeLine: this builder is used only by `revertScript`, which runs
 * against REVERT_CODE (two lines), not CHERRY_CODE (five). The builders above are
 * shared, so their indices belong to CHERRY_CODE — a shared builder with a
 * per-script index is the reason the revert panel briefly had blank lines.
 */
const revert = (id: string): RepoCommand => ({
  label: `git revert ${id}`,
  op: { kind: "revert", commit: id },
  codeLine: 1,
});

/**
 * Cherry-pick, then merge the source branch — the full duplicate story.
 *   c1 init            (main)
 *   c2 urgent fix      (feature, branched at c1)
 *   c3 more work       (feature)
 *   c4 urgent fix      (main — a COPY of c2, copyOf=c2)
 *   c5 merge feature   (main — pulls c2 and c3 back in)
 * After the merge the change from c2 exists as BOTH c2 and c4: two commits,
 * one logical change.
 */
const cherryPickScript: RepoScript = {
  commands: [
    commit("init"),
    branch("feature"),
    checkout("feature"),
    commit("urgent fix"),
    commit("more work"),
    checkout("main"),
    cherryPick("c2"),
    merge("feature"),
  ],
};

/**
 * Revert a bad commit in place.
 *   c1 init
 *   c2 add feature
 *   c3 bad change
 *   c4 revert bad change (revertOf=c3)
 * c3 stays exactly where it was; c4 is a new commit that reverses it.
 */
const revertScript: RepoScript = {
  commands: [
    commit("init"),
    commit("add feature"),
    commit("bad change"),
    revert("c3"),
  ],
};

const CHERRY_CODE = [
  "git commit",
  "git branch feature",
  "git checkout <branch>",
  "git cherry-pick c2",
  "git merge feature",
];

/*
 * No PADDING. This was ["git commit", "", "", "git revert c3"] so that the
 * revert command's codeLine of 3 lined up, which rendered two blank numbered
 * lines in the panel. Point every commit at one line instead, and let the
 * command's codeLine say which line it is.
 */
const REVERT_CODE = ["git commit", "git revert c3"];

const cherryCounters = [
  { key: REPO_COUNTERS.commits, label: "commits made" },
  { key: REPO_COUNTERS.copies, label: "cherry-picks" },
  { key: REPO_COUNTERS.merges, label: "merge commits" },
];

const revertCounters = [
  { key: REPO_COUNTERS.commits, label: "commits made" },
  { key: REPO_COUNTERS.reverts, label: "reverts" },
];

/** Cherry-pick a fix onto main, then merge the branch — the change lands twice. */
export const cherryPickAlgo: AlgoDef<RepoState, RepoScript> = {
  // The id must start with the lesson slug — check-curriculum enforces it.
  id: "cherry-pick-revert",
  title: "cherry-pick",
  code: CHERRY_CODE,
  counters: cherryCounters,
  generateInput: () => cherryPickScript,
  run: (script) => runRepoScript(script),
};

/** Revert a bad commit: a new commit undoes it, the original stays in place. */
export const revertAlgo: AlgoDef<RepoState, RepoScript> = {
  id: "cherry-pick-revert-revert",
  title: "revert",
  code: REVERT_CODE,
  counters: revertCounters,
  generateInput: () => revertScript,
  run: (script) => runRepoScript(script),
};
