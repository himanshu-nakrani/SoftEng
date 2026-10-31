import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { CouplingMetricsFigure } from "@/lessons/modularity-coupling/coupling-metrics-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("coupling-metrics");

export default function CouplingMetricsPage() {
  return (
    <Lesson slug="coupling-metrics">
      <LessonSection id="module-boundaries">
        <Lead>
          Software architectures rarely collapse from internal algorithmic bugs; they
          degenerate when package boundaries dissolve into an entangled mesh of cross-boundary
          imports.
        </Lead>
        <P>
          Every line of production code lives inside a module, namespace, or directory boundary.
          Yet not all imports carry the same architectural weight. Robert C. Martin formalized
          package-level dependencies into two opposing, directional vectors:
        </P>
        <P>
          <Strong>Afferent Coupling (<Term>C_a</Term>, Incoming):</Strong> The count of
          external packages that depend on classes inside this package. Afferent coupling
          measures <Strong>responsibility</Strong> and <Strong>blast radius</Strong>. When
          a module has a high C_a, numerous downstream consumers rely on its public contracts;
          altering its signatures or behavioral semantics risks cascading regressions throughout the
          entire codebase.
        </P>
        <P>
          <Strong>Efferent Coupling (<Term>C_e</Term>, Outgoing):</Strong> The count of external
          packages that classes inside this package depend upon. Efferent coupling measures{" "}
          <Strong>vulnerability</Strong> and <Strong>instability</Strong>. When a module has a high
          C_e, it is held hostage by changes in external systems—every foreign API adjustment,
          schema drift, or dependency refactor forces edits inside this module.
        </P>
        <P>
          Total Coupling is defined as <Term>C_a + C_e</Term>. An architectural hotspot with high
          total coupling is simultaneously brittle to upstream changes and hazardous to downstream
          callers. Clean architecture seeks to organize boundaries so that business policy remains
          sheltered from volatile infrastructure.
        </P>
      </LessonSection>

      <LessonSection id="measuring-coupling">
        <TryThis>
          <LI>
            Step through the initial monolithic state: observe how <Strong>billing</Strong> begins
            with C_e = 3 because it directly imports api, orders, and db.
          </LI>
          <LI>
            Advance to Step 1: extracting the <Strong>PaymentRepo</Strong> domain interface cuts
            the direct compile-time link to db, dropping billing&apos;s C_e to 2 and db&apos;s
            C_a to 2 simultaneously.
          </LI>
          <LI>
            Advance to Step 2: injecting dependencies removes billing&apos;s dependence on api,
            reducing billing&apos;s efferent coupling to C_e = 1 and collapsing total system
            coupling from 12 down to 8.
          </LI>
        </TryThis>
        <CouplingMetricsFigure />
        <Callout kind="insight">
          Coupling is strictly conserved across direction: every efferent dependency is an afferent
          dependency for another package. By extracting domain interfaces and injecting
          collaborators, billing transforms from a fragile coordinator with C_e = 3 into a
          focused domain module with C_e = 1, while db sheds callers and shrinks its blast radius.
        </Callout>
        <P>
          Consider the testing implications of the initial state: because <Strong>billing</Strong>{" "}
          directly imported the concrete database driver and the API web routing module, writing an
          isolated unit test for billing required mocking HTTP request contexts and spinning up
          database connections.
        </P>
        <P>
          In Step 1, billing introduces an abstract repository interface (<Strong>PaymentRepo</Strong>).
          Rather than billing conforming to the database&apos;s SQL schema, the database adapter must
          conform to billing&apos;s domain needs. In Step 2, caller identity is passed as an injected
          parameter rather than imported from global API state. As a result, billing now imports only
          the core <Strong>orders</Strong> domain entity.
        </P>
      </LessonSection>

      <LessonSection id="coupling-sensitivity">
        <Lead>
          The blast radius of any architectural refactoring, schema migration, or defect is
          strictly bounded by afferent coupling.
        </Lead>
        <P>
          When a package like <Strong>db</Strong> has C_a = 3, modifying a table column or connection
          pooling option forces synchronized code updates across three separate packages. Concrete
          infrastructure should never be widely imported; high afferent coupling should be reserved
          for stable, abstract interfaces that change infrequently.
        </P>
        <P>
          Conversely, a package with C_a = 0 is a leaf on the dependency graph. Because no external
          code imports it, internal implementations can be refactored, optimized, or completely
          rewritten with zero blast radius across external modules.
        </P>
        <P>
          Software cannot function with zero coupling; business rules must inevitably coordinate
          with persistence, networking, and user interfaces. The goal of modular design is to
          directionally control coupling: high-level policies should be stable (high C_a, low C_e),
          while low-level infrastructure adapters should remain easily swappable (low C_a, high C_e).
          This balance sets the stage for Martin&apos;s Instability metric (I = C_e / (C_a + C_e)) and
          the Distance from the Main Sequence.
        </P>
      </LessonSection>
    </Lesson>
  );
}
