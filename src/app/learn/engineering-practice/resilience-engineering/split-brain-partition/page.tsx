import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { SplitBrainPartitionFigure } from "@/lessons/resilience-engineering/split-brain-partition-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("split-brain-partition");

export default function SplitBrainPartitionPage() {
  return (
    <Lesson slug="split-brain-partition">
      <LessonSection id="partition-split">
        <Lead>When a network partition severs a database cluster, silence from peers is indistinguishable from death.</Lead>
        <P>
          In a 3-node distributed database cluster (Node 1, Node 2, and Node 3), state replication
          ensures durability across failures. During normal operation, write requests are acknowledged
          only after consensus is established across replicas.
        </P>
        <P>
          Suddenly, an asymmetric network partition severs Node 1 from Nodes 2 and 3. From Node 1&apos;s
          perspective, its peers have gone completely dark. From Nodes 2 and 3&apos;s perspective, Node 1
          has vanished. Because distributed networks are asynchronous, neither side can determine whether
          unreachable nodes have crashed, suffered power loss, paused during a stop-the-world garbage
          collection cycle, or are operating normally behind a severed switch.
        </P>
        <P>
          If clients continue submitting writes to both sides of the partitioned cluster, the system
          confronts the fundamental trade-off formalized by the <Term>CAP theorem</Term>: does the
          database preserve consistency by rejecting uncoordinated updates, or maximize availability
          at the risk of permanent data corruption?
        </P>
      </LessonSection>

      <LessonSection id="quorum-choice">
        <TryThis>
          <LI>Slide to <Strong>both sides accept writes</Strong> — safe in 0 of 200 runs as isolated Node 1 and majority Nodes 2 &amp; 3 commit conflicting updates to identical keys, losing 40 to 60 writes upon healing.</LI>
          <LI>Slide to <Strong>freeze all writes</Strong> — preserves consistency but fails the SLA in 0 of 200 runs by reducing write availability to 0%.</LI>
          <LI>Slide to <Strong>majority quorum with fencing</Strong> — safe in all 200 runs; Nodes 2 and 3 form a 2/3 majority quorum and commit safely, while Node 1 fences itself and cleanly rejects uncoordinated writes.</LI>
        </TryThis>
        <SplitBrainPartitionFigure />
        <Callout kind="insight">
          Accepting writes on both sides loses 40 to 60 updates in 0 of 200 runs upon reconciliation;
          freezing the cluster reduces write availability to 0% in 0 of 200 runs; majority quorum with
          fencing commits safely with 0 lost writes in all 200 runs.
        </Callout>
      </LessonSection>

      <LessonSection id="fencing-tokens">
        <Lead>Majority quorums eliminate concurrent leaders; fencing tokens disarm stale primaries.</Lead>
        <P>
          The mathematical anchor of consensus protocols like Raft and Paxos is the <Term>majority quorum</Term>
          (&lfloor;N/2&rfloor; + 1). In an N = 3 cluster, any quorum requires at least &lfloor;3/2&rfloor; + 1 = 2
          nodes. Because any two sets of 2 nodes in a 3-node cluster must overlap by at least one node
          (2 + 2 - 3 = 1), two disjoint partitions can never simultaneously claim majority consensus.
        </P>
        <P>
          However, quorum arithmetic alone is insufficient if an isolated node does not realize it is
          severed. If Node 1 was the active primary before the partition, it might continue processing
          in-flight requests or flushing dirty pages to disk while Nodes 2 and 3 elect a new primary.
        </P>
        <P>
          To protect against this <Term>split-brain</Term> disaster, consensus implementations pair quorums
          with monotonically increasing <Term>fencing tokens</Term> (generation IDs, terms, or epochs).
          When Nodes 2 and 3 form a new quorum, they increment the cluster epoch. Storage backends,
          state machines, and client leases reject any operation tagged with an outdated token. When the
          partition heals, Node 1 detects the higher epoch, fences its stale local state, and truncates
          divergent uncommitted entries to match the authoritative majority log.
        </P>
      </LessonSection>
    </Lesson>
  );
}
