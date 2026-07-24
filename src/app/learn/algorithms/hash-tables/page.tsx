import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { HashTableLab } from "@/lessons/algorithms/hash-table-lab";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hash Tables",
};

export default function HashTablesPage() {
  return (
    <Lesson slug="hash-tables">
      <LessonSection id="the-trick">
        <Lead>
          Every structure so far had to <em>search</em>. The hash table
          refuses: <Strong>compute where the answer lives and go
          straight there</Strong>. A hash function turns any key into a
          bucket number — lookup in O(1).
        </Lead>
        <P>
          The fine print funds the whole lesson: two keys can hash to the
          same bucket — a <Term>collision</Term> — and then they{" "}
          <Term>chain</Term>, and a lookup walks the chain. O(1) is really
          &quot;O(chain length)&quot;, which stays short only while the
          table stays roomy.
        </P>
      </LessonSection>

      <LessonSection id="collisions">
        <P>
          Insert keys and watch the chains. The <Term>load factor</Term> —
          keys per bucket — is the health meter: past ~0.75 the chains
          visibly stack (the longest glows red). Then hit{" "}
          <Term>resize ×2</Term> and watch every key jump.
        </P>
        <HashTableLab />
        <Callout kind="insight">
          The resize moved <em>every single key</em> — because{" "}
          <Term>hash % 16</Term> answers differently than{" "}
          <Term>hash % 8</Term>. You&apos;ve fought this exact enemy
          before: it&apos;s the sharding remap disaster, four lessons ago,
          shrunk to fit in RAM. Same math, same pain, same reason
          amortized growth exists.
        </Callout>
      </LessonSection>

      <LessonSection id="everywhere">
        <P>
          This structure is quietly under everything you&apos;ve built:
          JavaScript objects and Maps, Python dicts, database indexes,
          your <Term>redis-1</Term> cache from Track 1, the idempotency-key
          ledger, the LB&apos;s connection tables. When any of them slows
          down mysteriously, the questions are always the same:{" "}
          <Strong>what&apos;s the load factor, how long are the chains,
          and is the hash actually spreading?</Strong>
        </P>
        <Callout kind="note">
          And when a hash table outgrows one machine, you shard it — and
          when resharding hurts, you put the buckets on a ring. Track 2
          ends where Track 1 began; it was one idea all along, at two
          scales.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
