import { REPO_COUNTERS, runRepoScript, type RepoCommand, type RepoScript } from "@/engine/algo/repo";
import type { AlgoDef } from "@/engine/algo/types";
import type { RepoState } from "@/engine/algo/views/repo";

/**
 * Reset — archetype E (`runRepoScript`), rendered by `RepoView`.
 *
 * `reset` MOVES the current branch pointer to an existing commit. It creates
 * nothing and copies nothing — the whole operation is a pointer moving. That is
 * what separates it from every other operation in this module:
 *
 *   - cherry-pick and rebase COPY commits (new ids);
 *   - revert ADDS a commit that inverts an earlier one, leaving it in place;
 *   - reset moves the pointer BACK, so the commits ahead of the new tip lose
 *     their last reference and go unreachable.
 *
 * The hazard is that reset does not undo the work in the record — it discards
 * the work FROM the record. Revert keeps both the mistake and its undo; reset
 * removes the mistake as if it had never happened. That is why reset is safe on
 * commits only YOU have (local cleanup) and dangerous on commits others have
 * pulled: it takes their base out from under them, exactly like a rebase.
 *
 * Two figures make the contrast concrete:
 *
 *   discard  — a branch with three commits is reset back to the first; the two
 *              commits ahead of the new tip go red-and-dashed (unreachable),
 *              the reset counter reads 1, and NO new commit is made.
 *   survive  — the identical reset, except a second branch (`backup`) was
 *              pointed at the tip first. Now moving `main` back orphans NOTHING,
 *              because unreachability is about ALL references: the work is still
 *              one branch away. This is the model's honest version of "the
 *              commits are still in the reflog" — another ref keeps them alive.
 *
 * LIMITS — a believable model, not git. It tracks commit identity, parentage,
 * reachability and branch tips; it does NOT model the index or the working
 * tree, so it cannot distinguish `--soft` / `--mixed` / `--hard` (those differ
 * only in what happens to uncommitted changes, which this model has none of).
 * "Unreachable" stands in for "recoverable only via the reflog until it is
 * pruned". `runRepoScript` takes no rng — git is not random.
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
const reset = (id: string): RepoCommand => ({
  label: `git reset --hard ${id}`,
  op: { kind: "reset", commit: id },
  codeLine: 2,
});

/**
 * Discard case. main gains three commits, then resets to the first.
 *   c1 baseline   (main)
 *   c2 add search (main)
 *   c3 wip        (main)
 *   reset c1      — main moves back to c1; c2 and c3 go unreachable.
 * No commit is created; the reset counter reads 1.
 */
const discardScript: RepoScript = {
  commands: [
    commit("baseline"),
    commit("add search"),
    commit("wip"),
    reset("c1"),
  ],
};

/**
 * Survive case. Identical work and the identical reset, but a `backup` branch
 * is pointed at the tip BEFORE resetting.
 *   c1 baseline   (main)
 *   c2 add search (main)
 *   c3 wip        (main, backup)
 *   reset c1      — main moves back to c1; backup still holds c2 and c3, so
 *                   NOTHING goes unreachable.
 */
const surviveScript: RepoScript = {
  commands: [
    commit("baseline"),
    commit("add search"),
    commit("wip"),
    branch("backup"),
    reset("c1"),
  ],
};

const DISCARD_CODE = [
  "git commit",
  "git branch <name>",
  "git reset --hard c1",
];

const counters = [
  { key: REPO_COUNTERS.commits, label: "commits made" },
  { key: REPO_COUNTERS.resets, label: "resets" },
];

/** Reset back three commits with no safety net: two commits go unreachable. */
export const resetAlgo: AlgoDef<RepoState, RepoScript> = {
  // The id must start with the lesson slug — check-curriculum enforces it.
  id: "reset",
  title: "reset — discard",
  code: DISCARD_CODE,
  counters,
  generateInput: () => discardScript,
  run: (script) => runRepoScript(script),
};

/** The same reset, but a backup branch was set first: nothing is orphaned. */
export const resetSurviveAlgo: AlgoDef<RepoState, RepoScript> = {
  id: "reset-survive",
  title: "reset — with a backup",
  code: DISCARD_CODE,
  counters,
  generateInput: () => surviveScript,
  run: (script) => runRepoScript(script),
};
