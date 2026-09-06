import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  ClockFigure,
  FifoFigure,
  LruFigure,
} from "@/lessons/virtual-memory/page-replacement-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("page-replacement");

export default function PageReplacementPage() {
  return (
    <Lesson slug="page-replacement">
      <LessonSection id="no-free-frame">
        <Lead>
          Demand paging fills frames on first touch. The next fault, with
          every frame occupied, has to throw someone out.{" "}
          <Strong>Who</Strong> is a policy, not a mystery.
        </Lead>
        <P>
          The working set here is four pages —{" "}
          <Term>VPN 0, 1, 2, 3</Term> — accessed in the order{" "}
          <Strong>0, 1, 2, 0, 3</Strong>. Three physical frames cannot hold
          four residents. The fourth distinct page (<Term>3</Term>) arrives
          with no free frame, and one of the three already loaded has to
          leave.
        </P>
        <P>
          <Term>FIFO</Term> throws out whoever has been in memory longest.{" "}
          <Term>LRU</Term> throws out whoever has gone unused the longest.
          They disagree about page 0: it was loaded first, and it was also
          just used. The slider is how many frames you have — every stop is
          a different amount of pressure.
        </P>
      </LessonSection>

      <LessonSection id="fifo-vs-lru">
        <TryThis>
          <LI>
            Leave frames at <Strong>3</Strong>. Step the FIFO run. Pages 0,
            1, 2 fill the frames. The second access to 0 is a hit. Then{" "}
            <Term>VPN 3</Term> faults: frame 0 goes red, and{" "}
            <Term>VPN 0</Term> is gone even though you just used it.
          </LI>
          <LI>
            Meters land on <Strong>4</Strong> page faults and{" "}
            <Strong>1</Strong> eviction. The frames that remain are{" "}
            <Strong>3, 1, 2</Strong>.
          </LI>
        </TryThis>
        <FifoFigure />
        <TryThis>
          <LI>
            Same five accesses, same three frames, LRU. Step until{" "}
            <Term>VPN 3</Term> arrives. The red victim is frame 1:{" "}
            <Term>VPN 1</Term> leaves, <Term>VPN 0</Term> stays.
          </LI>
          <LI>
            Still <Strong>4</Strong> faults and <Strong>1</Strong> eviction.
            The frames that remain are <Strong>0, 3, 2</Strong>.
          </LI>
          <LI>
            Drag to <Strong>4</Strong>. The working set fits:{" "}
            <Strong>4</Strong> faults, <Strong>0</Strong> evictions, frames{" "}
            <Strong>0, 1, 2, 3</Strong> under both policies.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. Five accesses, five faults, three
            evictions. Both policies end at frames <Strong>3, 0</Strong> —
            the re-access of 0 is now a fault, because 0 was already thrown
            out to make room for 2.
          </LI>
        </TryThis>
        <LruFigure />
        <Callout kind="insight">
          FIFO does not care that 0 was just used. Recency is LRU&apos;s
          whole job, and that is why it keeps 0 and throws out 1 instead.
          At four frames nobody is evicted; at two, the working set does
          not fit and the policies agree again. Policy only matters in the
          gap where some pages fit and some do not.
        </Callout>
      </LessonSection>

      <LessonSection id="clock">
        <Lead>
          LRU needs a recency list. Hardware usually cannot afford one.{" "}
          <Term>CLOCK</Term> approximates it with a single referenced bit
          per page and a sweeping hand.
        </Lead>
        <P>
          On a fault the hand inspects the page it is pointing at. If the
          bit is set, CLOCK clears it and moves on — a second chance. If
          the bit is clear, that page is the victim. The cheap version of
          &quot;has this been used recently?&quot; is one bit, not a
          timestamp.
        </P>
        <TryThis>
          <LI>
            Same pattern, three frames. Step CLOCK until{" "}
            <Term>VPN 3</Term> faults. The red victim is frame 0:{" "}
            <Term>VPN 0</Term> leaves, just as under FIFO. Frames that
            remain: <Strong>3, 1, 2</Strong>.
          </LI>
          <LI>
            Meters match FIFO exactly: <Strong>4</Strong> faults,{" "}
            <Strong>1</Strong> eviction. CLOCK did not save the hot page.
          </LI>
          <LI>
            Drag to 4 and to 2. CLOCK still matches FIFO on this pattern:
            no eviction at four frames, three evictions ending at{" "}
            <Strong>3, 0</Strong> at two.
          </LI>
        </TryThis>
        <ClockFigure />
        <Callout kind="warning">
          At the first eviction every referenced bit is set — each page was
          just loaded, and 0 was just used — so CLOCK spends a full circle
          giving everyone a second chance, then throws out the oldest
          anyway. The approximation of LRU has not started yet. A later
          eviction is where the cleared bits would matter; this run has
          only one.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
