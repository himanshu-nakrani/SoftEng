import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  InheritFigure,
  InvertedFigure,
} from "@/lessons/cpu-scheduling/priority-inversion-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("priority-inversion");

export default function PriorityInversionPage() {
  return (
    <Lesson slug="priority-inversion">
      <LessonSection id="the-lock">
        <Lead>
          A high-priority task can wait on a low-priority one — and then wait
          on a medium-priority one that never took the lock it needs.
        </Lead>
        <P>
          Three tasks, one CPU, one lock. <Term>L</Term> (burst{" "}
          <Strong>5</Strong>, prio 0) arrives at t=0 and takes the lock for
          its whole burst. <Term>H</Term> (burst <Strong>2</Strong>, prio 2)
          arrives at t=1 and needs that lock. <Term>M</Term> (burst{" "}
          <Strong>4</Strong>, prio 1) arrives at t=2 and does not. Higher
          number is more important. A priority scheduler always dispatches
          the runnable task with the highest number.{" "}
          <Term>blocked</Term> is not runnable.
        </P>
        <P>
          The arrivals are the Pathfinder shape, reduced to three bursts:
          Low at 0, High shortly after, Medium after that. That order is the
          whole setup. The scheduler does the rest. Waiting time is
          completion minus burst — the same definition as the last lesson. It
          does not subtract the arrival instant.
        </P>
      </LessonSection>

      <LessonSection id="inverted">
        <TryThis>
          <LI>
            Step until L is on the CPU. The lock line reads held by L.
          </LI>
          <LI>
            Keep stepping. H arrives (prio 2) and blocks on the lock held by
            L. The inversions meter goes to <Strong>1</Strong>. H is dashed
            and marked blocked.
          </LI>
          <LI>
            M arrives (prio 1) and preempts L. L still holds the lock,
            remaining 3/5. Preemptions reads <Strong>1</Strong>.
          </LI>
          <LI>
            Finish the run. M is done@6 (wait <Strong>2</Strong>), L is
            done@9 (wait <Strong>4</Strong>), H is done@11 (wait{" "}
            <Strong>9</Strong>).
          </LI>
        </TryThis>
        <InvertedFigure />
        <Callout kind="insight">
          High is the most important task, and it waited for both of the
          others. Medium never took the lock High needs. Medium ran because
          it outranked the lock holder, and High was not runnable. That is a{" "}
          <Term>priority inversion</Term>: the scheduler obeyed priority and
          still ran Medium over High.
        </Callout>
        <P>
          The cpu-steps meter ends at <Strong>11</Strong> — the same work
          either policy will do. Boosts stays at 0: nothing donated.
        </P>
      </LessonSection>

      <LessonSection id="inherit">
        <Lead>
          While High is blocked, run Low at High&apos;s priority. Medium is
          no longer the highest runnable.
        </Lead>
        <P>
          <Term>Priority inheritance</Term> changes one rule. While a
          higher-priority task is blocked on a lock, the holder runs at the
          waiter&apos;s priority. Low becomes as urgent as High until it
          releases.
        </P>
        <TryThis>
          <LI>
            Step until H blocks. Inversions goes to <Strong>1</Strong> and
            boosts goes to <Strong>1</Strong>. L&apos;s chip reads prio 0→2.
          </LI>
          <LI>
            M arrives. L is not preempted. Preemptions stays at{" "}
            <Strong>0</Strong>. L keeps the CPU at effective 2.
          </LI>
          <LI>
            Finish. L is done@5 (wait <Strong>0</Strong>), H is done@7 (wait{" "}
            <Strong>5</Strong>), M is done@11 (wait <Strong>7</Strong>).
          </LI>
        </TryThis>
        <InheritFigure />
        <Callout kind="insight">
          Inheritance does not stop High from blocking — inversions is still{" "}
          <Strong>1</Strong>. It stops Medium from stretching that wait.
          High&apos;s extra <Strong>4</Strong> steps of waiting without
          inheritance is Medium&apos;s whole burst.
        </Callout>
        <P>
          Same 11 cpu steps. H waits <Strong>5</Strong> instead of 9. L
          waits 0 instead of 4. Medium is the one that waits:{" "}
          <Strong>7</Strong> instead of 2.
        </P>
        <P>
          This model has one CPU, one lock, and Low holds it for the whole
          burst. Deliberately absent: nested locks, a priority ceiling, and a
          timeout. Those change how you bound the wait. They do not change
          the argument: a scheduler that does not donate lets Medium run over
          the lock holder, and High waits for both.
        </P>
      </LessonSection>
    </Lesson>
  );
}
