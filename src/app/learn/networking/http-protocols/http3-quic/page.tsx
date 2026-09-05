import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { Http3QuicFigure } from "@/lessons/http-protocols/http3-quic-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("http3-quic");

export default function Http3QuicPage() {
  return (
    <Lesson slug="http3-quic">
      <LessonSection id="udp-transport">
        <Lead>
          To fix head-of-line blocking once and for all, HTTP had to leave the TCP socket behind.
        </Lead>
        <P>
          For three decades, the web treated TCP as an unshakeable foundation: reliable, ordered, and ubiquitous.
          Yet TCP’s strongest guarantee—that every single byte must be delivered in strict ascending sequence—became
          the ultimate performance ceiling once HTTP/2 multiplexed hundreds of independent resources onto one connection.
        </P>
        <P>
          <Term>HTTP/3</Term> replaces TCP with <Term>QUIC</Term> (Quick UDP Internet Connections). Because QUIC
          runs on top of UDP, the operating system kernel does not impose any in-order byte buffer. Instead, QUIC
          implements its own transport logic in user space: encryption (TLS 1.3 is baked directly into the handshake),
          congestion control, and per-stream packet sequence numbers.
        </P>
      </LessonSection>

      <LessonSection id="independent-delivery">
        <TryThis>
          <LI>Observe the baseline under HTTP/3 (QUIC) with 15% packet loss: watch Stream 2 (the script) complete in roughly <Strong>833ms</Strong> despite packet drops.</LI>
          <LI>Notice the <Strong>transport HOL delay</Strong> meter: under HTTP/3, it stays pinned at exactly <Strong>0ms</Strong> because stream loss is completely isolated.</LI>
          <LI>Switch the protocol selector to <Strong>HTTP/2 (TCP transport)</Strong>: watch a single lost packet freeze all streams, introducing a <Strong>600ms</Strong> HOL stall and delaying Stream 2 to <Strong>1100ms</Strong> or more.</LI>
        </TryThis>
        <Http3QuicFigure />
        <Callout kind="insight">
          Under QUIC, every stream is its own independent transport entity. When packet loss hits Stream 1,
          Stream 1 retransmits in the background while Streams 2 and 3 continue to be processed and delivered
          by the browser immediately. Transport head-of-line blocking is eliminated.
        </Callout>
      </LessonSection>

      <LessonSection id="zero-rtt-resumption">
        <Lead>
          Beyond eliminating HOL blocking, QUIC collapses handshakes and survives IP address migration.
        </Lead>
        <P>
          In traditional HTTPS (TCP + TLS 1.3), opening a secure connection requires at least two round trips: one for
          the TCP SYN/ACK, and a second for the TLS key agreement. Because QUIC integrates the TLS cryptographic
          handshake directly into its initial transport packet, a fresh QUIC connection establishes in <Strong>1 RTT</Strong>,
          and resumed sessions can send application data immediately in <Strong>0-RTT</Strong>.
        </P>
        <P>
          Furthermore, TCP connections are bound to a 4-tuple: (source IP, source port, destination IP, destination port).
          If a smartphone switches from home Wi-Fi to a cellular network, its IP address changes, instantly breaking all
          open TCP connections and forcing a fresh handshake.
        </P>
        <P>
          QUIC connections are identified by a 64-bit <Term>Connection ID</Term> rather than network IP addresses. When
          the device switches networks, it simply sends its next UDP packet from the new IP using the existing Connection ID.
          The server validates the cryptographic authentication and continues the transfer without dropping a single packet—a
          capability known as <Term>connection migration</Term>.
        </P>
      </LessonSection>
    </Lesson>
  );
}
