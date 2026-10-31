import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { PageFaultsFigure } from "@/lessons/virtual-memory/page-faults-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("page-faults");

export default function PageFaultsPage() {
  return (
    <Lesson slug="page-faults">
      <LessonSection id="not-present">
        <Lead>
          A page-table entry can refuse to name a frame. Demand paging starts
          every PTE that way, so a process can own an address space that RAM
          has not paid for yet.
        </Lead>
        <P>
          Address translation walked two levels and trusted the{" "}
          <Term>PTE</Term> it found. That entry has a <Term>present</Term>{" "}
          bit. When the bit is clear, there is no physical address to form —
          the hardware raises a <Term>page fault</Term> instead of completing
          the load. <Term>Demand paging</Term> is the policy of leaving every
          PTE invalid until someone actually touches the page, then allocating
          a frame and reading the page from disk.
        </P>
        <P>
          Sixteen virtual pages, four frames. At the opening frame the frames
          are empty, the directory chips are hollow, and the table row says
          not walked. The process already &quot;has&quot; an address space.
          Memory does not hold any of it.
        </P>
      </LessonSection>

      <LessonSection id="first-touch">
        <TryThis>
          <LI>
            Leave unique pages at <Strong>2</Strong>. The trace is VPN{" "}
            <Strong>0, 1, 0</Strong>. Step: walk 0 (dashed PTE), fault into
            free frame 0; walk 1, fault into free frame 1; walk 0 again.
          </LI>
          <LI>
            Faults stop at <Strong>2</Strong>, disk reads at{" "}
            <Strong>2</Strong>, table refs at <Strong>6</Strong>. The third
            access is a walk of a present PTE — not a fault. Evictions stay
            at <Strong>0</Strong>.
          </LI>
          <LI>
            Drag to <Strong>4</Strong>. Four first-touches fill every frame:{" "}
            <Strong>4</Strong> faults, <Strong>4</Strong> disk reads,{" "}
            <Strong>10</Strong> table refs, still zero evictions. The extra
            access is still a repeat of VPN 0.
          </LI>
        </TryThis>
        <PageFaultsFigure />
        <Callout kind="insight">
          You pay disk on first touch, and only then. Two unique pages cost
          two faults and two disk reads; repeating the first page walks the
          tables and does not move either meter. Demand paging is that
          policy: do not put a page in a frame until someone names it.
        </Callout>
      </LessonSection>

      <LessonSection id="major-vs-minor">
        <Lead>
          Every fault in this figure is a disk read. Real kernels have a
          cheaper kind, and this model does not.
        </Lead>
        <P>
          Operators split faults into <Term>major</Term> (the page is not in
          RAM, so the handler must wait on I/O) and <Term>minor</Term> (the
          PTE is invalid, but the page is already in memory). A minor fault
          fills in a PFN and returns: a shared mapping, a page already in the
          cache, a copy-on-write share, or the kernel&apos;s zero page for a
          fresh anonymous allocation. No disk.
        </P>
        <P>
          This producer has no such path. At every slider position — 1, 2, 3,
          and 4 — <Strong>page faults equal disk reads</Strong>. The third
          access of the default run is not a minor fault either. It is not a
          fault: the PTE is already present, so the walk succeeds. A minor
          fault would still start from an invalid PTE; the model never has
          an invalid PTE whose page is already in a frame.
        </P>
        <Callout kind="warning">
          Absent: a second process sharing the page, a page cache,
          copy-on-write, and anonymous zero-fill. Those are what would split
          the two meters. The slider also never asks for a fifth unique page,
          so a free frame always exists — replacement, and the victim, are
          the next lesson.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
