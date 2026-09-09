import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  GroupCommitFigure,
  PerCommitFigure,
} from "@/lessons/durability/group-commit-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("group-commit");

export default function GroupCommitPage() {
  return (
    <Lesson slug="group-commit">
      <LessonSection id="one-each">
        <Lead>
          A commit costs one sequential force. At ten thousand commits a second, is
          it one force <Strong>each</Strong>?
        </Lead>
        <P>
          An fsync is not free and it does not get cheaper with company — it is a
          round trip to a device that has to actually persist something. If every
          transaction needs its own, the log becomes the throughput ceiling of the
          whole database, no matter how much work the transactions themselves were
          doing.
        </P>
        <P>
          But notice what the commit records have in common: they go to the{" "}
          <Strong>same log</Strong>, in order. One fsync makes a prefix durable,
          and a prefix can contain any number of commit records. So one write can
          answer many transactions.
        </P>
      </LessonSection>

      <LessonSection id="forcing-each">
        <P>
          First, the policy from the last two lessons. T1, T2 and T3 each write a
          page and commit, and each commit forces the log.
        </P>
        <TryThis>
          <LI>
            At crash 6, the forces meter reads <Strong>3</Strong> — one per
            transaction.
          </LI>
          <LI>
            Walk the crash point up from 0 and watch the transactions turn green
            one at a time: T1 is answered from crash <Strong>2</Strong>, T2 from{" "}
            <Strong>4</Strong>, T3 from <Strong>6</Strong>.
          </LI>
        </TryThis>
        <PerCommitFigure />
        <P>
          This is the best possible latency: each transaction is answered the
          instant its own record is durable, and never waits for anybody. The bill
          is on the forces meter — three writes for three transactions, and it
          would be a thousand for a thousand.
        </P>
      </LessonSection>

      <LessonSection id="one-force">
        <P>
          Now the same three transactions, batching the force. Each commit appends
          its record and stops there; one fsync at operation 6 covers all of them.
        </P>
        <TryThis>
          <LI>
            Stop at crash 6 and read the transaction rows: all three say{" "}
            <Term>committing</Term>, and the forced-log row is{" "}
            <Strong>empty</Strong>. Six records exist and none are durable.
          </LI>
          <LI>
            Drag to 7. A single fsync carries all six below the line and answers
            all three at once — forces meter: <Strong>1</Strong>.
          </LI>
          <LI>
            Compare the log records meter across both figures. It reads{" "}
            <Strong>6</Strong> either way.
          </LI>
        </TryThis>
        <GroupCommitFigure />
        <P>
          One force instead of three, for the same three transactions and the same
          six records. The saving is entirely in <Strong>forces</Strong>, not in how
          much was written to the log — and it would be one force for a hundred
          transactions just as readily as for three.
        </P>
      </LessonSection>

      <LessonSection id="latency-not-safety">
        <Lead>
          It is tempting to read that crash-6 frame as a loss: six records gone,
          three finished transactions destroyed. It is not a loss, and seeing why is
          the point of the lesson.
        </Lead>
        <P>
          Nobody had been told anything. All three transactions were still{" "}
          <Term>committing</Term> — their records appended, none forced, and so none
          acknowledged. A caller still waiting on a commit has not been promised
          durability, so a crash that discards its work breaks no promise. It just
          returns an error instead of a success.
        </P>
        <P>
          The figures bear that out: across all eight crash points,{" "}
          <Strong>neither</Strong> policy ever loses acknowledged work. Grouping is
          not a durability compromise, and the durability rule has not moved an
          inch — a commit is still durable exactly when its record is on disk.
        </P>
        <Callout kind="insight">
          What was actually traded is <Strong>latency</Strong>. Under per-commit,
          T1 was answered at crash point 2. Under grouping it is answered at 7 —
          five operations later, spent waiting for transactions it has nothing to do
          with. Grouping does not slow the database down; it slows individual
          transactions down in order to speed the system up.
        </Callout>
        <P>
          That makes the batch window a genuine tuning decision rather than a
          setting with a right answer. Wait longer and each fsync answers more
          transactions, so throughput rises and every commit&rsquo;s latency rises
          with it. Wait less and you approach one force each. Real systems make the
          window adaptive, widening it precisely when there is a queue to amortise
          across — which is when the waiting costs least, because those
          transactions were going to queue for the disk anyway.
        </P>
        <Callout kind="warning">
          The one thing that must not be batched is the <Strong>answer</Strong>. If
          a transaction reports success while its commit record is still in the
          volatile tail, the trade stops being latency for throughput and becomes
          durability for throughput. That is a different decision, it is usually the
          wrong one, and it is invisible in the happy path — which is why{" "}
          <em>Write-Ahead Logging</em> pins the moment of acknowledgement with its
          own test.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
