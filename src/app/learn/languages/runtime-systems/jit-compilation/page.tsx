import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { JitCompilationFigure } from "@/lessons/runtime-systems/jit-compilation-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("jit-compilation");

export default function JitCompilationPage() {
  return (
    <Lesson slug="jit-compilation">
      <LessonSection id="hot">
        <Lead>
          A loop starts in the <Term>interpreter</Term>. After{" "}
          <Strong>4</Strong> hits it compiles. Later iterations run
          compiled.
        </Lead>
        <P>
          <Term>Hot</Term> is <Strong>4</Strong>. The interpreter counts
          hits. At 4 the loop compiles; the remaining iterations run
          compiled. Three iterations never compile.
        </P>
        <P>
          This is a toy: not a real compiler. There is no IR, no inline
          cache, no on-stack replacement. The argument is when the tier
          changes, counted per iteration. There is no deopt here — that
          is the next lesson.
        </P>
      </LessonSection>

      <LessonSection id="loop">
        <P>
          The slider is how many iterations run, from 1 to 8. Default{" "}
          <Strong>8</Strong> is the measured run.
        </P>
        <TryThis>
          <LI>
            Leave iters at <Strong>8</Strong>. The first caption is
            &quot;Loop 8. hot=4.&quot; Skip to the end: meters read{" "}
            <Strong>4</Strong> interpreted, <Strong>4</Strong> compiled,{" "}
            <Strong>1</Strong> compiles. The stamp reads{" "}
            <Strong>4 compiled</Strong>. Last note &quot;interp 4,
            compiled 4, deopts 0.&quot;
          </LI>
          <LI>
            Drag to <Strong>4</Strong>. Interp <Strong>4</Strong>,
            compiles <Strong>1</Strong>, compiled <Strong>0</Strong>.
            Note &quot;Compile after 4 hits.&quot; The loop compiled
            and then stopped — nothing ran compiled yet.
          </LI>
          <LI>
            Drag to <Strong>3</Strong>. Interp <Strong>3</Strong>,
            compiles <Strong>0</Strong>. Three iterations never
            compile.
          </LI>
        </TryThis>
        <JitCompilationFigure />
        <Callout kind="insight">
          Eight iterations: interp 4, compiles 1, compiled 4. The
          compile is one event. The remaining four iterations are the
          payoff.
        </Callout>
      </LessonSection>

      <LessonSection id="tiers">
        <Lead>
          Interp then compiled. The compile sits between them as a
          counted event, not as an iteration.
        </Lead>
        <P>
          At 3: interp 3, compiles 0. At 4: interp 4, compiles 1,
          compiled 0. At 8: interp 4, compiles 1, compiled 4, deopts 0.
        </P>
        <P>
          The interpreter still paid the first four. Compilation does
          not rewrite the past; it changes the rest of the loop. Deopts
          stay at 0 on every slider position here — this lesson never
          deopts.
        </P>
        <Callout kind="warning">
          This is a toy: not a real compiler. Hot is 4 because the
          model says so. A real JIT has inline caches, an IR, and OSR.
          Those change how compilation pays for itself. They do not
          change the argument: a loop is interpreted until it is hot,
          then compiled until an assumption fails.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
