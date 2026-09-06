import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  CooperativeFigure,
  PreemptiveFigure,
} from "@/lessons/cpu-scheduling/preemptive-scheduling-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("preemptive-scheduling");

export default function PreemptiveSchedulingPage() {
  return (
    <Lesson slug="preemptive-scheduling">
      <LessonSection id="the-convoy">
        <Lead>
          A long burst at the head of a cooperative queue is a{" "}
          <Term>convoy</Term>. Every short burst behind it waits the whole
          thing out.
        </Lead>
        <P>
          Three tasks arrive together at t=0. <Term>A</Term> needs{" "}
          <Strong>8</Strong> CPU steps; <Term>B</Term> and <Term>C</Term> need{" "}
          <Strong>2</Strong> each. The ready queue is FIFO, so A runs first.
          Waiting time is completion minus burst — everyone arrived at the
          same instant, so a wait of 8 means sitting idle for A&apos;s entire
          run.
        </P>
        <P>
          <Term>Cooperative</Term> scheduling means the occupant keeps the CPU
          until it yields. Here that means until the burst ends. There is no
          timer. The kernel cannot take the processor back. That is a policy,
          not a hardware limit.
        </P>
      </LessonSection>

      <LessonSection id="cooperative">
        <TryThis>
          <LI>
            Step until A is on the CPU. B and C sit dashed in READY, remaining
            2/2.
          </LI>
          <LI>
            Keep stepping. A does not leave until remaining hits 0, at{" "}
            <Strong>t=8</Strong>. The preemptions meter stays at{" "}
            <Strong>0</Strong>.
          </LI>
          <LI>
            Read the chips: B is done@10, C is done@12. B waited{" "}
            <Strong>8</Strong>; C waited <Strong>10</Strong>. A waited{" "}
            <Strong>0</Strong>.
          </LI>
        </TryThis>
        <CooperativeFigure />
        <Callout kind="insight">
          The short work paid for being second. B waited <Strong>8</Strong> —
          the whole of A&apos;s burst — and C waited <Strong>10</Strong>. Zero
          preemptions is the mechanism: nothing interrupted A, so the queue
          behind it did not move.
        </Callout>
        <P>
          The cpu-steps meter ends at <Strong>12</Strong> — the same work
          either policy will do. Switches is <Strong>3</Strong>: one dispatch
          each.
        </P>
      </LessonSection>

      <LessonSection id="preemptive">
        <P>
          A timer changes the rule. After at most <Term>quantum</Term> steps,
          if anyone else is ready, the occupant is requeued and the next head
          is dispatched. That interruption is a <Term>preemption</Term>.
        </P>
        <TryThis>
          <LI>
            Leave quantum at <Strong>1</Strong>. Step until the first timer:
            A is requeued with remaining 7, and B is dispatched.
          </LI>
          <LI>
            Finish the run. B is done@5 (wait <Strong>3</Strong>), C is
            done@6 (wait <Strong>4</Strong>), A is done@12 (wait{" "}
            <Strong>4</Strong>). Preemptions reads <Strong>4</Strong>.
          </LI>
          <LI>
            Drag quantum to <Strong>2</Strong>. B now waits <Strong>2</Strong>{" "}
            — it ran its whole burst on first dispatch. Then drag to{" "}
            <Strong>8</Strong>: B waits <Strong>8</Strong> again, and
            preemptions is 0. The timer never fired.
          </LI>
        </TryThis>
        <PreemptiveFigure />
        <P>
          At quantum 1, A waits <Strong>4</Strong>, B waits <Strong>3</Strong>,
          C waits <Strong>4</Strong>. Four preemptions. The same 12 steps of
          work, <Strong>7</Strong> switches instead of 3.
        </P>
        <P>
          A shorter slice is not automatically kinder to B. At quantum 1, B is
          itself cut after one step and waits for C, so B waits 3. At quantum
          2, B runs to completion on its first dispatch and waits{" "}
          <Strong>2</Strong>.
        </P>
        <Callout kind="insight">
          Drag to 8. B waits 8 again, preemptions 0, A waits 0. A quantum as
          large as the long burst is cooperative in disguise: the timer never
          fires before A is done, so the two policies produce the same waits.
        </Callout>
        <P>
          This model has no I/O, no late arrivals, and no shortest-job-first.
          SJF would also let B in, but only by knowing the bursts in advance.
          A timer does not need to know. It just refuses to let anyone keep
          the CPU forever.
        </P>
      </LessonSection>
    </Lesson>
  );
}
