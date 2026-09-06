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
  EventLoopFigure,
  EventLoopNestedFigure,
} from "@/lessons/runtime-systems/event-loop-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("event-loop");

export default function EventLoopPage() {
  return (
    <Lesson slug="event-loop">
      <LessonSection id="three-queues">
        <Lead>
          Sync then micro then macro. The current turn finishes before
          anything it queued can run.
        </Lead>
        <P>
          This is a <Strong>toy event loop</Strong>. One sync turn queues
          work; then micros drain fully, including work they just queued;
          then one macrotask. The argument is the drain order, counted as
          a log.
        </P>
        <P>
          Three queues. <Term>Sync</Term> is now:{" "}
          <Term>console.log</Term>. A <Term>micro</Term> is{" "}
          <Term>queueMicrotask</Term> or a <Term>then</Term>. A{" "}
          <Term>macro</Term> is <Term>setTimeout</Term>. Log 1, queue
          micro 2, queue macro 3, log 4 → <Strong>1,4,2,3</Strong>. The 4
          printed before the queued 2, and 2 ran before the timer 3.
        </P>
      </LessonSection>

      <LessonSection id="classic">
        <P>
          The slider is which script, from 0 to 2. Default{" "}
          <Strong>0</Strong> is the measured run.
        </P>
        <TryThis>
          <LI>
            Leave script at <Strong>0</Strong>. The first caption is
            &quot;One micro, one macro.&quot; Stamp is{" "}
            <Strong>loop</Strong>. Step: &quot;Log 1.&quot; &quot;Queue
            micro 2.&quot; &quot;Queue macro 3.&quot; &quot;Log 4.&quot;
            Then &quot;Micro 2.&quot; then &quot;Macro 3.&quot; Last
            caption &quot;Log 1,4,2,3.&quot; Meters: sync{" "}
            <Strong>2</Strong>, micro <Strong>1</Strong>, macro{" "}
            <Strong>1</Strong>. Stamp <Strong>1,4,2,3</Strong>.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. First caption: &quot;Two micros,
            one macro.&quot; Log 1, two micros (2 and 3), macro 4, log 5.
            Then both micros drain, then the timer. Last caption
            &quot;Log 1,5,2,3,4.&quot; Stamp <Strong>1,5,2,3,4</Strong>.
            Meters: sync <Strong>2</Strong>, micro <Strong>2</Strong>,
            macro <Strong>1</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. A micro queues another micro.
            Stamp <Strong>1,3,A,B,2</Strong>. The next figure is that
            run, with no slider.
          </LI>
        </TryThis>
        <EventLoopFigure />
        <Callout kind="insight">
          The timer was queued before 4 printed, and still ran after 2.
          Sync 2, micro 1, macro 1, stamp 1,4,2,3. Micros beat the timer.
        </Callout>
      </LessonSection>

      <LessonSection id="nested">
        <Lead>
          A micro that queues micro B still beats the timer:{" "}
          <Strong>1,3,A,B,2</Strong>.
        </Lead>
        <TryThis>
          <LI>
            This figure is script <Strong>2</Strong>, no slider. The
            first caption is &quot;A micro queues another micro.&quot;
            Stamp is <Strong>loop</Strong>.
          </LI>
          <LI>
            Step the sync turn: &quot;Log 1.&quot; &quot;Queue micro
            A.&quot; &quot;Queue macro 2.&quot; &quot;Log 3.&quot; Sync
            is <Strong>2</Strong>. The log so far is 1,3. The timer is
            already queued.
          </LI>
          <LI>
            Then &quot;Micro A.&quot; A queues B: &quot;Queue micro
            B.&quot; B is new work, still a micro, so it drains before
            the timer. Then &quot;Micro B.&quot; Then &quot;Macro
            2.&quot; Last caption &quot;Log 1,3,A,B,2.&quot; Meters:
            sync <Strong>2</Strong>, micro <Strong>2</Strong>, macro{" "}
            <Strong>1</Strong>. Stamp <Strong>1,3,A,B,2</Strong>.
          </LI>
        </TryThis>
        <EventLoopNestedFigure />
        <Compare>
          <CompareCol title="script 0">
            Log 1,4,2,3. One micro, one macro. Stamp{" "}
            <Strong>1,4,2,3</Strong>. Micros beat the timer.
          </CompareCol>
          <CompareCol title="script 2">
            Log 1,3,A,B,2. A queued B; B still beat the timer. Stamp{" "}
            <Strong>1,3,A,B,2</Strong>. Nested micro still beats the
            timer.
          </CompareCol>
        </Compare>
        <Callout kind="insight">
          Nested micro still beats the timer. The micro queue drains
          fully, including work it just queued. Then one macrotask.
        </Callout>
        <Callout kind="warning">
          This is a toy: one sync turn, then micros drain fully, then one
          macro. No rAF, no nextTick vs then, no second timer with micros
          between. Those change how many turns you see. They do not
          change the order: sync, then every micro, then one macro.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
