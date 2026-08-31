import { buildAlgoSteps } from "@/engine/algo/build";
import {
  REPO_COUNTERS,
  runRepoScript,
  type RepoCommand,
  type RepoScript,
} from "@/engine/algo/repo";
import type { AlgoDef } from "@/engine/algo/types";
import { RepoView } from "@/engine/algo/views/RepoView";
import type { RepoState } from "@/engine/algo/views/repo";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

/**
 * Archetype E — the repo DAG.
 *
 * The claim under test is the lesson: the same divergent history integrated by
 * `merge` and by `rebase` gives different DAGs — one gains a merge commit and
 * keeps both parents, the other copies commits onto a new base and orphans the
 * originals.
 */

const commit = (message: string): RepoCommand => ({
  label: `git commit -m "${message}"`,
  op: { kind: "commit", message },
});
const branch = (name: string): RepoCommand => ({
  label: `git branch ${name}`,
  op: { kind: "branch", name },
});
const checkout = (name: string): RepoCommand => ({
  label: `git checkout ${name}`,
  op: { kind: "checkout", name },
});

/** main: base → A; feature (from base): B. Both sides have moved. */
const DIVERGED: RepoCommand[] = [
  commit("base"),
  branch("feature"),
  commit("main work"),
  checkout("feature"),
  commit("feature work"),
];

const mergeScript: RepoScript = {
  commands: [
    ...DIVERGED,
    checkout("main"),
    { label: "git merge feature", op: { kind: "merge", from: "feature" } },
  ],
};

const rebaseScript: RepoScript = {
  commands: [
    ...DIVERGED,
    { label: "git rebase main", op: { kind: "rebase", onto: "main" } },
  ],
};

const last = (steps: { state: RepoState }[]) => steps[steps.length - 1].state;

