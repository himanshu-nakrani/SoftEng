import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { RoundRobinFigure } from "@/lessons/cpu-scheduling/round-robin-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("round-robin");

export default function RoundRobinPage() {
  return (
    <Lesson slug="round-robin">
      <LessonSection id="the-slice">
        <Lead>
          Last lesson a 1-step <Term>quantum</Term> cut B&apos;s wait from{" "}
          <Strong>8</Strong> to <Strong>3</Strong>. That run charged nothing
          to switch. This one charges <Strong>1</Strong>.
        </Lead>
        <P>
          Same convoy: <Term>A</Term> needs <Strong>8</Strong> CPU steps;{" "}
          <Term>B</Term> and <Term>C</Term> need <Strong>2</Strong> each; all
          three arrive at t=0. <Term>Round-robin</Term> is preemptive FIFO
          with a quantum — the occupant runs at most that many steps, then
          goes to the back if anyone else is ready.
        </P>
        <P>
          Waiting time is still completion minus burst. Wall time is CPU
          steps plus <Term>waste</Term>. Every dispatch after the first
          costs <Strong>1</Strong> wall step that nobody&apos;s burst
          counts. That is a <Term>context switch</Term> in this model: not
          free, and not work.
        </P>
      </LessonSection>

      <LessonSection id="short-slice">
        <TryThis>
          <LI>
            Leave quantum at <Strong>1</Strong>. Step until the first timer:
            A is requeued with remaining 7. The next caption is{" "}
            &quot;Dispatch B — switch costs 1.&quot; Waste ticks to{" "}
            <Strong>1</Strong>, t=2.
          </LI>
          <LI>
            Finish the run. B is done@9 (wait <Strong>7</Strong>), C is
            done@11 (wait <Strong>9</Strong>), A is done@18 (wait{" "}
            <Strong>10</Strong>). Waste <Strong>6</Strong>, switches{" "}
            <Strong>7</Strong>, cpu steps <Strong>12</Strong>, wall time{" "}
            <Strong>18</Strong>. Preemptions read <Strong>4</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. B is done@5 (wait <Strong>3</Strong>),
            waste <Strong>3</Strong>, switches <Strong>4</Strong>, time{" "}
            <Strong>15</Strong>. Then drag to <Strong>8</Strong>: B waits{" "}
            <Strong>9</Strong>, waste <Strong>2</Strong>, switches{" "}
            <Strong>3</Strong>, time <Strong>14</Strong>, preemptions 0.
          </LI>
        </TryThis>
        <RoundRobinFigure />
        <Callout kind="insight">
          The 1-step slice that used to help B now hurts it. Without the
          switch cost B waited <Strong>3</Strong>; with it B waits{" "}
          <Strong>7</Strong>. Four of the six waste ticks land before B
          finishes at t=9.
        </Callout>
        <P>
          Cpu steps stay <Strong>12</Strong> at every quantum — the same
          work. The clock did not. Seven switches at quantum 1 versus three
          at quantum 8 is how a short slice inflates the wall.
        </P>
      </LessonSection>

      <LessonSection id="long-slice">
        <Lead>
          Waste versus waiting is a trade, and the shortest slice is not
          the winning side.
        </Lead>
        <P>
          Quantum 2 is kind to B on this convoy because B&apos;s burst is
          2: it finishes on first dispatch, and A is still cut after two
          steps. Waste <Strong>3</Strong>, B wait <Strong>3</Strong>, time{" "}
          <Strong>15</Strong>. One preemption.
        </P>
        <P>
          Stretch the slice to <Strong>8</Strong> and the timer never
          fires. A runs to completion (wait <Strong>0</Strong>, done@8),
          then two real switches — A→B and B→C — cost 1 each. Waste{" "}
          <Strong>2</Strong>, time <Strong>14</Strong>, B waits{" "}
          <Strong>9</Strong>, C waits <Strong>12</Strong>. That is the
          convoy plus two dispatch charges. Last lesson the same quantum
          was B wait 8.
        </P>
        <Callout kind="insight">
          A round-robin quantum is a budget you spend on fairness. Spend it
          at 1 and switches eat the clock — B waits 7, almost as long as
          the convoy. Spend it as large as the long burst and you bought
          the convoy back, plus two charges. The number in the middle is
          the lesson.
        </Callout>
        <P>
          This model has no I/O, no late arrivals, and no shortest-job-first.
          A real kernel&apos;s switch is not always 1, and a real burst is
          not known in advance. The argument does not need either: once a
          dispatch costs something, a 1-step quantum is a policy you can
          measure, not a kindness you can assume.
        </P>
      </LessonSection>
    </Lesson>
  );
}
