import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { CallStackFigure } from "@/lessons/parsing-execution/call-stack-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("call-stack");

export default function CallStackPage() {
  return (
    <Lesson slug="call-stack">
      <LessonSection id="frames">
        <Lead>
          Each call is a frame. Recursion is not a loop — it is a stack of
          frames, one per call that has not returned.
        </Lead>
        <P>
          The function here is <Term>f(n) = n==0 ? 1 : n * f(n-1)</Term>.
          The base is <Term>f(0) = 1</Term>. Every other call waits on{" "}
          <Term>f(n-1)</Term> and multiplies. The machine keeps that wait
          as a <Term>frame</Term>: the argument, and a place to resume.
        </P>
        <P>
          The cap is <Strong>4</Strong> frames. That is a toy. A real
          stack is larger and still finite. Default <Strong>n = 3</Strong>{" "}
          fits; <Strong>n = 4</Strong> does not.
        </P>
      </LessonSection>

      <LessonSection id="recurse">
        <P>
          The slider is n, from 0 to 4. Default <Strong>3</Strong> is the
          measured run.
        </P>
        <TryThis>
          <LI>
            Leave n at <Strong>3</Strong>. The first caption is
            &quot;f(3). cap 4.&quot; Step to the end: the last note is
            &quot;f(3) = 6. depth 4.&quot; Meters read <Strong>4</Strong>{" "}
            pushes, <Strong>4</Strong> depth, <Strong>0</Strong> overflow.
            The stamp reads <Strong>6</Strong>. Result is{" "}
            <Strong>6</Strong>.
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. Result is <Strong>1</Strong>,
            depth <Strong>1</Strong>, overflow <Strong>0</Strong>. One
            frame, the base case, and it returns.
          </LI>
          <LI>
            Drag to <Strong>4</Strong>. The stamp reads{" "}
            <Strong>overflow</Strong>. Result is null. Overflow is{" "}
            <Strong>1</Strong>. Notes include &quot;Overflow at f(0). cap
            4.&quot; then Unwind f(1) through f(4). Pushes stay{" "}
            <Strong>4</Strong>, depth stays <Strong>4</Strong>.
          </LI>
        </TryThis>
        <CallStackFigure />
        <Callout kind="insight">
          Depth is the peak, not the live height. After f(3) returns the
          chips are gone and the depth meter still reads 4 — four frames
          sat at once.
        </Callout>
      </LessonSection>

      <LessonSection id="overflow">
        <Lead>
          f(4) overflows the cap of 4 at f(0) — result is null.
        </Lead>
        <P>
          Four frames fill with f(4), f(3), f(2), f(1). f(0) is the fifth
          frame and there is no fifth slot. The overflow caption is
          &quot;Overflow at f(0). cap 4.&quot; f(0) never entered. Then
          four Unwind notes: Unwind f(1), Unwind f(2), Unwind f(3), Unwind
          f(4). Meters: <Strong>4</Strong> pushes, <Strong>4</Strong>{" "}
          depth, <Strong>1</Strong> overflow. Result is null. Stamp{" "}
          <Strong>overflow</Strong>.
        </P>
        <P>
          Unbounded recursion is not an infinite loop — it is a cap you
          can count. f(3) returns 6 at depth 4, pushes 4, overflow 0. f(4)
          overflows at f(0), result null, overflow 1. Same four slots.
          One extra call.
        </P>
        <Callout kind="warning">
          Cap 4 is a toy so overflow is a slider stop. A real stack is
          larger and still finite. Locals besides n, closures, and a real
          ISA are absent. The argument is the count: each call is a frame,
          and a fifth frame has nowhere to go.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
