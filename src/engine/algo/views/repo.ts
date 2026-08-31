/**
 * The repo view's state contract — archetype E's frame.
 *
 * Pure data (no JSX) so lesson `.ts` files can script repos without pulling a
 * component into their module graph.
 */

export interface CommitFrame {
  /** Short id, stable within a run ("c3"). */
  id: string;
  message: string;
  /** Ordered: for a merge commit, [ours, theirs]. */
  parents: string[];
  /** Vertical track for drawing — one per branch that created commits. */
  lane: number;
  /** Creation order, so a view can lay commits out left to right. */
  seq: number;
  /**
   * The commit this one was replayed FROM, when a rebase copied it. Present
   * only on rebased commits, which is how the view shows that a rebase makes
   * new objects rather than moving old ones.
   */
  rewriteOf?: string;
}

export interface RepoState {
  commits: CommitFrame[];
  /** Branch name → commit id it points at. */
  branches: Record<string, string>;
  /** Name of the checked-out branch. */
  head: string;
  /** The command that produced this frame. */
  ranCommand?: string;
  /** Commits created or moved by that command — the highlight. */
  touched: string[];
  /** Commits that no branch can reach any more (orphaned by a rebase). */
  unreachable: string[];
  /** Why a command did nothing ("already up to date"). */
  note?: string;
}
