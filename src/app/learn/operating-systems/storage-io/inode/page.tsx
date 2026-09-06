import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  InodeDirectFigure,
  InodeIndirectFigure,
} from "@/lessons/storage-io/inode-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("inode");

export default function InodePage() {
  return (
    <Lesson slug="inode">
      <LessonSection id="pointers">
        <Lead>
          A file looks like a stream of bytes. On disk it is a list of
          blocks, and the list lives in a small, fixed record: the{" "}
          <Term>inode</Term>.
        </Lead>
        <P>
          A directory entry stores a name and an inode number. The inode
          stores the metadata — size, owner, timestamps — and the map from
          file offset to disk block. That map is the whole lesson. The
          inode cannot grow a pointer for every block of a huge file,
          because the inode itself is a fixed-size structure.
        </P>
        <P>
          This inode has <Strong>4</Strong> <Term>direct pointers</Term>.
          Each names one data block from inside the inode. Past that, one{" "}
          <Term>indirect block</Term> holds <Strong>4</Strong> more
          pointers. Eight blocks is as far as this model goes.
        </P>
        <P>
          To read block 0: consult the inode, follow <Term>d0</Term>, read
          the data. Two I/Os. To read block 4: consult the inode, follow
          the indirect pointer to a pointer block, then follow{" "}
          <Term>i0</Term> to the data. Three I/Os. The extra read is not
          the data. It is the name of the data, which no longer fits in the
          inode.
        </P>
      </LessonSection>

      <LessonSection id="direct">
        <TryThis>
          <LI>
            Leave file blocks at <Strong>4</Strong>. The stamp says{" "}
            <Strong>4 blocks · direct 4</Strong>. The four direct chips
            already name 0 through 3; the four indirect chips are hollow.
          </LI>
          <LI>
            Step. Block 0 lights d0 and b0. Then d1, d2, d3. Each caption
            is &quot;Read block N via direct pointer dN.&quot;
          </LI>
          <LI>
            Meters stop at <Strong>4</Strong> inode reads,{" "}
            <Strong>4</Strong> data reads, <Strong>0</Strong> pointer
            reads. The pointer-reads meter never left 0.
          </LI>
        </TryThis>
        <InodeDirectFigure />
        <Callout kind="insight">
          A file that fits in the direct pointers never paid for a pointer
          block. Four data blocks, four inode lookups, zero extra reads.
        </Callout>
        <P>
          Drag to <Strong>1</Strong>, <Strong>2</Strong>, or{" "}
          <Strong>3</Strong>. Pointer reads stay <Strong>0</Strong>. inode
          reads and data reads equal the file size. The extra I/O is not
          &quot;the file is bigger.&quot; It starts when a block&apos;s
          name no longer lives in the inode.
        </P>
      </LessonSection>

      <LessonSection id="indirect">
        <Lead>
          Block 4 has nowhere to live among the four direct pointers. Its
          name sits in an extra block of pointers, and fetching that name
          is a disk read that block 0 never needed.
        </Lead>
        <TryThis>
          <LI>
            Leave file blocks at <Strong>5</Strong>. Slot i0 already names
            4; i1–i3 stay hollow.
          </LI>
          <LI>
            Step the first four blocks. After d3 the meters still read{" "}
            <Strong>4</Strong>, <Strong>4</Strong>, and <Strong>0</Strong>.
            The stamp is still <Strong>5 blocks · direct 4</Strong>.
          </LI>
          <LI>
            One more step. Block 4 lights i0 and b4. The stamp flips to{" "}
            <Strong>1 pointer read</Strong>. Meters: <Strong>5</Strong>{" "}
            inode reads, <Strong>5</Strong> data reads, <Strong>1</Strong>{" "}
            pointer read.
          </LI>
          <LI>
            Drag to <Strong>8</Strong>. Four pointer reads, eight data
            reads, eight inode reads. Each block past d3 paid the extra
            lookup.
          </LI>
        </TryThis>
        <InodeIndirectFigure />
        <Callout kind="insight">
          The fifth block did not cost one more data read. It cost a
          pointer read <Strong>and</Strong> a data read. Eight blocks cost
          four pointer reads — one per indirect data block. The
          pointer-reads meter: <Strong>0</Strong> at 4, <Strong>1</Strong>{" "}
          at 5, <Strong>4</Strong> at 8.
        </Callout>
        <P>
          A real kernel would cache the inode and, after the first fetch,
          the indirect block. This figure does not. It walks the path on
          every block, the same way address translation walked two tables
          on every VPN until a TLB existed. The number that moves at the
          boundary is the pointer-reads meter.
        </P>
        <P>
          Absent: double-indirect, triple-indirect, extents. A Unix inode
          typically has twelve direct pointers plus single, double, and
          triple indirect, so a file can be much larger. Those extra levels
          change how many pointer blocks you walk, not that you walk them.
          Directories as inodes of their own are the next lesson&apos;s
          setup: a directory is a file whose data blocks name other inodes,
          and a crash between writing a data block and updating the inode
          is how you orphan a file.
        </P>
        <Callout kind="warning">
          Do not read four pointer reads as four separate trips for the
          same indirect block. The figure is the access path — inode, then
          pointer slot, then data — charged once per block, with no cache.
          A kernel that kept the indirect block in memory after the first
          fetch would still have paid the extra read the moment the file
          left the direct range. That is the load-bearing fact.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
