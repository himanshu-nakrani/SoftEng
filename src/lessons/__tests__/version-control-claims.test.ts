import { buildAlgoSteps } from "@/engine/algo/build";
import { REPO_COUNTERS as C } from "@/engine/algo/repo";
import type { AlgoDef } from "@/engine/algo/types";
import type { RepoState } from "@/engine/algo/views/repo";
import {
  mergeVsRebaseAlgo,
  mergeVsRebaseRebasedAlgo,
} from "@/lessons/history/merge-vs-rebase";
import {
  fastForwardAlgo,
  fastForwardDivergedAlgo,
} from "@/lessons/history/fast-forward";
import {
  cherryPickAlgo,
  revertAlgo,
} from "@/lessons/history/cherry-pick-revert";
import { resetAlgo, resetSurviveAlgo } from "@/lessons/history/reset";
import {
  threeWayMergeCleanAlgo,
  threeWayMergeFastForwardAlgo,
} from "@/lessons/history/three-way-merge";
import { describe, expect, it } from "vitest";

/**
 * The version-control history module's prose states numbers and graph shapes.
 * A failure here means a lesson page now lies, and the message should name the
 * sentence that became untrue.
 *
 * Archetype E takes no rng and no size — every def runs one fixed script, so a
 * claim reads "the final DAG says X". `run(script, rng)` ignores rng; we pass
 * size 0, seed 42 to `buildAlgoSteps` for consistency with the other suites.
 */
function run<I>(def: AlgoDef<RepoState, I>) {
  const steps = buildAlgoSteps(def, 0, 42);
  const final = steps[steps.length - 1];
  return {
    steps,
    state: final.state,
    counters: final.counters,
    /** Two-parent commits — merge commits and nothing else. */
    merges: final.state.commits.filter((c) => c.parents.length === 2),
    /** Commits produced by copying — the rebase replays. */
    copies: final.state.commits.filter((c) => c.rewriteOf !== undefined),
  };
}

const last = <S,>(steps: { state: S }[]) => steps[steps.length - 1].state;

// ---------------------------------------------------------------------------
// merge-vs-rebase
// ---------------------------------------------------------------------------

describe("merge-vs-rebase · the same work runs in both figures", () => {
  it("has four commits before either integration touches the DAG", () => {
    // "Four commits of work exist before either integration runs: one on main,
    // two on feature, and the base they share."
    const merge = run(mergeVsRebaseAlgo);
    const rebase = run(mergeVsRebaseRebasedAlgo);
    // The frame just before the merge / rebase command.
    const beforeMerge = merge.steps[merge.steps.length - 2].state;
    const beforeRebase = rebase.steps[rebase.steps.length - 2].state;
    expect(beforeMerge.commits).toHaveLength(4);
    expect(beforeRebase.commits).toHaveLength(4);
    // Identical work: same messages, same ids, up to that point.
    expect(beforeMerge.commits.map((c) => [c.id, c.message])).toEqual(
      beforeRebase.commits.map((c) => [c.id, c.message]),
    );
  });

  it("branches diverged: neither is an ancestor of the other", () => {
    // "Neither branch is an ancestor of the other; that is what diverged means."
    const rebase = run(mergeVsRebaseRebasedAlgo);
    const before = rebase.steps[rebase.steps.length - 2].state;
    // main tip is c2 (base -> add api); feature tip is c4 (base -> login ->
    // logout). Their only shared ancestor is c1 (base).
    expect(before.branches.main).toBe("c2");
    expect(before.branches.feature).toBe("c4");
  });
});

