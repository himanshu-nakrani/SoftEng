import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import { PropertyShrinkingFigure } from "@/lessons/property-testing/property-shrinking-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("property-shrinking");

export default function PropertyShrinkingPage() {
  return (
    <Lesson slug="property-shrinking">
      <LessonSection id="failing-inputs">
        <Lead>
          Property-based testing finds bugs that hand-written unit tests never
          think to look for &mdash; but it hands you a chaotic, 10-element random
          pile of numbers that buries the failure reason in noise.
        </Lead>
        <P>
          Example-based unit tests verify specific values authors anticipate:
          empty lists, zero, or hand-crafted fixtures. But real defects lurk at
          unanticipated boundaries and unexpected combinations. In{" "}
          <Term>property-based testing</Term> (PBT), instead of authoring concrete
          inputs, developers define invariants &mdash; assertions that must hold
          for <Strong>all</Strong> generated inputs &mdash; such as &ldquo;every
          element in a valid batch must be strictly under 50.&rdquo;
        </P>
        <P>
          When a test generator discovers an invariant failure, the counterexample
          is drawn from a pseudo-random distribution. Suppose our system invariant
          requires <Strong>all(x &lt; 50)</Strong>. A randomized generator might
          produce a 10-element array:
        </P>
        <P>
          <Strong>[31, 25, 39, 33, 16, 28, 92, 31, 40, 26]</Strong>
        </P>
        <P>
          The test runner fails with an assertion error. But looking at 10
          arbitrary numbers, an engineer faces immediate cognitive friction: Did
          the test fail because the array has 10 items? Because element 28 precedes
          92? Because the cumulative sum exceeded a buffer? Or because one specific
          number violated an assumption?
        </P>
        <Callout kind="warning">
          A raw randomized counterexample contains heavy{" "}
          <Strong>accidental complexity</Strong>. Without automated
          simplification, developers spend hours debugging irrelevant integers,
          permutations, and container shapes.
        </Callout>
      </LessonSection>

      <LessonSection id="shrink-strategies">
        <Lead>
          Shrinking systematically strips accidental complexity away until only the
          essential counterexample remains.
        </Lead>
        <P>
          This is where <Term>shrinking</Term> rescues property-based testing.
          Shrinking is a systematic reduction process that explores smaller,
          simpler variants of the failing input while confirming that the test{" "}
          <Strong>still fails</Strong>. If a candidate passes, the shrinker
          discards it because the bug was lost; if it still fails, the simpler
          candidate becomes the new baseline.
        </P>
        <P>
          Effective shrinkers combine three distinct reduction strategies in
          sequence:
        </P>
        <P>
          <Strong>1. Bisection (Chunk Removal)</Strong>: Instead of removing one
          item at a time, the shrinker tries dropping entire halves of the
          collection (halving the search space in O(log N)). In an array of 10
          items, testing the first half [31..16] passes (the defect is absent),
          while testing the second half [28..26] fails. In a single step, 5
          irrelevant elements are discarded. Halving the remaining 5 items retains
          [28, 92], dropping another 3 elements.
        </P>
        <P>
          <Strong>2. Element Deletion (1-by-1)</Strong>: When chunks can no longer
          be bisected without losing the invariant violation, the shrinker tries
          deleting each remaining element individually. Deleting 92 produces [28],
          which passes &mdash; so 92 is essential and must be kept. Deleting 28
          leaves [92], which still fails. Element 28 is deleted, pruning the array
          down to a single item.
        </P>
        <P>
          <Strong>3. Value Decrementing (Scalar Reduction)</Strong>: With the
          container structure minimal, the shrinker attacks the scalar value
          itself, stepping it towards baseline zero. It tests smaller integers (46
          passes, 69 fails, 57 fails, 51 fails, 50 fails, 49 passes) until it
          hits the exact boundary threshold: <Strong>50</Strong>.
        </P>
        <TryThis>
          <LI>
            Step through the interactive figure from step 0 to step 5. Notice how{" "}
            <Strong>bisection</Strong> cuts the 10-element array down to 5 and then
            2 elements in just two chunk reductions.
          </LI>
          <LI>
            At steps 6&ndash;8, watch <Strong>element deletion</Strong> test
            individual elements. Deleting 92 restores invariant passing, so 92 is
            retained; deleting 28 preserves the failure, so 28 is dropped.
          </LI>
          <LI>
            From step 9 onward, follow <Strong>value decrementing</Strong>. The
            value 92 drops through 69, 57, and 51 before settling on 50 &mdash;
            proving that 50 is the exact boundary condition where the invariant
            breaks.
          </LI>
        </TryThis>
        <PropertyShrinkingFigure />
        <Callout kind="insight">
          Across 12 property evaluations and 7 accepted shrinks, the shrinker
          distilled an unintelligible 10-element random array into the
          crystal-clear single-element reproduction [50]. The engineer does not
          have to guess: the bug is triggered precisely when an item reaches 50.
        </Callout>
      </LessonSection>

      <LessonSection id="minimal-repro">
        <Lead>
          The minimal failing case turns a randomized failure into a deterministic,
          one-line regression test.
        </Lead>
        <P>
          Without shrinking, property testing was historically viewed as painful
          for production teams because debugging a 100-character random string or a
          50-node random graph is agonizing. Frameworks like Haskell&rsquo;s{" "}
          <Term>QuickCheck</Term>, Python&rsquo;s <Term>Hypothesis</Term>, and
          TypeScript&rsquo;s <Term>fast-check</Term> made property testing a standard
          industry practice precisely because their shrinkers guarantee minimal
          counterexamples.
        </P>
        <P>
          A minimal counterexample delivers three vital engineering properties:
        </P>
        <P>
          <Strong>Immediate root cause visibility</Strong>: Seeing [50]
          instantly reveals an off-by-one defect (such as &lt; 50 vs &le; 50) or an
          unhandled boundary threshold.
        </P>
        <P>
          <Strong>Instant test extraction</Strong>: The minimized input [50] can
          be copy-pasted directly into a standard unit test suite as a deterministic
          regression test that executes in microseconds.
        </P>
        <P>
          <Strong>Canonical failure reporting</Strong>: Even when different CI runs
          generate wildly different random seeds, the shrinker converges onto the
          exact same canonical minimal failure every time.
        </P>
        <Callout kind="insight">
          When writing custom generators for domain entities (like HTTP requests,
          database models, or state machine events), always define sensible shrink
          paths or rely on integrated shrinking frameworks. A property test is only
          as helpful as the clarity of the counterexample it delivers when it breaks.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
