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
import {
  FencedFigure,
  StoreBufferFigure,
} from "@/lessons/shared-state/memory-visibility-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("memory-visibility");

export default function MemoryVisibilityPage() {
  return (
    <Lesson slug="memory-visibility">
      <LessonSection id="writes-take-time">
        <Lead>
          Every lesson so far assumed a write is instantly visible to everyone.
          On real hardware it is not. A store lands in a buffer near your core and
          becomes visible to other threads later.
        </Lead>
        <P>
          The reason is speed: waiting for a write to reach shared memory would
          stall the processor on every assignment, so the store goes into a{" "}
          <Term>store buffer</Term> and execution continues. Correct for one
          thread — it reads its own buffer — and a different world entirely for a
          second thread, which sees only what has been published.
        </P>
        <P>
          The consequence is that two threads can disagree about the{" "}
          <Strong>order</Strong> things happened in, without any instruction
          having been moved. Nothing here is a data race: each variable is written
          by exactly one thread. Locks are not the answer, because there is
          nothing to exclude.
        </P>
      </LessonSection>

      <LessonSection id="both-miss">
        <P>
          The test below is the classic one. Each thread writes its own variable,
          then reads the other&apos;s. If writes were immediate, at least one
          thread would have to see the other&apos;s — whoever wrote second cannot
          miss the write that came first.
        </P>
        <TryThis>
          <LI>
            Step through and watch a write land in <Term>buf_x</Term> while{" "}
            <Term>x</Term> itself stays 0.
          </LI>
          <LI>
            Read <Term>r1</Term> and <Term>r2</Term> at the end. Shuffle until{" "}
            <Strong>both are 0</Strong> — roughly one run in three.
          </LI>
          <LI>
            Step backward from that ending and find the moment: both reads
            happened before either flush.
          </LI>
        </TryThis>
        <StoreBufferFigure />
        <Callout kind="insight">
          Both threads read zero, so each concludes it went first. There is no
          global order of events they would both agree on — and no line of code
          you could point at as the bug. The program is wrong about{" "}
          <Strong>visibility</Strong>, not about exclusion.
        </Callout>
      </LessonSection>

      <LessonSection id="fences">
        <P>
          A <Term>memory fence</Term> (a barrier) forces the buffer to drain
          before the thread continues. The store stops being a private note and
          becomes a published fact, at a point you chose.
        </P>
        <FencedFigure />
        <P>
          Across two hundred seeds, both reads never come back zero. That is the
          guarantee a fence buys: not speed, not exclusion, but an{" "}
          <Strong>ordering everyone agrees on</Strong>.
        </P>
        <Callout kind="warning">
          You rarely write fences by hand. They are what a mutex, an atomic, or a{" "}
          <Term>volatile</Term>/<Term>Atomic</Term> declaration inserts for you —
          which is the real reason those tools fix bugs that look nothing like
          races. It also means removing a lock from code that &ldquo;does not need
          exclusion&rdquo; can break it: you did not just remove exclusion, you
          removed the ordering that came with it.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
