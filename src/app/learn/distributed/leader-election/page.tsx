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
      <LessonSection id="why-a-leader">
        <Lead>
          Replication gave you one node that accepts every write and several
          that copy it. That single writer is not bureaucracy — it is how a
          distributed system gets <Strong>one order of events</Strong>, which
          is the only thing that makes &quot;the last write&quot; mean
          anything at all.
        </Lead>
        <P>
          The catch arrived at the end of that lesson: the leader died, and a
          human promoted a replica. That works exactly once, at 3am, if
          someone is awake. <Term>Leader election</Term> is the automated
          answer — the cluster notices the silence and picks a successor
          itself, in about as long as it takes you to read this sentence.
        </P>
        <P>
          The rules below are <Term>Raft</Term>&apos;s, simplified. Every node
          holds a <Term>term</Term> — a monotonic election counter, the
          cluster&apos;s version of &quot;which government is this?&quot; — and
          a role: <Strong>leader</Strong>, <Strong>follower</Strong>, or{" "}
          <Strong>candidate</Strong>. A leader proves it is alive by sending{" "}
          <Term>heartbeats</Term>. Every heartbeat a follower receives resets
          that follower&apos;s <Strong>randomized election timer</Strong>. Miss
          enough heartbeats and the timer fires: the follower increments the
          term, votes for itself, and asks everyone else for their vote.
        </P>
        <P>
          The randomization is the trick. If all five timers were identical
          they would fire together, every node would stand for election, and
          every node would vote for itself — a permanent tie. Drawing each
          timer from a range makes one node reliably first, and first almost
          always wins.
        </P>
      </LessonSection>

      <LessonSection id="kill-the-leader">
        <P>
          Five peers, fully connected, and an app wired to <Term>n1</Term>.
          The cluster starts cold with nobody in charge, so the first thing
          you see is an election: timers count down, one fires, violet{" "}
          <Term>RequestVote</Term> packets fan out, green grants come back,
          and at three votes a leader exists. From then on the small cyan
          heartbeats are the entire job — proof of life, twice a second.
        </P>
        <P>
          Amber packets are client writes. They enter at n1 and are proxied to
          whichever peer currently holds the leader role, so the write path
          visibly re-routes every time leadership moves. Watch what happens
          when there is nobody to route to. (n1 is this app&apos;s only
          connection, so killing <em>it</em> bounces the writes for want of a
          route rather than a leader — real client libraries hold a list of
          peers and retry the next one.)
        </P>
        <LeaderElectionFigure />
        <P>
          Two experiments, in order. First stretch{" "}
          <Term>heartbeat interval</Term> toward the{" "}
          <Term>election timeout</Term>: the leader is perfectly healthy, but
          the followers stop hearing from it often enough, and a node times
          out and calls an election anyway. Terms climb, leadership bounces
          between nodes, writes bounce with it. That is a{" "}
          <Strong>spurious election</Strong>, and in production it is usually
          caused by a garbage-collection pause or a saturated network card
          rather than a slider.
        </P>
        <P>
          Then kill the leader — the button, or click the box. Heartbeats
          stop, the surviving timers run out, and a couple of seconds later
          there is a new leader on a new term and the writes resume against
          it. Nothing was promoted by hand. The cost is on the meters:{" "}
          <Term>writes rejected</Term> counts every request that arrived
          during the gap and found nobody allowed to accept it.
        </P>
        <Callout kind="warning">
          Failover is never free, and its length is set by the timeout you
          chose. Real clusters run 150–300ms election timeouts (this sim uses
          seconds so you can watch), which buys a sub-second gap — at the
          price of calling an election every time a node stalls for a third of
          a second. Tighter timeouts mean faster recovery <em>and</em> more
          false alarms; there is no setting that gives you neither.
        </Callout>
      </LessonSection>

      <LessonSection id="quorum">
        <P>
          Keep killing and you find the floor. Three of five is fine. Two of
          five is not — and the reason is the rule that has been running the
          whole time: a candidate needs a <Term>majority</Term> of the{" "}
          <Strong>cluster</Strong>, three votes out of five, not a majority of
          whoever happens to be alive. Two survivors can agree perfectly and
          unanimously, and it buys them nothing. The badges show it: each
          candidate stalls at 1/3 or 2/3, the term climbs on every retry, and{" "}
          <Term>elections won</Term> never moves.
        </P>
        <P>
          That looks like pedantry until you ask what the rule is defending
          against. Suppose those two survivors could elect themselves a
          leader. Then the other three — alive and well on the far side of a
          network partition, not dead at all — could elect one too, because
          three is a majority of the living <em>they</em> can see. Two
          leaders, two histories, both accepting writes, and no algorithm on
          earth to merge them afterwards. That is{" "}
          <Term>split brain</Term>, and requiring a fixed majority is what
          makes it impossible: <Strong>two majorities of five must share at
          least one node</Strong>, and that node will not vote twice in the
          same term.
        </P>
        <Callout kind="insight">
          Overlap is the whole idea. Any two quorums intersect, so the
          survivor of any partition can always reconstruct what the last
          quorum agreed to. It is why odd cluster sizes are the convention:
          5 nodes tolerate 2 failures, and 6 nodes still tolerate only 2 — you
          bought a machine that adds cost and latency without adding fault
          tolerance. It is also why a 2-node &quot;HA pair&quot; is a trap:
          1 is not a majority of 2, so a pair running consensus survives zero
          failures. If a 2-node cluster ever does fail over, it is not running
          consensus — it is guessing, and one day it will guess twice.
        </Callout>
        <P>
          The last beat of the sim is the recovery: one node reboots, the live
          count is back to three, and the very next timer to fire produces a
          leader in a single round. Nothing was repaired, no state was
          rebuilt — quorum came back, so consensus came back with it.
        </P>
        <Callout kind="note">
          This is production machinery, not theory. <Term>Raft</Term> is
          what <Term>etcd</Term> runs, which is what every Kubernetes cluster
          stores its entire world in; <Term>Consul</Term> and{" "}
          <Term>CockroachDB</Term> run it too. <Term>ZooKeeper</Term> uses{" "}
          <Term>ZAB</Term> and Google&apos;s Chubby uses <Term>Paxos</Term>,
          but the shape is identical: an elected leader, a term (or epoch),
          heartbeats, and a majority that must overlap. When someone says a
          service &quot;needs an odd number of nodes,&quot; this lesson is the
          reason.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
