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
  MtlsFigure,
  PerimeterFigure,
} from "@/lessons/defense-in-depth/mtls-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("mtls");

export default function MtlsPage() {
  return (
    <Lesson slug="mtls">
      <LessonSection id="who-is-speaking">
        <Lead>
          The network is not a name. Being on the same wire as svc-b does
          not tell svc-b who is speaking.
        </Lead>
        <P>
          Ordinary TLS authenticates the server. The client checks a cert;
          the server accepts whoever reached it.{" "}
          <Term>Mutual TLS</Term> is the same check in both directions:
          svc-b presents a cert, and svc-a must present one that chains to
          the same CA.
        </P>
        <P>
          Two peers, <Term>svc-a</Term> and <Term>svc-b</Term>. The slider
          is the client cert: <Strong>0</Strong> is a cert from this CA,{" "}
          <Strong>1</Strong> is none, <Strong>2</Strong> is other-ca. This
          is not X.509 and not SPIFFE. The kinds are ok, none, and
          other-ca. The argument is whether the server authenticated the
          client, not how a CA works.
        </P>
      </LessonSection>

      <LessonSection id="perimeter">
        <P>
          Perimeter trust: anyone on the network is connected. The client
          cert is never checked. Default <Strong>1</Strong> is the
          measured run — no cert, still connected.
        </P>
        <TryThis>
          <LI>
            Drag the slider to <Strong>1</Strong> — no client cert. Step
            through. The captions read &quot;Perimeter trust. Network is
            enough.&quot;, then &quot;Server presents its cert.&quot;, then
            &quot;Client presents nothing.&quot;, then &quot;Perimeter
            accepts anyone on the network.&quot;
          </LI>
          <LI>
            connected is <Strong>1</Strong>. verified is <Strong>0</Strong>.
            The stamp reads <Strong>connected</Strong>.
          </LI>
          <LI>
            Drag 0 and 2. Every perimeter run ends connected 1, verified 0.
            The cert never mattered.
          </LI>
        </TryThis>
        <PerimeterFigure />
        <Callout kind="insight">
          A missing client cert still connected. verified stayed 0. The
          perimeter never asked who was speaking.
        </Callout>
      </LessonSection>

      <LessonSection id="mutual">
        <Lead>
          mTLS connects only when the cert is from this CA. Missing or
          other-ca rejects.
        </Lead>
        <P>
          Same two peers, same slider. Default <Strong>0</Strong> is the
          happy path. The server now verifies the client cert the same way
          the client verified the server.
        </P>
        <TryThis>
          <LI>
            Leave the slider at <Strong>0</Strong> — a cert from this CA.
            connected is <Strong>1</Strong>, verified is <Strong>1</Strong>,
            the stamp reads <Strong>connected</Strong>.
          </LI>
          <LI>
            Drag to <Strong>1</Strong>. No client cert. connected is{" "}
            <Strong>0</Strong>, rejected is <Strong>1</Strong>, the stamp
            reads <Strong>reject</Strong>.
          </LI>
          <LI>
            Drag to <Strong>2</Strong>. A cert from another CA. connected
            is <Strong>0</Strong>, rejected is <Strong>1</Strong>, the stamp
            reads <Strong>reject</Strong>, and the peers are not connected.
          </LI>
        </TryThis>
        <MtlsFigure />
        <Compare>
          <CompareCol title="Perimeter">
            Size 0, 1, or 2: connected <Strong>1</Strong>, verified{" "}
            <Strong>0</Strong>. Anyone on the network is in.
          </CompareCol>
          <CompareCol title="Mutual TLS">
            Size 0: connected 1, verified 1. Size 1 or 2: rejected{" "}
            <Strong>1</Strong>, connected <Strong>0</Strong>. The client
            cert is the name.
          </CompareCol>
        </Compare>
        <Callout kind="insight">
          Being on the network is not a name. Mutual TLS is the server
          checking the client&apos;s cert the same way the client checks
          the server&apos;s.
        </Callout>
        <Callout kind="warning">
          These are toy cert kinds, not a chain. Rotation, SPIFFE IDs, and
          real X.509 are not here. The load-bearing fact is who the server
          authenticated.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
