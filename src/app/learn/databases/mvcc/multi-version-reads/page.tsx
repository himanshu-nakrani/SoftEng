import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  SnapshotReadFigure,
  WriteConflictFigure,
} from "@/lessons/mvcc/multi-version-reads-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("multi-version-reads");

export default function MultiVersionReadsPage() {
  return (
    <Lesson slug="multi-version-reads">
      <LessonSection id="one-cell">
        <Lead>
          Repeatable read gave a transaction a fixed point of view: a{" "}
          <Term>snapshot</Term> taken when it began. That lesson showed the
          outcome — a stable total — and left the machinery inside a single
          committed cell. This one opens the cell.
        </Lead>
        <P>
          A row is not one value that writes overwrite. It is a{" "}
          <Term>chain of versions</Term>. Every write appends a new version
          stamped with the transaction that wrote it and the logical time it
          committed; the old version stays exactly where it was. A reading
          transaction takes a <Strong>snapshot timestamp</Strong> when it begins
          and reads the newest version committed at or before that time.
        </P>
        <P>
          That is <Term>multi-version concurrency control</Term>, and the
          consequence is the whole point: a writer can commit a new version while
          a reader is still looking at the old one, and neither waits for the
          other, because the old version is still physically there to read. The
          reader is not looking at a copy of the past — it is looking at a version
          that is still present.
        </P>
      </LessonSection>

      <LessonSection id="readers-dont-block">
        <TryThis>
          <LI>
            Step through. Watch each row grow a second version chip to the right
            of the first, joined by an arrow — the old one is never replaced.
          </LI>
          <LI>
            Read T1&apos;s total at the end. It is <Strong>200</Strong> in every
            run, however the transfer interleaves.
          </LI>
          <LI>
            Reshuffle to <Strong>seed 1</Strong>. T1 takes its snapshot at clock
            2, then reads the OLD bob=100 even though a newer committed bob=150
            already sits beside it — the read chip is ringed on the older version.
          </LI>
          <LI>
            Confirm nobody waited: the <Term>transfer</Term> committed on its own
            schedule, and the report still committed too.
          </LI>
        </TryThis>
        <SnapshotReadFigure />
        <Callout kind="insight">
          The report and the transfer ran concurrently and{" "}
          <Strong>neither blocked the other</Strong>. The report read a consistent
          pair — both from before the transfer committed, or both from after —
          because its snapshot timestamp selects one coherent version of each row.
          The reason the old version was available to read is the reason it was
          not thrown away: MVCC keeps it precisely so a snapshot that predates the
          new one still has something to look at.
        </Callout>
      </LessonSection>

      <LessonSection id="write-conflict">
        <TryThis>
          <LI>
            This is the lost-update program again: a deposit and a withdrawal, both
            reading the balance from their own snapshot and writing it back.
          </LI>
          <LI>
            At <Strong>seed 42</Strong>, T2 commits first. T1&apos;s version is
            struck through in red: its commit is <Term>refused</Term> because the
            balance changed since its snapshot.
          </LI>
          <LI>
            Read the final balance. When one is refused it is <Strong>150</Strong>{" "}
            or <Strong>70</Strong> — never the silently-merged 120.
          </LI>
          <LI>
            Reshuffle. Both commit in only 49 of 200 orders; the other 151 refuse
            whichever transaction tried to commit second.
          </LI>
        </TryThis>
        <WriteConflictFigure />
        <Callout kind="warning">
          MVCC does not make a lost update disappear — it makes it{" "}
          <Strong>visible</Strong>. Two transactions writing the same row conflict
          at commit time under <Term>first-committer-wins</Term>: the first to
          commit appends its version, and the second discovers the row it based its
          write on has moved, so it is rolled back rather than allowed to overwrite.
          That is the same 49-of-200 split the lost-update lesson measured under
          serializable — a refused commit, not a repaired one.
        </Callout>
      </LessonSection>

      <LessonSection id="what-it-costs">
        <Lead>
          Keeping the old versions is not free, and it does not buy
          serializability.
        </Lead>
        <P>
          Every write creates a version rather than replacing one, so the{" "}
          <Term>versions-kept</Term> meter climbs and never falls during a run. A
          real engine reclaims versions that no live snapshot can still see — a
          background <Term>vacuum</Term> — but until then the storage is the price
          of never blocking a reader. This model keeps every version so the chain
          stays legible; production systems trade some of that legibility for
          space.
        </P>
        <P>
          And the guarantee is exactly repeatable read, no stronger. Snapshot
          isolation catches a write-write conflict because two writers of one row
          leave a version to compare. It cannot catch <Strong>write skew</Strong>,
          where two transactions write <Strong>different</Strong> rows: there is no
          overlapping version, so first-committer-wins has nothing to fire on. MVCC
          is not a stricter promise than the snapshot — it is a cheaper way to keep
          the same one, which is why write skew survived repeatable read and
          survives here too.
        </P>
      </LessonSection>
    </Lesson>
  );
}
