import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { ExtractClassFigure } from "@/lessons/refactoring/extract-class-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("extract-class");

export default function ExtractClassPage() {
  return (
    <Lesson slug="extract-class">
      <LessonSection id="god-class">
        <Lead>
          A class that knows how to calculate totals and how to format receipts is two
          classes trapped in one name.
        </Lead>
        <P>
          The <Term>god class</Term> anti-pattern rarely starts as a deliberate design. It
          grows incrementally: a business service calculates taxes and discounts, then
          gains receipt generation, then email notifications, and eventually PDF rendering.
          Each addition seems small, but together they violate the Single Responsibility
          Principle.
        </P>
        <P>
          In the module below, <code>OrderProcessor</code> handles both financial calculation
          and customer presentation. It opens at a <Strong>cyclomatic complexity</Strong> of 7
          and a <Term>fan-out</Term> of 5, directly coupled to pricing helpers (
          <code>calcTax</code>, <code>applyDiscount</code>) and presentation helpers (
          <code>formatItem</code>, <code>sendEmail</code>, <code>renderPdf</code>).
        </P>
      </LessonSection>

      <LessonSection id="extract-class">
        <TryThis>
          <LI>
            Read <code>OrderProcessor&apos;s</code> header &mdash; cc 7, fan-out 5 &mdash; and note
            how its dependencies span both pricing and document generation.
          </LI>
          <LI>
            Step forward once to apply <Strong>Extract Class</Strong>, moving formatting and
            notification logic into <code>ReceiptFormatter</code>.
          </LI>
          <LI>
            Watch <code>OrderProcessor&apos;s</code> complexity fall from 7 to 3, its fan-out drop
            from 5 to 3, and module max fan-out fall from 5 to 3.
          </LI>
        </TryThis>
        <ExtractClassFigure />
        <Callout kind="insight">
          <code>OrderProcessor</code> drops from complexity 7 to 3 and fan-out 5 to 3, while the
          new <code>ReceiptFormatter</code> takes on complexity 5 and fan-out 3. Total decision
          points remain <Strong>conserved at 6</Strong>: extraction reallocates structure rather
          than erasing it, but partitioning concerns drops maximum coupling across the module.
        </Callout>
      </LessonSection>

      <LessonSection id="cohesion-metrics">
        <Lead>High fan-out across unrelated domains is the structural symptom of low cohesion.</Lead>
        <P>
          <Term>Cohesion</Term> measures how tightly the responsibilities inside a single module
          belong together. When a class suffers from a <Term>lack of cohesion</Term>, its methods
          interact with disjoint sets of data and collaborators. The metric signature is clear:
          high fan-out to distinct subsystems that never talk to each other.
        </P>
        <P>
          Extracting <code>ReceiptFormatter</code> restores cohesion. <code>OrderProcessor</code>{" "}
          now coordinates pricing and delegates customer communication through a single edge.
          Marketing changes to receipt templates or email formats no longer risk breaking tax
          calculations, and tests for pricing no longer need mocks for PDF engines.
        </P>
      </LessonSection>
    </Lesson>
  );
}
