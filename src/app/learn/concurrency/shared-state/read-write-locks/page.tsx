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
  MutexFigure,
  RwLockFigure,
} from "@/lessons/shared-state/read-write-locks-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("read-write-locks");

export default function ReadWriteLocksPage() {
  return (
    <Lesson slug="read-write-locks">
      <LessonSection id="too-strong">
        <Lead>
          Mutual exclusion is stronger than most workloads need. Two threads that
          only <Strong>read</Strong> cannot corrupt anything — excluding them from
          each other buys nothing and costs contention.
        </Lead>
        <P>
          The asymmetry is the whole opportunity. Readers conflict with writers
          and writers conflict with everyone, but readers do not conflict with
          each other. A <Term>read-write lock</Term> encodes exactly that: many
          threads may hold it in <Term>shared</Term> mode, only one in{" "}
          <Term>exclusive</Term> mode, and never both at once.
        </P>
        <P>
          There is no magic in it. It is a small protocol over ordinary shared
          state — a count of current readers and a flag for the writer — with each
          side waiting on the other&apos;s condition. The figure shows that
          mechanism rather than hiding it behind a name, because the mechanism is
          the part worth understanding.
        </P>
      </LessonSection>

      <LessonSection id="sharing-reads">
        <TryThis>
          <LI>
            Step through and watch the <Term>readers</Term> count climb past one —
            several readers are inside simultaneously.
          </LI>
          <LI>
            Find the writer <Term>waiting for an empty room</Term>. It cannot
            enter until every reader has left.
          </LI>
          <LI>
            Raise <Strong>readers</Strong> from 2 to 5. Blocked turns barely move.
          </LI>
        </TryThis>
        <RwLockFigure />
        <Callout kind="insight">
          Adding readers adds almost no blocking — it stays around 1.5 turns
          whether there are two readers or five — because the only real conflict
          in the room is with the single writer. The reader count reaching the
          full population is the proof that sharing is actually happening.
        </Callout>
      </LessonSection>

      <LessonSection id="what-it-costs">
        <P>
          Run the same threads under one exclusive lock and the flat line becomes
          a curve: blocked turns go 3, 6, 10, 15 as readers go 2, 3, 4, 5 — every
          pair of threads meeting once again, because now every pair genuinely
          conflicts.
        </P>
        <MutexFigure />
        <P>
          Same work, same correctness, six times the blocking at three readers.
          The mutex is not wrong — it is just answering a stronger question than
          the workload asked.
        </P>
        <Callout kind="warning">
          Two costs the figure understates. The protocol is more state to get
          right: a reader that forgets to decrement the count locks out writers
          forever. And a steady stream of readers can keep the room permanently
          occupied, so the writer never sees it empty — <Term>writer
          starvation</Term>. Real implementations add a policy for that, usually
          by making new readers queue behind a waiting writer, which trades some
          read throughput for a bound on write latency.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
