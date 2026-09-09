import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  CherryPickFigure,
  RevertFigure,
} from "@/lessons/history/cherry-pick-revert-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("cherry-pick-revert");

export default function CherryPickRevertPage() {
  return (
    <Lesson slug="cherry-pick-revert">
      <LessonSection id="one-commit">
        <Lead>Merge and rebase move a whole branch. Sometimes you want one commit.</Lead>
        <P>
          A bug fix landed on a release branch and you need it on{" "}
          <Term>main</Term> now, without dragging the ten other commits sitting
          beside it. Or a single commit turned out to be wrong and you want it
          gone, but the branch is already pushed and other people have pulled it.
          Neither case is a branch operation. Both act on{" "}
          <Strong>one commit</Strong>.
        </P>
        <P>
          <Term>cherry-pick</Term> answers the first: copy a single commit onto
          the branch you are on. <Term>revert</Term> answers the second: add a
          new commit that undoes an earlier one. The two look symmetric, but they
          leave history in very different states — and one of them plants a
          duplicate that comes back later.
        </P>
      </LessonSection>

      <LessonSection id="cherry-pick">
        <P>
          The fix lives as <Term>c2</Term> on <Term>feature</Term>. You are on{" "}
          <Term>main</Term> and you cherry-pick it. Watch the commit count and
          the ids, not just the shape.
        </P>
        <TryThis>
          <LI>Step to the cherry-pick and read the new commit&rsquo;s id.</LI>
          <LI>
            Compare it to c2: same message, different id, and c2 is still there.
          </LI>
        </TryThis>
        <CherryPickFigure />
        <P>
          The cherry-pick creates <Term>c4</Term> — a new commit with a new id
          carrying the same change as c2, parented on main&rsquo;s tip. The{" "}
          <Strong>cherry-picks</Strong> meter reads 1 and the commit count is 4
          at that point. Crucially, c2 is untouched: <Term>feature</Term> still
          contains it, so the fix now exists as <Strong>two commits</Strong>.
        </P>
        <Callout kind="insight">
          A cherry-pick is a copy, not a move. Nothing goes unreachable — the
          &ldquo;unreachable&rdquo; count stays at zero, unlike a rebase — which
          is exactly why the original is still around to cause trouble.
        </Callout>
      </LessonSection>

      <LessonSection id="revert">
        <P>
          Now the opposite problem: <Term>c3</Term> was a bad change, already
          pushed. A reset would erase it and rewrite history everyone else has.
          Revert instead.
        </P>
        <TryThis>
          <LI>Step to the revert and note that c3 does not disappear.</LI>
          <LI>Read the new commit&rsquo;s message and its parent.</LI>
        </TryThis>
        <RevertFigure />
        <P>
          Revert adds <Term>c4</Term>, a new commit whose change reverses c3,
          parented directly on it. The commit count goes to 4 and the{" "}
          <Strong>reverts</Strong> meter reads 1. c3 stays exactly where it was —
          nothing is rewritten, nothing goes unreachable. History now records
          both the mistake and its undo, in order.
        </P>
        <Callout kind="insight">
          Because revert only <Strong>adds</Strong>, it is safe on published
          history: no id changes, so no one else has to force-pull. The cost is
          honesty — the bad commit stays on the record forever, next to the one
          that fixed it.
        </Callout>
      </LessonSection>

      <LessonSection id="duplicates">
        <Lead>A cherry-picked commit is a duplicate, and duplicates come back.</Lead>
        <P>
          Return to the cherry-pick figure and step past the merge at the end.
          The branch <Term>feature</Term> — which still owns the original c2 — is
          merged into <Term>main</Term>. The merge pulls c2 and c3 in, so the
          change you already copied as c4 arrives a <Strong>second time</Strong>
          {" "}as c2. The final history has five commits, and the message{" "}
          <Term>urgent fix</Term> appears on two of them.
        </P>
        <P>
          In a real repository that second arrival is often a conflict: git tries
          to apply a change that is already present. Even when it applies
          cleanly, you are left with two commits for one logical change — the
          copy and the original — and nothing in the graph says they are the
          same work.
        </P>
        <Callout kind="warning">
          That is the asymmetry. Revert is additive, so it is safe on shared
          history; the price is a permanent record of the mistake. Cherry-pick
          duplicates, so the same change can land twice when the source branch
          merges later — cheap now, a conflict or a confusing double entry
          afterward.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
