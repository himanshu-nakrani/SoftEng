import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { ClientServerFigure } from "@/lessons/scaling/client-server-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client & Server",
};

export default function ClientServerPage() {
  return (
    <Lesson slug="client-server">
      <LessonSection id="lifecycle">
        <Lead>
          Strip away every diagram you&apos;ve ever seen and a web system is
          this: a <Term>client</Term> that asks, a <Term>server</Term> that
          answers, and a wire between them.
        </Lead>
        <P>
          Each request travels the wire, waits its turn at the server, gets
          processed, and a response travels back. That round trip has a cost —{" "}
          <Strong>latency</Strong> — and the server can only process so many
          requests per second — its <Strong>capacity</Strong>. Everything in
          system design falls out of those two numbers.
        </P>
      </LessonSection>

      <LessonSection id="drive-it">
        <P>
          This is a live system. Press play, then drag the sliders — the
          simulation reacts instantly. Around the 14-second mark, a traffic
          spike hits and you&apos;ll be asked to predict what happens.
        </P>
        <ClientServerFigure />
        <Callout kind="insight">
          Watch the <Term>server queue</Term> bar. As long as arrivals stay
          below server speed it hovers near zero. The instant arrivals exceed
          capacity, it grows — and latency grows with it. The queue is where
          latency hides.
        </Callout>
      </LessonSection>

      <LessonSection id="saturation">
        <P>
          A server at <Strong>saturation</Strong> — arrivals ≥ capacity — has
          only three possible futures: the queue grows forever (memory dies),
          requests wait unboundedly (users die of old age), or the system{" "}
          <Strong>sheds load</Strong> and drops what it can&apos;t handle.
          Real systems choose dropping, because it is the only honest option.
        </P>
        <P>
          You just watched that choice happen: the red dots bouncing back
          during the spike were requests the server refused so the ones it
          had already accepted could finish in reasonable time.
        </P>
        <Callout kind="warning">
          A system that never drops requests isn&apos;t resilient — it&apos;s
          a system that hasn&apos;t met real traffic yet. Load shedding is a
          feature. The next lessons are about pushing the point where it
          kicks in.
        </Callout>
      </LessonSection>

    </Lesson>
  );
}
