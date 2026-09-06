import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { MlfqAgingFigure, MlfqFigure } from "@/lessons/cpu-scheduling/mlfq-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("mlfq");

export default function MlfqPage() {
  return (
    <Lesson slug="mlfq">
      <LessonSection id="several-queues">
        <Lead>
          One quantum treats every burst the same. Three queues, with quanta{" "}
          <Strong>1 / 2 / 4</Strong>, guess which jobs are interactive — by
          watching who burns a full slice.
        </Lead>
        <P>
          Two tasks arrive together at t=0. <Term>LONG</Term> needs{" "}
          <Strong>8</Strong> CPU steps; <Term>SHORT</Term> needs{" "}
          <Strong>1</Strong>. The scheduler is not told those bursts. Both
          start in <Term>Q0</Term>, whose slice is one step. A task that uses
          its whole slice is <Term>demoted</Term> to the next queue; a task
          that finishes inside the slice stays where it is.
        </P>
        <P>
          Q1&apos;s slice is two steps, Q2&apos;s is four. The CPU is always
          pulled from the highest nonempty queue, so Q0 runs ahead of Q1,
          and Q1 ahead of Q2. That is the whole mechanism. Cooperative FIFO
          on this pair would finish SHORT at <Strong>t=9</Strong> — waiting
          the whole of LONG&apos;s burst.
        </P>
      </LessonSection>

      <LessonSection id="demotion">
        <TryThis>
          <LI>
            Step until the first timer: LONG is demoted Q0 → Q1, and SHORT
            is dispatched from Q0. Demotions reads <Strong>1</Strong>.
          </LI>
          <LI>
            SHORT completes at <Strong>t=2</Strong>. Its chip still says Q0.
            It never used a slice without finishing.
          </LI>
          <LI>
            Keep stepping. LONG&apos;s next timer demotes Q1 → Q2 at t=4. A
            Q2 slice of 4, then one leftover step: LONG is done@9 in Q2.
            Demotions is <Strong>2</Strong>. Preemptions is <Strong>3</Strong>{" "}
            — the last timer found nowhere lower to go.
          </LI>
        </TryThis>
        <MlfqFigure />
        <Callout kind="insight">
          SHORT waited <Strong>1</Strong> — LONG&apos;s first quantum. LONG
          waited <Strong>1</Strong> — SHORT&apos;s burst. The scheduler never
          asked how long either job was. It watched who exhausted a slice.
        </Callout>
        <P>
          Cpu steps end at <Strong>9</Strong>, the same work either policy
          would do. Switches is <Strong>5</Strong>: LONG was dispatched four
          times, SHORT once.
        </P>
      </LessonSection>

      <LessonSection id="aging">
        <Lead>
          Demotion has no reverse gear. A job that sinks to Q2 stays there,
          and any new work in Q0 would skip it. That is{" "}
          <Term>starvation</Term>, and the fix is a timer.
        </Lead>
        <P>
          This pair is too small to starve: SHORT is done at t=2, so LONG
          gets the CPU. What aging changes is the classification. Every{" "}
          <Term>age every</Term> steps, everyone in Q1 and Q2 is boosted
          back to Q0. 0 means never.
        </P>
        <TryThis>
          <LI>
            Leave age-every at <Strong>4</Strong>. Step to t=4: LONG has
            just landed in Q2, then the caption reads &quot;Aging: everyone
            returns to Q0.&quot;
          </LI>
          <LI>
            Finish. A second boost at t=8 catches LONG on the CPU. It is
            done@9 in <Strong>Q0</Strong>. Demotions read <Strong>4</Strong>{" "}
            — it sank twice. SHORT is still done@2 in Q0.
          </LI>
          <LI>
            Drag to <Strong>0</Strong>: LONG ends in Q2 with 2 demotions,
            same as the figure above. Drag to <Strong>8</Strong>: still 2
            demotions, but LONG finishes in Q0 — the boost caught it after
            the Q2 slice. Drag to <Strong>12</Strong>: identical to 0. The
            run is 9 steps, so a period of 9 or more never fires.
          </LI>
        </TryThis>
        <MlfqAgingFigure />
        <Callout kind="warning">
          Aging did not make LONG finish earlier. Both runs end at t=9. What
          it reset is the queue. Without a boost, a CPU-bound job is a
          background job forever, and the next interactive arrival — which
          this model does not send — would run in front of it.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
