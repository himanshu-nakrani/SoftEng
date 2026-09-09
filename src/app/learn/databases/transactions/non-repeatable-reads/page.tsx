import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import {
  NonRepeatableFigure,
  RepeatableReadFigure,
} from "@/lessons/transactions/non-repeatable-reads-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("non-repeatable-reads");

export default function NonRepeatableReadsPage() {
  return (
    <Lesson slug="non-repeatable-reads">
      <LessonSection id="read-twice">
        <Lead>
          Read committed keeps its promise: every value you read has been
          committed. It says nothing about whether two of your reads saw the same{" "}
          <Strong>moment</Strong>.
        </Lead>
        <P>
          <Term>T1</Term> reads alice, reads bob, and reports the total.{" "}
          <Term>T2</Term> transfers 50 between them and commits. Nothing here
          fails: T2 is a correct, successful transaction, and every value T1 reads
          is committed data. There is no dirty read — the counter stays at zero all
          run.
        </P>
        <P>
          But T1&apos;s two reads happen at two different times. If T2 commits
          between them, T1 sees alice as it was and bob as it became, and adds a
          pair of numbers that were <Strong>never simultaneously true</Strong>.
          That is a <Term>non-repeatable read</Term>: read the same data twice in
          one transaction and it can change underneath you.
        </P>
      </LessonSection>

      <LessonSection id="watch-it-change">
        <TryThis>
          <LI>
            Step through and watch the <Term>dirty reads</Term> counter. It never
            moves — this is a different failure.
          </LI>
          <LI>
            Read T1&apos;s total at the end. Shuffle to see it move between 200
            and <Strong>250</Strong> — 250 in roughly one run in four.
          </LI>
          <LI>
            On a 250 run, step back and find T2&apos;s <Term>COMMIT</Term> landing
            between T1&apos;s two reads.
          </LI>
          <LI>
            Check the committed table at the end: alice 50, bob 150. The transfer
            was correct and the accounts still sum to 200 — only the report is
            wrong.
          </LI>
        </TryThis>
        <NonRepeatableFigure />
        <Callout kind="insight">
          Both of T1&apos;s reads were legal, and its arithmetic was right. The
          accounts end at 50 and 150, summing to 200 exactly as they should. What
          T1 lacked was a consistent <Strong>point of view</Strong>. This is why
          &ldquo;we read committed data&rdquo; is a weaker statement than it
          sounds, and why a report that sums several rows can be wrong on a
          database where every individual query is correct.
        </Callout>
      </LessonSection>

      <LessonSection id="snapshots">
        <P>
          <Term>Repeatable read</Term> gives the transaction a fixed point of view:
          a <Term>snapshot</Term> taken when it begins. Every read is answered from
          that snapshot, so a value cannot change under it — not because writers
          are blocked, but because the reader stopped looking at the present.
        </P>
        <RepeatableReadFigure />
        <P>
          The total is 200 across all two hundred seeds. Notice what did{" "}
          <Strong>not</Strong> happen: T2 was never delayed. It transferred and
          committed exactly as before. The reader is simply looking at a consistent
          older world — which is what <Term>MVCC</Term> is, keeping several
          versions of a row so a snapshot remains readable while writers move on.
        </P>
        <Callout kind="warning">
          A snapshot is stale by construction, and that is the trade: T1 reports a
          total that was true when it started and is no longer true when it
          finishes. For a report, correct-as-of-a-moment is exactly right. For a{" "}
          <Strong>decision that then writes</Strong> — read a balance, approve a
          withdrawal — it is not enough, because two transactions can each read a
          consistent snapshot, each make a locally valid decision, and together
          break an invariant neither violated alone. That is write skew, and it
          survives repeatable read.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
