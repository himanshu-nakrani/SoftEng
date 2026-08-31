import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { CommitFrame, RepoState } from "./views/repo";

/**
 * Archetype E — the repo / pipeline DAG.
 *
 * Third archetype to ride on B rather than being its own engine: a sequence of
 * git commands is a finite list of DAG states. Step-back matters more here than
 * anywhere else, because the whole confusion this archetype addresses is
 * "what did that command do to my history" — and the answer is a diff between
 * two frames you can scrub between.
 *
 * The lesson it is built for: run the SAME commands through `merge` and through
 * `rebase` and watch one produce a diamond with a merge commit while the other
 * produces a straight line of NEW commits, orphaning the originals.
 */

export type RepoOp =
  | { kind: "commit"; message: string }
  | { kind: "branch"; name: string }
  | { kind: "checkout"; name: string }
  | { kind: "merge"; from: string }
  | { kind: "rebase"; onto: string };

export interface RepoCommand {
  /** As the learner would type it ("git merge feature"). */
  label: string;
  codeLine?: number;
  op: RepoOp;
}

export interface RepoScript {
  commands: RepoCommand[];
  /** Branch the repo starts on. Defaults to "main". */
  trunk?: string;
}

export const REPO_COUNTERS = {
  /** Commits created, including merge commits and rebase copies. */
  commits: "commits",
  merges: "merges",
  /** Commits copied by a rebase — the "history was rewritten" number. */
  replayed: "replayed",
} as const;

/**
 * Replay a script, one frame per command.
 *
 * Takes no RNG: git is not random, and a run whose output depends only on its
 * script is the honest model. A def wires it up as `run: (script) => …`, which
 * is assignable to `AlgoDef.run` because it simply ignores the second argument.
 */
export function runRepoScript(script: RepoScript): AlgoStep<RepoState>[] {
  const trunk = script.trunk ?? "main";

  const commits: CommitFrame[] = [];
  const byId = new Map<string, CommitFrame>();
  const branches: Record<string, string> = {};
  /** Stable lane per branch, assigned on first use. */
  const lanes = new Map<string, number>([[trunk, 0]]);

  let head = trunk;
  let seq = 0;
  let ranCommand: string | undefined;
  let touched: string[] = [];
  let note: string | undefined;

  const laneOf = (branch: string): number => {
    const existing = lanes.get(branch);
    if (existing !== undefined) return existing;
    const lane = lanes.size;
    lanes.set(branch, lane);
    return lane;
  };

  /** Every commit reachable from any branch tip. */
  const reachable = (): Set<string> => {
    const seen = new Set<string>();
    const stack = Object.values(branches);
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const commit = byId.get(id);
      if (commit) stack.push(...commit.parents);
    }
    return seen;
  };

  const ancestry = (id: string | undefined): Set<string> => {
    const seen = new Set<string>();
    if (!id) return seen;
    const stack = [id];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      const commit = byId.get(next);
      if (commit) stack.push(...commit.parents);
    }
    return seen;
  };

  const addCommit = (
    message: string,
    parents: string[],
    lane: number,
    rewriteOf?: string,
  ): CommitFrame => {
    seq += 1;
    const commit: CommitFrame = {
      id: `c${seq}`,
      message,
      parents,
      lane,
      seq,
      rewriteOf,
    };
    commits.push(commit);
    byId.set(commit.id, commit);
    return commit;
  };

  const rec = new StepRecorder<RepoState>(() => {
    const live = reachable();
    return {
      // Copy every frame: a shared array would make the whole run show the
      // final DAG, which is exactly what step-back must not do.
      commits: commits.map((c) => ({ ...c, parents: [...c.parents] })),
      branches: { ...branches },
      head,
      ranCommand,
      touched: [...touched],
      unreachable: commits.filter((c) => !live.has(c.id)).map((c) => c.id),
      note,
    };
  });

  rec.record({ note: `empty repo on ${trunk}` });

  for (const command of script.commands) {
    ranCommand = command.label;
    touched = [];
    note = undefined;

    switch (command.op.kind) {
      case "commit": {
        const parent = branches[head];
        const commit = addCommit(
          command.op.message,
          parent ? [parent] : [],
          laneOf(head),
        );
        branches[head] = commit.id;
        touched = [commit.id];
        rec.bump(REPO_COUNTERS.commits);
        break;
      }

      case "branch": {
        // A new branch is a pointer, not history — nothing is created.
        branches[command.op.name] = branches[head];
        laneOf(command.op.name);
        note = `${command.op.name} points at ${branches[head] ?? "nothing"}`;
        break;
      }

      case "checkout": {
        if (!(command.op.name in branches)) {
          note = `no such branch: ${command.op.name}`;
          break;
        }
        head = command.op.name;
        break;
      }

      case "merge": {
        const ours = branches[head];
        const theirs = branches[command.op.from];
        if (!theirs) {
          note = `no such branch: ${command.op.from}`;
          break;
        }
        if (ours && ancestry(ours).has(theirs)) {
          note = "already up to date";
          break;
        }
        if (!ours || ancestry(theirs).has(ours)) {
          // Fast-forward: the pointer moves, no commit is made. Worth showing
          // precisely because learners expect a merge commit here.
          branches[head] = theirs;
          touched = [theirs];
          note = "fast-forward — no merge commit";
          break;
        }
        const merge = addCommit(
          `merge ${command.op.from} into ${head}`,
          [ours, theirs],
          laneOf(head),
        );
        branches[head] = merge.id;
        touched = [merge.id];
        rec.bump(REPO_COUNTERS.commits);
        rec.bump(REPO_COUNTERS.merges);
        break;
      }

      case "rebase": {
        const onto = branches[command.op.onto];
        const ours = branches[head];
        if (!onto || !ours) {
          note = `nothing to rebase onto ${command.op.onto}`;
          break;
        }
        const ontoHistory = ancestry(onto);
        if (ontoHistory.has(ours)) {
          note = "already up to date";
          break;
        }

        // Our commits that `onto` does not have, oldest first.
        const mine = [...ancestry(ours)]
          .filter((id) => !ontoHistory.has(id))
          .map((id) => byId.get(id)!)
          .sort((a, b) => a.seq - b.seq);

        let base = onto;
        const copies: string[] = [];
        for (const original of mine) {
          // A NEW commit, not a moved one: this is why rebasing shared
          // history hurts, and the frame shows the original going unreachable.
          const copy = addCommit(
            original.message,
            [base],
            laneOf(head),
            original.id,
          );
          base = copy.id;
          copies.push(copy.id);
          rec.bump(REPO_COUNTERS.commits);
          rec.bump(REPO_COUNTERS.replayed);
        }
        branches[head] = base;
        touched = copies;
        note = `replayed ${copies.length} commit${copies.length === 1 ? "" : "s"} — new ids`;
        break;
      }
    }

    rec.record({ codeLine: command.codeLine, note: command.label });
  }

  return rec.steps;
}
