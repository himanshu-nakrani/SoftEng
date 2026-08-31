import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis, UL } from "@/components/lesson/prose";
import { BlueGreenFigure } from "@/lessons/delivery/blue-green-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("blue-green");

export default function BlueGreenPage() {
  return (
    <Lesson slug="blue-green">
      <LessonSection id="two-fleets">
        <Lead>
          A canary asks how <em>much</em> traffic to risk on a new version. A
          blue-green deploy asks a different question and answers it with money:
          run two complete fleets, keep one live, and switch between them.
        </Lead>
        <P>
          <Term>Blue</Term> is the fleet you are running now, on the version you
          trust. <Term>Green</Term> is a second fleet, provisioned to full
          capacity, running the new version and taking no traffic at all. It is
          not a fraction of a fleet or a single canary box — it is a whole
          duplicate of production, idle, waiting. That is the bill you sign up
          for: for the length of the deploy you are paying for twice the
          capacity you serve from.
        </P>
        <P>
          What the second fleet buys is a router that has only two positions.
          Deploying is throwing the switch so <Strong>100%</Strong> of traffic
          moves from blue to green at once. Reverting is throwing it back. There
          is no half-deployed state, because no request is ever split across the
          two versions: each one meets whichever fleet is live at the instant it
          arrives.
        </P>
      </LessonSection>

      <LessonSection id="cutover">
        <TryThis>
          <LI>
            The run opens with all traffic on <Term>blue v1.4</Term>, coming
            back clean, while <Term>green v1.5</Term> sits idle. Let it reach the{" "}
            <Term>t=9</Term> beat, where the router cuts the whole fleet over to
            green.
          </LI>
          <LI>
            Watch the <Term>traffic on green</Term> bar snap from 0 to 100 and
            the <Term>error rate</Term> follow it up within a second or two —
            there is no middle setting to land on.
          </LI>
        </TryThis>
        <BlueGreenFigure />
        <P>
          <Term>Green v1.5</Term> is deliberately a bad version: it errors on
          roughly <Strong>75%</Strong> of the requests it receives. While blue
          is live the error rate sits near zero — blue&apos;s own baseline is
          about <Strong>1%</Strong>. The instant the switch flips, the{" "}
          <Term>traffic on green</Term> bar goes to <Strong>100%</Strong> and
          the error rate climbs to green&apos;s failure rate: in the run it
          moves from near zero to about <Strong>33%</Strong> one second after
          the cutover, <Strong>68%</Strong> the next, and settles around{" "}
          <Strong>75%</Strong> a second after that as the last blue responses
          drain and only green requests remain.
        </P>
        <Callout kind="insight">
          The deploy control is a switch, not a slider. It cannot expose a
          fifth of your users to a bad version, because it does not know how to
          send a fifth of your traffic anywhere — it sends all of it or none of
          it. The price of never running a half-deployed fleet is that a bad
          cutover is a bad cutover for everyone at once.
        </Callout>
      </LessonSection>

      <LessonSection id="revert">
        <TryThis>
          <LI>
            After the cutover, once the <Term>error rate</Term> is clearly
            elevated, press <Term>revert</Term>.
          </LI>
          <LI>
            Watch <Term>traffic on green</Term> drop back to 0 immediately, then
            watch the error rate decay over the next few seconds rather than
            snapping down with it.
          </LI>
        </TryThis>
        <P>
          The symmetry is the whole point. The switch that exposed everyone at
          once is the same switch that rescues them at once: press{" "}
          <Term>revert</Term> and the router points at blue again on the very
          next tick, so <Term>traffic on green</Term> reads <Strong>0%</Strong>
          {" "}within a second. From the moment you decide, recovery is a single
          move — as fast as the mistake was.
        </P>
        <P>
          The error rate does not fall as sharply as the routing does, and the
          run shows why. Reverting at an error rate of about <Strong>76%</Strong>,
          the rate does not hit zero; it drifts down through the low{" "}
          <Strong>50s</Strong> a couple of seconds later and reaches under{" "}
          <Strong>10%</Strong> by around four seconds after the press. That tail
          is the requests already in flight to green when you flipped — they
          still come back as errors, because the switch changes where{" "}
          <em>new</em> requests go, not where the ones already gone can be
          recalled from. Recovery is fast, but it is not instantaneous, and the
          difference is exactly the work you had already committed to the bad
          fleet.
        </P>
        <Callout kind="insight">
          Blue-green does not shrink the damage a bad version does; it shrinks
          the <Strong>time</Strong> that damage lasts. The cost of a bad deploy
          is the full error rate times how long it takes you to notice and flip
          back — and the flip back is the fastest recovery you can buy.
        </Callout>
      </LessonSection>

      <LessonSection id="versus-canary">
        <Lead>
          A canary and a blue-green deploy solve the same problem from opposite
          ends, and neither one dominates the other.
        </Lead>
        <P>
          A <Term>canary</Term> bounds the <Strong>blast radius</Strong>. It
          routes a chosen fraction of traffic to the new version, so a bad
          release can only fail the users in that fraction — the error rate is
          the share times the version&apos;s failure rate. The cost is on two
          axes. It needs a router that can split traffic by percentage and
          per-version metrics to read the two populations apart, and it exposes
          those unlucky users for <em>longer</em>, because the whole method is
          to sit at a small share and watch before widening.
        </P>
        <P>
          A <Term>blue-green deploy</Term> bounds the <Strong>time</Strong>{" "}
          instead. The cutover and the revert are each one atomic flip, so a bad
          version is live for only as long as it takes you to react — but while
          it is live it is live for <em>everyone</em>. It does not bound the
          blast radius at all. And it needs the thing a canary does not: a
          second full fleet, which is double the capacity for the length of the
          deploy.
        </P>
        <UL>
          <LI>
            <Strong>Canary:</Strong> small radius, longer exposure, needs a
            splitting router and per-version metrics, runs on one fleet plus a
            sliver.
          </LI>
          <LI>
            <Strong>Blue-green:</Strong> full radius, shortest exposure, needs a
            simple two-position switch, runs on two full fleets.
          </LI>
        </UL>
        <P>
          The choice inverts once state is involved. A stateful{" "}
          <Term>schema change</Term> is harder under blue-green, and the reason
          is the same instantaneous switch that makes it attractive. Green
          writes to the database in the new schema; the moment you cut over,
          every write is a new-schema write. If you then revert, blue is handed
          a database that green has already changed and may no longer be able to
          read — the revert that recovers the code cannot recover the data. A
          canary, running both versions against the same data at the same time
          for an extended window, forces you to make the schema tolerate both
          versions <em>anyway</em>, which is the discipline a safe migration
          needs. Blue-green lets you skip that discipline right up until the
          revert makes you regret it.
        </P>
        <Callout kind="insight">
          Pick the bound that matches the failure you fear. If the danger is a
          version that is subtly wrong and you want the smallest possible group
          harmed while you investigate, bound the radius with a canary. If the
          danger is a version that is loudly wrong and you want to be out of it
          in one move, bound the time with blue-green — and keep your schema
          changes backward-compatible so the revert stays as cheap as the
          cutover.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
