import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { CyclicDependenciesFigure } from "@/lessons/modularity-coupling/cyclic-dependencies-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("cyclic-dependencies");

export default function CyclicDependenciesPage() {
  return (
    <Lesson slug="cyclic-dependencies">
      <LessonSection id="the-import-cycle">
        <Lead>
          &ldquo;No package can be built or released first when each component requires its consumer to compile.&rdquo;
        </Lead>
        <P>
          Modularity promises that large codebases can be partitioned into independently developable,
          testable, and releasable units. In an ideal architecture, each package carries its own semantic
          version and can be modified or deployed by a team working in isolation.
        </P>
        <P>
          However, as systems evolve, convenience imports frequently introduce circular relationships.
          Consider three common domain packages: <code>Users</code> imports <code>Orders</code> to display
          purchase history; <code>Orders</code> imports <code>Billing</code> to process payment transactions;
          and <code>Billing</code> imports <code>Users</code> to look up customer account tiers and invoice
          addresses. Together, they form a closed dependency loop:{" "}
          <code>Users &rarr; Orders &rarr; Billing &rarr; Users</code>.
        </P>
        <P>
          The consequence is an <Strong>atomic release deadlock</Strong>. A compiler or CI pipeline cannot
          determine build order: <code>Users</code> requires <code>Orders</code>, which requires <code>Billing</code>,
          which requires <code>Users</code>. Any commit to <code>Billing</code> forces a rebuild and retest of all
          three packages. The package boundary becomes an illusion—a single tightly coupled monolith masquerading
          as separate modules.
        </P>
      </LessonSection>

      <LessonSection id="breaking-cycles">
        <TryThis>
          <LI>
            Observe the circular dependency loop in the table: <code>Users</code>, <code>Orders</code>, and{" "}
            <code>Billing</code> lock each other in a circle (<code>has_cycle = 1</code>).
          </LI>
          <LI>
            Step forward to cycle detection: watch Tarjan&apos;s DFS identify the back-edge, causing topological
            sort to abort with a circular wait deadlock.
          </LI>
          <LI>
            Step forward to Dependency Inversion: watch <code>UsersInterface</code> break the loop, dropping{" "}
            <code>has_cycle</code> to 0 and calculating release order <code>[Billing, Users, Orders]</code>.
          </LI>
        </TryThis>
        <CyclicDependenciesFigure />
        <Callout kind="insight">
          Interface inversion breaks the compile-time cycle without altering runtime capabilities. By defining
          an abstraction (<code>UsersInterface</code>) that <code>Billing</code> depends upon, the source-code
          dependency points against the flow of control. The cycle collapses into a clean Directed Acyclic Graph (DAG).
        </Callout>
      </LessonSection>

      <LessonSection id="acyclic-principle">
        <Lead>
          The Acyclic Dependencies Principle (ADP): the dependency structure between packages must form a Directed Acyclic Graph.
        </Lead>
        <P>
          Formulated by Robert C. Martin, the <Term>Acyclic Dependencies Principle (ADP)</Term> dictates that package
          dependency graphs must never contain cycles. When a graph is acyclic, a <Term>topological sort</Term> always
          exists: a linear ordering of packages where every dependency appears strictly before the packages that
          consume it.
        </P>
        <P>
          In our refactored architecture, topological sort produces the deterministic release order{" "}
          <code>[Billing, Users, Orders]</code>:
        </P>
        <P>
          1. <code>Billing</code> depends only on abstract interfaces and has zero concrete package dependencies,
          allowing it to compile and publish first.
        </P>
        <P>
          2. <code>Users</code> compiles second, satisfying the interface contracts and linking against the published{" "}
          <code>Billing</code> artifact.
        </P>
        <P>
          3. <code>Orders</code> compiles last, assembling the complete business workflow atop published releases of both{" "}
          <code>Billing</code> and <code>Users</code>.
        </P>
        <P>
          Enforcing ADP eliminates the &ldquo;morning-after syndrome&rdquo;—where overnight changes in one package
          silently break the builds of teams working on unrelated components—enabling deterministic, scalable CI/CD releases.
        </P>
      </LessonSection>
    </Lesson>
  );
}
