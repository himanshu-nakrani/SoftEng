import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { TwoPhaseCommitFigure } from "@/lessons/distributed/two-phase-commit-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Two-Phase Commit",
};

export default function TwoPhaseCommitPage() {
  return (
    <Lesson slug="two-phase-commit">
      <LessonSection id="all-or-nothing">
        <Lead>
          One transaction, three databases, one rule:{" "}
          <Strong>either all of them commit or none of them do</Strong>. A
          single machine gets that for free — it has one log, and the write
          is durable or it isn&apos;t. Across three machines there is no
          &quot;the&quot; log, so atomicity has to be negotiated over a
          network that can drop the negotiation halfway through.
        </Lead>
        <P>
          <Term>Two-phase commit</Term> is the oldest answer, and the name is
          the whole protocol. <Strong>Phase one, prepare:</Strong> the
          coordinator asks every participant <em>can you promise to commit
          this?</em> A participant that says <Term>YES</Term> is making a
          binding promise — it has written the change to its log and locked
          the rows, and from that moment it may not change its mind. A{" "}
          <Term>NO</Term> costs it nothing: it aborts locally and moves on.{" "}
          <Strong>Phase two, decide:</Strong> the coordinator counts the
          votes. Unanimous YES means COMMIT; a single NO vetoes the whole
          transaction. It broadcasts the outcome, everyone applies it and
          releases their locks, and the transaction is done.
        </P>
        <P>
          So a distributed write costs two full round trips instead of one,
          and the rows it touches stay locked across both of them. Both of
          those are prices you can measure — the figure below puts numbers on
          them. The price you cannot measure is what happens in the gap
          between the two phases.
        </P>
      </LessonSection>

      <LessonSection id="run-a-commit">
        <P>
          Every dot below is a protocol message. Follow a single transaction
          through its four beats: amber <Term>PREPARE</Term> fans out to all
          three databases; each answers with a green <Term>YES</Term> or a red{" "}
          <Term>NO</Term>; the coordinator broadcasts violet{" "}
          <Term>COMMIT</Term> (or orange <Term>ABORT</Term>); cyan{" "}
          <Term>ACK</Term> closes it out. Notice that the links are not equal
          speed — the coordinator sits waiting on <Term>db-c</Term> in every
          round, because <Strong>each phase finishes at the pace of the
          slowest participant</Strong>, not the average one.
        </P>
        <TwoPhaseCommitFigure />
        <P>
          The pips under each database are its <Term>locks</Term>. They light
          the moment it votes YES and go dark only when the decision packet
          lands — that window is exactly two one-way trips wide, and nothing
          else may touch those rows for its duration. Turn{" "}
          <Term>participant abort rate</Term> up and watch one red vote kill a
          transaction all three databases were willing to commit; that veto{" "}
          <em>is</em> the atomicity guarantee doing its job. Turn{" "}
          <Term>transaction rate</Term> up and the coordinator&apos;s backlog
          chip starts climbing, because new transactions cannot start until
          held locks come free.
        </P>
        <P>
          Watch <Term>coordination tax</Term>: it compares the full protocol
          against one machine&apos;s round trip on the same wire, and it sits
          near <Strong>3×</Strong>. That is what atomicity across three
          databases costs when everything goes right.
        </P>
      </LessonSection>

      <LessonSection id="coordinator-dies">
        <P>
          Now the gap. The coordinator collects the last YES vote. For one
          instant it is the only machine in the world that knows this
          transaction commits — and then it dies, before a single COMMIT
          packet leaves. Press <Term>kill at the worst moment</Term> to stage
          it (the timeline stages it for you at t=16 either way).
        </P>
        <P>
          Every participant is now holding locks it is not allowed to
          release. Not out of caution — out of{" "}
          <Strong>genuine ignorance</Strong>. From db-a&apos;s seat, &quot;I
          voted YES and heard nothing&quot; is indistinguishable from
          &quot;db-c voted NO and the ABORT never reached me&quot;. Commit on
          a guess and you risk the exact split outcome the protocol exists to
          prevent: two databases with the row, one without. So they wait. The{" "}
          <Term>blocked txns</Term> meter counts them, the databases turn
          orange, and the coordinator&apos;s backlog chip fills with
          transactions that cannot even start. One dead process, and three
          healthy databases are useless.
        </P>
        <P>
          Six seconds later the coordinator comes back and replays its log.
          Anything it had a complete unanimous vote set for commits — the
          decision was already made, it just never got out. Anything with
          votes missing is <Term>presumed abort</Term>: with no record of a
          promise, the safe outcome is the only defensible one. The locks
          release, the backlog drains, and the latency sparkline carries a
          scar where those transactions spent the outage.
        </P>
        <Callout kind="warning">
          The blocking window is not a bug in 2PC — it is a theorem about it.
          The coordinator is a single point of failure that cannot be fixed by
          making the coordinator more reliable, because the participants
          genuinely cannot infer the decision from what they know. And a
          coordinator that dies <em>permanently</em> holds those locks
          forever: kill it by hand in the figure and watch nothing recover
          until you revive it.
        </Callout>
        <Callout kind="insight">
          This is why modern systems rarely run bare 2PC.{" "}
          <Strong>Consensus protocols</Strong> (Raft, Paxos) close the window
          by replicating the <em>decision log</em> across a quorum: the
          outcome survives any single crash, a new coordinator is elected and
          simply reads it. <Strong>Sagas</Strong> go the other way and give up
          atomicity entirely — commit each step independently and run
          compensating transactions to undo the ones that shouldn&apos;t have
          happened, trading &quot;never inconsistent&quot; for &quot;never
          blocked&quot;. 2PC is still very much alive where the participants
          are few, close and trusted: <Term>XA</Term> transactions across a
          database and a message broker, and the internal commit path of
          distributed SQL engines like Spanner and CockroachDB — which run 2PC{" "}
          <em>on top of</em> Raft-replicated participants, so that a crashed
          coordinator is replaced rather than waited for.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
