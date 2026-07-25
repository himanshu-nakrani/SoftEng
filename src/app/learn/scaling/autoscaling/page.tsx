import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { AutoscalingFigure } from "@/lessons/scaling/autoscaling-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("autoscaling");

export default function AutoscalingPage() {
  return (
    <Lesson slug="autoscaling">
      <LessonSection id="reactive-capacity">
        <Lead>
          Every fleet so far has been a number you chose. Autoscaling makes it
          a <Strong>function of the load</Strong> — a control loop that buys
          machines when the bars go red and hands them back when they go
          green.
        </Lead>
        <P>
          The loop has four steps: <Term>measure</Term> a signal (CPU,
          requests per instance, queue depth), <Term>decide</Term> whether it
          breaches a threshold, <Term>provision</Term> the capacity, and then{" "}
          <Strong>wait for it to exist</Strong>. Three of those steps take
          milliseconds. The fourth takes a minute.
        </P>
        <P>
          That wait is the whole lesson, and it is longer than the API call
          suggests. A metric has to be averaged over a window before you dare
          act on it; the instance has to boot, pull an image, warm its caches,
          and pass health checks before the balancer will send it anything.
          Add it up and you get the interval during which your capacity is{" "}
          <Strong>exactly what it was before you noticed</Strong>.
        </P>
        <Callout kind="note">
          A control loop is reactive by construction: it can only respond to
          load that has already arrived. Everything that makes autoscaling
          look magical — and everything that makes it fail — follows from
          that one sentence.
        </Callout>
      </LessonSection>

      <LessonSection id="ride-the-ramp">
        <P>
          Two servers are running. The four dashed outlines are real machines
          you haven&apos;t paid for: they take no traffic and cost nothing.
          The autoscaler watches the <Term>avg load</Term> meter — the average
          of the same load bars you can see — and when it stays above{" "}
          <Term>scale-out above</Term>, it provisions a ghost. Watch what the
          box does next: it stays dashed, counts down, and takes{" "}
          <Strong>nothing</Strong> until the countdown ends.
        </P>
        <AutoscalingFigure />
        <P>
          The opening ramp is the happy path. Traffic climbs, the average
          crosses the line, a box is ordered, it boots for five seconds, and
          it joins the rotation before anything queues — zero drops through
          the entire ramp. Now play with the two lines. Drag{" "}
          <Term>scale-out above</Term> down and the fleet grows sooner and
          bigger; drag it up and the autoscaler cuts it fine. Drag{" "}
          <Term>scale-in below</Term> up past the current load and watch the
          newest box drain and dissolve back into an outline.
        </P>
        <Callout kind="insight">
          The gap between the two lines is a <Term>deadband</Term>: the range
          of load where the autoscaler is content to do nothing. It exists
          because doing something is not free — every scale-out costs a boot,
          and every scale-in throws away capacity you may want back in ten
          seconds.
        </Callout>
      </LessonSection>

      <LessonSection id="the-cliff">
        <P>
          At the fifteen-second mark, traffic stops climbing and{" "}
          <Strong>jumps</Strong> — near threefold, in a single tick. The
          autoscaler behaves impeccably: it notices within a couple of
          seconds and orders two more boxes. It is still completely useless,
          and the sim stops to ask you why.
        </P>
        <P>
          Do the arithmetic with it. The fleet is serving 24 req/s and 35 are
          arriving, so 11 req/s have nowhere to go. The only buffer on the
          stage is the queues: five slots per box, three boxes, fifteen
          requests — about <Strong>a second and a half</Strong> of excess.
          The boots take five seconds. Everything in between is shed, and you
          can watch the <Term>dropped</Term> counter measure the difference.
          Stretch <Term>provisioning lag</Term> toward sixty and the drop
          count grows with it: the gap is a multiplier on your excess rate.
        </P>
        <P>
          The other way to burn boot time is to <Term>flap</Term>. Squeeze the
          two lines together around wherever <Term>avg load</Term> happens to
          be sitting — scale-out just above it, scale-in just below (80% and
          75% works once the spike has been absorbed) — and set{" "}
          <Term>cooldown</Term> to zero. Now every box that lands drops the
          average below the scale-in line, so it is immediately taken away,
          which pushes the average back above the scale-out line, and the
          fleet oscillates forever, paying a full boot per cycle. Cooldown is
          the brake: it demands the breach be sustained and forbids a second
          action for a while. A wide deadband is the actual cure.
        </P>
        <Callout kind="insight">
          Real fleets buy their way out of the gap, not their way around it:{" "}
          <Strong>predictive scaling</Strong> (scale on the calendar and the
          forecast, before the load arrives), <Strong>warm pools</Strong> and
          pre-baked images (shorten the boot), <Strong>headroom</Strong> (run
          at 50% so the spike lands in capacity you already own), and a{" "}
          <Term>queue</Term> in front (make the buffer deep enough to outlast
          a boot). Autoscaling absorbs trends. Spikes are absorbed by
          capacity you already have, or by a buffer you already built.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
