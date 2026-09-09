import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  AtTheEdgeFigure,
  FarTestsFigure,
} from "@/lessons/test-quality/boundary-mutants-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("boundary-mutants");

export default function BoundaryMutantsPage() {
  return (
    <Lesson slug="boundary-mutants">
      <LessonSection id="near-the-edge">
        <Lead>
          The last lesson&rsquo;s survivors were weak assertions. These survivors
          assert the exact answer — and live anyway, because the tests never visit
          the one input where the bug shows.
        </Lead>
        <P>
          A <Term>boundary</Term> is a value where behaviour flips: the moment a
          seat number stops being bookable, the last index still inside an array,
          the score at which a grade changes. Almost every off-by-one bug lives on
          one — <Strong>{">"}</Strong> slackened to <Strong>{">="}</Strong>, a bound
          set one too high or one too low. Such a change is wrong at{" "}
          <Strong>exactly one value</Strong> and correct everywhere else.
        </P>
        <P>
          The function below accepts a seat number when it is at least 1 and
          strictly below the row&rsquo;s capacity of 20. Two edges — the low one at
          1, the high one at 20 — and every mutant we try breaks one of them.
        </P>
      </LessonSection>

      <LessonSection id="far-tests">
        <P>
          First, a suite that asserts exact answers but samples comfortable,
          middle-of-the-range inputs: seat 10 is valid, seat &minus;5 is invalid,
          seat 40 is invalid. Five boundary mutants are tried against it.
        </P>
        <TryThis>
          <LI>
            The score line reads <Strong>1 killed, 4 survived</Strong>. Only the
            coarse mutant — the one that drops the upper check entirely — dies,
            caught by <Strong>seat 40 invalid</Strong> (with no upper bound, 40
            wrongly passes).
          </LI>
          <LI>
            The four survivors are the true off-by-ones: <Strong>{">="} became {">"}</Strong>,{" "}
            <Strong>{"<"} became {"<="}</Strong>, and the two bounds shifted by one.
            Each is wrong at a single seat, and no test tried that seat.
          </LI>
        </TryThis>
        <FarTestsFigure />
        <P>
          Every test passes, every assertion is exact, and four real bugs are
          still standing. The suite is not lax about what a valid seat should
          return — it just never asked about the seats where valid turns into
          invalid.
        </P>
      </LessonSection>

      <LessonSection id="at-the-edge">
        <P>
          The same seat check, the same five mutants. Now the inputs sit exactly on
          the boundaries: seat 0 and seat 1 straddle the low edge, seat 19 and seat
          20 straddle the high one.
        </P>
        <TryThis>
          <LI>
            The score line reads <Strong>5 killed, 0 survived</Strong>. Four tests
            over the two edges caught what fifteen middle-of-the-range executions
            could not.
          </LI>
          <LI>
            Match each edge to its kill. <Strong>seat 1 valid</Strong> catches both
            lower-edge mutants; <Strong>seat 19 valid</Strong> and{" "}
            <Strong>seat 20 invalid</Strong> catch the upper ones. The value that
            kills a boundary mutant is the boundary itself.
          </LI>
        </TryThis>
        <AtTheEdgeFigure />
        <Callout kind="insight">
          Two suites, both asserting exact answers, opposite verdicts:{" "}
          <Strong>1 of 5</Strong> against <Strong>5 of 5</Strong>. The difference
          was not the assertions this time — it was choosing inputs that sit{" "}
          <Strong>on</Strong> the edge instead of near it.
        </Callout>
      </LessonSection>

      <LessonSection id="why-boundaries">
        <Lead>
          Boundaries hide bugs because a range of inputs is not a range of
          behaviours. The interesting behaviour is concentrated at the ends.
        </Lead>
        <P>
          Every seat from 2 to 18 exercises the identical path through the
          function; testing all of them proves no more than testing one. The
          decisions live at 0, 1, 19 and 20 — the values on either side of each
          edge — and a test that never lands there is spending its assertions where
          the code has nothing left to decide. That is why{" "}
          <Term>boundary-value analysis</Term> targets the edge and the two values
          bracketing it, rather than sampling the middle.
        </P>
        <P>
          The through-line across both lessons: a green suite is evidence about the
          tests. A survivor tells you which claim the tests do not make — here,{" "}
          <Strong>&ldquo;nothing would notice if the seat limit were off by
          one.&rdquo;</Strong> Coverage cannot surface that. A mutant can, because a
          mutant is the missing test, written for you.
        </P>
      </LessonSection>
    </Lesson>
  );
}
