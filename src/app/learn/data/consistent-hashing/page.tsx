import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { ConsistentHashingFigure } from "@/lessons/data/consistent-hashing-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Consistent Hashing",
};

export default function ConsistentHashingPage() {
  return (
    <Lesson slug="consistent-hashing">
      <LessonSection id="the-ring">
        <Lead>
          Last lesson ended in a 75% migration. The fix is a change of
          geometry: stop asking <Term>hash % N</Term> and put the hash space
          on a <Term>ring</Term>.
        </Lead>
        <P>
          Hash every <Strong>node</Strong> onto a circle. Hash every{" "}
          <Strong>key</Strong> onto the same circle. A key belongs to the
          first node you meet walking clockwise. That&apos;s the whole
          algorithm — and note what it never mentions:{" "}
          <Strong>N</Strong>. No modulus, no coupling between cluster size
          and key placement.
        </P>
      </LessonSection>

      <LessonSection id="spin-it">
        <P>
          The coloured band is <Strong>ownership</Strong>: each cache holds
          the arc that ends at it. The ticks outside the ring are 24 keys at
          their fixed positions, tinted with whoever answers for them right
          now. Run the same experiment that hurt last lesson — add a node —
          and read the <Term>remapped</Term> meter as the new arc flashes.
          Then kill a cache: its arc goes dashed and its keys change colour
          to the neighbour that swallowed them.
        </P>
        <ConsistentHashingFigure />
        <Callout kind="insight">
          Adding a node claims one arc — <Strong>~1/N of the keys</Strong>{" "}
          move, everyone else is untouched. Killing a node hands its arc to
          the next neighbour clockwise. Membership changes went from a
          global reshuffle to a local negotiation.
        </Callout>
      </LessonSection>

      <LessonSection id="virtual-nodes">
        <P>
          One honest wrinkle: with a few nodes at fixed ring positions the
          arcs are lumpy — drop <Term>ring nodes</Term> to 2 and one cache
          owns three quarters of the keyspace, which the{" "}
          <Term>arc spread</Term> meter reports. Now flip{" "}
          <Term>vnodes</Term> and watch the arcs even out: each machine is
          hashed onto the ring <Strong>three</Strong> times instead of once,
          so its total share averages out — and when it dies, its load
          scatters across every neighbour instead of dumping on one unlucky
          successor.
        </P>
        <P>
          Real clusters use 100–200 virtual nodes per machine, not three;
          the arithmetic is the same, just smoother. It is also how you
          give a bigger machine a bigger share — hand it more ring points.
        </P>
        <Callout kind="note">
          This ring is why Cassandra, DynamoDB, and every memcached client
          library can grow a cluster without stopping the world. One idea —
          decouple placement from cluster size — carried an industry.
        </Callout>
      </LessonSection>

    </Lesson>
  );
}
