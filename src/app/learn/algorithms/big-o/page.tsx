import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { BigORace } from "@/lessons/algorithms/big-o-race";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Big-O, Felt",
};

export default function BigOPage() {
  return (
    <Lesson slug="big-o">
      <LessonSection id="growth">
        <Lead>
          Big-O notation answers one question:{" "}
          <Strong>when the input grows, how fast does the work grow?</Strong>{" "}
          Not how fast your laptop is. Not milliseconds. The <em>shape</em>{" "}
          of the growth.
        </Lead>
        <P>
          The shapes have names you&apos;ll use forever:{" "}
          <Term>O(log n)</Term> barely notices growth, <Term>O(n)</Term>{" "}
          scales with it, <Term>O(n log n)</Term> is the price of good
          sorting, and <Term>O(n²)</Term> is the one that turns a demo into
          an outage the first time real data shows up.
        </P>
      </LessonSection>

      <LessonSection id="race">
        <P>
          Four real algorithms, one shared <Term>n</Term>. Drag the slider —
          then use <Term>double n</Term> and read the multiplier chips:
          that&apos;s the entire theory in four numbers.
        </P>
        <BigORace />
        <Callout kind="insight">
          Doubling n adds <Strong>+1</Strong> to binary search,{" "}
          <Strong>×2</Strong> to the scan, and <Strong>×4</Strong> to the
          nested loops. Same doubling, different bills — and the bills
          compound: from n=16 to n=512, the quadratic curve grew a
          thousand times more expensive.
        </Callout>
      </LessonSection>

      <LessonSection id="reading-curves">
        <P>
          Two practical habits fall out of this. First:{" "}
          <Strong>constants don&apos;t matter, shapes do</Strong> — an
          O(n) algorithm with sloppy constants beats a tidy O(n²) as soon
          as n gets serious, and n always gets serious. Second: know your
          n. O(n²) on a 20-item dropdown is fine; on a 50,000-row table
          it&apos;s a frozen browser tab.
        </P>
        <Callout kind="note">
          You already met these shapes at datacenter scale: a load
          balancer&apos;s round-robin pick is O(1), scanning every server
          is O(n), and the resharding disaster was quadratic pain of a
          different flavor. Track 1 was Big-O wearing a server costume.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
