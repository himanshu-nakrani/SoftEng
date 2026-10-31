import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { DeoptimizationFigure } from "@/lessons/runtime-systems/deoptimization-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("deoptimization");

export default function DeoptimizationPage() {
  return (
    <Lesson slug="deoptimization">
      <LessonSection id="assumption">
        <Lead>
          Compiled code is a bet. After <Strong>4</Strong> interpreted hits
          the loop compiled for ints. That assumption is load-bearing.
        </Lead>
        <P>
          A <Term>JIT</Term> specializes on the types it has seen. While
          every iteration is an integer, the machine code is faster than
          the interpreter. The moment an iteration arrives with a
          different type, that code is wrong — it was compiled for ints
          and this value is not one.
        </P>
        <P>
          <Term>Deoptimization</Term> is the fallback. The runtime throws
          away the compiled body and resumes in the interpreter. The
          compile still counted. The rest of the loop does not run
          compiled.
        </P>
      </LessonSection>

      <LessonSection id="deopt">
        <P>
          Always <Strong>8</Strong> iterations. The slider is which
          iteration fails the type assumption, from <Strong>5</Strong> to{" "}
          <Strong>8</Strong>. Default <Strong>6</Strong> is the measured
          run. Hot is 4, so 5 is the first compiled iter.
        </P>
        <TryThis>
          <LI>
            Leave deopt at <Strong>6</Strong>. The first caption is
            &quot;Loop 8. deopt at 6.&quot; Step through the four interp
            hits and the compile. Iter 5 runs compiled. Then: &quot;Deopt
            at iter 6.&quot; Iters 7 and 8 are interp again.
          </LI>
          <LI>
            Skip to the end. Last note is &quot;interp 7, compiled 1,
            deopts 1.&quot; The stamp reads <Strong>deopt</Strong>. Meters:
            interpreted <Strong>7</Strong>, compiled <Strong>1</Strong>,
            compiles <Strong>1</Strong>, deopts <Strong>1</Strong>.
          </LI>
          <LI>
            Drag to <Strong>5</Strong> — the first compiled iter. Interp{" "}
            <Strong>8</Strong>, compiled <Strong>0</Strong>. Then drag to{" "}
            <Strong>8</Strong>: interp <Strong>5</Strong>, compiled{" "}
            <Strong>3</Strong>. Compiles and deopts stay at 1 either way.
          </LI>
        </TryThis>
        <DeoptimizationFigure />
        <Callout kind="insight">
          The compile still counted. Deopt at 6 spent one compiled
          iteration and then fell back; deopt at 5 spent none. Compiles
          is 1 on every position — the compile was not free, and it did
          not come back.
        </Callout>
      </LessonSection>

      <LessonSection id="after">
        <Lead>
          After the type fail, remaining iterations run in the
          interpreter. The failing iter does too.
        </Lead>
        <P>
          The deopt iteration itself counts as interpreted — that is why
          default 6 ends at interp <Strong>7</Strong>, not 6: four warmup
          hits, the failing iter, and two remaining. Compiled is only
          iter 5. At 5 there is no compiled iteration at all: interp{" "}
          <Strong>8</Strong>, compiled <Strong>0</Strong>. At 8 the fail
          is last, so three compiled iters survive: interp{" "}
          <Strong>5</Strong>, compiled <Strong>3</Strong>.
        </P>
        <P>
          Every slider position compiles <Strong>1</Strong> and deopts{" "}
          <Strong>1</Strong>. The compile happened after 4 hits; one later
          iteration failed the assumption; the runtime did not compile
          again. Speculative machine code is a loan you pay back the
          moment the types change.
        </P>
        <Callout kind="warning">
          This model has no inline caches, no OSR, and no recompile. A
          real JIT may specialize again after a deopt. The argument here
          is the fallback itself, counted per iteration: one bad type
          turns remaining work back into interp.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
