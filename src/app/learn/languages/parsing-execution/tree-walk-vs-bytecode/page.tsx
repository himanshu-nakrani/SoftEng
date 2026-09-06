import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  BytecodeFigure,
  WalkFigure,
} from "@/lessons/parsing-execution/tree-walk-vs-bytecode-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("tree-walk-vs-bytecode");

export default function TreeWalkVsBytecodePage() {
  return (
    <Lesson slug="tree-walk-vs-bytecode">
      <LessonSection id="two-machines">
        <Lead>
          Same tree, two machines. Both get <Strong>7</Strong> for{" "}
          <Term>1+2*3</Term>.
        </Lead>
        <P>
          The three expressions here are <Term>1+2</Term>,{" "}
          <Term>1+2*3</Term>, and <Term>(1+2)*3</Term>. Default expr{" "}
          <Strong>1</Strong> is <Term>1+2*3</Term>. A{" "}
          <Term>tree walk</Term> visits every AST node.{" "}
          <Term>Bytecode</Term> compiles the same tree to a linear list of{" "}
          <Term>LOAD</Term>, <Term>MUL</Term>, and <Term>ADD</Term>, then
          runs it on a stack.
        </P>
        <P>
          Both yield <Strong>7</Strong>. The walk visits{" "}
          <Strong>5</Strong> nodes. Bytecode is <Strong>5</Strong> ops (
          <Term>LOAD 1</Term>, <Term>LOAD 2</Term>, <Term>LOAD 3</Term>,{" "}
          <Term>MUL</Term>, <Term>ADD</Term>) with stack max{" "}
          <Strong>3</Strong>. The value is the same; the peak stack is
          not.
        </P>
        <P>
          The slider is which expression, from 0 to 2. Default{" "}
          <Strong>1</Strong> is the measured run. Seed is ignored: an
          evaluator is not a scheduler.
        </P>
      </LessonSection>

      <LessonSection id="walk">
        <TryThis>
          <LI>
            Leave expr at <Strong>1</Strong>. The first caption is
            &quot;Walk 1+2*3.&quot; The stamp reads walk. Step:{" "}
            <Term>Leaf 1</Term>, <Term>Leaf 2</Term>,{" "}
            <Term>Leaf 3</Term>, then &quot;2 * 3 = 6.&quot;, then
            &quot;1 + 6 = 7.&quot; Meters read <Strong>5</Strong> visits.
            The stamp reads <Strong>7</Strong>.
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. Source is <Term>1+2</Term>. Result{" "}
            <Strong>3</Strong>, visits <Strong>3</Strong>. Stamp{" "}
            <Strong>3</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. Source is <Term>(1+2)*3</Term>.
            Result <Strong>9</Strong>. Stamp <Strong>9</Strong>. Visits
            still <Strong>5</Strong> — three leaves and two ops, same as
            expr 1.
          </LI>
        </TryThis>
        <WalkFigure />
        <Callout kind="insight">
          A visit is a node. Three leaves and two ops is five visits, on{" "}
          <Term>1+2*3</Term> and on <Term>(1+2)*3</Term>. The stamp is the
          value, not the cost.
        </Callout>
      </LessonSection>

      <LessonSection id="bytecode">
        <P>
          The same three expressions, compiled. The slider is still which
          expression — 0 through 2, default <Strong>1</Strong>.
        </P>
        <TryThis>
          <LI>
            Leave expr at <Strong>1</Strong>. The first caption is
            &quot;Compile 1+2*3 → 5 ops.&quot; Next: &quot;LOAD 1, LOAD 2, LOAD 3, MUL, ADD.&quot;
          </LI>
          <LI>
            Step the dispatch. The last notes are
            &quot;MUL. stack [1 6].&quot;, &quot;ADD. stack [7].&quot;, and
            &quot;1+2*3 = 7. stack max 3.&quot; Meters: <Strong>5</Strong>{" "}
            ops, stack <Strong>3</Strong>. Stamp <Strong>7</Strong>.
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. <Term>1+2</Term> is{" "}
            <Strong>3</Strong> ops, stack max <Strong>2</Strong>. Result{" "}
            <Strong>3</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. <Term>(1+2)*3</Term> is{" "}
            <Strong>9</Strong> with stack max <Strong>2</Strong>. The
            code is <Term>LOAD 1</Term>, <Term>LOAD 2</Term>,{" "}
            <Term>ADD</Term>, <Term>LOAD 3</Term>, <Term>MUL</Term> —{" "}
            <Term>ADD</Term> happens before the third LOAD, so the stack
            never holds three values.
          </LI>
        </TryThis>
        <BytecodeFigure />
        <Callout kind="insight">
          Same <Term>1+2*3</Term>, same <Strong>7</Strong>. The walk&apos;s{" "}
          <Strong>5</Strong> is nodes; bytecode&apos;s <Strong>5</Strong> is
          ops. The peak stack moved: <Strong>3</Strong> for{" "}
          <Term>1+2*3</Term>, <Strong>2</Strong> for{" "}
          <Term>(1+2)*3</Term>.
        </Callout>
        <Callout kind="warning">
          This evaluator is a toy. Plus and star, no locals, no real ISA.
          Deliberately absent: registers, jumps, a compiler. Those change
          the instruction list. They do not change the argument: the walk
          is recursive structure; bytecode is a linear list plus a stack.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
