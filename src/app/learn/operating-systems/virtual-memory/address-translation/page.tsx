import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  AddressTranslationFigure,
  AddressTranslationSameTableFigure,
} from "@/lessons/virtual-memory/address-translation-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("address-translation");

export default function AddressTranslationPage() {
  return (
    <Lesson slug="address-translation">
      <LessonSection id="vpn-and-offset">
        <Lead>
          A virtual address is not a location in RAM. It is a page number and
          an offset, and only the page number is looked up.
        </Lead>
        <P>
          The hardware does not store a map from every byte to a frame. It
          maps <Term>pages</Term>. A virtual address splits into a{" "}
          <Term>VPN</Term> — the virtual page number — and an{" "}
          <Term>offset</Term> inside that page. The offset is a byte index
          the tables never see: once the page is found, adding it is
          arithmetic. This machine has <Strong>16</Strong> virtual pages, so
          the VPN is four bits, 0 through 15.
        </P>
        <P>
          Those four bits split again. The high two bits are the{" "}
          <Term>directory</Term> index (<Term>vpn &gt;&gt; 2</Term>). The
          low two bits are the table index (<Term>vpn &amp; 3</Term>). VPN{" "}
          <Strong>0</Strong> reads directory[0] then table[0]; VPN{" "}
          <Strong>4</Strong> reads directory[1] then table[0]; VPN{" "}
          <Strong>8</Strong> reads directory[2] then table[0]. One
          translation, two table reads. That is a{" "}
          <Term>two-level page table</Term>.
        </P>
      </LessonSection>

      <LessonSection id="walk-the-tables">
        <TryThis>
          <LI>
            Leave translations at <Strong>3</Strong>. Step. VPN 0 lights
            directory slot 0–3 and the table of pages 0–3. VPN 4 jumps to
            slot 4–7. VPN 8 to 8–11. The table-refs meter stops at{" "}
            <Strong>6</Strong>. Faults stay at <Strong>0</Strong>.
          </LI>
          <LI>
            Drag to <Strong>4</Strong>. The fourth translation lights
            directory 12–15. Eight table refs, and every directory slot has
            now been walked.
          </LI>
          <LI>
            Drag to <Strong>8</Strong>. Sixteen table refs. VPN 1 still paid
            two refs even though VPN 0 already walked that table.
          </LI>
        </TryThis>
        <AddressTranslationFigure />
        <Callout kind="insight">
          A translation is two memory references, every time. Three pages did
          not cost three walks. They cost <Strong>six</Strong>. The identity
          map already had every PTE present — nothing faulted — and there is
          no TLB, so nothing was skipped.
        </Callout>
      </LessonSection>

      <LessonSection id="why-two-levels">
        <Lead>
          Two levels do not make a translation cheaper. VPNs 0, 1 and 2
          — the same table — still cost six table refs.
        </Lead>
        <TryThis>
          <LI>
            Leave translations at <Strong>3</Strong>. Directory slot 0–3
            never yields. The table-refs meter still lands on{" "}
            <Strong>6</Strong>, faults on <Strong>0</Strong>.
          </LI>
          <LI>
            Drag to <Strong>4</Strong>, then <Strong>8</Strong>. Eight refs,
            then sixteen — the same four pages, twice. Locality did not
            discount the walk.
          </LI>
        </TryThis>
        <AddressTranslationSameTableFigure />
        <P>
          Two-level page tables exist so the kernel can keep a small
          directory and allocate a table only for a region that is actually
          used. Four directory slots here, each covering four pages. A
          process that only needed pages 0–3 would store the directory plus
          one table of four, not sixteen PTEs. This identity map has every
          page present from the first frame, so you cannot see that saving
          on the stage. You can see the price: the extra reference.
        </P>
        <P>
          A one-level table would translate in one memory read and occupy a
          PTE for every virtual page, used or not. Two levels invert that:
          the walk is longer, and an unused region costs a single invalid
          directory slot. The next lesson is how a <Term>TLB</Term> gives
          the extra reference back on the hot path.
        </P>
        <Callout kind="insight">
          The walk is the cost of sparse tables. Hits in a TLB are how you
          stop paying it.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
