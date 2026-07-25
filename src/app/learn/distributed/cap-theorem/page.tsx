import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { CapTheoremFigure } from "@/lessons/distributed/cap-theorem-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The CAP Theorem",
};

export default function CapTheoremPage() {
  return (
    <Lesson slug="cap-theorem">
      <LessonSection id="the-choice">
        <Lead>
          Everything you&apos;ve built in this track — replicas, shards,
          queues — assumed the network mostly works. The{" "}
          <Term>CAP theorem</Term> is about the day it doesn&apos;t.
        </Lead>
        <P>
          When a <Strong>partition</Strong> splits your replicas, exactly
          one question remains: a write arrives on each side —{" "}
          <em>do you accept it?</em> Say yes everywhere and the sides
          diverge (you kept <Term>availability</Term>, lost{" "}
          <Term>consistency</Term>). Say no somewhere and you stayed
          consistent by refusing service. There is no third option, because
          information cannot cross a severed link. That&apos;s not an
          engineering limitation — it&apos;s the definition of severed.
        </P>
      </LessonSection>

      <LessonSection id="partition">
        <P>
          Two coasts, two replicas, writes landing on both. The violet{" "}
          <Term>sync</Term> stream keeps the version chips marching
          together. A few seconds in, a fiber cut takes the link down on
          its own — nobody flipped anything, which is exactly the point —
          and from that moment each side knows only its own truth. The{" "}
          <Term>network partition</Term> toggle lets you stage the outage
          again whenever you want it.
        </P>
        <CapTheoremFigure />
      </LessonSection>

      <LessonSection id="cp-vs-ap">
        <P>
          While split, toggle the mode. <Term>CP</Term>: db-east turns
          amber and refuses writes — red bounces, availability craters,
          but the surviving side&apos;s data is authoritative.{" "}
          <Term>AP</Term>: both sides accept and the{" "}
          <Term>diverged writes</Term> counter climbs — everyone gets
          service, and you now owe the universe a reconciliation.
        </P>
        <P>
          Heal the partition in AP mode and watch divergence drain: this
          sim resolves by last-write-wins, which is a polite way of saying{" "}
          <Strong>somebody&apos;s write gets silently discarded</Strong>.
          The moment the versions merge, the two chips snap to one number
          and <Term>lost writes</Term> jumps by every write the losing
          replica accepted while it was cut off — each one already
          answered with a cheerful 200 that nobody will ever take back.
          Real AP systems spend enormous effort here — vector clocks,
          CRDTs, application-level merges — because &quot;discard a
          write&quot; is a fine answer for a like-counter and a
          catastrophic one for a bank balance.
        </P>
        <Callout kind="insight">
          CAP isn&apos;t a menu of three where you pick two. Partitions are
          not optional — networks fail. The real theorem is:{" "}
          <Strong>when</Strong> (not if) a partition happens, you have
          pre-decided C or A, whether you know it or not. Better to know
          it.
        </Callout>
        <Callout kind="note">
          Most real systems choose per-operation, not per-database:
          payments go CP (refuse rather than double-spend), presence
          indicators go AP (stale beats absent). The unit of the decision
          is the write, not the vendor.
        </Callout>
      </LessonSection>

    </Lesson>
  );
}
