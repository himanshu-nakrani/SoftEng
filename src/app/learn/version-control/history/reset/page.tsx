import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  ResetDiscardFigure,
  ResetSurviveFigure,
} from "@/lessons/history/reset-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("reset");

export default function ResetPage() {
  return (
    <Lesson slug="reset">
      <LessonSection id="move-a-pointer">
        <Lead>Revert undoes a commit. Reset pretends it never happened.</Lead>
        <P>
          A branch name is just a pointer at one commit; every earlier commit is
          reachable by walking parents. <Term>reset</Term> moves that pointer to
          a different commit and does nothing else — it creates no commit, copies
          nothing, and inverts nothing. That makes it the odd one out in this
          module: cherry-pick and rebase <Strong>copy</Strong> commits under new
          ids, revert <Strong>adds</Strong> a commit that reverses an earlier
          one, and reset simply <Strong>moves</Strong> the branch.
        </P>
        <P>
          Moving the pointer <Strong>back</Strong> is where it earns its
          reputation. The commits that were ahead of the new tip are no longer on
          any path from the branch, so nothing can reach them. The work is not
          undone in the record — it is discarded from it.
        </P>
      </LessonSection>

      <LessonSection id="discarding">
        <P>
          <Term>main</Term> has three commits: <Term>baseline</Term>,{" "}
          <Term>add search</Term>, and a rough <Term>wip</Term>. You decide the
          last two were a false start and reset back to <Term>c1</Term>. Watch
          the commit count and the two commits ahead of the tip.
        </P>
        <TryThis>
          <LI>Step to the reset and note that no new commit appears.</LI>
          <LI>Watch c2 and c3 turn red and dashed as main jumps back to c1.</LI>
        </TryThis>
        <ResetDiscardFigure />
        <P>
          The commit count stays at 3 — reset made no commit, so{" "}
          <Strong>commits made</Strong> never moves past 3 and{" "}
          <Strong>resets</Strong> reads 1. But <Term>main</Term> now points at
          c1, and c2 and c3 are drawn red and dashed: the footer reads{" "}
          <Term>2 commits now unreachable</Term>. No branch can reach them, so
          git will eventually prune them.
        </P>
        <Callout kind="warning">
          This is why reset is not an undo. Revert would have left c3 in place
          and added a fourth commit reversing it, so history recorded both.
          Reset removed c2 and c3 as if they had never existed — safe on commits
          only you have, ruinous on commits someone else has already pulled.
        </Callout>
      </LessonSection>

      <LessonSection id="recovering">
        <P>
          The commits are not shredded the instant the pointer moves — they are
          orphaned, and anything else that references them keeps them alive. Here
          is the identical reset, except a <Term>backup</Term> branch is pointed
          at the tip <Strong>before</Strong> resetting.
        </P>
        <TryThis>
          <LI>Step to the branch and note backup now sits on c3.</LI>
          <LI>Step to the reset: main moves back, but nothing goes red.</LI>
        </TryThis>
        <ResetSurviveFigure />
        <P>
          Same three commits, same reset, same <Strong>resets</Strong> counter
          at 1 — but the <Term>unreachable</Term> count stays at{" "}
          <Strong>zero</Strong>. Unreachability is about <Strong>all</Strong>{" "}
          references, not just the one you moved: <Term>backup</Term> still holds
          c2 and c3, so the work is one branch away. In a real repository even
          without a backup branch the commits linger in the reflog until it is
          pruned, which is the escape hatch behind &ldquo;undo a reset.&rdquo;
        </P>
        <Callout kind="insight">
          A reset discards a <Strong>reference</Strong>, not the commits
          themselves. Keep any other pointer on them — a branch, a tag, the
          reflog — and they are still reachable. Lose the last one and they are
          gone.
        </Callout>
      </LessonSection>

      <LessonSection id="reset-vs-revert">
        <Lead>Two ways to walk back a commit, and only one is safe to share.</Lead>
        <P>
          Revert and reset answer the same question — &ldquo;get rid of that
          change&rdquo; — with opposite mechanics. Revert is{" "}
          <Strong>additive</Strong>: it leaves the bad commit in place and adds a
          new one that inverts it, so no id changes and no one has to force-pull.
          Reset is <Strong>destructive</Strong>: it moves the branch and orphans
          whatever was ahead, changing which commit the branch names.
        </P>
        <Callout kind="warning">
          Reset on your own local history is the cleanest tool there is — squash
          a messy afternoon back to a clean base and start over. Reset on history
          others have pulled is the same hazard as a rebase: you have taken their
          base out from under them. On shared branches, reach for revert; keep
          reset for commits that have never left your machine.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
