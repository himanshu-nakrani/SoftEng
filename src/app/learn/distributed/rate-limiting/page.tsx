import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { RateLimitingFigure } from "@/lessons/distributed/rate-limiting-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rate Limiting",
};

export default function RateLimitingPage() {
  return (
    <Lesson slug="rate-limiting">
      <LessonSection id="why-limit">
        <Lead>
          You learned in lesson one that overloaded systems must shed load.
          A <Term>rate limiter</Term> is that lesson made polite: shed the
          load <em>early</em>, <em>predictably</em>, and <em>per client</em>{" "}
          — before it ever touches the fragile parts.
        </Lead>
        <P>
          A <Term>429 Too Many Requests</Term> at the front door costs
          microseconds. The same request, admitted and then dying deep in an
          overloaded database, costs everyone. Rate limiting is the
          cheapest &quot;no&quot; in system design.
        </P>
      </LessonSection>

      <LessonSection id="token-bucket">
        <P>
          The classic mechanism is the <Term>token bucket</Term>: tokens
          drip in at a fixed <Strong>refill rate</Strong> up to a{" "}
          <Strong>bucket size</Strong>; each request spends one or bounces.
          The chip on the limiter is its live token count — watch it climb
          when traffic is light and drain when you push the rate up.
        </P>
        <RateLimitingFigure />
        <Callout kind="insight">
          Two knobs, two different promises. <Term>refill rate</Term> is
          the sustained ceiling — what you can do forever.{" "}
          <Term>bucket size</Term> is burst tolerance — how much
          &quot;save it up for later&quot; the limiter forgives. A full
          bucket is stored patience.
        </Callout>
      </LessonSection>

      <LessonSection id="burst">
        <P>
          Real traffic isn&apos;t smooth — it&apos;s a page load firing 30
          requests at once, a retry storm, a cron job at midnight. Hit{" "}
          <Term>send burst</Term> with different bucket sizes and watch who
          survives: the deep bucket absorbs the spike silently; the shallow
          one sprays 429s.
        </P>
        <Callout kind="warning">
          The dangerous failure mode isn&apos;t rejecting too much —
          it&apos;s clients that treat 429 as &quot;retry immediately.&quot;
          That converts polite refusal into a self-inflicted flood. Every
          429 should carry a <Term>Retry-After</Term>, and every client
          should back off exponentially.
        </Callout>
      </LessonSection>

    </Lesson>
  );
}
