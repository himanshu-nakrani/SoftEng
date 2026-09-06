import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { LexicalAnalysisFigure } from "@/lessons/parsing-execution/lexical-analysis-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("lexical-analysis");

export default function LexicalAnalysisPage() {
  return (
    <Lesson slug="lexical-analysis">
      <LessonSection id="characters">
        <Lead>
          Source is a string of characters. A scanner groups them into
          tokens — the only thing a parser will see.
        </Lead>
        <P>
          The four sources here are <Term>let n=2</Term>,{" "}
          <Term>let n = 2</Term>, <Term>let &apos;n=2&apos;</Term>, and{" "}
          <Term>letn=2</Term>. Default source <Strong>0</Strong> is{" "}
          <Term>let n=2</Term>: <Strong>7</Strong> characters. The scanner
          is a toy: letters, digits, single-quoted strings, and single-char
          operators. No comments, no Unicode, no parser.
        </P>
        <P>
          Whitespace is skipped, never emitted. A keyword is an ident that
          matches the reserved set as a whole word — <Term>let</Term> is
          reserved; a longer ident that starts with those letters is not.
          A quoted string is one token even when it contains{" "}
          <Term>=</Term>.
        </P>
      </LessonSection>

      <LessonSection id="scan">
        <P>
          The slider is which source, from 0 to 3. Default{" "}
          <Strong>0</Strong> is the measured run.
        </P>
        <TryThis>
          <LI>
            Leave source at <Strong>0</Strong>. The first caption is
            &quot;Scan 7 chars.&quot; Tokens is empty. Step to the end:
            meters read <Strong>4</Strong> tokens, <Strong>1</Strong>{" "}
            skipped. The chips are <Term>kw let</Term>,{" "}
            <Term>ident n</Term>, <Term>op =</Term>, <Term>num 2</Term>.
            The stamp reads <Strong>4 tokens</Strong>.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. Source is <Term>let n = 2</Term>.
            The same four tokens, three spaces skipped. Meters:{" "}
            <Strong>4</Strong> tokens, <Strong>3</Strong> skipped. Stamp
            still <Strong>4 tokens</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. Source is{" "}
            <Term>let &apos;n=2&apos;</Term>. Two tokens:{" "}
            <Term>kw let</Term> and the string{" "}
            <Term>&apos;n=2&apos;</Term>, which keeps the{" "}
            <Term>=</Term> inside. Meters: <Strong>2</Strong> tokens,{" "}
            <Strong>1</Strong> skipped. Stamp <Strong>2 tokens</Strong>.
          </LI>
          <LI>
            Drag to <Strong>3</Strong>. Source is <Term>letn=2</Term>.
            Three tokens: <Term>ident letn</Term>, <Term>op =</Term>,{" "}
            <Term>num 2</Term>. Nothing skipped. Stamp{" "}
            <Strong>3 tokens</Strong>.
          </LI>
        </TryThis>
        <LexicalAnalysisFigure />
        <Callout kind="insight">
          Extra spaces did not invent tokens. Source 0 and source 1 emit
          the same four chips; only the skipped meter moved, from 1 to 3.
        </Callout>
      </LessonSection>

      <LessonSection id="keywords">
        <Lead>
          <Term>let</Term> is a keyword only as a whole ident.{" "}
          <Term>letn</Term> is not <Term>let</Term> plus <Term>n</Term>.
        </Lead>
        <P>
          Source 3 is six characters and no spaces: <Term>letn=2</Term>.
          The scanner greedily takes the longest ident, then checks the
          reserved set. <Term>letn</Term> is not in it, so the chip is{" "}
          <Term>ident letn</Term>, not a keyword. The run ends at{" "}
          <Strong>3</Strong> tokens, <Strong>0</Strong> skipped — not four,
          because there was never a separate <Term>n</Term>.
        </P>
        <P>
          Source 2 is the other grouping rule. Quotes wrap{" "}
          <Term>n=2</Term> into one string. The <Term>=</Term> inside is
          characters of that string, not an operator. Two tokens, not four.
        </P>
        <Callout kind="warning">
          This scanner is a toy. Letters, digits, <Term>&apos;...&apos;</Term>{" "}
          strings, and single-char ops. It does not do comments, Unicode,
          nested quotes, or parse a tree. The argument is what the scanner
          groups, counted as chips — not a language.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
