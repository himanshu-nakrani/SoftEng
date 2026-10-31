import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { DiffieHellmanFigure } from "@/lessons/cryptography/diffie-hellman-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("diffie-hellman");

export default function DiffieHellmanPage() {
  return (
    <Lesson slug="diffie-hellman">
      <LessonSection id="public-channel">
        <Lead>
          Two parties can agree on a number without ever sending it, on a
          channel an eavesdropper reads in full.
        </Lead>
        <P>
          Alice and Bob want a shared secret. Eve copies every message.
          Sending the secret is the same as giving it to Eve, so they cannot
          send it. What they can send is a <Term>public value</Term> that
          hides the exponent that produced it.
        </P>
        <P>
          <Term>Diffie-Hellman</Term> publishes a modulus{" "}
          <Strong>p = 23</Strong> and a generator <Strong>g = 5</Strong>.
          Alice keeps a secret <Strong>a</Strong>, Bob keeps{" "}
          <Strong>b</Strong>. She publishes <Term>A = g^a mod p</Term>; he
          publishes <Term>B = g^b mod p</Term>. Then she computes{" "}
          <Term>B^a</Term> and he computes <Term>A^b</Term>. Both land on
          the same number — <Term>g^(ab) mod p</Term> — a value that never
          travelled.
        </P>
        <P>
          The modulus here is tiny on purpose. Real Diffie-Hellman uses a{" "}
          <Strong>2048-bit</Strong> modulus. p = 23 is so the numbers fit
          on chips you can step through.
        </P>
      </LessonSection>

      <LessonSection id="exchange">
        <P>
          Bob&apos;s secret is fixed at <Strong>7</Strong>. The slider is
          Alice&apos;s secret, from 2 to 10. Default <Strong>6</Strong> is
          the measured run.
        </P>
        <TryThis>
          <LI>
            Leave Alice&apos;s secret at <Strong>6</Strong>. Step: Alice
            publishes <Strong>8</Strong>, then Bob publishes{" "}
            <Strong>17</Strong>. Mod muls read <Strong>4</Strong>, then{" "}
            <Strong>9</Strong>.
          </LI>
          <LI>
            Next step: the caption reads &quot;Shared secret 12 — both
            sides match.&quot; Rows sA and sB both show <Strong>12</Strong>.
            Mod muls land on <Strong>18</Strong>.
          </LI>
          <LI>
            Last step: the stamp becomes <Strong>shared 12</Strong>.
            Guesses land on <Strong>23</Strong>. Now drag to{" "}
            <Strong>2</Strong>: A becomes <Strong>2</Strong>, the secret
            becomes <Strong>13</Strong>. Drag to <Strong>10</Strong>: A
            becomes <Strong>9</Strong>, the secret <Strong>4</Strong>. B
            stays <Strong>17</Strong>. Both sides still match.
          </LI>
        </TryThis>
        <DiffieHellmanFigure />
        <Callout kind="insight">
          They never sent 6 or 7. The channel carried 8 and 17. The secret
          12 is something Eve watched them compute and still does not have.
        </Callout>
        <P>
          Every slider stop publishes a different A. B is 17 at all of
          them, because Bob did not move. The guesses meter stays at{" "}
          <Strong>23</Strong>: Eve&apos;s cheapest honest attack on this
          toy does not get cheaper because Alice picked a smaller exponent.
        </P>
      </LessonSection>

      <LessonSection id="eve">
        <Lead>
          Seeing A and B is not knowing a. The public values are on the
          channel; the exponents are not.
        </Lead>
        <P>
          Eve has 8, 17, g = 5, and p = 23. The secret is 8^7 mod 23, or
          17^6 mod 23, and she has neither exponent. Finding a from{" "}
          <Term>g^a mod p</Term> is the <Term>discrete logarithm</Term>. On
          this modulus she can try every candidate until 5^a equals 8 — at
          most <Strong>23</Strong> trials. That is what the guesses meter
          records: the bound p, not a loop the figure ran.
        </P>
        <P>
          On a 2048-bit modulus the same bound is 2^2048. Tiny p is so you
          can see both sides land on 12. The hardness is why the real
          modulus is huge.
        </P>
        <Callout kind="warning">
          This is a toy. p = 23, square-and-multiply is not constant-time,
          and nobody authenticated who published A. A man-in-the-middle who
          substitutes their own public values learns two secrets and
          forwards traffic. Those are why deployed Diffie-Hellman sits
          inside a handshake with certificates — the next lesson is the
          signature that handshake checks.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
