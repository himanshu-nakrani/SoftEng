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
  ItableFigure,
  StaticFigure,
  VtableFigure,
} from "@/lessons/runtime-systems/vtables-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("vtables");

export default function VtablesPage() {
  return (
    <Lesson slug="vtables">
      <LessonSection id="named">
        <Lead>
          A named call is <Strong>0</Strong> extra loads. A vtable is{" "}
          <Strong>2</Strong>. An interface is <Strong>1</Strong> plus a
          scan.
        </Lead>
        <P>
          Two objects: <Term>dog</Term> and <Term>cat</Term>. Both have{" "}
          <Term>speak</Term>. Dog says <Strong>woof</Strong>. Cat says{" "}
          <Strong>meow</Strong>. This is a toy: one method, two classes, a
          three-slot itable. Not C++ and not a JVM.
        </P>
        <P>
          If the compiler knows the class, the call site{" "}
          <Term>is</Term> the function. <Term>Dog.speak</Term> is{" "}
          <Term>Dog_speak</Term>. Lookups stay at <Strong>0</Strong>. The
          slider is which object, <Strong>0</Strong> dog or{" "}
          <Strong>1</Strong> cat. The name on the call changes. The load
          count does not.
        </P>
        <TryThis>
          <LI>
            Leave object at <Strong>0</Strong>. The first caption is
            &quot;Static Dog.speak.&quot; Lookups is <Strong>0</Strong>.
          </LI>
          <LI>
            Step. &quot;Object is dog.&quot; Then &quot;Call Dog_speak →
            woof.&quot; Calls is <Strong>1</Strong>. The stamp reads{" "}
            <Strong>woof</Strong>. Lookups is still <Strong>0</Strong>.
            There is no table.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. Cat.speak → <Strong>meow</Strong>.
            Lookups still <Strong>0</Strong>.
          </LI>
        </TryThis>
        <StaticFigure />
        <Callout kind="insight">
          The call site named the function. Changing the object changed
          which name, not how many loads.
        </Callout>
      </LessonSection>

      <LessonSection id="vtable">
        <Lead>
          One call site, two tables. Load the vptr, then slot 0 —{" "}
          <Strong>2</Strong> lookups either way.
        </Lead>
        <TryThis>
          <LI>
            Leave object at <Strong>0</Strong>. First caption: &quot;Dynamic
            dog.speak.&quot;
          </LI>
          <LI>
            Step: &quot;Object is dog.&quot; Then &quot;Load vptr →
            Dog_vt.&quot; Lookups becomes <Strong>1</Strong>.
          </LI>
          <LI>
            Step: &quot;Slot 0 is Dog_speak.&quot; Lookups is{" "}
            <Strong>2</Strong>. Then &quot;Call Dog_speak → woof.&quot;
            Stamp <Strong>woof</Strong>.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. Same two loads, Cat_vt, Cat_speak,{" "}
            <Strong>meow</Strong>.
          </LI>
        </TryThis>
        <VtableFigure />
        <Compare>
          <CompareCol title="static · named">
            Lookups <Strong>0</Strong>. The call site is Dog_speak or
            Cat_speak. Two names, no table.
          </CompareCol>
          <CompareCol title="vtable · slot 0">
            Lookups <Strong>2</Strong>. One call site. The object&apos;s
            vptr picks the table.
          </CompareCol>
        </Compare>
      </LessonSection>

      <LessonSection id="itable">
        <Lead>
          An interface does not have a fixed slot. It scans until the iid
          matches. Slot 2 costs <Strong>4</Strong> lookups, not 2.
        </Lead>
        <P>
          The itable on dog is <Term>draw</Term>, <Term>clone</Term>,{" "}
          <Term>speak</Term>. The slider is which slot holds speak,{" "}
          <Strong>0</Strong> through <Strong>2</Strong>, default{" "}
          <Strong>2</Strong>. A vptr load, then one load per scanned slot.
        </P>
        <TryThis>
          <LI>
            Leave speak slot at <Strong>2</Strong>. First caption:
            &quot;Interface speak on dog. iid at slot 2.&quot;
          </LI>
          <LI>
            Step. &quot;Load vptr → Dog_it.&quot; Then &quot;Slot 0 is
            draw, not speak.&quot; &quot;Slot 1 is clone, not speak.&quot;
            &quot;Slot 2 is speak.&quot; Scans <Strong>3</Strong>, lookups{" "}
            <Strong>4</Strong>.
          </LI>
          <LI>
            Last caption: &quot;Call Dog_speak → woof.&quot; Same woof.
            More loads.
          </LI>
          <LI>
            Drag to <Strong>0</Strong>: scans <Strong>1</Strong>, lookups{" "}
            <Strong>2</Strong> — the same two loads as a vtable. Slot{" "}
            <Strong>1</Strong>: scans <Strong>2</Strong>, lookups{" "}
            <Strong>3</Strong>.
          </LI>
        </TryThis>
        <ItableFigure />
        <Callout kind="warning">
          This is not a JVM itable and not a Swift witness table. Three
          slots, one iid. A real interface lookup is a different scan or
          a hashed cache. The argument a step list can show: a named
          call is 0 extra loads, a vtable is 2, an interface is 1 plus
          however far speak sits.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
