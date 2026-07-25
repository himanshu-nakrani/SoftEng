import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { TailLatencyFigure } from "@/lessons/resilience/tail-latency-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("tail-latency");

export default function TailLatencyPage() {
  return (
    <Lesson slug="tail-latency">
      <LessonSection id="averages-lie">
        <Lead>
          Your dashboard says the average response time is 50ms. Half your
          requests finish in 40. Nothing is on fire, no alert has gone off,
          and some slice of your users is watching a spinner for a full
          second. Every one of those statements is true at the same time,
          and the first one is why you have not noticed the last one.
        </Lead>
        <P>
          Latency is not a number. It is a <Term>distribution</Term> — a
          shape, with a dense fast body and a long thin tail — and the moment
          you collapse it to one figure you have thrown away the only part
          anybody complains about. The mean is the worst collapse available,
          because it is <Strong>arithmetic on outliers</Strong>: drop one
          1000ms request into ninety-nine 40ms ones and the average moves
          from 40 to 50. Ten milliseconds. On a graph that is a rounding
          error. For the person who waited, it was a second.
        </P>
        <P>
          So we use percentiles instead. <Term>p50</Term> — the median — is
          the request in the middle: half are faster, half are slower. It
          describes the typical experience and it is stubbornly, uselessly
          stable. <Term>p99</Term> is the request that 99% of requests beat.
          It describes the worst experience you are willing to call normal,
          and it is where the interesting things live. The gap between them
          is not noise. It <em>is</em> the shape.
        </P>
        <P>
          &quot;One in a hundred&quot; also sounds rarer than it is. A single
          user loading a single page fires ten or twenty requests at your
          service; a session fires hundreds. At p99, a user who makes 100
          requests has better-than-even odds of hitting the tail at least
          once — and what they remember is the slow one, not the ninety-nine
          fast ones around it. The tail is not an edge case that affects 1%
          of people. It is a common case that affects most of them,
          occasionally.
        </P>
        <Callout kind="insight">
          A useful reflex: whenever someone shows you an average latency, ask
          what the p99 is. If they do not have it, they do not know how their
          service behaves — they know how it behaves on a good day, averaged
          with itself.
        </Callout>
      </LessonSection>

      <LessonSection id="find-the-tail">
        <P>
          Below, <Term>lb-1</Term> hands each request to one of three
          identical <Term>api</Term> servers. Amber dots go out, green dots
          come back, and almost all of them are home in about 40ms. Every so
          often a server has a bad moment — a garbage collection pause, a
          lock it has to queue behind, a page fault — and one answer comes
          back as a fat orange dot that visibly <Strong>crawls</Strong> down
          its edge while the fast ones fly past it. That is the tail, drawn.
        </P>
        <TailLatencyFigure />
        <P>
          Every one of those latencies is measured, not asserted: the clock
          starts when the client sends and stops when the answer arrives, and
          the meters are percentiles over a sliding window of the last 120
          measurements. Watch the two counters while it runs.{" "}
          <Term>p50</Term> sits at 40ms and does not move. <Term>p99</Term>{" "}
          sits near it too — until the window happens to catch two stalls, at
          which point it leaps past 500ms and stays there for as long as
          those samples remain in the window.
        </P>
        <P>
          Now drag <Term>slow requests</Term> from 2% up to 5% and watch
          which number reacts. p50 does not care at all: the middle request
          is still a fast request, and it will be until stalls make up half
          your traffic. The mean creeps. p99 goes to the ceiling and stays
          there. That divergence is the whole reason the tail gets measured
          separately — <Strong>the tail is the only place a rare event is
          visible</Strong>, and rare events are what your infrastructure is
          made of.
        </P>
        <Callout kind="note">
          p99 is a <Strong>sample statistic</Strong>, and it is noisy by
          construction. Over a 120-sample window it is the second-worst
          request in the window — so one unlucky moment moves it, and a
          quiet stretch drops it back. That jitter is not a bug in the
          meter; it is what having only 120 samples means. It is also why a
          p99 computed per-minute, per-host, and then <em>averaged</em>{" "}
          across hosts is a number with no meaning at all: percentiles do not
          average.
        </Callout>
      </LessonSection>

      <LessonSection id="fanout-amplification">
        <P>
          Here is the part that turns a nuisance into an architecture
          problem. Flip <Term>fan out to all 3</Term> on. Every request now
          goes to all three servers at once and cannot finish until the{" "}
          <Strong>slowest</Strong> leg comes home — a search that queries
          every shard, a page that assembles a dozen services, a quorum read
          that waits for the majority. Nothing about the servers changed.
          Nothing about the 2% changed. Watch p99.
        </P>
        <P>
          The arithmetic is short and it is brutal. For the request to be
          fast, <em>every</em> leg has to be fast, which happens with
          probability <Term>(1-p)ⁿ</Term>. So the request is slow with
          probability <Term>1-(1-p)ⁿ</Term>, which for small p is just about{" "}
          <Strong>n×p</Strong>. Take servers that each stall on 1% of
          requests: one of them and you are slow 1% of the time; three, 3%;
          ten, 10%; a hundred — an entirely ordinary number of leaf calls
          behind one search box — and you are slow{" "}
          <Strong>63%</Strong> of the time. A one-in-a-hundred event at the
          leaf has become the common case at the root, and the only thing
          that changed is width.
        </P>
        <Callout kind="warning">
          This is the mechanism behind <Term>the tail at scale</Term>: as a
          system fans out, the p99 of its components becomes the p50 of the
          whole. You cannot fix it by making the components more reliable in
          the average case, because the average case was never the problem.
          It is why a service that looks perfectly healthy on every one of
          its hosts can be unusable when you put a hundred of them behind one
          request.
        </Callout>
        <P>
          The sim makes a second point at <Term>t=15</Term> that is worth
          sitting with: api-2 dies, lb-1 routes around it on the spot, and
          every request now waits on two legs instead of three. Two chances
          to be unlucky rather than three — 1-(0.98)² is 4%, down from 5.9%.{" "}
          <Strong>Losing a server made the tail thinner.</Strong> You have
          less capacity and better latency, which is the same trade in
          reverse and a good thing to have felt once before someone proposes
          fanning out wider &quot;for reliability&quot;.
        </P>
      </LessonSection>

      <LessonSection id="budgets-hedging">
        <P>
          If the tail is arithmetic, so is the fix. Start with a{" "}
          <Term>latency budget</Term>: a number you promise for the whole
          request — say 300ms at p99 — which then has to be <em>divided</em>{" "}
          among everything the request touches. A budget is what turns
          &quot;make it fast&quot; into a design constraint. It tells you how
          wide you can afford to fan out, how many sequential hops you can
          chain, and, bluntly, which dependency has to be cut.
        </P>
        <P>
          The second tool is the one the sim ends on. Flip{" "}
          <Term>hedge at p95</Term>: when a request is still running as it
          passes the measured p95, send a second copy to a different server
          and take whichever answer comes back first. The threshold is its
          own cost control — by definition at most 5% of requests ever cross
          p95 — and what those few duplicates buy is enormous, because the
          copy lands on a server whose bad moments are{" "}
          <Strong>independent</Strong> of the first one&apos;s. Both have to
          stall for you to wait: 2% becomes 0.04%. Watch p99 fall from a
          stalled server&apos;s entire bad moment to roughly the deadline
          plus one more round trip.
        </P>
        <P>
          A hedge is not a retry, and the difference matters. Nothing failed.
          Nothing timed out. Both copies are still running when the winner
          returns, which means hedged work must be{" "}
          <Term>idempotent</Term> — hedge a read freely, hedge a payment
          never — and it means you should cancel the loser if the protocol
          lets you. It also means hedging is a bad idea on a service that is
          already saturated: 5% more load on something at its limit is how a
          slow day becomes an outage.
        </P>
        <Callout kind="insight">
          The rules of thumb worth keeping:{" "}
          <Strong>measure percentiles, never averages</Strong>, and never
          average percentiles;{" "}
          <Strong>budget the whole request, then divide</Strong>;{" "}
          <Strong>narrow the fan-out</Strong> before you tune the leaves,
          because n multiplies and p only adds; and{" "}
          <Strong>hedge at a percentile</Strong>, once, on idempotent work,
          with the loser cancelled.
        </Callout>
        <P>
          One last thing to carry forward. These percentiles are not just a
          report card — they are the input to the next decision you have to
          make. A <Term>timeout</Term> is a number you pick, and the only
          honest way to pick it is from the distribution you just measured:
          a little above p99, so healthy-but-unlucky requests survive, and
          comfortably under your own caller&apos;s budget, so you are never
          working for someone who has already left. Set it below p99 and you
          have not made anything faster — you have converted your tail into
          an error rate. That is the next lesson.
        </P>
      </LessonSection>
    </Lesson>
  );
}
