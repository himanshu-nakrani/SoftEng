import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Lead,
  LI,
  P,
  Strong,
  Term,
  TryThis,
  UL,
} from "@/components/lesson/prose";
import { GossipFigure } from "@/lessons/distributed/gossip-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("gossip");

export default function GossipPage() {
  return (
    <Lesson slug="gossip">
      <LessonSection id="epidemic">
        <Lead>
          The last lesson spent a cluster&apos;s entire budget on agreeing who
          is in charge. This one spends nothing, elects nobody, and still gets
          a fact to every node in the building — by copying the one
          distribution mechanism that has never needed a coordinator:{" "}
          <Strong>an epidemic</Strong>.
        </Lead>
        <P>
          The rules of <Term>gossip</Term> fit in a sentence. Every node holds
          a flat list of its peers; once a node learns something, then every
          round — a second or so — it picks <Term>fanout</Term> of them at
          random and tells them, and they do the same. Nobody is assigned a
          subtree, nobody acknowledges anything, and nobody notices when a peer
          stops answering.
        </P>
        <P>
          What makes that more than a party trick is the arithmetic. If every
          node that knows tells two more, the group that knows roughly
          multiplies each round instead of growing by a fixed amount: 1, 3, 7,
          10. Coverage therefore costs <Strong>O(log N) rounds</Strong> — about
          7 for a hundred nodes, about 10 for a thousand, about 20 for a
          million. The sender count grows with the crowd, so the crowd is what
          delivers to itself. Compare that to one coordinator mailing N nodes:
          the last one waits for all N sends, and if the coordinator dies
          halfway, half the cluster never hears.
        </P>
        <P>
          The bill is the other half of the story. Nodes keep gossiping after
          everyone already knows, because <em>no node can tell</em> that
          everyone knows — that would take exactly the global view gossip
          refuses to maintain. So the traffic is O(N·k) messages per round,
          forever, and most of it is redundant. That redundancy is not a leak
          to be plugged; it is what buys delivery through dead peers, dropped
          packets and reboots without a single retry, timeout or failover path.
        </P>
        <P>This is production machinery, and you are almost certainly running it:</P>
        <UL>
          <LI>
            <Term>Cassandra</Term> and <Term>DynamoDB</Term>-style stores
            gossip membership and node state — who is up, who owns which token
            range — so a ring can heal without anyone in charge of it.
          </LI>
          <LI>
            <Term>Serf</Term> and HashiCorp&apos;s <Term>memberlist</Term>{" "}
            (the <Term>SWIM</Term> protocol) spread membership and failure
            suspicions this way under Consul and Nomad.
          </LI>
          <LI>
            <Term>Bitcoin</Term> and Ethereum relay every transaction and block
            by gossip across an open peer-to-peer network, where there is no
            coordinator available even in principle.
          </LI>
          <LI>
            <Term>Redis Cluster</Term> runs a gossip bus between its shards to
            track which node owns which slots — and{" "}
            <Term>CockroachDB</Term> runs both protocols at once: Raft inside
            every range, gossip across the cluster for node liveness and
            metadata.
          </LI>
        </UL>
      </LessonSection>

      <LessonSection id="spread-it">
        <P>
          Ten peers, and every pair is drawn — because in gossip every pair is
          real. A node picks its targets from the whole membership list, so
          each message here rides the direct wire to the peer it was addressed
          to; nothing is routed through anybody. That thicket <em>is</em> the
          protocol&apos;s worldview: no hierarchy, no tree, no special node.
        </P>
        <P>
          For the first few seconds nothing moves, because nobody has anything
          to say. Then n0 learns a fact and the epidemic starts. Amber dots are
          messages that will teach their receiver something; grey dots are
          messages that will not, because the receiver already knows or is
          dead. The sender cannot tell them apart —{" "}
          <Strong>that distinction is yours, not the protocol&apos;s</Strong> —
          and watching the stage go grey is watching the cost of certainty
          being paid.
        </P>
        <GossipFigure />
        <P>
          The plate in the corner keeps the shape of it: nodes that knew at the
          start of each round. You are looking for the classic epidemic curve —
          a slow start, a near-vertical middle, and a flat top where every
          remaining message is redundant. Read it against{" "}
          <Term>messages sent</Term>, which never flattens.
        </P>
        <TryThis>
          <LI>
            Drop <Term>fanout</Term> to 1 and press{" "}
            <Term>start a new rumor</Term>. One friend a round still gets
            there — in nine rounds instead of three, because a single unlucky
            pick (telling someone who already knows) costs that node the whole
            round. Watch the columns go flat for rounds at a time.
          </LI>
          <LI>
            Now fanout 4: two rounds instead of three. Notice what it did{" "}
            <em>not</em> buy — reaching everyone cost about the same total
            either way (24 messages against 22 here), because the cluster
            gossips for fewer rounds. What quadrupling the fanout really
            changes is the steady rate afterwards, which never stops.
          </LI>
          <LI>
            Switch to <Term>push-pull</Term>. The nodes that{" "}
            <em>don&apos;t</em> know now spend their round asking (cyan), so
            stragglers fetch the news instead of waiting to be told. At fanout
            1 that cuts the spread from nine rounds to four; at fanout 4 it
            mostly just adds traffic, because the tail was never the problem.
          </LI>
        </TryThis>
      </LessonSection>

      <LessonSection id="lose-nodes">
        <P>
          Now kill peers — click any two, mid-spread if you can manage it. Look
          for what <em>doesn&apos;t</em> happen. No election, no re-planning, no
          error, no retry queue: senders keep picking the dead peers, those
          messages turn grey and land on nothing, and the rumor reaches
          everyone else in about the number of rounds it took before. There is
          no single point of failure here because there is no{" "}
          <Strong>single point of anything</Strong> — every node runs the same
          three lines of logic, and a node that vanishes takes only its own
          share of the sending with it.
        </P>
        <P>
          The meters split that honestly. <Term>coverage of live</Term> is
          measured against the peers still up, because a dead peer is not a gap
          in the rumor&apos;s reach — it is gone, and it leaves the numerator
          and the denominator together. <Term>nodes that know</Term> stays
          scaled to the full cluster of ten, so you can still see the hole the
          deaths left.
        </P>
        <P>
          Then revive one. It comes back knowing nothing, coverage dips, and
          within a round or two somebody happens to pick it and it is current
          again. Nothing detected the reboot and nothing was scheduled to
          repair it — that is <Term>anti-entropy</Term>: because peers keep
          exchanging state forever, any difference between two nodes is
          temporary by construction. It is the same property that lets gossip
          survive a message being dropped outright: the next round is another
          chance, and there is always a next round.
        </P>
        <Callout kind="insight">
          Gossip trades latency and bandwidth for robustness:{" "}
          <Strong>O(log N) rounds</Strong> to reach everyone,{" "}
          <Strong>O(N·k) messages per round</Strong> to pay for it, and{" "}
          <Strong>zero coordination</Strong> — no leader, no membership
          agreement, no retry logic, and no node that can fail and take the
          delivery with it. Redundancy is the mechanism, not the waste.
        </Callout>
        <Callout kind="warning">
          Which also says where <em>not</em> to use it. Gossip is eventually
          consistent by construction: it will tell you everyone converges, but
          never when, and never that they have. Anything needing a decision at
          a moment in time — who holds this lock, did this transaction commit,
          who is the leader — still needs the machinery from the last lesson. A
          real cluster runs both: consensus for the handful of facts that must
          be agreed, gossip for the thousands that merely have to arrive.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
