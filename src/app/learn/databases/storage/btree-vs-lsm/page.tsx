import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { BtreeFigure, LsmFigure } from "@/lessons/storage/btree-vs-lsm-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("btree-vs-lsm");

export default function BtreeVsLsmPage() {
  return (
    <Lesson slug="btree-vs-lsm">
      <LessonSection id="pages-in-place">
        <Lead>
          A commit that reached disk is durable. That does not say how many
          pages the write touched on the way. This lesson is about that
          number — <Term>write amplification</Term> and{" "}
          <Term>read amplification</Term> — measured on two engines given the
          same keys.
        </Lead>
        <P>
          A <Term>B-tree</Term> keeps keys in sorted leaves and updates them
          in place. Changing one key rewrites the whole leaf that holds it.
          An <Term>LSM tree</Term> never updates a page in place: it appends
          to a memtable, flushes that buffer as a new sorted run, and later
          compacting merges runs so a read does not have to search all of
          them.
        </P>
        <P>
          Both figures write the same alphabet (<Strong>a</Strong> through
          however many keys you set), then read the first key, a middle key,
          the last key, and <Strong>z</Strong>, which is never present. The
          slider is how many keys are written. Four, eight, and twelve are
          the interesting stops: one flush, two flushes, and a compaction.
        </P>
      </LessonSection>

      <LessonSection id="btree">
        <TryThis>
          <LI>
            Leave the slider at <Strong>8</Strong>. Step through. Every write
            lights the root and one leaf, and the leaf is rewritten whole.
          </LI>
          <LI>
            At the end, page writes read <Strong>8</Strong> and page reads
            read <Strong>24</Strong> — height two, paid on each of eight
            writes and four reads.
          </LI>
          <LI>
            The last read is <Strong>z</Strong>. It still walks the tree. A
            miss costs the same height as a hit.
          </LI>
        </TryThis>
        <BtreeFigure />
        <Callout kind="insight">
          Eight logical writes became eight leaf rewrites. The B-tree did not
          write eight keys; it wrote eight <Strong>pages</Strong>, each
          because one key inside it changed. That ratio is write
          amplification as in-place update, and it does not wait for a
          compaction to show up.
        </Callout>
      </LessonSection>

      <LessonSection id="lsm">
        <TryThis>
          <LI>
            Same eight keys. Writes fill a memtable of four, then flush.
            Nothing is a page write until that flush.
          </LI>
          <LI>
            At eight keys the meters read <Strong>2</Strong> page writes,{" "}
            <Strong>3</Strong> page reads, <Strong>4</Strong> bloom misses,
            and no compaction. Two runs sit on disk; a miss for{" "}
            <Strong>z</Strong> skips both.
          </LI>
          <LI>
            Drag to <Strong>12</Strong>. A third flush triggers a compaction:
            three runs merge into one, page writes become <Strong>4</Strong>,
            page reads <Strong>6</Strong>, one compaction.
          </LI>
        </TryThis>
        <LsmFigure />
        <Callout kind="insight">
          The same eight writes cost <Strong>two</Strong> page writes instead
          of eight, because the memtable absorbed them until it filled. The
          read path paid bloom skips instead of a constant height:{" "}
          <Strong>z</Strong> touched no page at all. Compaction is the bill
          coming due — at twelve keys it is the first time the LSM rewrites
          data it already flushed.
        </Callout>
      </LessonSection>

      <LessonSection id="amplification">
        <Lead>
          Amplification is a ratio, and the two engines put the cost in
          different places.
        </Lead>
        <P>
          At eight keys the B-tree&apos;s write amplification is{" "}
          <Strong>8 page writes / 8 keys</Strong>. The LSM&apos;s is{" "}
          <Strong>2 / 8</Strong>. At twelve keys the LSM has compacted, so
          the ratio rises to <Strong>4 / 12</Strong> — still a third of the
          B-tree&apos;s twelve leaf rewrites, and the extra two writes are
          the compaction: three runs read, one run written.
        </P>
        <P>
          Reads invert. The B-tree always pays height two,{" "}
          <Strong>24</Strong> page reads at eight keys (writes and reads
          together) and <Strong>32</Strong> at twelve. The LSM at eight keys
          reads <Strong>3</Strong> pages and skips <Strong>4</Strong> runs
          with the bloom filter; after compaction a miss is one skip and a
          hit is one page. An LSM read is cheap while runs are few and the
          bloom is honest. A B-tree read is a constant, including for keys
          that are not there.
        </P>
        <P>
          Real engines add bloom false positives, a buffer cache, and
          leveled compaction. Those move the numbers. They do not move the
          shape: in-place update pays per write, log-structured update pays
          at flush and compaction, and a later read pays for however many
          runs you have not merged yet.
        </P>
      </LessonSection>
    </Lesson>
  );
}
