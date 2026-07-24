import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { LeaderElectionFigure } from "@/lessons/distributed/leader-election-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leader Election",
};

export default function LeaderElectionPage() {
  return (
    <Lesson slug="leader-election">
      <LessonSection id="who-decides">
        <Lead>
          Replication needed a leader. CAP taught you partitions punish
          the unprepared. The last question of this track:{" "}
          <Strong>when the leader dies, who decides who&apos;s next</Strong>{" "}
          — with no human, no shared memory, and a network that lies?
        </Lead>
        <P>
          The answer that powers etcd, Consul, and every serious database
          is an election with three moving parts: a{" "}
          <Term>heartbeat</Term> that means &quot;I&apos;m still in
          charge,&quot; a <Term>randomized timeout</Term> that decides who
          notices the silence first, and a <Term>majority vote</Term> that
          makes the result safe. This is Raft&apos;s election, simplified
          but honest.
        </P>
      </LessonSection>

      <LessonSection id="watch-an-election">
        <P>
          The full load bar marks the leader; violet packets are its
          heartbeats; every chip shows that node&apos;s <Term>term</Term> —
          a logical clock counting elections. At the 10-second mark the
          leader dies. Watch the silence, then the race: amber vote
          requests, green votes back, a new reign.
        </P>
        <LeaderElectionFigure />
        <Callout kind="insight">
          The randomized timeout is the quiet genius. If every node timed
          out identically, they&apos;d all campaign at once and split the
          vote forever. Randomness makes one node blink first — almost
          always giving a clean, single-candidate election. Sometimes
          coordination&apos;s best tool is a dice roll.
        </Callout>
      </LessonSection>

      <LessonSection id="quorum">
        <P>
          Now do what the caption says: kill a second node — fine. Kill a
          third, and something remarkable happens: the two survivors,{" "}
          <em>perfectly healthy</em>, campaign forever (watch the term
          counter spin) and never elect.{" "}
          <Strong>Quorum is a majority of the total membership</Strong> —
          3 of 5 — not of whoever answered today.
        </P>
        <P>
          That constant is the safety proof in one line: two disjoint
          majorities of the same 5 can&apos;t exist, so two legitimate
          leaders can&apos;t either. It&apos;s also the bill: below quorum
          the cluster chooses to be <em>unavailable</em> rather than risk
          split-brain — the CP choice from the CAP lesson, made by
          arithmetic.
        </P>
        <Callout kind="note">
          This is why consensus clusters come in odd sizes: 5 nodes
          tolerate 2 failures; 4 nodes tolerate only 1 — a whole extra
          machine buying zero extra safety. And why &quot;just add more
          replicas&quot; makes elections <em>slower</em>, not safer:
          majorities grow with the cluster.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
