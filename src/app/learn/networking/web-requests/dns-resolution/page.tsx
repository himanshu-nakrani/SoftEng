import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { DnsResolutionFigure } from "@/lessons/web-requests/dns-resolution-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("dns-resolution");

export default function DnsResolutionPage() {
  return (
    <Lesson slug="dns-resolution">
      <LessonSection id="names-not-addresses">
        <Lead>
          You typed a name. The network only carries numbers. Before a browser
          can send a single byte to <Term>shop.example.com</Term> it has to
          turn that name into an address, and that translation is not a lookup
          in a local table — it is a small distributed system of its own.
        </Lead>
        <P>
          The browser asks a <Term>recursive resolver</Term>. If the resolver
          does not already know the answer, it does the walking: it asks a{" "}
          <Strong>root</Strong> server, which points it at the server for{" "}
          <Term>.com</Term>; it asks that <Strong>TLD</Strong> server, which
          points it at the <Strong>authoritative</Strong> server for{" "}
          <Term>example.com</Term>; and only that last server actually knows
          the address. Three questions, each answered before the next can be
          asked, because each answer is a referral telling the resolver where
          to go next.
        </P>
        <P>
          That is the tension the rest of this lesson drives: a name you have
          never seen is expensive, and the fix is to remember the answer for a
          while. How long is <em>a while</em> turns out to be the only real
          knob DNS gives you, and it is the same bet a cache always makes.
        </P>
      </LessonSection>

      <LessonSection id="resolve-it">
        <P>
          The browser is on the left, the resolver a short hop away, and the
          three hierarchy servers on the right. Start cold and watch the first
          lookup for a name walk the whole chain: a cyan <Term>query</Term> to
          the root, a violet <Term>referral</Term> back, then the same to the
          TLD server and finally the authoritative one, before a resolved
          address returns to the browser. Those stacked round trips are about{" "}
          <Strong>700ms</Strong>.
        </P>
        <P>
          Then watch a name repeat. The resolver already holds the answer, so
          it replies in a single short hop of roughly <Strong>85ms</Strong> —
          about <Strong>eight times faster</Strong> — and the hierarchy never
          hears about it. The <Term>authoritative</Term> meter falls to almost
          nothing even as the browser keeps asking. That gap is why DNS
          survives at internet scale: the authoritative servers see a trickle,
          not the flood the browsers generate.
        </P>
        <DnsResolutionFigure />
        <Callout kind="insight">
          The <Term>cache hit ratio</Term> climbs and the{" "}
          <Term>lookup latency</Term> meter drops from origin distance toward
          that one-hop figure as the cache warms. Nothing about the network got
          faster — the resolver simply stopped asking. A cached name is not a
          shorter journey; it is no journey at all.
        </Callout>
      </LessonSection>

      <LessonSection id="ttl-and-cache">
        <P>
          A cached answer is not kept forever. Every record comes with a{" "}
          <Term>TTL</Term> — a time-to-live — and the resolver may serve it
          without asking again only until that lease runs out. The pill above
          the resolver is that countdown for its freshest record; when it hits
          zero the next lookup for that name walks the hierarchy again.
        </P>
        <P>
          Drag <Term>record ttl</Term> down and the resolver re-walks more
          often: the hit ratio sags, the authoritative meter climbs, and you
          are paying for freshness. Drag it up and the hierarchy goes quiet —
          fewer walks, a higher hit ratio — but you are now promising to serve
          the same address for that long even if the real one changes.
        </P>
        <Callout kind="note">
          <Strong>Long TTL</Strong> = cheapness and reach: a high hit ratio and
          an authoritative server that barely has to answer, paid for in{" "}
          <Strong>staleness</Strong>, because a moved service is unreachable at
          its old address until every cached record lapses. <Strong>Short
          TTL</Strong> = agility: changes propagate quickly, paid for in
          repeated walks and load on the hierarchy. It is exactly the
          cache-in-front-of-anything trade, and DNS makes you pick a number for
          it per record.
        </Callout>
      </LessonSection>

      <LessonSection id="when-it-goes-stale">
        <P>
          Now kill the <Term>authoritative</Term> server — click it, or wait
          for the script. Watch the meters, because the interesting thing is
          what <em>doesn&apos;t</em> happen: hit ratio steady, latency flat,
          failures at zero. Every cached name is still inside its TTL, so the
          resolver keeps answering from copies of a server that is no longer
          there. Nobody has noticed. The checkpoint asks you what browsers see
          at exactly this moment, and then the sim proves it.
        </P>
        <P>
          The damage is only scheduled. Name by name, each lease drains to
          zero, the resolver re-walks, reaches nobody, and the lookups waiting
          behind that name fail — red. It happens <Strong>one name at a
          time</Strong>, in the order the leases happen to lapse, which is why
          this kind of outage shows up as a slow rise in failures rather than a
          cliff. A longer TTL would have held longer, and served a possibly
          wrong address the whole time.
        </P>
        <Callout kind="warning">
          The grace period you get in an outage and the staleness you risk on a
          change are the <em>same number</em> read two ways. There is no TTL
          that is generous in a failure and strict on an update — the lease is
          symmetric. DNS is the cache in front of the whole web, and it makes
          you name the size of the loan.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
