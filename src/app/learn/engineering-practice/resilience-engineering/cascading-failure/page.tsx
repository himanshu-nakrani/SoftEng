import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { CascadingFailureFigure } from "@/lessons/resilience-engineering/cascading-failure-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("cascading-failure");

export default function CascadingFailurePage() {
  return (
    <Lesson slug="cascading-failure">
      <LessonSection id="cache-failure">
        <Lead>When a cache shielding 10,000 queries per second vanishes, raw traffic crashes into an unprotected database.</Lead>
        <P>
          In high-scale architectures, caching layers absorb the vast majority of read traffic.
          Under normal operating conditions, a cache hit rate of 99% means that out of 10,000 queries
          per second (QPS) arriving at the application tier, only 100 QPS reaches the primary relational
          database. The database hardware and connection pools are sized comfortably for this modest load.
        </P>
        <P>
          Then disaster strikes: a primary cache node crashes, network partitions sever communication,
          or an operational flush purges hot keys. In a single millisecond, the 99% buffer disappears.
          All 10,000 incoming requests per second turn into cache misses and surge simultaneously down
          to the database. This sudden, synchronized deluge is the classic <Term>thundering herd</Term> (or
          <Term>cache stampede</Term>).
        </P>
        <P>
          The database connection pool is typically capped at a bounded limit, such as 100 connections.
          Under 10k concurrent queries, that pool saturates instantly. Queries queue up, execution latencies
          spiral from single-digit milliseconds to multi-second timeouts, and upstream application workers
          block waiting for responses. Downstream services begin returning HTTP 500 errors, sparking a
          rapid, uncontrollable <Strong>cascading failure</Strong> throughout the entire platform.
        </P>
      </LessonSection>

      <LessonSection id="stampede-policy">
        <TryThis>
          <LI>Slide to <Strong>Direct DB passthrough</Strong> — all 10k QPS floods the primary database, immediately exhausting the connection pool and triggering query timeouts in all 200 runs (0 of 200).</LI>
          <LI>Slide to <Strong>Aggressive retries without backoff</Strong> — clients retry 500 errors instantly, multiplying traffic by 3x to 30k QPS and causing a total system collapse (0 of 200 runs).</LI>
          <LI>Slide to <Strong>Singleflight request coalescing + circuit breaker</Strong> — concurrent requests for the same cache key collapse into 1 DB query, keeping DB CPU under 40% and holding SLA in all 200 runs.</LI>
        </TryThis>
        <CascadingFailureFigure />
        <Callout kind="insight">
          Direct DB passthrough and uncoordinated retries guarantee total system collapse (0 of 200 runs).
          Singleflight request coalescing collapses thousands of concurrent key lookups into a single
          in-flight database query, keeping DB CPU between 32% and 38% and holding SLA across all 200 runs.
        </Callout>
      </LessonSection>

      <LessonSection id="singleflight-protection">
        <Lead>Request coalescing turns an O(N) database stampede into an O(1) singleflight execution.</Lead>
        <P>
          The fundamental flaw of direct passthrough is redundant execution: if 500 concurrent threads
          all request user profile <Term>user:1042</Term> at the same moment, running 500 identical SQL
          queries against the primary database produces zero additional information while consuming 500
          connection slots.
        </P>
        <P>
          The <Term>singleflight</Term> pattern (request coalescing or promise deduplication) solves this by
          maintaining an in-flight synchronization registry. When a request experiences a cache miss:
        </P>
        <P>
          The first worker to request key <Term>K</Term> becomes the <Strong>leader</Strong>, registering an
          in-flight channel and dispatching exactly one query to the primary database. Concurrent requests
          for that same key register as <Strong>waiters</Strong> on the leader&apos;s channel without touching the
          database. When the database query finishes, the leader broadcasts the result to all waiting callers
          and populates the cache simultaneously.
        </P>
        <P>
          Pairing singleflight with a <Term>circuit breaker</Term> provides defense-in-depth: if the database
          begins to degrade even under coalesced queries, the circuit breaker trips to fast-fail or serve
          stale fallback data rather than letting request queues grow indefinitely. Furthermore, clients must
          apply exponential backoff with full jitter rather than aggressive immediate retries, ensuring that
          transient failures never amplify into self-inflicted denial-of-service storms.
        </P>
      </LessonSection>
    </Lesson>
  );
}
