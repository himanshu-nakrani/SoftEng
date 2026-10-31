import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { StranglerFigFigure } from "@/lessons/architecture-boundaries/strangler-fig-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("strangler-fig");

export default function StranglerFigPage() {
  return (
    <Lesson slug="strangler-fig">
      <LessonSection id="monolith-gravity">
        <Lead>
          Every successful software system eventually confronts <Term>monolithic gravity</Term>:
          the accumulated weight of rapid feature delivery, shared in-memory state, and tangled
          database dependencies that make every deployment terrifying and every refactoring effort
          hazardous.
        </Lead>
        <P>
          When an aging monolith becomes an organizational bottleneck, engineering leadership
          frequently falls prey to the seductive appeal of the <Strong>big-bang rewrite</Strong>.
          The proposal appears straightforward: assemble a dedicated team to re-architect the entire
          system from scratch on modern infrastructure, while leaving the legacy codebase frozen or
          on minimal maintenance until a climactic weekend cutover.
        </P>
        <P>
          In practice, big-bang rewrites are architectural death traps characterized by three
          systemic failure modes:
        </P>
        <P>
          <Strong>1. The Moving Target Problem:</Strong> Production systems cannot remain frozen
          while market demands evolve. As regulatory mandates emerge, competitors launch features,
          and urgent bug fixes land in the monolith, the rewrite team is forced to chase a rapidly
          drifting specification. The replacement architecture is functionally obsolete before it
          ever receives production traffic.
        </P>
        <P>
          <Strong>2. Unbounded Cutover Risk:</Strong> An all-or-nothing release boundary transfers
          100% of production traffic onto unproven code in a single catastrophic instant. Edge cases
          that only surface under real-world concurrency, unindexed query plans, and hidden client
          assumptions explode simultaneously, leaving teams with no recourse other than a chaotic
          emergency rollback.
        </P>
        <P>
          <Strong>3. Value Delay and Organizational Fatigue:</Strong> Months stretch into years
          without delivering operational feedback or business value. Executive sponsorship erodes,
          team morale collapses, and high-profile rewrites are routinely cancelled mid-flight after
          consuming millions in capital.
        </P>
        <P>
          Martin Fowler popularized an elegant biological alternative inspired by the Australian
          rainforest: the <Term>Strangler Fig</Term>. Strangler fig seeds germinate in the upper
          canopy of a host tree, gradually sending roots downward toward the soil. Over years, the
          strangler&apos;s lattice of stems envelops the host trunk until the original tree rots away,
          leaving a hollow, self-supporting tree. In software architecture, the{" "}
          <Strong>Strangler Fig Pattern</Strong> replaces monolithic codebases incrementally by
          intercepting ingress traffic behind a routing facade proxy.
        </P>
      </LessonSection>

      <LessonSection id="interceptor-routing">
        <TryThis>
          <LI>
            <Strong>Step 0 (Monolith Baseline):</Strong> Inspect the starting state. Notice how all
            four routes (<Strong>/catalog</Strong>, <Strong>/orders</Strong>,{" "}
            <Strong>/payments</Strong>, <Strong>/users</Strong>) point directly to the monolith core,
            handling 100% of traffic with a cutover count of 0/4.
          </LI>
          <LI>
            <Strong>Step 1 (Deploy Facade Proxy):</Strong> Advance to Step 1 to deploy an interceptor
            proxy in front of the monolith. Ingress traffic now terminates at the facade, which
            transparently forwards 100% of requests to the legacy monolith with zero downtime.
          </LI>
          <LI>
            <Strong>Step 2 (Strangle /catalog):</Strong> Advance to Step 2 as the new Catalog
            microservice comes online. The facade intercepts the <Strong>/catalog</Strong> route and
            diverts 100% of its traffic to the microservice, dropping monolith traffic from 100% down
            to 75% (1/4 routes cut over) while remaining routes continue untouched.
          </LI>
          <LI>
            <Strong>Step 3 (Strangle /orders &amp; /payments):</Strong> Advance to Step 3 as Orders
            and Payments domain services are deployed. The facade shifts both routes simultaneously,
            plunging monolith traffic down to 25% (3/4 routes cut over) with zero operational
            disruption.
          </LI>
          <LI>
            <Strong>Step 4 (Complete Monolith Decommissioning):</Strong> Advance to Step 4 as the
            remaining <Strong>/users</Strong> auth service is migrated. Monolith traffic reaches 0%
            (4/4 routes cut over), allowing the legacy core to be cleanly decommissioned with zero
            downtime.
          </LI>
        </TryThis>
        <StranglerFigFigure />
        <Callout kind="insight">
          The core breakthrough of the Strangler Fig pattern is decoupling the{" "}
          <Strong>network routing boundary</Strong> from the <Strong>underlying deployment binaries</Strong>.
          By placing an interceptor facade at the edge, each domain boundary can be extracted, canary-tested,
          and safely promoted without altering client applications or endangering adjacent capabilities.
        </Callout>
        <P>
          The interceptor facade operates as an architectural control plane. Implemented as an API
          gateway (such as Envoy, NGINX, or a cloud reverse proxy), the facade inspects ingress
          HTTP request paths, verbs, and headers. In Step 1, deploying the facade introduces no
          functional changes: 100% of traffic continues to route to the legacy monolith. This ensures
          that network routing latency, SSL termination, and proxy plumbing are fully validated in
          production before any application logic is split.
        </P>
        <P>
          In Step 2, when <Strong>/catalog</Strong> is strangled, the routing proxy directs only
          catalog requests to the new service. Teams can utilize <Term>shadow traffic</Term> (mirroring
          live requests to both systems and comparing outputs asynchronously) or <Term>canary rollouts</Term>{" "}
          (routing 5% of traffic before scaling to 100%) to verify functional parity. If an unhandled
          edge case emerges, the facade proxy can roll traffic back to the monolith in milliseconds by
          updating a single routing rule, bounding the blast radius to zero customer downtime.
        </P>
        <P>
          By Step 3, multiple autonomous teams can strangle distinct business capabilities in
          parallel. The <Strong>/orders</Strong> and <Strong>/payments</Strong> boundaries are
          developed, deployed, and scaled on their own cadence. Crucially, client mobile apps and web
          frontends remain completely oblivious to the migration: the external URLs remain identical
          while the underlying infrastructure undergoes a total transformation.
        </P>
      </LessonSection>

      <LessonSection id="complete-cutover">
        <Lead>
          The final phase of the Strangler Fig pattern—safely decommissioning the legacy monolith
          once traffic drops to 0%—demands deliberate architectural hygiene to avoid creating
          &quot;zombie&quot; infrastructure.
        </Lead>
        <P>
          In many engineering organizations, legacy monoliths linger indefinitely even after all
          production endpoints have been extracted. Teams hesitate to shut down the old application
          servers out of anxiety over hidden database triggers, forgotten cron jobs, or undocumented
          internal dependencies. Permitting a dormant monolith to survive indefinitely incurs cloud
          infrastructure waste, expands the corporate security attack surface, and forces ongoing
          dependency patches for dead code.
        </P>
        <P>
          A rigorous decommissioning process follows a disciplined four-stage runbook:
        </P>
        <P>
          <Strong>1. Traffic Draining &amp; Log Auditing:</Strong> Once the facade proxy redirects
          all 4 routes (<Strong>/catalog</Strong>, <Strong>/orders</Strong>, <Strong>/payments</Strong>,
          and <Strong>/users</Strong>), access logs, distributed tracing spans, and edge metrics
          must show exactly zero incoming requests to the monolith across a defined observation window
          (typically 14 to 30 days to account for monthly accounting or billing cycles).
        </P>
        <P>
          <Strong>2. Database Decoupling:</Strong> Strangler migrations often rely on temporary
          synchronization mechanisms, such as <Term>Change Data Capture (CDC)</Term> via Debezium or
          dual-writing application events. Once the modern microservices fully own their respective
          datastores, legacy database read replicas, replication slots, and foreign key constraints
          are severed.
        </P>
        <P>
          <Strong>3. Facade Rule Consolidation:</Strong> The interim strangler routing logic inside
          the API gateway is simplified. The proxy rules that formerly differentiated between legacy
          and microservice targets are eliminated, leaving a clean, declarative routing configuration
          tailored solely for modern domain services.
        </P>
        <P>
          <Strong>4. Server Termination &amp; Repository Archival:</Strong> Compute instances,
          container task definitions, CI/CD pipelines, and internal DNS entries for the legacy core
          are permanently deleted. The monolithic git repository is marked read-only and archived,
          locking in the architectural victory and reclaiming engineering focus for customer-facing
          innovation.
        </P>
      </LessonSection>
    </Lesson>
  );
}
