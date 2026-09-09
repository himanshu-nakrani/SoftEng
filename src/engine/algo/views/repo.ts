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
  /**
   * The commit this one is a CHERRY-PICK copy of. Deliberately NOT `rewriteOf`:
   * a rebase copy replaces its original (which goes unreachable), whereas a
   * cherry-pick copy leaves the original reachable on its own branch. Sharing
   * one field would force the view to treat both the same, and the whole point
   * of the cherry-pick lesson is that the work now exists in TWO live places.
   * A distinct field lets the view draw the copy→original link without
   * implying the original is dead.
   */
  copyOf?: string;
  /**
   * The commit this one UNDOES, when it is a revert. A revert is a genuinely
   * new commit that reverses an earlier change; both stay reachable, which is
   * why revert is safe on published history. Distinct from `copyOf` because the
   * relationship is inverse (undo), not duplicate (copy).
   */
  revertOf?: string;
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