describe("merge-vs-rebase · 'by merge' claims", () => {
  it("adds exactly one commit and one merge commit — four to five", () => {
    // "A fifth commit has appeared, and the merge commits meter reads 1."
    const { state, counters } = run(mergeVsRebaseAlgo);
    expect(state.commits).toHaveLength(5);
    expect(counters[C.merges]).toBe(1);
    expect(counters[C.commits]).toBe(5);
  });

  it("makes a commit with two parents — the branch tips", () => {
    // "Look at its parents: it points at both branch tips."
    const { merges } = run(mergeVsRebaseAlgo);
    expect(merges).toHaveLength(1);
    expect(merges[0].parents).toEqual(["c2", "c4"]);
  });

  it("copies nothing and orphans nothing", () => {
    // "The commits copied meter never moves and the unreachable count stays at
    // zero — a merge rewrites nothing."
    const { state, counters } = run(mergeVsRebaseAlgo);
    expect(counters[C.replayed] ?? 0).toBe(0);
    expect(state.unreachable).toEqual([]);
    expect(state.commits.every((c) => c.rewriteOf === undefined)).toBe(true);
  });

  it("keeps the four originals' ids and parents untouched", () => {
    // "The four original commits keep their ids and their parents."
    const { steps, state } = run(mergeVsRebaseAlgo);
    const before = steps[steps.length - 2].state.commits;
    for (const original of before) {
      const after = state.commits.find((c) => c.id === original.id)!;
      expect(after.parents).toEqual(original.parents);
    }
  });
});

describe("merge-vs-rebase · 'by rebase' claims", () => {
  it("jumps four commits to six and copies two", () => {
    // "The count jumped from four commits to six, and commits copied reads 2."
    const { state, counters } = run(mergeVsRebaseRebasedAlgo);
    expect(state.commits).toHaveLength(6);
    expect(counters[C.replayed]).toBe(2);
    expect(counters[C.commits]).toBe(6);
  });

  it("makes no merge commit at all", () => {
    // "there is no merge commit — the merge meter stayed at zero the whole run."
    const { merges, counters } = run(mergeVsRebaseRebasedAlgo);
    expect(merges).toHaveLength(0);
    expect(counters[C.merges] ?? 0).toBe(0);
  });

  it("orphans the two feature originals", () => {
    // "The footer reads 2 commits now unreachable: no branch can reach them."
    const { state } = run(mergeVsRebaseRebasedAlgo);
    expect(state.unreachable).toEqual(["c3", "c4"]);
  });

  it("chains the copies oldest-first onto main's tip", () => {
    // "The two copies (c5, c6) carry the same messages onto a new base, chained
    // oldest-first, with fresh ids; each records the original it replaced."
    const { state, copies } = run(mergeVsRebaseRebasedAlgo);
    const ordered = copies.sort((a, b) => a.seq - b.seq);
    expect(ordered.map((c) => c.id)).toEqual(["c5", "c6"]);
    expect(ordered.map((c) => c.message)).toEqual(["add login", "add logout"]);
    expect(ordered.map((c) => c.rewriteOf)).toEqual(["c3", "c4"]);
    // c5 sits on main's tip (c2); c6 chains onto c5.
    expect(ordered[0].parents).toEqual(["c2"]);
    expect(ordered[1].parents).toEqual(["c5"]);
    // feature now points at the last copy.
    expect(state.branches.feature).toBe("c6");
  });

  it("ends linear: no commit has two parents", () => {
    // "The history is now a straight line."
    const { state } = run(mergeVsRebaseRebasedAlgo);
    expect(state.commits.every((c) => c.parents.length <= 1)).toBe(true);
  });
});

