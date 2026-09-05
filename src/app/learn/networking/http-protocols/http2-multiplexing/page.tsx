import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { Http2MultiplexingFigure } from "@/lessons/http-protocols/http2-multiplexing-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("http2-multiplexing");

export default function Http2MultiplexingPage() {
  return (
    <Lesson slug="http2-multiplexing">
      <LessonSection id="binary-framing">
        <Lead>
          HTTP/1.1 treated the connection as a textual document stream; HTTP/2 turns it into a multiplexed frame bus.
        </Lead>
        <P>
          In HTTP/1.1, messages were ASCII text strings terminated by newlines. The only way to know where one
          request ended and another began was by parsing headers or reading the connection until closure. Because
          there were no stream identifiers, interleaving parts of two different messages on the same socket would
          corrupt both.
        </P>
        <P>
          HTTP/2 introduced the <Term>binary framing layer</Term>. Every request and response is sliced into small,
          typed binary frames (<Term>HEADERS</Term> and <Term>DATA</Term>). Each frame carries a 9-byte header containing
          its length, type, flags, and a 31-bit <Term>stream identifier</Term>. Because every chunk declares which logical
          stream it belongs to, frames from disparate streams can freely interleave across a single TCP socket.
        </P>
      </LessonSection>

      <LessonSection id="interleaved-multiplexing">
        <TryThis>
          <LI>Observe the clean link with multiplexing enabled: watch frames from Stream 1 (CSS), Stream 3 (hero image), and Stream 5 (API call) interleave concurrently.</LI>
          <LI>Note that the lightweight API call (Stream 5) completes in roughly <Strong>733ms</Strong>, without waiting for the large 5-frame hero image to finish.</LI>
          <LI>Toggle <Strong>multiplexing</Strong> off: under sequential HTTP/1.1 ordering, Stream 5 is starved behind the image, delaying its arrival to <Strong>1200ms</Strong>.</LI>
          <LI>Raise the <Strong>packet loss</Strong> slider: watch what happens when a single frame drops. TCP halts all delivery, producing a <Strong>600ms</Strong> transport freeze.</LI>
        </TryThis>
        <Http2MultiplexingFigure />
        <Callout kind="insight">
          Multiplexing completely eliminates application-level head-of-line blocking: independent streams do not wait
          for each other to serialize. But because all streams share one underlying TCP connection, a single dropped
          packet triggers TCP’s in-order guarantee, freezing every stream at the transport layer.
        </Callout>
      </LessonSection>

      <LessonSection id="tcp-hol-blocking">
        <Lead>
          By consolidating traffic onto a single socket, HTTP/2 amplified the cost of packet loss.
        </Lead>
        <P>
          In HTTP/1.1 with six parallel TCP connections, a dropped packet on connection 1 slowed down only that
          single connection. The other five connections continued receiving data uninterrupted.
        </P>
        <P>
          In HTTP/2, all streams travel inside the same TCP byte stream. The operating system kernel knows nothing
          about HTTP/2 frames; TCP only knows sequence numbers. If sequence byte $K$ is dropped by an intermediate
          router, the receiver kernel buffers bytes $K+1, K+2 \dots$ and refuses to deliver them to user space until
          the sender retransmits byte $K$. Even if byte $K+1$ contains the entire payload of an urgent CSS file,
          the browser cannot read it until the dropped frame clears.
        </P>
        <P>
          On lossy networks (such as mobile cellular connections with 2%–5% packet loss), HTTP/2 can actually perform
          worse than HTTP/1.1 with multiple sockets. Solving this required abandoning TCP entirely—which led directly
          to Google’s QUIC protocol and <Term>HTTP/3</Term>.
        </P>
      </LessonSection>
    </Lesson>
  );
}
