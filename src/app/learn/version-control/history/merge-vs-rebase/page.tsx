import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { MergeFigure, RebaseFigure } from "@/lessons/history/merge-vs-rebase-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("merge-vs-rebase");

export default function MergeVsRebasePage() {
  return (
    <Lesson slug="merge-vs-rebase">
      <LessonSection id="same-work">
        <Lead>
          Two branches have diverged. Both figures below do the identical work,
          then integrate it two different ways — and end with two different
          shapes.
        </Lead>
        <P>
          The setup is the same in both: a <Strong>base</Strong> commit, then
          each side moves on. <Term>main</Term> gains one commit,{" "}
          <Strong>add api</Strong>. <Term>feature</Term>, branched at base, gains
          two, <Strong>add login</Strong> and <Strong>add logout</Strong>. Neither
          branch is an ancestor of the other; that is what <Term>diverged</Term>{" "}
          means, and it is the only case where <Term>merge</Term> and{" "}
          <Term>rebase</Term> genuinely differ.
        </P>
        <P>
          Four commits of work exist before either integration runs: one on main,
          two on feature, and the base they share. Hold that number. What each
          command does to it is the whole lesson.
        </P>
      </LessonSection>

      <LessonSection id="by-merge">
        <TryThis>
          <LI>
            Step to the last frame. A <Strong>fifth</Strong> commit has appeared,
            and the <Strong>merge commits</Strong> meter reads <Strong>1</Strong>.
          </LI>
          <LI>
            Look at its parents: it points at <Strong>both</Strong> branch tips
            (drawn with an inner dot). That is a two-parent commit — the only kind
            that has two.
          </LI>
        </TryThis>
        <MergeFigure />
        <Callout kind="insight">
          Merge adds exactly one commit and touches nothing else. The four
          original commits keep their ids and their parents; both lines of history
          stay reachable. The <Strong>commits copied</Strong> meter never moves and
          the unreachable count stays at zero — a merge rewrites nothing.
        </Callout>
      </LessonSection>

      <LessonSection id="by-rebase">
        <TryThis>
          <LI>
            Step to the last frame. The count jumped from four commits to{" "}
            <Strong>six</Strong>, and <Strong>commits copied</Strong> reads{" "}
            <Strong>2</Strong> — not a merge commit but two new ones.
          </LI>
          <LI>
            The two feature commits are now drawn dashed and hollow. The footer
            reads <Strong>2 commits now unreachable</Strong>: no branch can reach
            them any more.
          </LI>
        </TryThis>
        <RebaseFigure />
        <Callout kind="insight">
          Rebase did not move the feature commits — it <Strong>copied</Strong>{" "}
          them. The two copies (c5, c6) carry the same messages onto a new base,
          chained oldest-first, with fresh ids; each records the original it
          replaced. The originals (c3, c4) are still objects, but orphaned. The
          history is now a straight line, and there is no merge commit — the merge
          meter stayed at zero the whole run.
        </Callout>
      </LessonSection>

      <LessonSection id="choosing">
        <Lead>
          Identical work, two shapes. Merge kept four commits and added a fifth
          that joins the histories; rebase replaced two commits with two copies and
          orphaned the originals, leaving six.
        </Lead>
        <P>
          Neither is more correct. Merge preserves exactly what happened, including
          the fact that two lines of work ran in parallel — at the cost of a
          diamond in the graph. Rebase buys a clean linear history by{" "}
          <Strong>rewriting</Strong> it: the commits you had are gone, replaced by
          copies that never coexisted with main&rsquo;s work the way the originals
          did.
        </P>
        <Callout kind="warning">
          That rewrite is why the rule is <Strong>never rebase shared history</Strong>.
          The originals going unreachable is harmless when the commits were only
          yours. If a teammate had already based work on c3 or c4, rebasing pulls
          those commits out from under them — their branch still points at objects
          nobody else can reach.
        </Callout>
        <P>
          The deciding question is not which command is better. It is whether the
          commits you are about to rewrite have ever left your machine.
        </P>
      </LessonSection>
    </Lesson>
  );
}
