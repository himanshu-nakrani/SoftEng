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
  NaiveFigure,
  StrictFigure,
} from "@/lessons/identity-access/jwt-pitfalls-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("jwt-pitfalls");

export default function JwtPitfallsPage() {
  return (
    <Lesson slug="jwt-pitfalls">
      <LessonSection id="three-parts">
        <Lead>
          A JWT is three strings. Trusting the header&apos;s alg, skipping
          exp, or skipping the signature are three different ways to accept
          a token nobody signed.
        </Lead>
        <P>
          A <Term>JSON Web Token</Term> is a header, a payload, and a
          signature, joined by dots. The header names an algorithm. The
          payload names a subject and an expiry. The signature is supposed
          to bind the first two so a verifier can refuse a token nobody
          signed.
        </P>
        <P>
          This is a <Term>toy JWT</Term>, not JWS and not JWE. The clock
          is <Strong>now = 10</Strong> — a step clock, not unix time. The
          signature is <Term>toySig</Term>, not HMAC-SHA256. The numbers
          are small so a step list can show the three checks a verifier
          either runs or skips.
        </P>
        <P>
          The slider picks which token, from 0 to 3. Default{" "}
          <Strong>0</Strong> is the valid one: alg=HS256, sub=ada, exp=
          <Strong>20</Strong>, sig=<Strong>56</Strong> — that is
          toySig(&quot;HS256&quot;, &quot;ada&quot;, 20). The next two
          figures run the same four tokens: one verifier checks nothing,
          the other checks alg, exp, and the signature.
        </P>
      </LessonSection>

      <LessonSection id="naive">
        <P>
          The naive verifier reads the three parts and accepts. It does
          not look at alg, it does not compare exp to now, and it does
          not recompute the signature.
        </P>
        <TryThis>
          <LI>
            Leave the token at <Strong>0</Strong>. The first caption is
            &quot;JWT valid. now=10.&quot;
          </LI>
          <LI>
            Step. The chips read alg=HS256 sub=ada exp=20 sig=
            <Strong>56</Strong>.
          </LI>
          <LI>
            Step again. The caption reads &quot;Naive verifier
            accepts.&quot; The stamp is <Strong>accept</Strong>.{" "}
            <Term>verified</Term> is <Strong>1</Strong>.
          </LI>
          <LI>
            Drag 1 through 3. Every naive run accepts. verified stays{" "}
            <Strong>1</Strong>. Token 1&apos;s captions are &quot;JWT alg
            none. now=10.&quot;, then &quot;alg=none sub=ada exp=20
            sig=0.&quot;, then &quot;Naive verifier accepts.&quot; Token
            2 is exp=<Strong>5</Strong>, sig=<Strong>137</Strong>. Token
            3 is sub=mallory carrying ada&apos;s sig 56.
          </LI>
        </TryThis>
        <NaiveFigure />
        <Callout kind="insight">
          Accepting at 0 is not evidence the verifier checked anything.
          It also accepts alg=none, an expired exp, and a payload it did
          not sign. verified 1 on all four tokens is the bug, not the
          feature.
        </Callout>
      </LessonSection>

      <LessonSection id="strict">
        <Lead>
          The same four tokens. A verifier that actually checks alg, exp,
          and the signature accepts only one of them.
        </Lead>
        <TryThis>
          <LI>
            Leave the token at <Strong>0</Strong>. The token is the same:
            alg=HS256 sub=ada exp=20 sig=56. Strict accepts. verified is{" "}
            <Strong>1</Strong>, rejected is <Strong>0</Strong>, stamp{" "}
            <Strong>accept</Strong>.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. The caption reads &quot;Strict
            rejects: alg none.&quot; rejected is <Strong>1</Strong>,
            verified is <Strong>0</Strong>, ok is false, stamp{" "}
            <Strong>reject</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. exp=5 is less than now=10. Strict
            rejects: expired. Drag to <Strong>3</Strong>. sub=mallory
            carries sig 56, which is toySig of ada, not mallory. Strict
            rejects: bad sig.
          </LI>
        </TryThis>
        <StrictFigure />
        <Compare>
          <CompareCol title="naive verifier">
            Accepts all four tokens. verified is <Strong>1</Strong> at
            0, 1, 2, and 3. rejected never moves.
          </CompareCol>
          <CompareCol title="strict verifier">
            Accepts only token 0. Tokens 1–3 are rejected{" "}
            <Strong>1</Strong>, verified <Strong>0</Strong>.
          </CompareCol>
        </Compare>
        <Callout kind="insight">
          The three refusals are three different checks. alg=none is
          trusting a header the attacker wrote. exp=5 against now=10 is
          a clock the verifier must consult. sub=mallory with ada&apos;s
          sig 56 is a payload the signature does not cover unless you
          recompute it.
        </Callout>
        <Callout kind="warning">
          This is a toy JWT, not JWS or JWE. now=10 is a step clock, not
          unix time, and toySig is not HMAC-SHA256. alg=none is a real
          historical pitfall — libraries that trusted the header&apos;s
          alg accepted an unsigned token. The argument that is here: a
          verifier that skips alg, exp, or the signature will accept a
          token nobody signed.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
