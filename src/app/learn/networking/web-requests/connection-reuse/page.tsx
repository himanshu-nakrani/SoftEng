import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { ConnectionReuseFigure } from "@/lessons/web-requests/connection-reuse-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("connection-reuse");

export default function ConnectionReusePage() {
  return (
    <Lesson slug="connection-reuse">
      <LessonSection id="paying-twice">
        <Lead>
          A single web request, fully priced: a DNS lookup to find the server,
          a handshake round trip to open a connection, then the request and its
          response. Two of those three are setup — work done before the useful
          work, paid in latency the user feels.
        </Lead>
        <P>
          So here is the obvious waste. If the browser opens a fresh connection
          for every request and closes it afterward, it pays that setup{" "}
          <em>every single time</em>. The handshake round trip you measured two
          lessons ago is not a one-off cost; it is a per-request tax you keep
          choosing to pay. The fix is almost embarrassingly simple: keep the
          connection open and use it again. HTTP calls this <Term>keep-alive</Term>.
        </P>
        <P>
          This lesson runs the two strategies side by side on the same request
          stream so the difference is a thing you watch, not a claim you take on
          faith.
        </P>
      </LessonSection>

      <LessonSection id="reuse-it">
        <P>
          The top browser opens a new connection each time; the bottom one
          keeps its connection alive. Watch the first request: both send a
          violet <Term>setup</Term> packet, wait a round trip for the handshake,
          then send the request. They take the <Strong>same</Strong> time —
          about <Strong>700ms</Strong>, two round trips — because neither had a
          connection yet.
        </P>
        <P>
          From the second request on, they diverge. The keep-alive client
          already has a warm connection, so its request goes straight out: one
          round trip, about <Strong>350ms</Strong>. The new-connection client
          threw its connection away and handshakes all over again — back to
          around 700ms. Watch the <Term>connections opened</Term> counters: one
          climbs with every request while the other stays at one.
        </P>
        <ConnectionReuseFigure />
        <Callout kind="insight">
          Reuse cut per-request latency roughly in half, and it did it by
          removing a round trip, not by making the network faster. The handshake
          did not get cheaper; the browser simply stopped paying for it. That is
          why the number to watch is <Term>connections opened</Term> — every one
          after the first was avoidable.
        </Callout>
      </LessonSection>

      <LessonSection id="pool-under-load">
        <P>
          Toggle <Term>keep-alive</Term> off and the bottom client handshakes on
          every request too — the two lanes converge, because reuse was the
          entire difference between them. The checkpoint asks you which request
          the two strategies tie on, and the answer is the key to the whole
          idea: reuse saves nothing on a single request and everything on a
          stream of them.
        </P>
        <P>
          Real clients push this further with a <Term>connection pool</Term>: a
          set of warm connections kept open and ready in advance, so a request
          does not even wait for the <em>first</em> handshake — it borrows a
          connection that was opened earlier and returns it when done. A busy
          service talking to a database or another API almost always pools its
          connections for exactly this reason.
        </P>
        <Callout kind="note">
          The payoff scales with request count: setup cost saved times the
          number of requests you avoided repeating it on. One request, no
          benefit. Thousands of requests to the same host — an API client, a
          browser loading a page, a service mesh — and the connection you did
          not tear down is the difference between a system that spends its time
          working and one that spends it shaking hands.
        </Callout>
      </LessonSection>

      <LessonSection id="what-reuse-buys">
        <P>
          That closes the request lifecycle. You can now trace what a browser
          actually does with a URL: <Strong>resolve</Strong> the name through
          the DNS hierarchy, cached under a TTL; <Strong>connect</Strong> with a
          handshake that costs a round trip and risks a timeout; <Strong>exchange</Strong>{" "}
          requests and responses over that connection, one lane at a time unless
          you open more; and <Strong>reuse</Strong> the connection so the setup
          is paid once, not per request.
        </P>
        <P>
          Almost every latency number in this module was a round trip spent on
          something other than the answer — finding the server, agreeing to
          talk, waiting in line. The craft of a fast web system is mostly the
          craft of not paying those round trips more often than you have to:
          cache the lookup, keep the connection, multiplex the requests. Each is
          a way of turning setup you have already done into setup you never do
          again.
        </P>
      </LessonSection>
    </Lesson>
  );
}
