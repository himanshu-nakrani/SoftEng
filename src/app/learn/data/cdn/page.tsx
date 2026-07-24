import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { CdnFigure } from "@/lessons/data/cdn-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CDN & Edge Caching",
};

export default function CdnPage() {
  return (
    <Lesson slug="cdn">
      <LessonSection id="speed-of-light">
        <Lead>
          You built a cache in the last lesson and made the database fast.
          One problem survives every optimization you can buy:{" "}
          <Strong>your users are far away</Strong>, and light has a speed
          limit.
        </Lead>
        <P>
          A round trip from Sydney to a Virginia origin costs ~200ms before
          your servers do <em>anything</em>. No amount of server-side
          caching fixes distance — the fix is moving the cache{" "}
          <em>to the user</em>: a <Term>CDN</Term>, thousands of small{" "}
          <Term>points of presence</Term> parked at the edge of the
          network, each one a cache with your origin behind it.
        </P>
      </LessonSection>

      <LessonSection id="hit-the-edge">
        <P>
          Two regions, one distant origin. Green responses are served at
          the edge (~80ms); amber misses pay the full trek (~700ms). Watch
          the two <Term>p50</Term> meters converge downward as the PoPs
          warm up — then kill one and watch its region&apos;s meter alone
          spring back up.
        </P>
        <CdnFigure />
        <Callout kind="insight">
          The PoP protects two different things at once: the{" "}
          <Strong>user&apos;s latency</Strong> and the{" "}
          <Strong>origin&apos;s capacity</Strong>. Check{" "}
          <Term>origin load</Term> while the caches are warm — the origin
          serves a fraction of real traffic. Every CDN is also a shield.
        </Callout>
      </LessonSection>

      <LessonSection id="what-it-really-is">
        <P>
          Everything you learned about caching still applies — TTL trades
          freshness for hit ratio, small caches churn — but multiplied by
          thousands of locations. That multiplication changes one thing
          fundamentally: <Strong>invalidation</Strong>. Updating a page
          means convincing every PoP on Earth to forget it, which is why
          CDNs expose <Term>purge</Term> APIs, why cache-busting filenames
          (<Term>app.3f9c2.js</Term>) exist, and why &quot;how long can
          this be stale?&quot; is a product decision, not a config value.
        </P>
        <Callout kind="note">
          The failover you triggered is the CDN posture in miniature: edges
          are <em>disposable</em>, the origin is <em>precious</em>. A dead
          PoP costs milliseconds; a dead origin costs everything — which is
          why the shield matters as much as the speed.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
