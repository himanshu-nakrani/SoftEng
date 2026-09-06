import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { TlbFigure, TlbNoneFigure } from "@/lessons/virtual-memory/tlb-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("tlb");

export default function TlbPage() {
  return (
    <Lesson slug="tlb">
      <LessonSection id="the-walk-is-slow">
        <Lead>
          A translation is not an adder. It is two memory references, paid
          again even when the page has not changed.
        </Lead>
        <P>
          A virtual page number here is 4 bits, split into a 2-bit directory
          index and a 2-bit table index. Translating <Term>VPN 0</Term> reads{" "}
          <Strong>directory[0]</Strong>, then <Strong>table[0]</Strong>. That
          costs <Strong>2</Strong> table refs — one per level. The walk is
          the same on the second access, and the third.
          Three translations of the same page cost <Strong>6</Strong> table
          refs. Eight cost <Strong>16</Strong>.
        </P>
        <P>
          The page tables live in memory. Two extra loads on the path of
          every load is why a kernel does not walk on every instruction, and
          why the next section exists.
        </P>
      </LessonSection>

      <LessonSection id="tlb-hits">
        <P>
          A <Term>TLB</Term> — translation lookaside buffer — is a small
          fully-associative FIFO of recent VPN→PFN mappings. A hit returns
          the frame and skips the walk. A miss walks, then fills an entry.
          Both figures repeat VPN 0; the slider is how many times. The only
          difference is whether the cache exists.
        </P>
        <TryThis>
          <LI>
            Leave repeated accesses at <Strong>8</Strong> on the figure with
            no TLB. Every access lights the directory and the table. Table
            refs land on <Strong>16</Strong>. Hits and misses stay at 0 —
            there is no cache, so there is nothing to hit.
          </LI>
          <LI>
            Same eight on the TLB of 4. Step the first two: a walk, then a
            hit. The table row says <Strong>walk skipped</Strong>. Skip to
            the end: <Strong>7</Strong> hits, <Strong>1</Strong> miss, table
            refs still <Strong>2</Strong>.
          </LI>
          <LI>
            Drag both to <Strong>3</Strong>. Without a TLB the table refs
            drop to <Strong>6</Strong>. With one: <Strong>1</Strong> miss,{" "}
            <Strong>2</Strong> hits, still <Strong>2</Strong> table refs.
          </LI>
        </TryThis>
        <TlbNoneFigure />
        <TlbFigure />
        <Callout kind="insight">
          A hit is not a cheaper walk. It is no walk. Eight translations of
          one page cost sixteen table references without a TLB, and two with
          one — the two that filled the entry.
        </Callout>
        <P>
          The cache also has to be large enough to hold the pages you are
          looping over. A one-entry TLB and a two-page loop of eight
          accesses still cost <Strong>16</Strong> table refs: FIFO evicts
          the other page on every miss, so the hit counter never leaves 0.
          That run is not on the slider; it is the same producer,{" "}
          <Term>tlbSize 1</Term>, accesses 0,1,0,1,0,1,0,1.
        </P>
      </LessonSection>

      <LessonSection id="flush-on-switch">
        <Lead>
          Those seven hits belong to one address space. A switch, on this
          hardware, would throw them away — and this figure will not.
        </Lead>
        <P>
          The TLB here is tagged by VPN only. VPN 0 in the next process is a
          different page, in a different table. A kernel that cannot tell
          the entries apart must <Term>flush</Term> the whole buffer on a
          context switch, or it would translate with the previous
          process&apos;s frames.
        </P>
        <P>
          This producer does not model that flush. There is no{" "}
          <Term>ASID</Term> (address-space id) and no switch. If you imagine
          one in the middle of the eight hits, the figure will keep hitting
          anyway. After a real flush the next access of VPN 0 is a miss
          again: the same two table refs, then hits once the entry is
          refilled. The working set you just cached is gone because the
          process that owned it is gone.
        </P>
        <P>
          ASIDs (PCIDs on x86) exist so entries from different address
          spaces can coexist, and a switch need not empty the buffer. They
          are absent here on purpose: they change how often you flush, not
          the fact that a hit is not a walk. Real TLBs are also
          set-associative rather than fully-associative FIFO; that changes
          conflict misses, not the argument.
        </P>
        <Callout kind="warning">
          Do not read the seven hits as surviving a switch. The figure
          cannot empty itself. The next lesson is what happens when the
          translation is not in the tables either — a miss is still a hit
          in the page tables; a fault is not.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
