import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { HttpRequestResponseFigure } from "@/lessons/web-requests/http-request-response-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("http-request-response");

export default function HttpRequestResponsePage() {
  return (
    <Lesson slug="http-request-response">
      <LessonSection id="one-connection">
        <Lead>
          The connection is open. Now the browser asks for things — and it
          almost never asks for just one. A single page is an HTML document,
          then the stylesheet and script it references, then the images those
          reference. Eight requests for one page is modest.
        </Lead>
        <P>
          HTTP/1.1 keep-alive lets all of those requests share the connection
          you already paid a round trip to build. That is the good news. The
          catch is what &quot;share&quot; means here: one HTTP/1.1 connection is
          a single ordered <Strong>lane</Strong>. A request cannot go out until
          the response to the previous one has come back. The requests are a
          queue, served strictly in order.
        </P>
        <P>
          That single fact — one lane, one at a time — is the whole lesson, and
          it decides how long a page takes to load.
        </P>
      </LessonSection>

      <LessonSection id="send-a-request">
        <P>
          Start with one connection. Watch a page load: eight amber requests,
          but only ever one on the wire at a time. Each crosses to the server,
          is processed, and returns green before the next can leave. The rest
          sit queued at the browser, waiting their turn.
        </P>
        <P>
          The <Term>page load time</Term> meter is the number that matters. On
          one connection it settles near <Strong>4800ms</Strong> — that is the{" "}
          <Strong>sum</Strong> of all eight round trips, because they happened
          in series. Not the largest of them; the sum. The prediction
          checkpoint asks you to reason about exactly that relationship before
          the sim spells it out.
        </P>
        <HttpRequestResponseFigure />
        <Callout kind="insight">
          Each request here is only about 600ms on its own, and the server does
          almost no work. Yet the page takes nearly five seconds, purely
          because the requests could not overlap. This is <Term>head-of-line
          blocking</Term>: the request at the front of the lane holds up
          everything behind it.
        </Callout>
      </LessonSection>

      <LessonSection id="head-of-line">
        <P>
          Now drag <Term>connections</Term> up. Each connection is an
          independent lane, so the eight requests split across them and run at
          the same time. At three connections the page time drops to about{" "}
          <Strong>1800ms</Strong>; at six, to about <Strong>1200ms</Strong> —
          roughly the batch divided by the number of lanes. This is why
          browsers open several connections per host, and historically capped at
          around six.
        </P>
        <P>
          Then toggle <Term>one slow resource</Term>. On a single connection
          the slow response sits at the head of the lane and every request
          behind it — even the tiny ones that would have finished instantly —
          waits for it to clear. Add lanes and the damage is contained: the slow
          resource ties up its own connection while the others carry on.
        </P>
        <Callout kind="note">
          More connections is a workaround, not a fix — each one costs its own
          handshake (the previous lesson) and its own slice of server and
          network resources, which is why the count is capped. The real fix is{" "}
          <Term>HTTP/2 multiplexing</Term>: many independent streams over{" "}
          <em>one</em> connection, so requests overlap without paying for a lane
          each. It exists precisely to delete the constraint you just watched.
        </Callout>
      </LessonSection>

      <LessonSection id="what-a-request-costs">
        <P>
          Step back and add it up. A page load is: one DNS lookup to find the
          server, one handshake round trip to open a connection, and then a
          queue of request/response round trips whose total depends entirely on
          how many can overlap. The bytes the server actually produced were a
          small part of any of it.
        </P>
        <P>
          Everything expensive was a round trip you spent before or between the
          useful work — naming, connecting, and waiting in line. Two of those
          three, the browser can avoid repeating if it simply keeps the
          connection it already built instead of tearing it down and starting
          over. That is the next lesson, and it is the cheapest speed-up in this
          entire chain.
        </P>
      </LessonSection>
    </Lesson>
  );
}
