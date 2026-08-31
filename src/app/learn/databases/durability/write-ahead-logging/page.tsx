import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  PagesOnlyFigure,
  WriteAheadFigure,
} from "@/lessons/durability/write-ahead-logging-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("write-ahead-logging");

export default function WriteAheadLoggingPage() {
  return (
    <Lesson slug="write-ahead-logging">
      <LessonSection id="commit-promise">
        <Lead>
          Every lesson so far has treated a commit as the end of the story. It is
          not the end; it is a <Strong>promise</Strong>. And the machine can lose
          power one instruction after making it.
        </Lead>
        <P>
          A database does not read and write your disk directly. It keeps pages in
          a <Term>buffer pool</Term> in memory, changes them there, and writes them
          out later — because writing every changed page at every commit would mean
          scattered random I/O on the critical path of every transaction.
        </P>
        <P>
          That leaves an awkward question. If a commit does not write the pages,
          what exactly makes the promise true? And the obvious answer — write the
          pages at commit after all — does not even work in principle: a
          transaction that changed two pages cannot make both writes happen at
          once, so a crash between them leaves half a transaction on disk.
        </P>
      </LessonSection>

      <LessonSection id="without-a-log">
        <P>
          Below is the naive design, where the pages on disk are the only durable
          state there is. Eight operations: T1 changes two pages and commits, then
          T2 starts changing one of them and never finishes. The slider is not a
          size — it is <Strong>where the power fails</Strong>.
        </P>
        <TryThis>
          <LI>
            Start at 4. T1 was told it committed, and the disk holds{" "}
            <Strong>balance 150 with audit 0</Strong> — half of it.
          </LI>
          <LI>
            Now drag from 0 up to 7 and watch the verdict line. It is fine at 0, 1
            and 2, and wrong at every point after that.
          </LI>
          <LI>
            At 6, the balance on disk reads <Strong>90</Strong> — a value T2 never
            committed, sitting on top of a value T1 did.
          </LI>
        </TryThis>
        <PagesOnlyFigure />
        <P>
          Across the eight crash points, this policy loses acknowledged work at{" "}
          <Strong>five</Strong> of them. It is safe only at 0, 1 and 2, and for an
          uninteresting reason: nothing had been promised yet.
        </P>
        <P>
          The five failures are not one failure repeated. They come in three
          distinct shapes. Crash at 3 and the commit has vanished entirely — the
          disk still reads 100 and 0. Crash at 4 or 5 and it is{" "}
          <Term>torn</Term>: balance 150 and audit 0, so half of an atomic
          transaction survived. Crash at 6 or 7 and the balance holds{" "}
          <Strong>90</Strong>, a number no committed transaction ever produced.
        </P>
        <Callout kind="insight">
          The third shape is the worst, and it is the one people forget. Losing a
          commit is bad; having an uncommitted value take its place is worse,
          because nothing on this disk records what the value used to be. There is
          no information anywhere from which the old value could be restored.
        </Callout>
      </LessonSection>

      <LessonSection id="with-a-log">
        <P>
          Now the same eight operations, with one addition: before any page is
          changed in the pool, a record describing the change is appended to a{" "}
          <Term>log</Term> — the page, the value before, the value after. At
          commit, the log is forced to disk. The pages are not.
        </P>
        <TryThis>
          <LI>
            Step through the first write. The record appears above the durability
            line <Strong>before</Strong> the pool value moves. That order is the
            entire mechanism.
          </LI>
          <LI>
            Watch the commit. One <Term>fsync</Term> carries the records below the
            line, and only then is T1 told it succeeded — at which point{" "}
            <Strong>not one of its pages is on disk</Strong>.
          </LI>
          <LI>
            Now drag the crash point anywhere from 3 to 7. The disk ends at
            balance 150 and audit 1 every single time.
          </LI>
        </TryThis>
        <WriteAheadFigure />
        <P>
          Zero of the eight crash points lose acknowledged work. That is what
          durability actually claims — not that a crash is survivable at a
          convenient moment, but that the answer is the same at{" "}
          <Strong>every</Strong> moment.
        </P>
        <P>
          Look at what the commit cost. At the instant T1 reports success it has
          modified two pages, has written <Strong>zero</Strong> of them to disk,
          and has performed exactly <Strong>one</Strong> sequential force. The disk
          still reads balance 100 and audit 0 — and T1 is nonetheless fully
          recoverable, because the log knows how to get from here to there.
        </P>
        <P>
          Recovery does two passes over the forced log. <Term>Redo</Term> replays
          the changes of transactions whose commit record made it to disk;{" "}
          <Term>undo</Term> reverses the changes of those whose did not, using the
          before-image in each record. That is why the log stores both values.
        </P>
        <Callout kind="insight">
          Watch the <Strong>records applied</Strong> counter as you move the crash
          point. It reads 2 at crash 3 and 1 at crash 4 — one fewer, because by
          then the balance page had already reached disk on its own and redo skips
          a change that is already there. At crash 7 redo skips everything and undo
          does the whole repair, and the disk still ends correct. Recovery is
          idempotent: it may be interrupted and run again.
        </Callout>
      </LessonSection>

      <LessonSection id="the-ordering-rule">
        <Lead>
          The log is not the mechanism. The <Strong>order</Strong> is.
        </Lead>
        <P>
          Appending a record after changing the page would be useless: the
          before-image would already be gone, so undo would have nothing to write
          back. Appending it before is what makes the record trustworthy, and it is
          where the name comes from — the log is written <Term>ahead</Term> of the
          change it describes.
        </P>
        <P>
          The rule extends to disk. A page may not be written out while the records
          describing it are still in the volatile tail, because a crash would then
          leave a change on disk that the durable log cannot explain — and undo
          cannot reverse what it cannot see. So a flush that outruns the log forces
          the log first. In this run that costs one extra fsync, at crash point 6.
        </P>
        <P>
          This is the invariant the whole design rests on, and it holds on every
          frame of every crash point: no page&rsquo;s durable content is ever newer
          than the durable log prefix. Remove that force and recovery does not
          merely lose the rule — it loses T1&rsquo;s commit.
        </P>
        <Callout kind="warning">
          The counters make the trade explicit. Logging adds five log records and
          three forces on top of the same three page writes the naive policy did.
          In a run with no crash, that overhead buys nothing at all. It is
          insurance, and the premium is paid on every commit.
        </Callout>
        <P>
          Two bills are left unpaid here, and both are visible in the figure if you
          drag to the end. The log only grows, and recovery reads it from the
          start — so at crash 7 you can watch a <Term>checkpoint</Term> go by,
          forcing the dirty pages out. That operation is the subject of the next
          lesson, and it is what stops recovery time from growing with uptime.
        </P>
        <P>
          One honest boundary: at crash points 0, 1 and 2 the two policies produce
          identical disks. Before the first commit there is no promise outstanding,
          so there is nothing for a log to protect. Durability machinery earns its
          cost only from the moment something has been acknowledged.
        </P>
      </LessonSection>
    </Lesson>
  );
}
