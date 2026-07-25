import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { CacheStampedeFigure } from "@/lessons/data/cache-stampede-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cache Stampede",
};

export default function CacheStampedePage() {
  return (
    <Lesson slug="cache-stampede">
      <LessonSection id="dogpile">
        <Lead>
          A cache with a 95% hit ratio is not protecting your database 95% of
          the time. It is protecting it right up until one popular key
          expires — and then, for about a second, not at all.
        </Lead>
        <P>
          That second has a name: the <Term>cache stampede</Term>, also
          called the <Strong>dogpile</Strong> or the thundering herd. The
          mechanism is embarrassingly simple. An entry expires. The next
          request for it misses and goes to the database. So does the one
          after it, and the one after that — because the first one has not
          come back yet, so there is still nothing in the cache for anyone
          else to hit. Every reader that arrives during the refill window
          issues its own read.
        </P>
        <P>
          The arithmetic is the whole lesson. Refilling costs one round trip —
          call it a second under load. A key doing 20 reads a second therefore
          costs you <Strong>20 database reads</Strong> per expiry instead of{" "}
          <Strong>one</Strong>. Nothing about that key changed; nothing about
          your traffic changed. The only thing that happened is that a
          timer went off, and a system with no coordination did the same work
          twenty times.
        </P>
        <P>
          It gets worse in exactly the direction you would least like. The
          hotter the key, the bigger the pile. The slower the database gets,
          the longer the refill window stays open, so the more readers join
          the pile, which makes the database slower still. That is a spiral
          with a floor, and the floor is an outage.
        </P>
      </LessonSection>

      <LessonSection id="expire-it">
        <P>
          One hot key, one TTL. The bar above <Term>redis-1</Term> is the time
          it has left; while it is green everything hits and{" "}
          <Term>pg-main</Term> — which serves five reads a second — hears
          nothing. The other keys in the background are ordinary traffic:
          mostly hits, some misses, sharing the same database queue.
        </P>
        <CacheStampedeFigure />
        <P>
          Watch <Term>fetches / expiry</Term>. It resets the moment the key
          expires and counts the separate reads <Term>pg-main</Term> takes for
          that one value. At the default traffic the first expiry costs a
          handful — wasteful, survivable. Now push <Term>traffic</Term> to the
          top and press <Term>expire hot key</Term>: the counter runs to
          twenty-odd, the queue chip on <Term>pg-main</Term> climbs past
          anything it can drain, and the node goes orange and then dies
          outright — out of connections, refusing new reads at the door while
          it digs out. Notice who else is stuck: the background keys never
          expired and did nothing wrong, but their misses are in the same
          queue.
        </P>
        <Callout kind="warning">
          Shortening the TTL does not help — it hands you the same pile more
          often. Lengthening it does not help either: you get the same pile,
          just less frequently, on a staler value. The size of the pile is set
          by traffic and refill time, and the TTL only chooses when to send
          the invitation.
        </Callout>
      </LessonSection>

      <LessonSection id="coalesce">
        <P>
          The fix is not a bigger database. It is a lock. Under{" "}
          <Term>coalescing</Term> — <Strong>single-flight</Strong>, in the
          literature — the first reader to miss takes the key&apos;s lock and
          goes to the database; every reader behind it finds the lock held and
          simply waits at the cache. That is the count chip on{" "}
          <Term>redis-1</Term>: not packets on the wire, just readers parked in
          memory. When the one fetch returns, they are all answered from it at
          once. Same traffic, same expiry, same TTL —{" "}
          <Strong>one read instead of twenty</Strong>, and the counter reads 1.
        </P>
        <P>
          They still waited, though, and that is the honest limit of
          coalescing: it fixes database <Strong>load</Strong>, not{" "}
          <Strong>latency</Strong>. Its cousin fixes the other half. Under{" "}
          <Term>stale-while-revalidate</Term>, an expired entry is not
          deleted — it keeps being served (the violet packets) while a single
          refresh runs behind it. Nobody waits for the truth; they get the
          slightly-old answer at cache speed and the fresh one lands a moment
          later. Turn both on and the expiry becomes invisible: one background
          read, zero waiting readers, and a database that never notices the
          key was gone at all.
        </P>
        <P>
          Two switches, two different halves — and they really are
          independent. Turn on stale-while-revalidate <em>without</em>{" "}
          coalescing and watch what happens: the latency stays flat, every
          reader is happy, and the fetch counter still runs to twenty, because
          nothing is stopping each of them from kicking off its own refresh.
          Your users would never tell you. Your database would.
        </P>
        <Callout kind="insight">
          You will meet this in production under several names. Go&apos;s{" "}
          <Term>singleflight</Term> package and Ruby&apos;s{" "}
          <Term>race_condition_ttl</Term> are the in-process form; CDNs and
          Varnish call it <Term>request collapsing</Term>; a distributed cache
          does it with a short-lived lock key in Redis.{" "}
          <Strong>Probabilistic early refresh</Strong> (XFetch) attacks it from
          the other end: each read rolls dice that get more likely as the entry
          nears expiry, so one unlucky reader refreshes early and the key never
          actually expires under load. And the cheapest habit of all — jitter
          your TTLs — is what keeps a thousand keys written in the same second
          from expiring in the same second.
        </Callout>
        <P>
          One last edge, because it is the sharp one: with coalescing, a failed
          fetch fails <em>everyone</em> waiting on it. If the coalesced read
          hits a database that is already refusing connections, every parked
          reader gets the same error in the same instant, and the lock has to
          be released and retried by someone. That is the trade you signed
          for — a single point of coordination is a single point of failure,
          and it is still an overwhelmingly good deal compared to twenty of
          them.
        </P>
      </LessonSection>
    </Lesson>
  );
}
