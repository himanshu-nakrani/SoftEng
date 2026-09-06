import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  DigitalSignaturesFigure,
  DigitalSignaturesTamperFigure,
} from "@/lessons/cryptography/digital-signatures-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("digital-signatures");

export default function DigitalSignaturesPage() {
  return (
    <Lesson slug="digital-signatures">
      <LessonSection id="private-signs">
        <Lead>
          Anyone with the public exponent can check a signature. Only the
          holder of the private exponent can make one.
        </Lead>
        <P>
          This is <Term>toy RSA</Term>. The modulus is{" "}
          <Strong>n = 55</Strong>, the public exponent is{" "}
          <Strong>e = 3</Strong>, the private exponent is{" "}
          <Strong>d = 27</Strong>. Sign is <Term>s = m^d mod n</Term>. Verify
          is <Term>s^e mod n</Term>, and it should come back the message. A
          real signature uses a hash of the bytes and a modulus measured in
          thousands of bits. None of that is here. The numbers are small so
          a step list can show the check.
        </P>
        <P>
          The public key is <Strong>(n, e)</Strong>. Anyone can raise a
          signature to e. The private key is <Strong>d</Strong>. Only someone
          who knows d can raise the message to it. e and d are chosen so
          that raising to d and then to e returns the message. The last
          frame of the next figure is that fact, not an explanation of it.
        </P>
        <P>
          Checking does not require a shared secret. Forging does. The next
          two figures run the same toy on the same slider: one verifies the
          signed message, the other verifies a message that changed after it
          was signed.
        </P>
      </LessonSection>

      <LessonSection id="sign-verify">
        <P>
          The slider is the message, from 1 to 16. Default{" "}
          <Strong>4</Strong> is the measured run. This toy never signs 0, so
          it maps that control into 1..54 and 4 becomes plaintext{" "}
          <Strong>5</Strong>.
        </P>
        <TryThis>
          <LI>
            Leave the message at <Strong>4</Strong>. The first caption is
            &quot;Sign message 5 with d, verify with e. n=55.&quot;
          </LI>
          <LI>
            Step. <Term>sig</Term> becomes <Strong>25</Strong> — that is
            5^27 mod 55. Mod muls read <Strong>8</Strong>.
          </LI>
          <LI>
            Step again. 25^3 mod 55 is <Strong>5</Strong>, which matches m.
            The stamp reads <Strong>verify ok</Strong>.{" "}
            <Term>verified</Term> is <Strong>1</Strong>. Mod muls land on{" "}
            <Strong>11</Strong>.
          </LI>
          <LI>
            Drag 1 through 16. Every honest run accepts. verified stays{" "}
            <Strong>1</Strong>.
          </LI>
        </TryThis>
        <DigitalSignaturesFigure />
        <Callout kind="insight">
          The checker never used d. It used e, which is public. verified 1
          means s^e came back the message — not that the checker could have
          produced the signature.
        </Callout>
      </LessonSection>

      <LessonSection id="tamper">
        <Lead>
          The signature is the same. The message is not. That is enough to
          refuse.
        </Lead>
        <TryThis>
          <LI>
            Leave the message at <Strong>4</Strong>. The sign step is
            identical: sig is still <Strong>25</Strong>.
          </LI>
          <LI>
            Step to verify. The <Term>see</Term> row is <Strong>6</Strong>,
            not 5. 25^3 mod 55 is still <Strong>5</Strong>. 5 is not 6. The
            stamp reads <Strong>verify fail</Strong>. verified is{" "}
            <Strong>0</Strong>.
          </LI>
          <LI>
            Drag 1 through 16. Every tampered run rejects. verified stays{" "}
            <Strong>0</Strong>. The signature never moved; the message did.
          </LI>
        </TryThis>
        <DigitalSignaturesTamperFigure />
        <Callout kind="insight">
          Accepting is not a property of the signature alone. It is a
          property of the pair (message, signature). Change either side of
          the pair and the public check fails.
        </Callout>
        <P>
          A production signature is over a hash of the bytes, not over a
          number that fits in six bits. The check is the same shape: raise
          to e, compare to what you were given. If the bytes moved, the
          hash moved, and s^e will not match.
        </P>
        <Callout kind="warning">
          n = 55 is 5 × 11. Anyone can factor it, recover d, and forge.
          That is why this is a toy. A 2048-bit modulus is the same
          protocol with a number you cannot factor on this page. SHA-256
          and constant-time code are also not here. The argument that is
          here: e verifies, d signs, a changed message fails.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
