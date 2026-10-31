import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { DependencyInversionFigure } from "@/lessons/architecture-boundaries/dependency-inversion-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("dependency-inversion");

export default function DependencyInversionPage() {
  return (
    <Lesson slug="dependency-inversion">
      <LessonSection id="concrete-coupling">
        <Lead>
          In classical tiered software systems, source code dependencies follow the runtime flow of
          control straight down into volatile database and network infrastructure.
        </Lead>
        <P>
          When building enterprise applications, the path of least resistance is direct coupling:
          an <Strong>OrderService</Strong> class directly instantiates a concrete database client (such
          as <Term>pg</Term> or an ORM connection pool) to persist entity state, and invokes an
          external vendor SDK (such as <Term>Sendgrid</Term>) to dispatch transactional receipts. While
          intuitive during early prototyping, this pattern introduces a severe architectural
          pathology: <Strong>domain pollution</Strong>.
        </P>
        <P>
          High-level business rules—the policies governing price calculations, promotional discount
          rules, and lifecycle state transitions—become inextricably coupled to the low-level mechanics
          of third-party drivers and relational SQL protocols. In terms of modularity metrics, the domain
          incurs an efferent fan-out of <Strong>2</Strong> (<Term>C_e = 2</Term>). Every time a database
          driver updates its connection pooling API, an ORM alters its entity mapping decorators, or
          Sendgrid deprecates a REST payload format, engineers must edit, verify, and redeploy the
          core domain logic.
        </P>
        <P>
          The most immediate operational casualty of direct concrete coupling is automated testability.
          When domain logic directly imports concrete network sockets and SQL drivers, executing a unit
          test requires provisioning live database containers, running migration scripts, or relying on
          fragile, monkey-patched mocking frameworks. As a result, test suites slow from milliseconds
          to minutes, leading teams to skip writing comprehensive unit tests (<Strong>isolated_tests = 0</Strong>).
        </P>
      </LessonSection>

      <LessonSection id="ports-and-adapters">
        <TryThis>
          <LI>
            Step through <Strong>Step 0 (Direct Coupling)</Strong>: observe how <Strong>OrderService</Strong>{" "}
            points directly outward into PostgresDB and Sendgrid, producing a domain fan-out of 2 and 0
            isolated tests.
          </LI>
          <LI>
            Advance to <Strong>Step 1 (Port Extraction)</Strong>: watch the domain declare
            abstract <Strong>OrderRepository</Strong> and <Strong>NotificationService</Strong> interfaces
            within its own boundary, dropping domain fan-out from 2 down to 0.
          </LI>
          <LI>
            Advance to <Strong>Step 2 (Dependency Inversion)</Strong>: observe the dependency arrows
            flip. <Strong>PostgresRepo</Strong> and <Strong>SendgridNotifier</Strong> now point inward,
            implementing domain-owned contracts.
          </LI>
          <LI>
            Advance to <Strong>Step 3 (Swappability &amp; Test Isolation)</Strong>: swap in lightweight
            in-memory doubles (<Strong>InMemoryRepo</Strong> and <Strong>MockNotifier</Strong>) to execute
            domain tests with 0 database or network I/O, achieving <Strong>isolated_tests = 1</Strong>.
          </LI>
        </TryThis>
        <DependencyInversionFigure />
        <Callout kind="insight">
          The Dependency Inversion Principle does not eliminate dependencies; it flips their
          direction. Instead of domain policy depending downward on database schema and transport
          details, infrastructure adapters must depend inward on contracts defined and owned by the
          domain core.
        </Callout>
        <P>
          Formulated by Robert C. Martin as the foundational principle of Clean Architecture,
          the <Strong>Dependency Inversion Principle (DIP)</Strong> establishes two complementary
          rules:
        </P>
        <P>
          1. <Strong>High-level modules should not depend on low-level modules.</Strong> Both should
          depend on abstractions. High-level policies represent the core business value of an
          organization; they must never be held hostage by the technical details of persistence or
          delivery channels.
        </P>
        <P>
          2. <Strong>Abstractions should not depend on details.</Strong> Details should depend on
          abstractions. The interface signature must reflect the domain&apos;s conceptual needs, not
          the idiosyncrasies of SQL tables or third-party JSON schemas.
        </P>
        <P>
          In Alistair Cockburn&apos;s <Term>Hexagonal Architecture</Term> (also formalized
          as <Term>Ports &amp; Adapters</Term>), this principle materializes as a protective perimeter
          around the domain core:
        </P>
        <P>
          <Strong>Driving Adapters (Primary / Inbound):</Strong> Entry points that trigger application
          actions, such as HTTP controllers, gRPC handlers, or background message consumers. The
          driving adapter converts external requests into domain model inputs and calls into the domain.
        </P>
        <P>
          <Strong>Driven Adapters (Secondary / Outbound):</Strong> Infrastructure components that fulfill
          domain needs, such as database repositories, caching clients, and notification gateways. The
          domain defines the <Term>Port</Term> (e.g., <Strong>OrderRepository</Strong>), and the driven
          adapter implements it.
        </P>
        <P>
          Notice the critical architectural ownership: the domain <Strong>owns the port</Strong>.
          The interface does not belong to the infrastructure layer; it lives inside the domain package.
          The database adapter is merely a plug-in that conforms to the domain&apos;s contract.
        </P>
      </LessonSection>

      <LessonSection id="boundary-isolation">
        <Lead>
          Inverted architectural boundaries transform persistence, messaging, and transport
          mechanisms into replaceable implementation details.
        </Lead>
        <P>
          When source code dependencies point strictly inward toward abstract contracts, the core
          business domain achieves complete technological agnosticism. If business scale requires
          migrating from a relational PostgreSQL database to an event-sourced ledger, a document store,
          or an embedded key-value engine, not a single line of business logic inside <Strong>OrderService</Strong>{" "}
          needs to change. Only the driven adapter is rewritten or swapped.
        </P>
        <P>
          Crucially, dependency inversion delivers genuine test isolation. Rather than mocking network
          boundaries with brittle monkey-patching libraries that verify implementation details rather
          than business outcomes, developers write deterministic, in-memory adapters:
        </P>
        <P>
          An <Strong>InMemoryOrderRepository</Strong> backed by a native array or hash map can be
          instantiated and wired in nanoseconds. It executes without background processes, file system
          locks, or network sockets. Domain invariants can be tested across hundreds of edge cases in
          milliseconds, restoring confidence and rapid iteration velocity.
        </P>
        <P>
          By structuring applications around inward-pointing dependencies, engineering teams insulate
          high-value business policies from framework churn, database migrations, and vendor
          deprecations. The domain remains stable, deterministic, and independently verifiable.
        </P>
      </LessonSection>
    </Lesson>
  );
}
