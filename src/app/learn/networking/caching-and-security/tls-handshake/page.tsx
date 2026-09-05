import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { TlsHandshakeFigure } from "@/lessons/caching-and-security/tls-handshake-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("tls-handshake");

export default function TlsHandshakePage() {
  return (
    <Lesson slug="tls-handshake">
      <LessonSection id="asymmetric-agreement">
        <Lead>TODO: ECDHE key exchange.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>

      <LessonSection id="handshake-round-trips">
        <TryThis>
          <LI>TODO: the first thing to do.</LI>
          <LI>TODO: the thing that surprises.</LI>
        </TryThis>
        <TlsHandshakeFigure />
        <Callout kind="insight">TODO: what the figure just proved.</Callout>
      </LessonSection>

      <LessonSection id="replay-vulnerabilities">
        <Lead>TODO: Early data and replay attacks.</Lead>
        <P>
          TODO. Use <Term>terms</Term> and <Strong>emphasis</Strong> sparingly.
        </P>
      </LessonSection>
    </Lesson>
  );
}
