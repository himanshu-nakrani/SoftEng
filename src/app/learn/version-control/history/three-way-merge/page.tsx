import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { FastForwardFigure, ThreeWayMergeFigure } from "@/lessons/history/three-way-merge-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("three-way-merge");

export default function ThreeWayMergePage() {
  return (
    <Lesson slug="three-way-merge">
      <LessonSection id="common-ancestor">
        <Lead>
          When two branches diverge, comparing only their tip commits cannot
          tell you who changed what. Git needs a third reference point: their
          lowest common ancestor, the <Term>merge base</Term>.
        </Lead>
        <P>
          Imagine comparing two files at the branch tips: <Term>main</Term> has
          line 10 as <Strong>timeout = 30</Strong>, while <Term>feature</Term>{" "}
          has deleted line 10 entirely. Did feature delete a line that main kept,
          or did main add a line that feature never had? A two-way diff between
          the two tips yields the exact same textual difference in both cases.
          Without history, the intent is ambiguous.
        </P>
        <P>
          To resolve this ambiguity, Git walks backward through the commit DAG
          from both tips until their histories intersect. The most recent shared
          commit is the <Term>merge base</Term>.
        </P>
        <Callout kind="insight">
          The merge base turns an ambiguous two-way diff into a deterministic{" "}
          <Term>three-way merge</Term>. By computing two independent diffs —{" "}
          <Strong>diff(base, main)</Strong> and{" "}
          <Strong>diff(base, feature)</Strong> — Git determines who introduced
          each change. If a file changed in feature but stayed untouched on main
          relative to the base, Git automatically applies feature&rsquo;s edit.
        </Callout>
      </LessonSection>

      <LessonSection id="three-way-join">
        <TryThis>
          <LI>
            Step through to the last frame. The commit count grows from 4 to{" "}
            <Strong>5</Strong>, and the <Strong>merge commits</Strong> meter
            ticks to <Strong>1</Strong>.
          </LI>
          <LI>
            Inspect the new commit: it points at both <Strong>main 1</Strong> (c4)
            and <Strong>feat 2</Strong> (c3). That is a two-parent merge commit
            joining the two lines of development.
          </LI>
          <LI>
            Compare this with the second figure below: when main never diverged past
            base, Git slid the pointer directly to feat 2 with{" "}
            <Strong>0 merge commits</Strong>, keeping the count at 3.
          </LI>
        </TryThis>
        <ThreeWayMergeFigure />
        <Callout kind="insight">
          Because main and feature touched non-overlapping files or lines since
          the merge base, the three-way merge completed cleanly. Both lines of
          history remain reachable and untouched; the merge commit records their
          integration into a single unified state without rewriting any IDs.
        </Callout>
        <P>
          Now look at what happens when the trunk has <Strong>not</Strong>{" "}
          diverged:
        </P>
        <FastForwardFigure />
        <Callout kind="insight">
          When main has no commits beyond the merge base, the lowest common
          ancestor <Strong>is</Strong> main&rsquo;s current tip. Git does not need
          a three-way merge commit because there are no trunk changes to
          reconcile. It executes a <Term>fast-forward</Term>, advancing main&rsquo;s
          pointer to feature&rsquo;s tip with zero new commits created.
        </Callout>
      </LessonSection>

      <LessonSection id="conflict-resolution">
        <Lead>
          Automation succeeds only when edits are disjoint. When both branches
          modify the same lines differently relative to the merge base, algorithms
          stop and human judgement must step in.
        </Lead>
        <P>
          Suppose the merge base had <Strong>max_retries = 3</Strong>. On main, an
          incident response commit changed it to <Strong>5</Strong>. On feature, a
          resilience overhaul changed the same line to <Strong>10</Strong>. Both{" "}
          <Strong>diff(base, main)</Strong> and{" "}
          <Strong>diff(base, feature)</Strong> claim ownership of line 1.
        </P>
        <Callout kind="warning">
          Git refuses to guess. Rather than silently picking a winner or dropping
          an edit, Git halts the merge, marks the index unmerged, and inserts{" "}
          <Term>conflict markers</Term> (<Strong>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</Strong>,{" "}
          <Strong>=======</Strong>,{" "}
          <Strong>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</Strong>) directly into your working
          tree. The developer must inspect both sides, select or synthesize the
          correct code, stage the resolution, and complete the commit.
        </Callout>
        <P>
          Once resolved and committed, the resulting commit is structurally
          identical to a clean three-way merge: a two-parent commit joining both
          branch tips. The only difference is that a human provided the diff
          instead of an algorithm.
        </P>
      </LessonSection>
    </Lesson>
  );
}
