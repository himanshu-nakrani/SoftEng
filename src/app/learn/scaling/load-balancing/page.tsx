import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { LoadBalancingFigure } from "@/lessons/scaling/load-balancing-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Load Balancing",
};

export default function LoadBalancingPage() {
  return (
    <Lesson slug="load-balancing">
      <LessonSection id="why">
        <Lead>
          Last lesson ended on a cliffhanger: with many servers,{" "}
          <Strong>someone has to decide which machine gets which request</Strong>
          . That someone is the <Term>load balancer</Term> — the traffic cop
          standing between your users and your fleet.
        </Lead>
        <P>
          Every request now makes an extra hop, and in exchange the fleet
          becomes one logical server: machines can die, join, or drain behind
          the balancer without users ever holding a bad address.
        </P>
      </LessonSection>

      <LessonSection id="strategies">
        <P>
          How should the cop direct traffic? The sim below has a deliberate
          trap: <Term>api-2</Term> is a smaller instance than its siblings.
          Watch what <Term>round-robin</Term> — which treats all servers as
          equals — does to it, then try the alternatives.
        </P>
        <LoadBalancingFigure />
        <Callout kind="insight">
          <Term>round-robin</Term> is blind fairness: equal requests to
          unequal machines. <Term>least-conn</Term> measures reality — it
          routes to whoever is least busy, which automatically compensates
          for slow machines, slow requests, and everything else it never had
          to know about. Feedback beats scheduling.
        </Callout>
      </LessonSection>

      <LessonSection id="failure">
        <P>
          At the 12-second mark, <Term>api-3</Term> dies — and just before
          it, the sim asks you the question that separates people who&apos;ve
          read about load balancers from people who&apos;ve operated one:
          what happens to the requests <Strong>already in flight</Strong>?
        </P>
        <P>
          If you missed the moment, hit <Term>restart</Term> — the run is
          deterministic, and the error burst happens the same way every time.
          Then revive api-3 with a click and watch traffic rebalance.
        </P>
      </LessonSection>

      <LessonSection id="health-checks">
        <P>
          The balancer only knows what its <Term>health checks</Term> tell
          it: a probe every second or so, marking servers in or out. Between
          the moment a server dies and the moment a check fails, the
          balancer keeps routing to a corpse. That{" "}
          <Strong>detection window</Strong> is unavoidable — you can shrink
          it, but never to zero.
        </P>
        <Callout kind="warning">
          This is why every serious client retries idempotent requests, and
          why failover is never &quot;seamless&quot; — only fast. Design for
          the error burst; don&apos;t pretend it away.
        </Callout>
      </LessonSection>

    </Lesson>
  );
}
