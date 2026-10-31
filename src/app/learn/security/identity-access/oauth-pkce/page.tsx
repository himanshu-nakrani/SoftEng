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
  OauthPkceFigure,
  OauthPkceNoneFigure,
} from "@/lessons/identity-access/oauth-pkce-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("oauth-pkce");

export default function OauthPkcePage() {
  return (
    <Lesson slug="oauth-pkce">
      <LessonSection id="the-code">
        <Lead>The code is not the token.</Lead>
        <P>
          An authorization server issues a short-lived{" "}
          <Term>authorization code</Term> after the user signs in. The
          client is sent back with that code in the URL, then exchanges it
          at a token endpoint for an access token. The token is the
          session. The code is a ticket for it.
        </P>
        <P>
          This lesson&apos;s ticket is <Strong>C9</Strong>. The token is{" "}
          <Strong>T1</Strong>. Anyone who can present C9 can collect T1 —
          unless the ticket is bound to a secret the attacker never saw.
        </P>
        <P>
          That binding is <Term>PKCE</Term>. The client holds verifier{" "}
          <Strong>V4</Strong> and sends challenge <Strong>77</Strong> with
          the request. The token endpoint will not issue T1 unless the
          presenter also has V4. <Term>pkceChallenge(V4)</Term> is{" "}
          <Strong>77</Strong>. 77 is a toy mix of V4, not SHA-256. Real
          PKCE hashes the verifier with S256.
        </P>
      </LessonSection>

      <LessonSection id="no-pkce">
        <P>
          The slider is intercept, 0 or 1. Default <Strong>1</Strong> is
          the measured run. Below, there is no verifier. C9 is enough.
        </P>
        <TryThis>
          <LI>
            Leave intercept at <Strong>1</Strong>. The first caption is
            &quot;Auth code without PKCE.&quot;
          </LI>
          <LI>
            Step. &quot;Client has no verifier.&quot; Then &quot;Authz
            issues code C9.&quot;
          </LI>
          <LI>
            Next: &quot;Attacker intercepts C9.&quot; Then &quot;Attacker
            exchanges C9 for T1.&quot; stolen is <Strong>1</Strong>, issued
            is <Strong>0</Strong>. The stamp reads <Strong>stolen</Strong>.
            The attacker holds T1.
          </LI>
          <LI>
            Last caption: &quot;Client&apos;s exchange fails: code already
            used.&quot; Drag intercept to <Strong>0</Strong>: issued{" "}
            <Strong>1</Strong>, stolen <Strong>0</Strong>. The client
            holds T1.
          </LI>
        </TryThis>
        <OauthPkceNoneFigure />
        <Callout kind="insight">
          Without PKCE, intercepting C9 issues T1 to the attacker (stolen
          1, issued 0). The redirect carried the whole grant.
        </Callout>
      </LessonSection>

      <LessonSection id="with-pkce">
        <Lead>
          The attacker still steals C9. The verifier never left the
          client, so C9 is not enough.
        </Lead>
        <TryThis>
          <LI>
            Leave intercept at <Strong>1</Strong>. The first caption is
            &quot;Auth code with PKCE. challenge=77.&quot;
          </LI>
          <LI>
            Step. &quot;Client holds verifier V4.&quot; Then &quot;Authz
            issues code C9.&quot;
          </LI>
          <LI>
            The attacker intercepts C9 again. Then &quot;Attacker has no
            verifier. Exchange rejected.&quot; rejected is{" "}
            <Strong>1</Strong>.
          </LI>
          <LI>
            Last caption: &quot;Client exchanges C9 for T1.&quot; stolen is{" "}
            <Strong>0</Strong>, issued is <Strong>1</Strong>. The stamp
            reads <Strong>client holds</Strong>.
          </LI>
        </TryThis>
        <OauthPkceFigure />
        <Compare>
          <CompareCol title="without PKCE">
            Intercept C9. stolen <Strong>1</Strong>, issued{" "}
            <Strong>0</Strong>. Stamp stolen. The attacker holds T1.
          </CompareCol>
          <CompareCol title="with PKCE">
            Intercept C9. stolen <Strong>0</Strong>, rejected{" "}
            <Strong>1</Strong>, issued <Strong>1</Strong>. Stamp client
            holds. The client holds T1. Challenge 77.
          </CompareCol>
        </Compare>
        <P>
          Drag intercept to <Strong>0</Strong>: issued <Strong>1</Strong>,
          stolen <Strong>0</Strong>, either way. PKCE only matters when
          someone else presents the code. With PKCE challenge 77, the
          attacker is rejected and the client still holds T1 (rejected 1,
          issued 1, stolen 0).
        </P>
        <Callout kind="insight">
          PKCE binds the code to a verifier the attacker never saw. C9
          still leaks on the redirect. T1 does not.
        </Callout>
        <Callout kind="warning">
          This is a toy. Challenge 77 is not S256. Code C9, token T1. A
          real verifier is high-entropy and hashed with SHA-256; a real
          code is one-time at a TLS token endpoint. The argument that is
          here: the redirect carried a code, not a session, and the
          exchange demands a secret that never travelled with it.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
