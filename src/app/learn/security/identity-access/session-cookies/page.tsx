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
import { SessionCookiesFigure } from "@/lessons/identity-access/session-cookies-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("session-cookies");

export default function SessionCookiesPage() {
  return (
    <Lesson slug="session-cookies">
      <LessonSection id="the-cookie">
        <Lead>
          The cookie is the session. Whoever holds <Term>sid=S7</Term> is
          the user. Flags decide whether that sid can leave the browser.
        </Lead>
        <P>
          A <Term>session cookie</Term> is a name the server wrote into the
          browser: <Term>sid=S7</Term>. The next request carries it, so the
          server does not have to ask who you are again. If someone else
          gets a copy, they are you. That is the whole mechanism, and the
          whole risk.
        </P>
        <P>
          This is a <Strong>toy cookie</Strong>. The sid is{" "}
          <Term>S7</Term>. The flags are <Term>HttpOnly</Term>,{" "}
          <Term>Secure</Term>, and <Term>SameSite</Term>. This page is not
          a browser, and it does not execute an XSS payload. Each flag is a
          door; the figure counts which door opened.
        </P>
      </LessonSection>

      <LessonSection id="flags">
        <P>
          The slider is the flags, from 0 to 3. Default <Strong>0</Strong>{" "}
          is all three on: HttpOnly, Secure, SameSite=Strict.
        </P>
        <TryThis>
          <LI>
            Leave flags at <Strong>0</Strong>. Step through the captions:
            &quot;Issue sid=S7.&quot; &quot;Flags HttpOnly=on Secure=on
            SameSite=Strict.&quot; &quot;XSS cannot read HttpOnly
            cookie.&quot; &quot;Secure cookie stays off HTTP.&quot;
            &quot;SameSite=Strict holds the cookie back.&quot; stolen{" "}
            <Strong>0</Strong>, csrf <Strong>0</Strong>. Stamp{" "}
            <Strong>cookie</Strong>.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. HttpOnly is off. Caption:
            &quot;XSS reads document.cookie. Sid stolen.&quot; stolen{" "}
            <Strong>1</Strong>, csrf <Strong>0</Strong>. Stamp{" "}
            <Strong>stolen</Strong>. The attacker holds <Term>S7</Term>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. Secure is off. Caption: &quot;HTTP
            request leaks the cookie.&quot; stolen <Strong>1</Strong>, csrf{" "}
            <Strong>0</Strong>. Stamp still <Strong>stolen</Strong>.
          </LI>
          <LI>
            Drag to <Strong>3</Strong>. SameSite=None. Caption:
            &quot;Cross-site POST sends the cookie.&quot; stolen{" "}
            <Strong>0</Strong>, csrf <Strong>1</Strong>. Stamp{" "}
            <Strong>csrf</Strong>. The sid never left as a copy — the
            browser sent it.
          </LI>
        </TryThis>
        <SessionCookiesFigure />
        <Callout kind="insight">
          stolen and csrf are different doors. XSS and HTTP produce a copy
          (stolen 1). SameSite=None never copies the sid — it lets a
          cross-site POST ride along (csrf 1, stolen 0).
        </Callout>
      </LessonSection>

      <LessonSection id="stolen">
        <Lead>
          A stolen sid is the session. CSRF is the session acting without
          the holder meaning to. They are not the same failure.
        </Lead>
        <P>
          At flags <Strong>1</Strong> and <Strong>2</Strong> the attacker
          holds <Term>S7</Term>. They can present it from their own
          browser. That is <Term>stolen</Term> <Strong>1</Strong>. At flags{" "}
          <Strong>3</Strong> they never read the cookie. The browser still
          has it, and a cross-site POST sends it. That is <Term>csrf</Term>{" "}
          <Strong>1</Strong>, stolen <Strong>0</Strong>.
        </P>
        <Compare>
          <CompareCol title="stolen · 1 and 2">
            HttpOnly off: XSS reads document.cookie. Secure off: an HTTP
            request leaks it. The attacker holds S7. Stamp{" "}
            <Strong>stolen</Strong>.
          </CompareCol>
          <CompareCol title="csrf · 3">
            SameSite=None: a cross-site POST sends the cookie. The attacker
            never holds S7. Stamp <Strong>csrf</Strong>.
          </CompareCol>
        </Compare>
        <Callout kind="warning">
          This is a toy cookie: sid S7 and three flags. A real Set-Cookie
          has more attributes, and a real browser. No XSS payload ran here.
          The argument that is here: each flag closes a different door, and
          the meters count which one opened.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
