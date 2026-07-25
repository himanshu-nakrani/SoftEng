import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { ReplicationFigure } from "@/lessons/data/replication-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Database Replication",
};

export default function ReplicationPage() {
  return (
    <Lesson slug="replication">
      <LessonSection id="leader-follower">
        <Lead>
          One database is a single point of failure and a read bottleneck.
          The classic fix: one <Term>leader</Term> that accepts every write,
          and <Term>replicas</Term> that copy it and absorb the reads.
        </Lead>
        <P>
          The catch is physics: copying takes time. Between a write landing
          on the leader and arriving at a replica lives the{" "}
          <Strong>replication lag</Strong> — usually milliseconds, sometimes
          seconds, and during trouble, minutes. Every consequence in this
          lesson falls out of that gap.
        </P>
      </LessonSection>

      <LessonSection id="watch-lag">
        <P>
          The badge over each box is its <Strong>data version</Strong>: watch{" "}
          <Term>pg-leader</Term>&apos;s number run ahead while the replicas
          chase it. Violet packets are the replication stream. Crank the{" "}
          <Term>replication lag</Term> slider and the gap becomes impossible
          to miss.
        </P>
        <P>
          Then kill a replica by clicking it. Its version freezes on the spot,
          the survivor quietly absorbs <Strong>every</Strong> read, and the
          longer it stays down the further behind it drifts. Revive it and
          nothing teleports: it replays the backlog entry by entry, over the
          same wire, at the same finite rate — which is exactly why a replica
          that has been down for an hour is not ready an instant after it
          boots.
        </P>
        <ReplicationFigure />
      </LessonSection>

      <LessonSection id="stale-reads">
        <P>
          Orange responses are the payoff of the whole lesson: a client read
          answered by a replica that hasn&apos;t caught up —{" "}
          <Strong>stale data, served with a straight face</Strong>. Nothing
          errored. Nothing is broken. The system is simply telling you the
          truth from a moment ago.
        </P>
        <Callout kind="insight">
          This is <Term>eventual consistency</Term> seen from below: stop
          writing, and the replicas converge. Keep writing, and every read
          from a replica is a small gamble on how much lag you can tolerate.
          Feeds and dashboards shrug; shopping carts and balances can&apos;t.
        </Callout>
        <Callout kind="warning">
          The classic bug: write to the leader, redirect, read from a
          replica — the user watches their own update vanish. Fixes exist
          (pin reads after writes to the leader, session tokens), but only
          if you remember the lag exists.
        </Callout>
        <P>
          At <Term>t=22</Term> the leader itself dies, and the same gap turns
          into something worse than a stale read. For three seconds writes
          bounce red — there is no node permitted to accept them — and then
          the most caught-up replica is promoted and traffic resumes against
          it. Watch the meters at that instant:{" "}
          <Strong>leader version steps backwards</Strong>, because every write
          the old leader committed but never shipped is missing from the new
          leader&apos;s copy, and that copy is the truth now. Those are your{" "}
          <Strong>lost writes</Strong> — the recovery-point objective of
          asynchronous replication, counted in rows nobody will ever get back.
        </P>
        <P>
          Note what does <em>not</em> change at the failover: the box is still
          labelled <Term>replica-1</Term>. Names are identities; leadership is
          a role that moves. Reads never stopped flowing the whole time — only
          writes have a single point of failure here, which is precisely the
          trade this topology makes.
        </P>
      </LessonSection>

    </Lesson>
  );
}
