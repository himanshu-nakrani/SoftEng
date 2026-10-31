import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { ReplaceConditionalFigure } from "@/lessons/refactoring/replace-conditional-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("replace-conditional");

export default function ReplaceConditionalPage() {
  return (
    <Lesson slug="replace-conditional">
      <LessonSection id="switch-chains">
        <Lead>Type codes turn functions into bottleneck switchboards. Every new case taxes existing callers.</Lead>
        <P>
          When a calculation branches on an object&apos;s type — whether through a <code>switch</code> statement
          or an <code>if-else</code> chain — every variant adds an explicit <Term>decision point</Term>.
          The shipping fee calculator below opens with five distinct types (<code>standard</code>, <code>express</code>,{" "}
          <code>overnight</code>, <code>freight</code>, and <code>intl</code>) stacked inside a single coordinator.
          Because all five paths converge into one body, <code>calcShipping</code> carries a cyclomatic
          complexity of 6.
        </P>
        <P>
          The cost is architectural: this conditional is a fragile hotspot that violates the{" "}
          <Strong>Open-Closed Principle</Strong>. Adding a sixth shipping tier requires editing this
          exact function, testing all existing branches against regressions, and redeploying the coordinator.
          When multiple operations branch on the same type discriminator, the identical conditional chain
          replicates across the codebase.
        </P>
      </LessonSection>

      <LessonSection id="polymorphic-dispatch">
        <TryThis>
          <LI>Inspect <code>calcShipping&apos;s</code> header: complexity 6 and 5 decision points.</LI>
          <LI>Step forward to extract each type branch into an independent strategy class.</LI>
          <LI>Watch the dispatcher&apos;s complexity fall sequentially from 6 to 1 as branching dissolves into dynamic dispatch.</LI>
        </TryThis>
        <ReplaceConditionalFigure />
        <Callout kind="insight">
          Each extracted strategy method has a cyclomatic complexity of exactly 1: a straight-line
          calculation with zero branching. In the final step, <code>calcShipping</code> delegates directly
          to <code>strategy.fee()</code>, dropping its own complexity to 1. Total decision points in the
          module fall from 5 to 0 because runtime <Strong>polymorphic dispatch</Strong> replaces explicit
          conditional branching.
        </Callout>
      </LessonSection>

      <LessonSection id="complexity-distribution">
        <Lead>Polymorphism does not hide decision points; it delegates them to the object graph.</Lead>
        <P>
          In procedural code, branching complexity accumulates in centralized coordinators. In object-oriented
          and functional designs with <Term>polymorphism</Term>, control flow is resolved by the structure of
          the data itself. By binding behavior directly to each variant class or handler, each strategy only
          answers for its own calculation: <code>StandardFee</code> knows only standard rates; <code>FreightFee</code>{" "}
          knows only freight formulas.
        </P>
        <P>
          The payoff is extension without modification: introducing a new shipping method introduces a
          new class with complexity 1, requiring <Strong>zero edits</Strong> to <code>calcShipping</code> and zero
          edits to existing strategy classes. A 6-path hotspot becomes a constellation of independent, single-path
          collaborators that can be tested and maintained in isolation.
        </P>
      </LessonSection>
    </Lesson>
  );
}
