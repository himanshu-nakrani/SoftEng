import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Compare,
  CompareCol,
  Lead,
  P,
  Strong,
  Term,
} from "@/components/lesson/prose";
import { ScalingStrategiesFigure } from "@/lessons/scaling/scaling-strategies-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("scaling-strategies");

export default function ScalingStrategiesPage() {
  return (
    <Lesson slug="scaling-strategies">
      <LessonSection id="two-axes">
        <Lead>
          Your server is saturated. You have exactly two moves:{" "}
          <Strong>scale up</Strong> — buy a bigger machine — or{" "}
          <Strong>scale out</Strong> — buy more machines.
        </Lead>
        <P>
          <Term>Vertical scaling</Term> is seductive because nothing about
          your system has to change: same code, same architecture, just more
          CPU under it. <Term>Horizontal scaling</Term> makes the hardware
          cheap and boring, but forces a new question that will follow you
          through every remaining lesson:{" "}
          <Strong>who decides which machine gets which request?</Strong>
        </P>
      </LessonSection>

      <LessonSection id="compare">
        <P>
          Both philosophies, one slider. At the same <Term>scale</Term>, both
          modes give identical total capacity — so push the traffic up, flip
          between modes, and find what&apos;s actually different. Then do
          what the caption says and start killing servers.
        </P>
        <ScalingStrategiesFigure />
        <Callout kind="insight">
          Watch the <Term>cost</Term> meter as you scale. Commodity boxes
          price linearly; big iron prices superlinearly — a 4× machine costs
          far more than four 1× machines. Physics and markets both fight
          vertical scaling.
        </Callout>
      </LessonSection>

      <LessonSection id="tradeoffs">
        <P>
          The deeper difference isn&apos;t price — it&apos;s the{" "}
          <Strong>ceiling</Strong> and the <Strong>blast radius</Strong>. The
          simulation kills a live machine for you partway through, in
          whichever mode you&apos;re running.
        </P>
        <Compare>
          <CompareCol title="vertical">
            A hard ceiling: at some point there is no bigger machine to buy.
            And it concentrates everything into one <Term>failure domain</Term>{" "}
            — you saw what happens when the XL box dies. One click, total
            outage: vertical drops <Term>live capacity</Term> straight to
            zero.
          </CompareCol>
          <CompareCol title="horizontal">
            No practical ceiling, and it degrades gracefully — losing one of
            three machines costs a third of capacity, not all of it.
            Horizontal loses exactly one box and the survivors keep serving.
            The price is coordination: spreading traffic, sharing state,
            handling partial failure. Nearly everything else in system design
            exists to pay that price.
          </CompareCol>
        </Compare>
        <Callout kind="note">
          Real systems do both: scale each box to the sweet spot of its
          price curve, then scale out. The interesting engineering is always
          in the &quot;out&quot; direction.
        </Callout>
      </LessonSection>

    </Lesson>
  );
}
