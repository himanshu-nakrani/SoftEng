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
  FlatFigure,
  PrecFigure,
} from "@/lessons/parsing-execution/recursive-descent-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("recursive-descent");

export default function RecursiveDescentPage() {
  return (
    <Lesson slug="recursive-descent">
      <LessonSection id="two-ops">
        <Lead>
          Why is <Term>1+2*3</Term> equal to <Strong>7</Strong>, not{" "}
          <Strong>9</Strong>?
        </Lead>
        <P>
          The three expressions here are <Term>1+2*3</Term>,{" "}
          <Term>1*2+3</Term>, and <Term>(1+2)*3</Term>. Default expr{" "}
          <Strong>0</Strong> is <Term>1+2*3</Term>. This parser is a toy:
          single-char tokens, digits, <Term>+</Term>, <Term>*</Term>, and
          parentheses. Not a real language.
        </P>
        <P>
          A flat grammar treats <Term>+</Term> and <Term>*</Term> the same,
          left to right. A precedence grammar puts <Term>*</Term> in a
          tighter production. Parentheses are a different production,
          counted the same way. Precedence is which production you call,
          not a later rewrite of the tree.
        </P>
      </LessonSection>

      <LessonSection id="flat">
        <P>
          The slider is which expression, from 0 to 2. Default{" "}
          <Strong>0</Strong> is the measured run.
        </P>
        <TryThis>
          <LI>
            Leave expr at <Strong>0</Strong>. The first caption is
            &quot;Parse 1+2*3.&quot; Reductions is empty.
          </LI>
          <LI>
            Step to the end: meters read <Strong>5</Strong> reductions.
            The stamp reads <Strong>9</Strong>. The last caption is
            &quot;1+2*3 = 9.&quot; Notes go &quot;Atom 1.&quot;,
            &quot;Atom 2.&quot;, &quot;+ → 3.&quot;, &quot;Atom 3.&quot;,
            &quot;* → 9.&quot;
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. Source is <Term>1*2+3</Term>.
            Value <Strong>5</Strong>, stamp <Strong>5</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. Source is <Term>(1+2)*3</Term>.
            Value <Strong>9</Strong>, stamp <Strong>9</Strong>.
          </LI>
        </TryThis>
        <FlatFigure />
        <Callout kind="insight">
          Flat left-to-right parses 1+2*3 as 9. Plus and star have the
          same rank, so 1+2 ran first.
        </Callout>
      </LessonSection>

      <LessonSection id="prec">
        <Lead>
          Star binds tighter because <Term>*</Term> lives in a tighter
          production, not because a later pass rewrote the tree.
        </Lead>
        <TryThis>
          <LI>
            Leave expr at <Strong>0</Strong>. Notes: &quot;Parse
            1+2*3.&quot; / &quot;Atom 1.&quot; / &quot;Atom 2.&quot; /
            &quot;Atom 3.&quot; / &quot;* → 6.&quot; / &quot;+ →
            7.&quot; / &quot;1+2*3 = 7.&quot;
          </LI>
          <LI>
            The stamp reads <Strong>7</Strong>. Reductions still{" "}
            <Strong>5</Strong>.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. Both figures give value{" "}
            <Strong>5</Strong>. 1*2+3 is 5 either way.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. Both figures give value{" "}
            <Strong>9</Strong>. (1+2)*3 is 9 either way.
          </LI>
        </TryThis>
        <PrecFigure />
        <Compare>
          <CompareCol title="flat">
            Expr 0 is <Term>1+2*3</Term>. Stamp <Strong>9</Strong>.
            Reductions <Strong>5</Strong>. The <Term>+</Term> fired
            first.
          </CompareCol>
          <CompareCol title="prec">
            Expr 0 is <Term>1+2*3</Term>. Stamp <Strong>7</Strong>.
            Reductions <Strong>5</Strong>. The <Term>*</Term> fired
            first.
          </CompareCol>
        </Compare>
        <Callout kind="insight">
          Precedence puts * in a tighter production and gets 7. Same five
          reductions as the flat run.
        </Callout>
        <Callout kind="warning">
          This parser is a toy: single-char tokens, digits, +, *, and
          parentheses. Not a real language. No unary minus, no exponent,
          no lexer. The argument is that precedence is which production
          you call, counted.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
