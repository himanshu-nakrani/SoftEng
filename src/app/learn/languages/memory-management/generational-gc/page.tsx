import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Compare,
  CompareCol,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import {
  BarrierFigure,
  NoBarrierFigure,
} from "@/lessons/memory-management/generational-gc-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("generational-gc");

export default function GenerationalGcPage() {
  return (
    <Lesson slug="generational-gc">
      <LessonSection id="young-old">
        <Lead>
          Most objects die young. A collector can scan only the young
          generation — if it also sees every pointer that an old object
          just stored into a young one.
        </Lead>
        <P>
          That observation is the <Term>weak generational hypothesis</Term>.
          A <Term>minor GC</Term> walks the young heap, not the old one.
          That is cheap only if every live young object is reachable from
          a young root <Strong>or</Strong> from a recorded old-to-young
          pointer. An old object that stores into a young one without
          telling the collector hides a live object from the scan.
        </P>
        <P>
          The heap is three objects: <Term>Y0</Term> (young, rooted),{" "}
          <Term>Y1</Term> (young), <Term>O0</Term> (old, rooted). Y0
          survives every run. O0 is old and is never swept. Y1 is the
          question. The slider is the old-to-young store, 0 or 1. Default{" "}
          <Strong>1</Strong> is <Term>O0.p = Y1</Term>.
        </P>
      </LessonSection>

      <LessonSection id="no-barrier">
        <P>
          Below is a minor GC with no write barrier. The store happens.
          The collector never hears about it.
        </P>
        <TryThis>
          <LI>
            Leave old-to-young at <Strong>1</Strong>. The first caption is
            &quot;O0.p = Y1. Minor GC.&quot;
          </LI>
          <LI>
            Step: &quot;Store O0.p = Y1. No barrier.&quot; Then
            &quot;Minor mark Y0.&quot; Then &quot;Sweep Y1. Live pointer
            from old missed.&quot;
          </LI>
          <LI>
            The stamp reads <Strong>lost Y1</Strong>. lost is{" "}
            <Strong>1</Strong>, swept is <Strong>1</Strong>. The last
            caption: &quot;Y1 was live and got swept.&quot;
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. The first caption is &quot;No
            old-to-young pointer. Minor GC.&quot; Y1 is garbage and got
            swept, lost <Strong>0</Strong>, swept <Strong>1</Strong>. The
            stamp reads <Strong>1 swept</Strong>.
          </LI>
        </TryThis>
        <NoBarrierFigure />
        <Callout kind="insight">
          Y1 was live — O0 still pointed at it — and still got swept. A
          minor GC that only marks young roots cannot see an old-to-young
          pointer it was never told about.
        </Callout>
      </LessonSection>

      <LessonSection id="barrier">
        <Lead>
          The same store, with a write barrier. The barrier dirties a
          card, and the minor GC marks from that card as well as from
          young roots.
        </Lead>
        <TryThis>
          <LI>
            Leave old-to-young at <Strong>1</Strong>. The write barrier
            dirties card O0. cards is <Strong>1</Strong>.
          </LI>
          <LI>
            Then &quot;Minor mark Y0.&quot; then &quot;Minor mark
            Y1.&quot; marked is <Strong>2</Strong>, swept is{" "}
            <Strong>0</Strong>.
          </LI>
          <LI>
            The stamp reads <Strong>held</Strong>. lost is{" "}
            <Strong>0</Strong>. The last caption: &quot;Young live set
            held.&quot;
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. Y1 is garbage either way. lost{" "}
            <Strong>0</Strong>, swept <Strong>1</Strong>, cards{" "}
            <Strong>0</Strong>.
          </LI>
        </TryThis>
        <BarrierFigure />
        <Compare>
          <CompareCol title="no barrier · store on">
            lost <Strong>1</Strong>, swept <Strong>1</Strong>, stamp{" "}
            <Strong>lost Y1</Strong>. Y1 was live and got swept.
          </CompareCol>
          <CompareCol title="barrier · store on">
            lost <Strong>0</Strong>, cards <Strong>1</Strong>, marked{" "}
            <Strong>2</Strong>, swept <Strong>0</Strong>, stamp{" "}
            <Strong>held</Strong>.
          </CompareCol>
        </Compare>
        <Callout kind="insight">
          A minor GC only walks young plus dirty cards. The barrier is how
          an old-to-young store becomes a card. Without it the young
          object is live and still dies.
        </Callout>
        <Callout kind="warning">
          One old object, one card, no promotion. A real collector has a
          remembered set and promotes survivors. Those change how you find
          the cards. They do not change the argument: a minor GC that
          misses an old-to-young store will sweep a live young object.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
