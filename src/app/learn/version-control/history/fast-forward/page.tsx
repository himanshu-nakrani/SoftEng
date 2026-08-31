import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { FastForwardFigure, NoFastForwardFigure } from "@/lessons/history/fast-forward-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("fast-forward");

export default function FastForwardPage() {
  return (
    <Lesson slug="fast-forward">
      <LessonSection id="expecting-a-commit">
        <Lead>
          You run <Strong>git merge feature</Strong> and expect a merge commit.
          Sometimes you get one; sometimes you get nothing new at all. The command
          did not change — the shape of your history did.
        </Lead>
        <P>
          A <Term>merge commit</Term> exists to join two lines of work that
          diverged. But if they never diverged — if one branch is simply{" "}
          <Strong>ahead</Strong> of the other, with no commits the other lacks —
          there is nothing to join. Git can integrate by sliding a pointer forward
          along a straight line. That slide is a <Term>fast-forward</Term>, and it
          creates no commit.
        </P>
        <P>
          The two figures run the <Strong>same command</Strong> over two
          histories. Predict, before each: does a new commit appear?
        </P>
      </LessonSection>

      <LessonSection id="ff">
        <TryThis>
          <LI>
            <Term>feature</Term> is two commits ahead of <Term>main</Term>, and
            main has not moved since the branch. Step to the last frame.
          </LI>
          <LI>
            The commit count stays at <Strong>3</Strong> — the merge made{" "}
            <Strong>no new commit</Strong>. The caption reads{" "}
            <Strong>fast-forward — no merge commit</Strong>, and the{" "}
            <Strong>merge commits</Strong> meter never leaves zero.
          </LI>
        </TryThis>
        <FastForwardFigure />
        <Callout kind="insight">
          The merge did happen — <Term>main</Term> now points at the feature tip,
          so both branches sit on the same commit. But integration here was just
          moving a pointer. The learner who expected a merge commit was expecting
          git to record a join that had no two sides to join.
        </Callout>
      </LessonSection>

      <LessonSection id="no-ff">
        <TryThis>
          <LI>
            Same feature work, but now <Term>main</Term> gains its own commit,{" "}
            <Strong>hotfix</Strong>, after the branch point. The histories have
            diverged.
          </LI>
          <LI>
            Run the identical <Strong>git merge feature</Strong>. This time the
            count grows from four commits to <Strong>5</Strong>, the{" "}
            <Strong>merge commits</Strong> meter ticks to <Strong>1</Strong>, and
            the new commit has two parents.
          </LI>
        </TryThis>
        <NoFastForwardFigure />
        <Callout kind="insight">
          One commit on main was enough. With work on both sides of the branch
          point, there is no straight line to slide along, so git must record a
          two-parent merge commit — the very thing the first figure did not make.
          The command is identical in both; only the history differs.
        </Callout>
      </LessonSection>

      <LessonSection id="divergence">
        <Lead>
          Divergence decides, not the command. A merge fast-forwards exactly when
          the branch you are on has no commits the other lacks; the moment it does,
          a merge commit is unavoidable.
        </Lead>
        <P>
          This is why <Strong>git merge</Strong> feels inconsistent to people who
          read it as &ldquo;make a merge commit.&rdquo; It does not promise a
          commit. It promises to <Strong>integrate</Strong>, and it uses the
          cheapest operation that does so — a pointer slide when the history is
          linear, a two-parent commit when it is not.
        </P>
        <Callout kind="insight">
          If you always want the merge commit — to record that a feature branch
          existed even when it could have fast-forwarded — <Strong>--no-ff</Strong>{" "}
          forces one. And if you never want one, a fast-forward-only merge refuses
          to run rather than silently creating a commit. Both are ways of taking
          the decision away from the shape of the history and stating it outright.
        </Callout>
        <P>
          The single fact worth keeping: a fast-forward is not a kind of merge that
          skipped the commit. It is what merge does when there was never anything to
          merge.
        </P>
      </LessonSection>
    </Lesson>
  );
}
