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
import { HashFunctionsFigure } from "@/lessons/cryptography/hash-functions-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("hash-functions");

export default function HashFunctionsPage() {
  return (
    <Lesson slug="hash-functions">
      <LessonSection id="one-way">
        <Lead>
          Computing a hash is cheap. Recovering the input from the digest
          is a search. That gap is the whole point of the function.
        </Lead>
        <P>
          A <Term>hash</Term> mixes an input into a fixed-size{" "}
          <Term>digest</Term>. Same input, same digest, every time. This
          lesson&apos;s mixer is <Term>mix8</Term>: eight bits in, eight
          bits out, five shift/xor/add steps. It is{" "}
          <Strong>not SHA-256</Strong>. SHA-256 is 256 bits and a different
          algorithm. mix8 is small enough that a step list can show it.
        </P>
        <P>
          <Term>mix8(42)</Term> is <Strong>23</Strong>. One pass. Given
          only 23, finding an input that produces it is a{" "}
          <Term>preimage</Term>. There are <Strong>256</Strong> eight-bit
          values to try. That is the work factor on this toy. The figure
          does not guess — it hashes 42, then flips one bit so you can
          count how many output bits move.
        </P>
      </LessonSection>

      <LessonSection id="avalanche">
        <TryThis>
          <LI>
            Leave flip bit at <Strong>0</Strong>. Step until the caption
            reads &quot;mix8 → 23.&quot; The bits-moved meter is still{" "}
            <Strong>0</Strong>.
          </LI>
          <LI>
            One more step. &quot;Flip bit 0: 6 of 8 output bits move.&quot;
            The meter jumps to <Strong>6</Strong>. The last stamp is{" "}
            <Strong>6/8 avalanche</Strong>. Bit 0 is the rightmost chip.
          </LI>
          <LI>
            Drag to bit <Strong>1</Strong>: <Strong>4</Strong> of 8 move.
            Bit <Strong>2</Strong>: <Strong>3</Strong>. Bits{" "}
            <Strong>3</Strong>, <Strong>4</Strong>, <Strong>5</Strong> and{" "}
            <Strong>7</Strong>: <Strong>2</Strong>. Bit <Strong>6</Strong>:{" "}
            <Strong>4</Strong>.
          </LI>
        </TryThis>
        <HashFunctionsFigure />
        <P>
          On input 42 the eight single-bit flips move <Strong>6</Strong>,{" "}
          <Strong>4</Strong>, <Strong>3</Strong>, <Strong>2</Strong>,{" "}
          <Strong>2</Strong>, <Strong>2</Strong>, <Strong>4</Strong>, and{" "}
          <Strong>2</Strong> output bits. The dashed chips on{" "}
          <Term>H&apos;</Term> are the ones that moved. Count them; they
          match the meter.
        </P>
        <Callout kind="insight">
          That is not four bits every time, and it is not a promised 50%.
          Avalanche on this mixer is measured, input by input, bit by bit.
        </Callout>
      </LessonSection>

      <LessonSection id="work-factor">
        <Lead>
          An 8-bit preimage is 256 guesses. A 256-bit preimage is 2^256.
          We count that. We do not step through it.
        </Lead>
        <P>
          mix8 is a permutation of the 256 eight-bit values: every digest
          has exactly one preimage, and 23 came from 42 and only 42. If
          you hold only 23, the honest search still tries up to{" "}
          <Strong>256</Strong> inputs. The figure never does that search.
          Its slider is which bit to flip, 0 through 7.
        </P>
        <Compare>
          <CompareCol title="mix8 · 8-bit toy">
            Domain 0–255. A preimage is at most <Strong>256</Strong>{" "}
            guesses. mix8(42) is 23 in one pass; inverting 23 is the
            search.
          </CompareCol>
          <CompareCol title="SHA-256">
            A 256-bit digest. A preimage is <Strong>2^256</Strong>{" "}
            guesses. This page does not run SHA-256, and it does not
            simulate 2^256 steps.
          </CompareCol>
        </Compare>
        <Callout kind="warning">
          mix8 is five mixing steps on 8 bits, not SHA-256. The 256 is
          brute-force of a tiny domain — the argument a step list can show.
          A real hash is built so the same brute-force is{" "}
          <Strong>2^256</Strong> guesses. That number does not fit on this
          stage.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
