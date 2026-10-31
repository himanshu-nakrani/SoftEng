import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  WriteBackFigure,
  WriteThroughFigure,
} from "@/lessons/storage-io/buffer-cache-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("buffer-cache");

export default function BufferCachePage() {
  return (
    <Lesson slug="buffer-cache">
      <LessonSection id="dirty-pages">
        <Lead>
          A <Term>write()</Term> that already returned success can still
          vanish. The bytes are in RAM. Disk has not moved.
        </Lead>
        <P>
          The last lesson forced a journal so a name could survive a crash.
          This one is about the bytes themselves. The kernel does not write
          your file to disk on every <Term>write()</Term>. It copies them
          into the <Term>buffer cache</Term> — pages in memory — and
          returns. The caller has been acknowledged. The disk has not
          moved.
        </P>
        <P>
          A page whose cache value disagrees with disk is <Term>dirty</Term>.{" "}
          <Term>write-back</Term> leaves it that way until{" "}
          <Term>fsync</Term> (or a background flush this figure does not
          have). <Term>write-through</Term> writes disk on every{" "}
          <Term>write()</Term>, so the cache is a copy, not a delay.
        </P>
        <P>
          Two pages, <Term>a</Term> and <Term>b</Term>, both start at{" "}
          <Strong>0</Strong>. Three operations: write a=1, write b=2,{" "}
          <Term>fsync</Term>. The slider is not a size — it is{" "}
          <Strong>where the power fails</Strong>.
        </P>
      </LessonSection>

      <LessonSection id="write-back">
        <P>
          Below is write-back. A write dirties the cache. Only fsync talks
          to disk. Crash anywhere before that force and the dirty pages
          revert.
        </P>
        <TryThis>
          <LI>
            Leave the crash at <Strong>2</Strong>. Step: write a=1 in cache
            (dirty), disk still 0. Then b=2. Stamp reads{" "}
            <Strong>2 dirty</Strong>. Disk chips still a 0 and b 0. Cache
            writes <Strong>2</Strong>, disk writes <Strong>0</Strong>.
          </LI>
          <LI>
            Step into the crash. Stamp flips to <Strong>2 lost</Strong>.
            Both pages revert to 0. The last caption:{" "}
            <Strong>2 acknowledged writes never reached disk</Strong>.
          </LI>
          <LI>
            Drag to <Strong>3</Strong>. fsync first: every dirty page hits
            disk, disk writes <Strong>2</Strong>, disk a=1 b=2. Then the
            crash: <Strong>0 lost</Strong>.
          </LI>
        </TryThis>
        <WriteBackFigure />
        <P>
          Drag to <Strong>1</Strong>: one dirty page, lost{" "}
          <Strong>1</Strong>, disk still 0. Drag to <Strong>0</Strong>:
          nothing had been written, so there is nothing to lose. Across the
          four crash points, write-back loses acknowledged work at{" "}
          <Strong>two</Strong> of them — 1 and 2.
        </P>
        <Callout kind="insight">
          The kernel already told the caller both writes succeeded. That is
          the loss window: acknowledged writes still only in RAM.
        </Callout>
      </LessonSection>

      <LessonSection id="write-through">
        <P>
          Same two writes, same crash. Every write is a disk write. The
          cache is a copy, not a delay.
        </P>
        <TryThis>
          <LI>
            Leave the crash at <Strong>2</Strong>. Each write goes through:
            write a=1 through to disk, then b=2. Stamp stays{" "}
            <Strong>cache = disk</Strong>. lost <Strong>0</Strong>, disk
            writes <Strong>2</Strong>, disk a=1 b=2.
          </LI>
          <LI>
            Compare write-back at the same crash: lost <Strong>2</Strong>,
            disk writes <Strong>0</Strong>, disk still 0. Cache writes{" "}
            <Strong>2</Strong> either way.
          </LI>
          <LI>
            Drag to <Strong>3</Strong>. fsync runs against a clean cache;
            disk writes stays <Strong>2</Strong>. The force was already
            paid, one disk write per write().
          </LI>
        </TryThis>
        <WriteThroughFigure />
        <P>
          Write-through loses at <Strong>none</Strong> of the four crash
          points. Crash 2 write-through already matches crash 3 write-back:
          lost 0, disk writes 2, disk a=1 b=2. The difference is when those
          two disk writes happened — on each write(), not at fsync.
        </P>
        <Callout kind="insight">
          Write-through closed the window by paying a disk write on every{" "}
          write(). Write-back pays at fsync — or never, if power fails
          first.
        </Callout>
        <Callout kind="warning">
          No background flusher, no page replacement. A real kernel writes
          dirty pages back over time; fsync is the explicit force. This
          figure is the window, not the whole cache.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
