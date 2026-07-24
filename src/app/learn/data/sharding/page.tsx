import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { ShardingFigure } from "@/lessons/data/sharding-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sharding",
};

export default function ShardingPage() {
  return (
    <Lesson slug="sharding">
      <LessonSection id="why-shard">
        <Lead>
          Replication copies the <em>same</em> data everywhere — great for
          reads, useless when the data itself outgrows one machine.{" "}
          <Term>Sharding</Term> splits the data: each node owns a slice.
        </Lead>
        <P>
          The splitting rule must be deterministic — every router, forever,
          must agree on where key <Term>4217</Term> lives. The obvious rule
          is one line: <Term>hash(key) % N</Term>. Hash for even spread,
          modulo to pick one of <Strong>N</Strong> shards. It works
          beautifully. Until you change N.
        </P>
      </LessonSection>

      <LessonSection id="route-keys">
        <P>
          Each query carries a key; the router computes its shard. The chips
          count how many of the 24 keys each shard owns — roughly even, as a
          good hash guarantees.
        </P>
        <ShardingFigure />
      </LessonSection>

      <LessonSection id="reshard-pain">
        <P>
          Did you do it? Slide <Term>shards</Term> from 3 to 4 and read the{" "}
          <Term>remapped</Term> meter: <Strong>~75% of all keys changed
          owner</Strong>. In production those aren&apos;t meter ticks —
          they&apos;re terabytes migrating between machines while live
          queries look for data that&apos;s mid-flight.
        </P>
        <Callout kind="warning">
          The brutal part: you grew capacity by a third and paid for it by
          moving three-quarters of everything. <Term>% N</Term> couples
          &quot;how many shards&quot; to &quot;where every key lives&quot; —
          change one, scramble the other. The next lesson breaks that
          coupling.
        </Callout>
      </LessonSection>

    </Lesson>
  );
}
