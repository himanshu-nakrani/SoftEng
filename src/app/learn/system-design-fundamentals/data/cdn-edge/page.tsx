import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { CdnEdgeFigure } from "@/lessons/data/cdn-edge-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("cdn-edge");

export default function CdnEdgePage() {
  return (
    <Lesson slug="cdn-edge">
      <LessonSection id="edge-of-the-world">
        <Lead>
          Your origin lives in one building. Your users do not. Light in fibre
          needs the better part of a tenth of a second to cross the Pacific and
          come back — before your server has done a single thing — and no
          amount of clever code negotiates with physics. So you stop moving the
          request to the data and start moving the data to the request.
        </Lead>
        <P>
          That is a <Term>CDN</Term>: a few hundred <Strong>points of
          presence</Strong> — PoPs — parked next to the users, each one a
          cache holding copies of your bytes. A request goes to the nearest
          PoP instead of to you. If that PoP holds a fresh copy it answers on
          the spot, and your origin never hears about it at all.
        </P>
        <P>
          Everything else in this lesson follows from one consequence of that
          sentence: <Strong>most of your traffic now terminates at machines
          you do not own, serving copies made at some point in the
          past</Strong>. That is what makes a CDN fast. It is also what makes
          the next two failures behave nothing like each other.
        </P>
      </LessonSection>

      <LessonSection id="regions">
        <P>
          Three regions, three PoPs, one origin. Amber packets are requests
          leaving <Term>us-west</Term>, <Term>eu</Term> and <Term>apac</Term>;
          the short hop to their PoP takes a moment, the long haul to the
          origin takes real time — that distance is the whole point, so watch
          it rather than read it. Green comes back from the edge. Cyan is a
          PoP going to the origin because its copy lapsed.
        </P>
        <P>
          The chip under each region is the wait its users are actually
          getting, in milliseconds. The pill above each PoP is how long its
          freshest copy has left to live, draining in real time as you watch.
          Start cold: every first request misses,
          every PoP fills, and the <Term>edge hit ratio</Term> climbs while{" "}
          <Term>origin</Term> req/s collapses to a heartbeat.
        </P>
        <CdnEdgeFigure />
        <Callout kind="insight">
          Now flip <Term>content</Term> to <Term>dynamic</Term>. Nothing is
          cacheable, every request runs the full distance, and origin req/s
          jumps to the entire traffic rate — around 15× what it was. That
          number is the offload a CDN buys you, and it is why &quot;can this
          response be cached?&quot; is an architectural question, not a header
          detail.
        </Callout>
      </LessonSection>

      <LessonSection id="origin-down">
        <P>
          Kill <Term>pop-sin</Term> — click it, or wait for the script.{" "}
          <Term>apac</Term>&apos;s requests immediately start running the whole
          way to the origin themselves: its chip roughly <Strong>triples</Strong>,
          violet packets crawl across the stage, and{" "}
          <Term>us-west</Term> and <Term>eu</Term> do not move at all. That is
          the good failure mode — geography isolates it. A dead PoP costs one
          region its speed, never its correctness. Bring it back and it returns{" "}
          <em>empty</em>: a cache is only as useful as what it has been asked
          for, so it refills one miss at a time.
        </P>
        <P>
          Then kill the <Term>origin</Term>. Watch carefully, because the
          interesting thing is what <em>doesn&apos;t</em> happen: hit ratio
          steady, latency flat, errors zero. Every PoP is still inside its TTL,
          answering from copies of a machine that no longer exists. Nobody has
          noticed. The prediction checkpoint asks you what users see at exactly
          this moment — and then the sim proves it.
        </P>
        <P>
          The damage is not cancelled, only scheduled. Each TTL pill drains to
          zero; that PoP goes back for a fresh copy; nobody answers; and the
          requests waiting behind that copy fail — red. It happens{" "}
          <Strong>region by region</Strong>, in the order their copies happen
          to lapse, which is why a CDN outage of this shape looks in your
          dashboards like a slow leak rather than a crash.
        </P>
        <Callout kind="warning">
          The uncomfortable part is the reporting delay. Your origin died
          minutes ago; the graphs are calm; your paging rules are watching user
          errors that will not arrive until the first TTL runs out. Alert on
          origin health directly — the edge is very good at hiding it from you.
        </Callout>
      </LessonSection>

      <LessonSection id="ttl-tradeoff">
        <P>
          The delay between the origin dying and the first user seeing an error
          was not luck. It was the <Term>edge ttl</Term>, exactly: the time
          each cached copy is allowed to be served without asking anyone
          whether it is still true. Raise the slider and the loan gets longer;
          lower it and the whole system checks in more often.
        </P>
        <Callout kind="note">
          <Strong>Long TTL</Strong> = resilience and cheapness: a high hit
          ratio, an origin that barely has to do anything, and an outage your
          users can sleep through — paid for in <Strong>staleness</Strong>, because you
          are promising to serve a copy for that long even after the truth
          changes. <Strong>Short TTL</Strong> = freshness: changes reach users
          quickly — paid for in <Strong>origin load</Strong> (every PoP
          revalidating on a fast clock) and in resilience, because the loan you
          can draw on during an outage is exactly that short. In the real world
          you set this per response with <Term>Cache-Control: max-age</Term>{" "}
          for browsers and <Term>s-maxage</Term> for the shared cache, and you
          buy the outage back separately with{" "}
          <Term>stale-if-error</Term> — permission for the edge to keep serving
          an expired copy when the origin is unreachable, which turns this
          lesson&apos;s cascade into a much longer, much quieter grace period.
        </Callout>
        <P>
          The pattern generalizes past CDNs. Any cache in front of anything is
          a bet that the past is still true, sized by a TTL and paid for in
          staleness. What a CDN adds is geography: hundreds of copies of that
          bet, close to the users, failing independently. It buys you time —
          not immortality. TTL is the size of the loan.
        </P>
      </LessonSection>

    </Lesson>
  );
}
