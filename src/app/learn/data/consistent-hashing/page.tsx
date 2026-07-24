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
          The violet ticks are 24 keys at their fixed ring positions; the
          chips show how many each cache owns. Run the same experiment that
          hurt last lesson — add a node — and read the{" "}
          <Term>remapped</Term> meter. Then kill one and watch where its
          keys go.
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
          One honest wrinkle: with a few nodes at random ring positions, the
          arcs are lumpy — one node can own a far bigger slice than another
          (you can see it in the chips). Real systems fix this with{" "}
          <Term>virtual nodes</Term>: each physical machine appears at
          100–200 points on the ring, so its total share averages out, and
          a dead node&apos;s load scatters across everyone instead of
          dumping onto one unlucky neighbour.
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