describe("runRepoScript", () => {
  it("is deterministic and records one frame per command", () => {
    const steps = runRepoScript(mergeScript);
    expect(steps).toEqual(runRepoScript(mergeScript));
    expect(steps).toHaveLength(mergeScript.commands.length + 1);
    expect(steps[0].state.commits).toHaveLength(0);
    expect(steps[0].state.head).toBe("main");
  });

  it("treats a branch as a pointer, creating no history", () => {
    const steps = runRepoScript({ commands: [commit("base"), branch("feature")] });
    const afterCommit = steps[1].state;
    const afterBranch = steps[2].state;
    expect(afterBranch.commits).toHaveLength(afterCommit.commits.length);
    expect(afterBranch.branches.feature).toBe(afterBranch.branches.main);
    // Still on main: branching does not check out.
    expect(afterBranch.head).toBe("main");
  });

  it("fast-forwards instead of inventing a merge commit", () => {
    const steps = runRepoScript({
      commands: [
        commit("base"),
        branch("feature"),
        checkout("feature"),
        commit("ahead"),
        checkout("main"),
        { label: "git merge feature", op: { kind: "merge", from: "feature" } },
      ],
    });
    const state = last(steps);
    expect(state.note).toBe("fast-forward — no merge commit");
    expect(state.commits).toHaveLength(2);
    expect(state.branches.main).toBe(state.branches.feature);
    expect(steps[steps.length - 1].counters[REPO_COUNTERS.merges] ?? 0).toBe(0);
  });

  it("reports an already-merged branch as up to date", () => {
    const steps = runRepoScript({
      commands: [
        commit("base"),
        branch("feature"),
        { label: "git merge feature", op: { kind: "merge", from: "feature" } },
      ],
    });
    expect(last(steps).note).toBe("already up to date");
    expect(last(steps).commits).toHaveLength(1);
  });

  it("merge keeps both histories and adds a two-parent commit", () => {
    const state = last(runRepoScript(mergeScript));
    // base, main work, feature work, merge
    expect(state.commits).toHaveLength(4);

    const merge = state.commits.find((c) => c.parents.length === 2)!;
    expect(merge.parents).toHaveLength(2);
    expect(state.branches.main).toBe(merge.id);
    // Nothing was rewritten and nothing was orphaned.
    expect(state.commits.every((c) => c.rewriteOf === undefined)).toBe(true);
    expect(state.unreachable).toEqual([]);
  });

  it("rebase copies commits onto a new base and orphans the originals", () => {
    const steps = runRepoScript(rebaseScript);
    const state = last(steps);

    // base, main work, feature work, plus ONE replayed copy.
    expect(state.commits).toHaveLength(4);
    const copy = state.commits.find((c) => c.rewriteOf !== undefined)!;
    expect(copy.message).toBe("feature work");
    expect(copy.parents).toEqual([state.branches.main]);
    expect(state.branches.feature).toBe(copy.id);

    // The original is still an object but no branch can reach it.
    expect(state.unreachable).toEqual([copy.rewriteOf]);
    expect(steps[steps.length - 1].counters[REPO_COUNTERS.replayed]).toBe(1);
    // A rebase is linear: no commit has two parents.
    expect(state.commits.every((c) => c.parents.length <= 1)).toBe(true);
  });

  it("merge and rebase reach different shapes from identical work", () => {
    const merged = last(runRepoScript(mergeScript));
    const rebased = last(runRepoScript(rebaseScript));

    expect(merged.commits.some((c) => c.parents.length === 2)).toBe(true);
    expect(rebased.commits.some((c) => c.parents.length === 2)).toBe(false);
    expect(merged.unreachable).toHaveLength(0);
    expect(rebased.unreachable).toHaveLength(1);
  });

  it("replays several commits oldest first", () => {
    const steps = runRepoScript({
      commands: [
        commit("base"),
        branch("feature"),
        commit("main work"),
        checkout("feature"),
        commit("f1"),
        commit("f2"),
        { label: "git rebase main", op: { kind: "rebase", onto: "main" } },
      ],
    });
    const state = last(steps);
    const copies = state.commits
      .filter((c) => c.rewriteOf !== undefined)
      .sort((a, b) => a.seq - b.seq);

    expect(copies.map((c) => c.message)).toEqual(["f1", "f2"]);
    // Chained onto each other, not both onto main.
    expect(copies[1].parents).toEqual([copies[0].id]);
    expect(state.unreachable).toHaveLength(2);
  });

  it("refuses unknown branches without corrupting the DAG", () => {
    const steps = runRepoScript({
      commands: [
        commit("base"),
        checkout("nope"),
        { label: "git merge ghost", op: { kind: "merge", from: "ghost" } },
      ],
    });
    expect(steps[2].state.note).toBe("no such branch: nope");
    expect(steps[2].state.head).toBe("main");
    expect(last(steps).note).toBe("no such branch: ghost");
    expect(last(steps).commits).toHaveLength(1);
  });

  it("never aliases a frame, so step-back shows the DAG as it was", () => {
    const steps = runRepoScript(mergeScript);
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    expect(new Set(steps.map((s) => s.state.commits)).size).toBe(steps.length);
    // Commit count only ever grows.
    let count = 0;
    for (const step of steps) {
      expect(step.state.commits.length).toBeGreaterThanOrEqual(count);
      count = step.state.commits.length;
    }
  });
});

describe("archetype E rides on archetype B", () => {
  const integrateDef: AlgoDef<RepoState, RepoScript> = {
    id: "merge-vs-rebase",
    title: "merge vs rebase",
    code: ["git commit", "git branch", "git checkout", "git merge / rebase"],
    counters: [
      { key: REPO_COUNTERS.commits, label: "commits" },
      { key: REPO_COUNTERS.merges, label: "merge commits" },
      { key: REPO_COUNTERS.replayed, label: "replayed" },
    ],
    generateInput: () => mergeScript,
    run: (script) => runRepoScript(script),
  };

  it("runs through buildAlgoSteps, reproducibly per seed", () => {
    const steps = buildAlgoSteps(integrateDef, 0, 42);
    expect(steps).toEqual(buildAlgoSteps(integrateDef, 0, 42));
    expect(last(steps).commits).toHaveLength(4);
  });

  it("satisfies the view contract the figure requires", () => {
    const view: ComponentType<{ state: RepoState }> = RepoView;
    expect(view).toBe(RepoView);
  });
});
