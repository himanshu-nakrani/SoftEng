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
  AllowFigure,
  OpenFigure,
} from "@/lessons/application-security/ssrf-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("ssrf");

export default function SsrfPage() {
  return (
    <Lesson slug="ssrf">
      <LessonSection id="the-fetch">
        <Lead>
          The server fetches for you. The caller chooses the host.
        </Lead>
        <P>
          A browser cannot see <Term>169.254.169.254</Term>. A server can.
          That is <Term>server-side request forgery</Term>: the app is a{" "}
          <Term>confused deputy</Term> that will GET whatever URL the
          caller handed it, including addresses that only exist on the
          server&apos;s network.
        </P>
        <P>
          Two hosts. Target <Strong>0</Strong> is{" "}
          <Term>api.example.com</Term>, the app host. Target{" "}
          <Strong>1</Strong> is <Term>169.254.169.254</Term>, the
          well-known cloud metadata address. The slider is the target, 0
          or 1. Default <Strong>1</Strong> is the measured run.
        </P>
        <P>
          This is a toy: two hosts, no DNS rebinding, no real cloud.{" "}
          <Term>169.254.169.254</Term> is the well-known metadata address;
          we do not fetch it.
        </P>
      </LessonSection>

      <LessonSection id="open">
        <P>
          Below is an open fetch. There is no allowlist. The server GETs
          the host the caller named.
        </P>
        <TryThis>
          <LI>
            Leave target at <Strong>1</Strong>. The first caption is
            &quot;Fetch 169.254.169.254.&quot;
          </LI>
          <LI>
            Step. &quot;Host 169.254.169.254.&quot; The chip is tainted.
          </LI>
          <LI>
            Step again. &quot;Open fetch reads the metadata endpoint.&quot;
            fetched is <Strong>1</Strong>, leaked is <Strong>1</Strong>.
            The stamp reads <Strong>metadata</Strong>. The FETCH chip is{" "}
            <Term>169.254.169.254</Term>. The run is marked fail.
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. fetched is <Strong>1</Strong>,
            leaked is <Strong>0</Strong>. The stamp reads{" "}
            <Strong>fetched</Strong>.
          </LI>
        </TryThis>
        <OpenFigure />
        <P>
          An open fetch of 169.254.169.254 is fetched 1 leaked 1. Target 0
          is an open fetch of api.example.com: fetched 1 leaked 0, stamp
          fetched.
        </P>
        <Callout kind="insight">
          The server did the GET. The caller only chose the host. That is
          the deputy: authority the browser does not have, spent on a URL
          the browser supplied.
        </Callout>
      </LessonSection>

      <LessonSection id="allowlist">
        <Lead>
          The same two hosts, against an allowlist of api.example.com.
        </Lead>
        <TryThis>
          <LI>
            Leave target at <Strong>1</Strong>. Step to the last caption:
            &quot;Allowlist refuses that host.&quot; blocked is{" "}
            <Strong>1</Strong>, leaked is <Strong>0</Strong>. The stamp
            reads <Strong>blocked</Strong>. FETCH reads none.
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. fetched is <Strong>1</Strong>,
            leaked is <Strong>0</Strong>. The stamp reads{" "}
            <Strong>fetched</Strong>.
          </LI>
        </TryThis>
        <AllowFigure />
        <P>
          The same host against an allowlist of api.example.com is blocked
          1 leaked 0. api.example.com is fetched either way, leaked 0.
        </P>
        <Compare>
          <CompareCol title="open · target 1">
            fetched <Strong>1</Strong> leaked <Strong>1</Strong>. Stamp{" "}
            <Strong>metadata</Strong>. The FETCH chip is 169.254.169.254.
          </CompareCol>
          <CompareCol title="allowlist · target 1">
            blocked <Strong>1</Strong> leaked <Strong>0</Strong>. Stamp{" "}
            <Strong>blocked</Strong>. FETCH reads none. The host never
            left the check.
          </CompareCol>
        </Compare>
        <Callout kind="insight">
          An allowlist is a host check. It is not a DNS tutorial, and it
          is not a firewall. The open fetch leaked because the server
          would GET any host; the allowlist leaked nothing because
          169.254.169.254 is not api.example.com.
        </Callout>
        <Callout kind="warning">
          Two hosts, no DNS rebinding, no real cloud. We do not fetch
          169.254.169.254. A production check also has to survive a
          hostname that resolves later to a link-local address — that is a
          different lesson. The argument that is here: the caller chose
          the host, and an allowlist is what stops the GET.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
