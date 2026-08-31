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
  OptimisticFigure,
  TwoPhaseLockingFigure,
} from "@/lessons/transactions/two-phase-locking-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("two-phase-locking");

export default function TwoPhaseLockingPage() {
  return (
    <Lesson slug="two-phase-locking">
      <LessonSection id="why-not-wait">
        <Lead>
          The last two lessons ended with a refused commit and an obligation to
          retry. There is an obvious objection: instead of letting the second
          transaction do its work and then failing it, why not make it{" "}
          <Strong>wait</Strong>?
        </Lead>
        <P>
          It can. <Term>Serializable</Term> names a guarantee, not a mechanism, and
          there are two ways to reach it. The version you have seen is{" "}
          <Term>optimistic</Term>: let transactions run against snapshots, assume
          they will not conflict, and check at commit. When the assumption fails,
          the work is discarded.
        </P>
        <P>
          The other is <Term>pessimistic</Term>: take a lock before you read,
          hold it until you commit, and let anyone who wants the same row wait
          their turn. Nothing is ever discarded, because nothing conflicting ever
          runs concurrently.
        </P>
      </LessonSection>

      <LessonSection id="optimistic-cost">
        <P>
          Here is the lost-update program again, optimistically. Both transactions
          read, both compute, and the second to commit is told its balance moved.
        </P>
        <OptimisticFigure />
        <P>
          Both transactions succeed in only <Strong>49 of 200</Strong> runs. In the
          other 151 one of them did its entire job and threw it away. Notice what
          never happens: nobody waits. Throughput is high precisely because nothing
          blocks — the cost is paid in wasted work, and in the retry loop the
          application is obliged to write.
        </P>
      </LessonSection>

      <LessonSection id="pessimistic">
        <TryThis>
          <LI>
            Step through and watch the <Term>locked by</Term> marker appear on the
            balance row at the first read.
          </LI>
          <LI>
            Watch the other lane read <Term>waiting for balance</Term> — it cannot
            even read until the first transaction commits.
          </LI>
          <LI>
            Read the final balance: <Strong>120</Strong>. Shuffle as much as you
            like; it is 120 in every run.
          </LI>
        </TryThis>
        <TwoPhaseLockingFigure />
        <Callout kind="insight">
          Both transactions commit in all 200 runs, no commit is ever refused, and
          the answer is right every time — with no retry logic anywhere. The lock
          is taken at the <Strong>read</Strong>, which is the part that matters:
          taking it at the write would be too late, because the value you computed
          from could already have moved. That is what{" "}
          <Term>SELECT … FOR UPDATE</Term> is for.
        </Callout>
        <P>
          The name describes the shape: two phases, one acquiring locks and one
          releasing them, never interleaved. Locks are held to the very end rather
          than released as soon as a row is done with — releasing early would let
          another transaction read a row you might still change.
        </P>
        <Callout kind="warning">
          The bill arrives as blocking: something waits in{" "}
          <Strong>every single run</Strong> here. Under contention that becomes
          queueing, and a transaction holding locks while it waits on something slow
          holds up everyone behind it. Locks taken in different orders also deadlock
          — the engine then picks a victim and rolls it back, so you need a retry
          loop after all, just for a rarer case. Neither mechanism is free: optimistic
          pays in wasted work, pessimistic pays in waiting, and the right choice
          depends on whether your transactions actually conflict.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
