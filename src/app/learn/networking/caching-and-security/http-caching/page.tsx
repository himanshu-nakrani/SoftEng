import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { HttpCachingFigure } from "@/lessons/caching-and-security/http-caching-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("http-caching");

export default function HttpCachingPage() {
  return (
    <Lesson slug="http-caching">
      <LessonSection id="cache-layers">
        <Lead>
          The fastest network round trip is zero milliseconds—serving from local memory before touching the wire.
        </Lead>
        <P>
          Every web request exists within a hierarchy of caches. First, the browser checks its private in-memory
          and disk cache. If the resource is missing or stale, the request leaves the client and travels to a
          geographically proximate <Term>CDN edge cache</Term>. Only when the CDN also suffers a cache miss does
          the request travel all the way across the internet backbone to the authoritative origin database.
        </P>
        <P>
          Without caching (<Term>Cache-Control: no-cache</Term>), every single interaction forces a full round trip
          to the origin, paying roughly <Strong>700ms</Strong> of round-trip wire time and hammering the database
          with 100% of incoming traffic.
        </P>
      </LessonSection>

      <LessonSection id="cache-control-directives">
        <TryThis>
          <LI>Observe the baseline under <Strong>max-age (fresh cache)</Strong> with a 4-second TTL: watch repeated requests answer instantly from local browser memory without generating wire packets.</LI>
          <LI>Notice the metrics: browser cache hit rate climbs to <Strong>63%</Strong>, cutting average response latency from 700ms down to <Strong>256ms</Strong>.</LI>
          <LI>Switch strategy to <Strong>no-cache</Strong>: watch all 7 requests traverse the full path, collapsing hit rate to <Strong>0%</Strong> and inflating average latency back to <Strong>700ms</Strong>.</LI>
          <LI>Switch to <Strong>stale-while-revalidate</Strong>: watch user-perceived hit rate jump to <Strong>88%</Strong> and average latency drop below <Strong>60ms</Strong>.</LI>
        </TryThis>
        <HttpCachingFigure />
        <Callout kind="insight">
          The `max-age` directive creates a lease: during the lease window, the client is strictly forbidden
          from checking the network. When the lease expires, the client must pay a full revalidation round trip.
          Caching trades instantaneous freshness for orders-of-magnitude reductions in server load and latency.
        </Callout>
      </LessonSection>

      <LessonSection id="stale-while-revalidate">
        <Lead>
          Stale-while-revalidate decouples user-perceived performance from network latency.
        </Lead>
        <P>
          A classic dilemma of `max-age` is the <Term>expiration cliff</Term>: for the first 4 seconds, users
          experience instantaneous 0ms responses. But the unlucky user who arrives at second 4.1 experiences
          the full 700ms origin stall while the cache revalidates.
        </P>
        <P>
          The <Term>stale-while-revalidate</Term> directive solves this cliff. It tells the browser: &ldquo;If the cached
          response is expired, go ahead and return the stale version immediately so the user doesn&rsquo;t wait, but
          dispatch an asynchronous background fetch to update the cache for the next visitor.&rdquo;
        </P>
        <P>
          In our simulation, `stale-while-revalidate` pushes the perceived hit rate to <Strong>88%</Strong> and
          drops average latency to just <Strong>58ms</Strong>. The origin still receives update requests in the
          background, but the user never blocks on them.
        </P>
      </LessonSection>
    </Lesson>
  );
}
