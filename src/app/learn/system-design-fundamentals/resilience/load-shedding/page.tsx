import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import { LoadSheddingFigure } from "@/lessons/resilience/load-shedding-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("load-shedding");

export default function LoadSheddingPage() {
  return (
    <Lesson slug="load-shedding">
      <LessonSection id="overload">
        <Lead>
          A server has a fixed capacity. When requests arrive faster than it
          can serve them, the extra work does not disappear — it waits. And a
          server that waits on everything eventually serves nobody.
        </Lead>
        <P>
          Every server has a rate it can sustain: so many requests per second,
          set by CPU, by locks, by the slowest thing in the path. Call it{" "}
          <Term>capacity</Term>. As long as arrivals stay under it, life is
          easy — work comes in, work goes out, nothing piles up. The
          interesting question is what happens when demand crosses that line
          and <Strong>stays</Strong> there, which under a real traffic spike is
          exactly what it does.
        </P>
        <P>
          The instinct is to queue. Accept the request, put it in line, get to
          it when you can. A queue feels like the polite, lossless choice — you
          are not turning anyone away. But a queue does not add capacity. It
          only adds <Strong>waiting</Strong>, and when arrivals stay above
          capacity there is no later moment when the line gets shorter. It
          grows for as long as the overload lasts, and everything in it grows
          old.
        </P>
        <Callout kind="note">
          Two words the rest of this lesson keeps strictly apart. A request
          lost because capacity ran out — a queue physically overflowed, a box
          died — is <Strong>dropped</Strong>. A request the server refuses on
          purpose, by policy, is <Strong>rejected</Strong>. Shedding is a
          policy, so it rejects. It never drops.
        </Callout>
      </LessonSection>

      <LessonSection id="queue-of-death">
        <TryThis>
          <LI>
            Let it run. Arrivals are 24/s and the server can do 12/s — it is
            underwater from the start. Watch the <Term>server queue</Term>{" "}
            chip climb.
          </LI>
          <LI>
            Now watch the <Term>queue wait</Term> meter next to it, and the{" "}
            <Term>useful answers</Term> counter. One of them keeps climbing.
            The other stops dead.
          </LI>
        </TryThis>
        <LoadSheddingFigure />
        <P>
          The server accepts everything, so the queue climbs without bound —
          past 100, past 150, toward 190 requests deep by the time the scripted
          window ends. Its wait is not fixed: a request that joins the back of
          the line waits for everyone ahead of it, so the wait is{" "}
          <Term>queue depth ÷ capacity</Term>, and the depth keeps growing. The{" "}
          <Term>queue wait</Term> meter blows past its 2000ms deadline within a
          few seconds and keeps going, up past fifteen <em>thousand</em>{" "}
          milliseconds. The server never stops working — its load bar is pinned
          at 100% the entire time.
        </P>
        <P>
          And here is the trap. Look at <Term>useful answers</Term>: it counts
          about 21 and then <Strong>freezes</Strong>. Those were the requests
          served in the first few seconds, before the wait crossed the
          deadline. After that, every answer the server produces arrives too
          late to matter — the caller has already timed out and gone — so it
          comes back as a dim orange <Term>wasted</Term> dot: real work, done
          for nobody. The machine is flat out and its goodput is zero. That is
          the queue of death: <Strong>a system at 100% utilisation serving
          nobody usefully</Strong>.
        </P>
        <Callout kind="warning">
          High utilisation is not the same as high throughput. A queue lets a
          server look perfectly busy — CPU pinned, nothing idle — while every
          unit of that work lands on a client that left seconds ago. Accepting
          more than you can serve does not raise your useful output; past the
          deadline it drives it to zero.
        </Callout>
      </LessonSection>

      <LessonSection id="shedding">
        <TryThis>
          <LI>
            Flip <Term>shed at the door</Term> on while the queue is deep.
            Watch the queue collapse and the <Term>queue wait</Term> meter drop
            back under the deadline.
          </LI>
          <LI>
            Now watch <Term>useful answers</Term> start climbing again — and
            the <Term>rejected (429)</Term> counter climb with it. The server
            is turning most arrivals away, and that is <em>why</em> it recovers.
          </LI>
        </TryThis>
        <LoadSheddingFigure />
        <P>
          <Term>Load shedding</Term> — <Term>admission control</Term> — is a
          single decision made at the door: before admitting a request, ask
          whether it could actually be served in time. If the queue is already
          too deep to beat the deadline, refuse it now, instantly and cheaply —
          an amber <Term>429</Term>, a <Strong>reject</Strong>, not a drop. The
          request that never entered the queue costs nothing; the caller learns
          immediately instead of hanging.
        </P>
        <P>
          The effect on the numbers is the whole lesson. Once shedding is on,
          the queue settles to a shallow line — around 17 deep — and the{" "}
          <Term>queue wait</Term> holds near 1400ms, comfortably inside the
          2000ms deadline. <Term>useful answers</Term> unfreezes and climbs
          steadily at the server&apos;s full 12/s — from the stuck 21 up past
          160 by the end of the run — while the <Term>rejected</Term> counter
          runs into the hundreds. The server refuses far more than it accepts,
          and serves <Strong>eight times more useful work</Strong> for it. Fast
          answers to a few beat slow answers to nobody.
        </P>
        <Callout kind="insight">
          Shedding does not make the server faster and it does not serve more
          requests — it serves fewer. What it protects is <Strong>goodput</Strong>:
          the answers that arrive while someone is still waiting for them. The
          rejected requests were going to fail either way; shedding just makes
          them fail early and cheaply, so the capacity they would have wasted
          goes to work that can still be used.
        </Callout>
      </LessonSection>

      <LessonSection id="what-to-drop">
        <Lead>
          Shedding is a policy, and a policy has to choose. Refusing work is
          only half the design — the other half is <em>which</em> work.
        </Lead>
        <P>
          The sim refuses whatever arrives once the line is too long, which is
          the simplest admission rule and already enough to save the system.
          Real shedders do better by being <Strong>selective</Strong>. Drop the
          cheap-to-lose before the expensive-to-lose: health checks and
          prefetches before checkouts, anonymous traffic before paying
          customers, one tenant&apos;s flood before everyone else&apos;s steady
          load. A <Term>priority</Term> on the request turns &quot;refuse
          something&quot; into &quot;refuse the <em>right</em> something&quot;.
        </P>
        <P>
          It also matters <em>where</em> you refuse. Shedding at the door, before
          the work is queued, is what makes a reject cheap — the whole point is
          that a refused request consumes almost nothing. A reject that still
          costs a database round trip is not shedding, it is just a slower way to
          be overloaded. And the deadline is the honest signal for the decision:
          if a request cannot be finished before its caller gives up, admitting
          it helps no one, so a good shedder sheds work whose deadline has
          already passed even after it is queued.
        </P>
        <P>
          Now click <Term>api-1</Term> in either figure and kill it. Every
          arrival still fails — but look at which counter moves. It is{" "}
          <Term>dropped</Term>, the red one, not <Term>rejected</Term>. A dead
          box has no policy to apply; it is not choosing to refuse work, it has
          simply lost the ability to do it. That is capacity loss, and it is why
          the words stay separate: a <Strong>reject</Strong> is a system in
          control of its own overload, and a <Strong>drop</Strong> is a system
          that is not.
        </P>
        <Callout kind="insight">
          Load shedding is admission control with a deadline: refuse work you
          cannot finish in time, refuse it early and cheaply, and refuse the
          least valuable work first. A server that never says no will, under
          enough load, end up saying nothing useful to anyone.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
