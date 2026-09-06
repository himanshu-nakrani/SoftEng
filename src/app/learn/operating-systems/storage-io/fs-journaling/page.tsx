import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  JournaledFigure,
  UnorderedFigure,
} from "@/lessons/storage-io/fs-journaling-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("fs-journaling");

export default function FsJournalingPage() {
  return (
    <Lesson slug="fs-journaling">
      <LessonSection id="the-gap">
        <Lead>
          Creating a file is two disk writes: the data block, then the{" "}
          <Term>inode</Term> that names it. Those writes are not atomic. Power
          can fail after the first.
        </Lead>
        <P>
          An inode is a list of blocks. To create a file you allocate a free
          block, write the bytes into it, then write the inode so it points at
          that block. A crash between those two writes is the gap this lesson
          is about.
        </P>
        <P>
          The safer order is data first. If the inode is written and the data
          is not, the name points at leftover bytes — a corrupt file. If the
          data is written and the inode is not, you leak a block the inode
          does not name: an <Term>orphan</Term>. This figure writes data first,
          so the crash it shows is the orphan. It does not journal the data.
        </P>
      </LessonSection>

      <LessonSection id="unordered">
        <P>
          Below is the naive create: write block 0, then write the inode. No
          log. The slider is not a size — it is{" "}
          <Strong>where the power fails</Strong>.
        </P>
        <TryThis>
          <LI>
            Leave the crash at <Strong>1</Strong>. Data on disk is{" "}
            <Strong>b0</Strong>, the inode is empty. Step past the crash: the
            verdict is an orphan.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. Both writes completed. The inode names
            0, and the verdict is consistent.
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. Nothing reached disk. The only crash
            that is safe, and only because nothing had been written yet.
          </LI>
        </TryThis>
        <UnorderedFigure />
        <P>
          Across the three crash points, this policy orphans at{" "}
          <Strong>one</Strong> of them — crash 1. Crash 0 has nothing to leak;
          crash 2 already wrote the inode. There is no recovery pass. Journal
          writes and journal forces stay at <Strong>0</Strong>.
        </P>
        <Callout kind="insight">
          The orphan is a leaked block, not a corrupt file. The name was never
          published. That is the better of the two gaps — and it is still a
          gap.
        </Callout>
      </LessonSection>

      <LessonSection id="journaled">
        <P>
          The same create, with one addition: the inode change is appended to
          a <Term>journal</Term> and <Term>forced</Term> to disk before the
          inode itself is written. Four operations: data, append, force, inode.
          The data block is still written in place. Only the metadata change
          is logged.
        </P>
        <TryThis>
          <LI>
            Leave the crash at <Strong>3</Strong>. Step through the force —
            the inode is still empty — then the crash. Keep stepping: recovery
            replays the forced record and the inode names <Strong>0</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. The journal chip is hollow (unforced).
            Recovery does not run. Still an orphan. Appended is not durable.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>: data is on disk, the journal is empty,
            still an orphan — this model does not journal data. Then drag to{" "}
            <Strong>4</Strong>: the inode write itself completed before the
            crash, and the file is already consistent.
          </LI>
        </TryThis>
        <JournaledFigure />
        <P>
          At crash 3 the inode has not been written — inode writes at the crash
          is <Strong>0</Strong> — and recovery still names block 0. One
          sequential force made the name durable. The inode write is no longer
          the durability point; the force is.
        </P>
        <Callout kind="insight">
          This is WAL&apos;s ordering rule applied to an inode. A record that
          has been appended but not forced cannot be replayed, which is why
          crash 2 still orphans. A record that has been forced can, which is
          why crash 3 does not.
        </Callout>
        <Callout kind="warning">
          The data block is never in the journal. Crash 1 orphans under both
          policies, because the bytes reached disk and the name did not, and
          there is no log record of either. Checksums, delayed allocation, and
          data journaling are absent: they change what the orphan costs, not
          the ordering argument.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
