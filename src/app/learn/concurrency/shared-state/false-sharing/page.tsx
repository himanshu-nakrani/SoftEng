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
  FalseSharingFigure,
  PaddedFigure,
} from "@/lessons/shared-state/false-sharing-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("false-sharing");

export default function FalseSharingPage() {
  return (
    <Lesson slug="false-sharing">
      <LessonSection id="nothing-is-shared">
        <Lead>
          Two threads. Two separate counters. Neither reads the other&apos;s. No
          lock, no race, nothing to synchronise — and they still slow each other
          down, because the two variables sit close together in memory.
        </Lead>
        <P>
          Caches do not track individual variables. They work in{" "}
          <Term>cache lines</Term> — typically 64 bytes — and a core that wants to
          write must hold the whole line exclusively. Two variables in the same
          line cannot be written by two cores at once, no matter how unrelated
          they are.
        </P>
        <P>
          So the line ping-pongs. Each time the threads alternate, one core takes
          ownership back from the other, and the write has to be redone. That is{" "}
          <Term>false sharing</Term>: contention with no shared data, invisible in
          the source, and undetectable by any reasoning about locks.
        </P>
      </LessonSection>

      <LessonSection id="the-ping-pong">
        <TryThis>
          <LI>
            Step through and watch <Term>line</Term> flip between 1 and 2 — that is
            ownership moving between cores.
          </LI>
          <LI>
            Every flip costs a <Term>line transfer</Term>: the write is refused,
            ownership is taken, and the write runs again.
          </LI>
          <LI>
            Shuffle a few times. Six useful writes cost anywhere from 2 to 16
            transfers depending purely on how the run interleaved.
          </LI>
        </TryThis>
        <FalseSharingFigure />
        <Callout kind="insight">
          The counters are correct in every run — this is not a correctness bug,
          which is exactly why it survives review and testing. It shows up as a
          program that refuses to get faster when you add threads, and the source
          offers no clue, because the defect is in the <Strong>layout</Strong>, not
          the logic.
        </Callout>
      </LessonSection>

      <LessonSection id="padding">
        <P>
          The fix is not synchronisation — there is nothing to synchronise. It is{" "}
          <Term>padding</Term>: push the two variables far enough apart that they
          land on different lines. Then each core claims its own line once and
          keeps it.
        </P>
        <PaddedFigure />
        <P>
          Transfers drop to exactly <Strong>two</Strong> — one initial claim per
          thread — and stay there however the run interleaves. Same six writes; at
          the default seed the shared version needed 10 transfers and 16
          operations against 2 and 8 here.
        </P>
        <Callout kind="warning">
          Padding trades memory for throughput, and it is easy to apply
          superstitiously. Two things make it worth doing: the variables are{" "}
          <Strong>written</Strong> often by different threads (shared reads are
          free — many cores may hold a line for reading), and you have measured a
          real stall. The usual culprits are adjacent fields in one struct, and
          arrays indexed per thread, where <Term>counters[0]</Term> and{" "}
          <Term>counters[1]</Term> are neighbours by construction.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