describe("merge-vs-rebase · 'choosing' claims", () => {
  it("contrasts five preserved commits against six with two orphaned", () => {
    // "Merge kept four commits and added a fifth ... rebase replaced two commits
    // with two copies and orphaned the originals, leaving six."
    const merge = run(mergeVsRebaseAlgo);
    const rebase = run(mergeVsRebaseRebasedAlgo);
    expect(merge.state.commits).toHaveLength(5);
    expect(merge.state.unreachable).toHaveLength(0);
    expect(rebase.state.commits).toHaveLength(6);
    expect(rebase.state.unreachable).toHaveLength(2);
  });

  it("only rebase rewrites history", () => {
    // The whole tension: "identical work, two shapes." One rewrites, one does not.
    expect(run(mergeVsRebaseAlgo).copies).toHaveLength(0);
    expect(run(mergeVsRebaseRebasedAlgo).copies).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// fast-forward
// ---------------------------------------------------------------------------

describe("fast-forward · the fast-forward case", () => {
  it("creates no commit — the count stays at 3", () => {
    // "The commit count stays at 3 — the merge made no new commit."
    const { steps, state, counters } = run(fastForwardAlgo);
    expect(state.commits).toHaveLength(3);
    // The merge frame added nothing beyond the three that already existed.
    const beforeMerge = steps[steps.length - 2].state;
    expect(beforeMerge.commits).toHaveLength(3);
    expect(counters[C.commits]).toBe(3);
  });

  it("records the fast-forward and no merge commit", () => {
    // "The caption reads fast-forward — no merge commit, and the merge commits
    // meter never leaves zero."
    const { state, counters, merges } = run(fastForwardAlgo);
    expect(state.note).toBe("fast-forward — no merge commit");
    expect(counters[C.merges] ?? 0).toBe(0);
    expect(merges).toHaveLength(0);
  });

  it("lands both branches on the same commit", () => {
    // "main now points at the feature tip, so both branches sit on the same
    // commit."
    const { state } = run(fastForwardAlgo);
    expect(state.branches.main).toBe(state.branches.feature);
    expect(state.branches.main).toBe("c3");
  });
});

describe("fast-forward · the no-fast-forward case", () => {
  it("grows from four commits to five when main has diverged", () => {
    // "the count grows from four commits to 5, the merge commits meter ticks to
    // 1, and the new commit has two parents."
    const { steps, state, counters } = run(fastForwardDivergedAlgo);
    const beforeMerge = steps[steps.length - 2].state;
    expect(beforeMerge.commits).toHaveLength(4);
    expect(state.commits).toHaveLength(5);
    expect(counters[C.merges]).toBe(1);
  });

  it("makes a real two-parent merge commit", () => {
    // "git must record a two-parent merge commit."
    const { merges, state } = run(fastForwardDivergedAlgo);
    expect(merges).toHaveLength(1);
    expect(merges[0].parents).toEqual(["c4", "c3"]);
    expect(state.branches.main).toBe(merges[0].id);
  });

  it("was caused by one commit on main after the branch point", () => {
    // "now main gains its own commit, hotfix, after the branch point."
    const { steps } = run(fastForwardDivergedAlgo);
    const hotfix = steps.find((s) => s.state.ranCommand?.includes("hotfix"))!;
    expect(hotfix.state.commits.at(-1)?.message).toBe("hotfix");
  });
});

describe("fast-forward · divergence decides, not the command", () => {
  it("runs the identical merge command in both figures", () => {
    // "The two figures run the same command over two histories." / "The command
    // is identical in both; only the history differs."
    const ff = last(runRepoStepsCmd(fastForwardAlgo));
    const noff = last(runRepoStepsCmd(fastForwardDivergedAlgo));
    expect(ff.ranCommand).toBe("git merge feature");
    expect(noff.ranCommand).toBe("git merge feature");
  });

  it("differs only in whether a merge commit appeared", () => {
    // The tension in one assertion: same command, opposite structural outcome.
    expect(run(fastForwardAlgo).merges).toHaveLength(0);
    expect(run(fastForwardDivergedAlgo).merges).toHaveLength(1);
  });
});

/** The step list, so the final frame's `ranCommand` can be read. */
function runRepoStepsCmd<I>(def: AlgoDef<RepoState, I>) {
  return buildAlgoSteps(def, 0, 42);
}

// ---------------------------------------------------------------------------
// cherry-pick-revert
// ---------------------------------------------------------------------------

/** The frame just before the merge — the cherry-pick figure's key moment. */
function afterCherryPick() {
  const steps = buildAlgoSteps(cherryPickAlgo, 0, 42);
  // Last command is the merge; the one before it is the cherry-pick.
  return steps[steps.length - 2].state;
}

describe("cherry-pick-revert · cherry-pick copies one commit", () => {
  it("creates c4, a new commit carrying c2's change onto main's tip", () => {
    // "The cherry-pick creates c4 — a new commit with a new id carrying the
    // same change as c2, parented on main's tip."
    const state = afterCherryPick();
    const copy = state.commits.find((c) => c.copyOf !== undefined)!;
    expect(copy.id).toBe("c4");
    expect(copy.message).toBe("urgent fix");
    expect(copy.copyOf).toBe("c2");
    expect(copy.parents).toEqual(["c1"]);
  });

  it("reads 1 cherry-pick and 4 commits at that point", () => {
    // "The cherry-picks meter reads 1 and the commit count is 4 at that point."
    const steps = buildAlgoSteps(cherryPickAlgo, 0, 42);
    const frame = steps[steps.length - 2];
    expect(frame.counters[C.copies]).toBe(1);
    expect(frame.state.commits).toHaveLength(4);
  });

  it("leaves c2 on feature — the fix now exists as two commits", () => {
    // "feature still contains it, so the fix now exists as two commits."
    const state = afterCherryPick();
    // feature's tip is c3, and c2 is its parent — still reachable, not orphaned.
    expect(state.branches.feature).toBe("c3");
    expect(state.commits.find((c) => c.id === "c3")!.parents).toEqual(["c2"]);
    expect(state.commits.filter((c) => c.message === "urgent fix")).toHaveLength(
      2,
    );
  });

  it("orphans nothing — the unreachable count stays at zero", () => {
    // "Nothing goes unreachable — the unreachable count stays at zero, unlike
    // a rebase."
    const state = afterCherryPick();
    expect(state.unreachable).toEqual([]);
  });
});

describe("cherry-pick-revert · revert inverts in place", () => {
  it("adds c4 whose change reverses c3, parented on it", () => {
    // "Revert adds c4, a new commit whose change reverses c3, parented directly
    // on it."
    const state = run(revertAlgo).state;
    const undo = state.commits.find((c) => c.revertOf !== undefined)!;
    expect(undo.id).toBe("c4");
    expect(undo.revertOf).toBe("c3");
    expect(undo.parents).toEqual(["c3"]);
  });

  it("goes to 4 commits with the reverts meter at 1", () => {
    // "The commit count goes to 4 and the reverts meter reads 1."
    const { state, counters } = run(revertAlgo);
    expect(state.commits).toHaveLength(4);
    expect(counters[C.reverts]).toBe(1);
  });

  it("leaves c3 in place and orphans nothing", () => {
    // "c3 stays exactly where it was — nothing is rewritten, nothing goes
    // unreachable."
    const { state } = run(revertAlgo);
    expect(state.commits.find((c) => c.id === "c3")!.message).toBe("bad change");
    expect(state.unreachable).toEqual([]);
    expect(state.commits.every((c) => c.rewriteOf === undefined)).toBe(true);
  });
});

describe("cherry-pick-revert · the duplicate comes back on merge", () => {
  it("ends at five commits after the merge", () => {
    // "The final history has five commits."
    const { state } = run(cherryPickAlgo);
    expect(state.commits).toHaveLength(5);
  });

  it("makes urgent fix appear on two commits — one change, two commits", () => {
    // "the message urgent fix appears on two of them." / "the change you
    // already copied as c4 arrives a second time as c2."
    const { state } = run(cherryPickAlgo);
    const dupes = state.commits.filter((c) => c.message === "urgent fix");
    expect(dupes).toHaveLength(2);
    expect(dupes.map((c) => c.id).sort()).toEqual(["c2", "c4"]);
  });

  it("pulls c2 and c3 in through the merge commit", () => {
    // "The branch feature ... is merged into main. The merge pulls c2 and c3
    // in."
    const { state, counters } = run(cherryPickAlgo);
    const merge = state.commits.find((c) => c.parents.length === 2)!;
    expect(merge.parents).toEqual(["c4", "c3"]);
    expect(counters[C.merges]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// reset — moves a branch pointer and discards the commits ahead of it
// ---------------------------------------------------------------------------

describe("reset · discarding without a safety net", () => {
  it("makes no commit — the count stays at 3 and resets reads 1", () => {
    // "The commit count stays at 3 — reset made no commit, so commits made
    // never moves past 3 and resets reads 1."
    const { state, counters } = run(resetAlgo);
    expect(state.commits).toHaveLength(3);
    expect(counters[C.commits]).toBe(3);
    expect(counters[C.resets]).toBe(1);
  });

  it("moves main back to c1", () => {
    // "main now points at c1."
    const { state } = run(resetAlgo);
    expect(state.branches.main).toBe("c1");
    expect(state.head).toBe("main");
  });

  it("orphans exactly the two commits ahead of the new tip", () => {
    // "the footer reads 2 commits now unreachable ... c2 and c3."
    const { state } = run(resetAlgo);
    expect(state.unreachable.slice().sort()).toEqual(["c2", "c3"]);
  });

  it("copies, reverts and rewrites nothing — only a pointer moved", () => {
    // "it creates no commit, copies nothing, and inverts nothing."
    const { state } = run(resetAlgo);
    expect(
      state.commits.every(
        (c) =>
          c.copyOf === undefined &&
          c.revertOf === undefined &&
          c.rewriteOf === undefined,
      ),
    ).toBe(true);
    expect(state.commits.filter((c) => c.parents.length === 2)).toHaveLength(0);
  });
});

describe("reset · the same reset with a backup branch", () => {
  it("orphans nothing — the unreachable count stays at zero", () => {
    // "the unreachable count stays at zero ... backup still holds c2 and c3."
    const { state, counters } = run(resetSurviveAlgo);
    expect(state.unreachable).toEqual([]);
    expect(state.branches.main).toBe("c1");
    expect(state.branches.backup).toBe("c3");
    // Identical mechanics: still no commit, still one reset.
    expect(state.commits).toHaveLength(3);
    expect(counters[C.commits]).toBe(3);
    expect(counters[C.resets]).toBe(1);
  });
});

describe("reset · reset versus revert", () => {
  it("revert adds a commit and keeps the target; reset removes both ahead", () => {
    // "Revert would have left c3 in place and added a fourth commit ... Reset
    // removed c2 and c3 as if they had never existed."
    const reverted = run(revertAlgo);
    const wasReset = run(resetAlgo);
    // revert: 4 commits, nothing unreachable, an inverting commit exists.
    expect(reverted.state.commits).toHaveLength(4);
    expect(reverted.state.unreachable).toEqual([]);
    expect(
      reverted.state.commits.some((c) => c.revertOf !== undefined),
    ).toBe(true);
    // reset: no new commit, two orphaned, nothing inverting.
    expect(wasReset.state.commits).toHaveLength(3);
    expect(wasReset.state.unreachable).toHaveLength(2);
    expect(
      wasReset.state.commits.every((c) => c.revertOf === undefined),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// three-way-merge
// ---------------------------------------------------------------------------

describe("three-way-merge · clean three-way merge", () => {
  it("has four commits before merge touches the DAG", () => {
    // "The commit count grows from 4 to 5, and the merge commits meter ticks to 1."
    const { steps } = run(threeWayMergeCleanAlgo);
    const beforeMerge = steps[steps.length - 2].state;
    expect(beforeMerge.commits).toHaveLength(4);
    expect(beforeMerge.branches.main).toBe("c4");
    expect(beforeMerge.branches.feature).toBe("c3");
  });

  it("grows from four commits to five with exactly one merge commit", () => {
    // "The commit count grows from 4 to 5, and the merge commits meter ticks to 1."
    const { state, counters } = run(threeWayMergeCleanAlgo);
    expect(state.commits).toHaveLength(5);
    expect(counters[C.commits]).toBe(5);
    expect(counters[C.merges]).toBe(1);
  });

  it("creates a two-parent merge commit pointing at main 1 and feat 2 tips", () => {
    // "Inspect the new commit: it points at both main 1 (c4) and feat 2 (c3)."
    const { merges, state } = run(threeWayMergeCleanAlgo);
    expect(merges).toHaveLength(1);
    expect(merges[0].parents).toEqual(["c4", "c3"]);
    expect(state.branches.main).toBe(merges[0].id);
  });

  it("shares common ancestor c1 (base) across both branches", () => {
    // Both feature and main branched from base (c1)
    const { state } = run(threeWayMergeCleanAlgo);
    const c1 = state.commits.find((c) => c.id === "c1")!;
    const c2 = state.commits.find((c) => c.id === "c2")!;
    const c3 = state.commits.find((c) => c.id === "c3")!;
    const c4 = state.commits.find((c) => c.id === "c4")!;
    expect(c1.message).toBe("base");
    expect(c1.parents).toEqual([]);
    expect(c2.message).toBe("feat 1");
    expect(c2.parents).toEqual(["c1"]);
    expect(c3.message).toBe("feat 2");
    expect(c3.parents).toEqual(["c2"]);
    expect(c4.message).toBe("main 1");
    expect(c4.parents).toEqual(["c1"]);
  });

  it("orphans nothing — every commit remains reachable", () => {
    // "Both lines of history remain reachable and untouched"
    const { state } = run(threeWayMergeCleanAlgo);
    expect(state.unreachable).toEqual([]);
    expect(state.commits.every((c) => c.rewriteOf === undefined)).toBe(true);
  });

  it("retains the exact commit parent relationships across all steps", () => {
    const { steps } = run(threeWayMergeCleanAlgo);
    // Step 0: initial empty repo
    expect(steps[0].state.commits).toHaveLength(0);
    // Step 1: commit base
    expect(steps[1].state.commits).toHaveLength(1);
    expect(steps[1].state.commits[0].id).toBe("c1");
    // Step 2: branch feature (no new commit)
    expect(steps[2].state.commits).toHaveLength(1);
    expect(steps[2].state.branches.feature).toBe("c1");
    // Step 3: checkout feature
    expect(steps[3].state.head).toBe("feature");
    // Step 4: commit feat 1
    expect(steps[4].state.commits).toHaveLength(2);
    expect(steps[4].state.branches.feature).toBe("c2");
    // Step 5: commit feat 2
    expect(steps[5].state.commits).toHaveLength(3);
    expect(steps[5].state.branches.feature).toBe("c3");
    // Step 6: checkout main
    expect(steps[6].state.head).toBe("main");
    // Step 7: commit main 1
    expect(steps[7].state.commits).toHaveLength(4);
    expect(steps[7].state.branches.main).toBe("c4");
    // Step 8: git merge feature
    expect(steps[8].state.commits).toHaveLength(5);
    expect(steps[8].state.branches.main).toBe("c5");
    expect(steps[8].state.commits[4].parents).toEqual(["c4", "c3"]);
  });
});

describe("three-way-merge · fast-forward comparison", () => {
  it("stays at three commits and makes zero merge commits", () => {
    // "when main never diverged past base, Git slid the pointer directly to feat 2 with 0 merge commits, keeping the count at 3."
    const { state, counters, merges } = run(threeWayMergeFastForwardAlgo);
    expect(state.commits).toHaveLength(3);
    expect(counters[C.commits]).toBe(3);
    expect(counters[C.merges] ?? 0).toBe(0);
    expect(merges).toHaveLength(0);
  });

  it("slides main pointer to the feature tip", () => {
    // "advancing main's pointer to feature's tip with zero new commits created"
    const { state } = run(threeWayMergeFastForwardAlgo);
    expect(state.branches.main).toBe("c3");
    expect(state.branches.feature).toBe("c3");
    expect(state.note).toBe("fast-forward — no merge commit");
  });
});
