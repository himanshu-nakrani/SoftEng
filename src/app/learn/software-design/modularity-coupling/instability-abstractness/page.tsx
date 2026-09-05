import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { InstabilityAbstractnessFigure } from "@/lessons/modularity-coupling/instability-abstractness-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("instability-abstractness");

export default function InstabilityAbstractnessPage() {
  return (
    <Lesson slug="instability-abstractness">
      <LessonSection id="instability-metric">
        <Lead>
          Components must balance how easily they can be modified against how
          many downstream consumers rely on their contracts.
        </Lead>
        <P>
          In modular architecture, coupling is directional. Robert C. Martin
          formalized this through two fundamental dependency counters:
        </P>
        <P>
          <Strong>Afferent Coupling (Ca)</Strong> counts external classes that
          depend on classes inside the package (incoming dependencies). When Ca is
          high, many modules depend on this package, making any breaking change
          expensive.
        </P>
        <P>
          <Strong>Efferent Coupling (Ce)</Strong> counts internal classes that
          depend on classes outside the package (outgoing dependencies). When Ce is
          high, this package depends on many external contracts, making it
          sensitive to external shifts.
        </P>
        <P>
          From these counts comes <Term>Instability (I)</Term>, defined as the ratio
          of outgoing coupling to total coupling:
        </P>
        <P>
          <Strong>I = Ce / (Ca + Ce)</Strong>
        </P>
        <P>
          The metric ranges strictly from 0 to 1. An instability of <Strong>I = 0</Strong>{" "}
          means the package has zero outgoing dependencies but positive incoming
          dependencies. It is <Strong>maximally stable</Strong>. In architectural
          metrics, &ldquo;stable&rdquo; does not mean reliable or bug-free; it
          signifies <Strong>resistance to change</Strong>. Modifying a package with
          I = 0 carries a massive blast radius across the entire application.
          Conversely, <Strong>I = 1</Strong> denotes a <Strong>maximally instable</Strong>{" "}
          package: no callers depend on it, so it can be refactored or discarded
          at minimal cost.
        </P>
        <P>
          The <Term>Stable Dependencies Principle (SDP)</Term> dictates that
          dependencies must run in the direction of stability: volatile modules
          should depend on stable modules, never the reverse.
        </P>
      </LessonSection>

      <LessonSection id="main-sequence">
        <Lead>
          If a stable package cannot easily change, how does an architecture
          evolve without breaking callers?
        </Lead>
        <P>
          When a package has high afferent coupling (I = 0), altering its concrete
          classes risks catastrophic regressions for callers. Freezing its code,
          however, prevents the application from adapting to new business requirements.
          The architectural release valve is <Term>Abstractness (A)</Term>:
        </P>
        <P>
          <Strong>A = Na / Nc</Strong>
        </P>
        <P>
          where Na is the number of abstract classes and interfaces, and Nc is the
          total count of classes and interfaces. A ranges from 0 (completely
          concrete) to 1 (pure specification).
        </P>
        <P>
          The <Term>Main Sequence</Term> defines the ideal balance line across the
          (A, I) coordinate plane: <Strong>A + I = 1</Strong>. A top-level UI or
          API controller (I = 1, A = 0) requires few interfaces because nothing
          depends on it. But a foundation core package (I = 0) must be abstract
          (A &approx; 1) so callers bind to interfaces rather than concrete details.
        </P>
        <P>
          The <Term>Normalized Distance (D)</Term> quantifies how far any module
          strays from this optimal line:
        </P>
        <P>
          <Strong>D = |A + I - 1|</Strong>
        </P>
        <P>
          An ideal component achieves D = 0. Values approaching D = 1 reveal an
          architectural hot spot requiring structural refactoring.
        </P>
        <TryThis>
          <LI>
            Observe <Strong>core</Strong> in its initial state: with Ca = 4 and Ce = 0,
            its instability is I = 0.00. Zero interfaces (A = 0.00) trap it at
            maximum distance D = 1.00 in the Zone of Pain.
          </LI>
          <LI>
            Step through the refactoring: watch two abstract interfaces extracted,
            raising Abstractness to A = 0.50 and cutting Distance D in half to 0.50
            towards the Main Sequence.
          </LI>
        </TryThis>
        <InstabilityAbstractnessFigure />
        <Callout kind="insight">
          A stable package does not need to be 100% abstract to escape rigidity.
          Extracting key interfaces decouples callers from implementation churn,
          halving distance D and establishing an extensible boundary.
        </Callout>
      </LessonSection>

      <LessonSection id="zone-of-pain">
        <Lead>
          Architectures rot when packages drift into the two fatal corners of the
          (A, I) plane: the Zone of Pain and the Zone of Uselessness.
        </Lead>
        <P>
          At <Strong>A = 0, I = 0 (D = 1.00)</Strong> sits the{" "}
          <Term>Zone of Pain</Term>. The package is maximally stable (everyone
          imports it) and completely concrete (no interfaces). Every change requires
          modifying executable code directly, causing ripple effects, broken builds,
          and regression tests across all dependent systems. Monolithic entity models,
          raw database clients, and rigid core libraries frequently devolve into this
          zone.
        </P>
        <P>
          At the opposite corner, <Strong>A = 1, I = 1 (D = 1.00)</Strong>, lies the{" "}
          <Term>Zone of Uselessness</Term>. This package is maximally instable
          (nobody imports it) yet completely abstract (pure interfaces with no
          implementations). It represents speculative generality, abandoned plugin
          frameworks, and premature abstractions that add cognitive overhead without
          delivering architectural flexibility.
        </P>
        <P>
          The <Term>Stable Abstractions Principle (SAP)</Term> resolves this
          dilemma: a package should be as abstract as it is stable. When a package
          gains callers and its instability I approaches 0, developers must extract
          interfaces (raising A) to migrate the module from the Zone of Pain onto
          the Main Sequence.
        </P>
      </LessonSection>
    </Lesson>
  );
}
