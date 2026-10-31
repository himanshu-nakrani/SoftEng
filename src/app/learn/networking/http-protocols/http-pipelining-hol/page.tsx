import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { HttpPipeliningHolFigure } from "@/lessons/http-protocols/http-pipelining-hol-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("http-pipelining-hol");

export default function HttpPipeliningHolPage() {
  return (
    <Lesson slug="http-pipelining-hol">
      <LessonSection id="pipelining-promise">
        <Lead>
          In HTTP/1.0, every request paid a full round trip before the next could even leave the browser.
        </Lead>
        <P>
          Fetching a webpage is never a single request. An HTML document references stylesheets, JavaScript
          bundles, font files, and images. In the early web, each asset required opening a new TCP connection,
          running the three-way handshake, sending the GET request, and waiting for the response. HTTP/1.1
          introduced persistent connections with <Term>Keep-Alive</Term>, saving the repeated handshake cost.
        </P>
        <P>
          To go further, HTTP/1.1 introduced <Term>HTTP pipelining</Term>: rather than waiting for response $N$
          to arrive before transmitting request $N+1$, the client sends all requests back-to-back into the TCP
          socket. On a clean link with uniform processing, pipelining collapses page load time down to a single
          pipelined batch—finishing in roughly <Strong>633ms</Strong> with zero idle wire wait.
        </P>
      </LessonSection>

      <LessonSection id="fifo-head-of-line">
        <TryThis>
          <LI>Observe the baseline: with pipelining on and a slow first request, watch fast requests 2, 3, and 4 reach the server and finish computing almost immediately.</LI>
          <LI>Notice that the origin server holds responses 2, 3, and 4 in memory, accumulating over <Strong>730ms</Strong> of head-of-line delay until request 1 finally completes.</LI>
          <LI>Toggle <Strong>slow first request</Strong> off: when processing is uniform, HOL delay drops to <Strong>0ms</Strong> and page load finishes in <Strong>633ms</Strong>.</LI>
        </TryThis>
        <HttpPipeliningHolFigure />
        <Callout kind="insight">
          RFC 2616 §8.1.2.2 mandated that responses must return in the exact order requests were received.
          If request 1 is a heavy dynamic database query taking 900ms, the server cannot transmit completed static
          assets 2, 3, and 4. They sit trapped in the server’s output buffer—this is application head-of-line blocking.
        </Callout>
      </LessonSection>

      <LessonSection id="middlebox-reality">
        <Lead>
          Head-of-line blocking made pipelining fragile, but buggy transparent proxies made it unusable.
        </Lead>
        <P>
          In theory, a server could process requests asynchronously in parallel worker threads. But because the
          single TCP stream has no multiplexing headers or stream identifiers, the client has no way to tell which
          bytes belong to which request other than their arrival sequence. The server has no choice but to enforce
          strict <Term>FIFO serialization</Term>.
        </P>
        <P>
          Worse, real-world internet paths in the 2000s were littered with transparent corporate proxies, antivirus
          filters, and caching middleboxes. Many middleboxes violated the specification: some hung indefinitely
          on pipelined requests, while others silently interleaved response bodies or closed the connection after
          the first response. Because browsers could not predict whether a user’s path contained a broken middlebox,
          nearly every major browser (Chrome, Firefox, Safari, Internet Explorer) disabled HTTP/1.1 pipelining by
          default.
        </P>
        <P>
          To bypass the FIFO bottleneck without triggering middlebox failures, browsers adopted a pragmatic hack:
          opening <Strong>up to six parallel TCP connections</Strong> to the same host. This workaround wasted server
          file descriptors and TCP buffers, setting the stage for HTTP/2’s true binary multiplexing.
        </P>
      </LessonSection>
    </Lesson>
  );
}
