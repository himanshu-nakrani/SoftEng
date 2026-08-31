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
