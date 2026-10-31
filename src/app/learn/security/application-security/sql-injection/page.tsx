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
  ConcatFigure,
  ParamFigure,
} from "@/lessons/application-security/sql-injection-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("sql-injection");

export default function SqlInjectionPage() {
  return (
    <Lesson slug="sql-injection">
      <LessonSection id="concat">
        <Lead>
          Input became syntax. Concatenating a string into a query does
          not pass a value — it grows the tree the matcher walks.
        </Lead>
        <P>
          This is a toy: three string ids — <Strong>1</Strong>,{" "}
          <Strong>7</Strong>, and <Strong>9</Strong> — not a SQL parser.
          A query is a tree of keywords, operators, and leaves. The honest
          lookup is <Term>WHERE id = 7</Term>: one literal, one match.
          Concatenating <Term>7 OR 1=1</Term> adds an <Term>OR</Term>{" "}
          node. That tautology is true for every row.
        </P>
        <P>
          <Term>Parameterization</Term> means the whole string is a leaf.
          The same characters that became operators under concat stay one
          literal under bind. Nobody&apos;s id equals the string{" "}
          <Term>7 OR 1=1</Term>.
        </P>
      </LessonSection>

      <LessonSection id="string-concat">
        <TryThis>
          <LI>
            Leave payload at <Strong>1</Strong>. The first caption is
            &quot;WHERE id = 7 OR 1=1.&quot; injected is still{" "}
            <Strong>0</Strong>; rows is still <Strong>0</Strong>.
          </LI>
          <LI>
            Step. &quot;Concat adds OR 1=1 to the AST.&quot; The OR chip
            is taint. injected jumps to <Strong>1</Strong>.
          </LI>
          <LI>
            Last step: &quot;Tautology matches 1, 7, and 9.&quot; rows{" "}
            <Strong>3</Strong>. Result <Strong>1</Strong>,{" "}
            <Strong>7</Strong>, and <Strong>9</Strong>. The stamp reads{" "}
            <Strong>3 rows · fail</Strong>.
          </LI>
          <LI>
            Drag to payload <Strong>0</Strong>. Concatenating 7 matches
            one row: 7 (injected 0, rows 1).
          </LI>
        </TryThis>
        <ConcatFigure />
        <Callout kind="insight">
          Concatenating 7 OR 1=1 adds an OR node and returns rows 1, 7,
          and 9 (injected 1, rows 3). The input did not stay a value. It
          became syntax.
        </Callout>
      </LessonSection>

      <LessonSection id="parameterized">
        <Lead>
          Bind the same string as a parameter. The whole payload is one
          leaf.
        </Lead>
        <TryThis>
          <LI>
            Leave payload at <Strong>1</Strong>. Caption: &quot;WHERE id
            = ?.&quot; Then &quot;Bind 7 OR 1=1 as a literal.&quot; The
            literal chip is the whole string <Term>7 OR 1=1</Term>.
          </LI>
          <LI>
            Last step: &quot;No row equals that literal.&quot; injected{" "}
            <Strong>0</Strong>, rows <Strong>0</Strong>, result empty.
            The stamp reads <Strong>0 rows · ok</Strong>.
          </LI>
          <LI>
            Drag to payload <Strong>0</Strong>. Binding 7 as a parameter
            does the same as concat at 0: one row, injected 0. Payload 0
            is id=7 either way (injected 0, rows 1).
          </LI>
        </TryThis>
        <ParamFigure />
        <Compare>
          <CompareCol title="concat">
            Payload 1 grows the tree. OR is a taint node. injected{" "}
            <Strong>1</Strong>, rows <Strong>3</Strong>. Result 1, 7, and
            9. The stamp fails.
          </CompareCol>
          <CompareCol title="param">
            Payload 1 is one literal leaf, the string 7 OR 1=1. injected{" "}
            <Strong>0</Strong>, rows <Strong>0</Strong>. Result empty.
            The stamp is ok.
          </CompareCol>
        </Compare>
        <Callout kind="insight">
          Binding the same string as a parameter matches nobody (injected
          0, rows 0). A parameter is a leaf, even when the string looks
          like SQL.
        </Callout>
        <Callout kind="warning">
          Three string ids, not a SQL parser. This page never claims a
          real DBMS. Concatenation here means growing a handful of chips.
          Parameterization means the whole string is a leaf. The figure
          is the tree, not an engine.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
