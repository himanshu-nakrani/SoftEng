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
        <Lead>
          Before two machines can exchange confidential data over the internet, they must agree on a shared secret key across an unencrypted wire where every packet is visible to eavesdroppers.
        </Lead>
        <P>
          Symmetric cryptography&mdash;such as AES-GCM or ChaCha20-Poly1305&mdash;is exceptionally fast, encrypting gigabytes of application throughput with minimal CPU overhead. However, symmetric ciphers require both the client and the server to possess an identical secret key in advance. Distributing that key over public fiber lines without exposing it to eavesdroppers is the classic cryptographic bootstrap challenge.
        </P>
        <P>
          Modern web security solves this with <Term>ECDHE</Term> (Elliptic Curve Diffie-Hellman Ephemeral). In an ECDHE exchange, the client and server each generate a temporary, private-public key pair on a standardized elliptic curve (such as X25519 or P-256). By exchanging only their public keys over the open wire, each side combines its own private key with the peer&apos;s public key to calculate the exact same premaster secret. An eavesdropper recording every packet on the wire cannot calculate this secret without solving the computationally intractable elliptic curve discrete logarithm problem.
        </P>
        <P>
          The &quot;E&quot; in ECDHE stands for <Term>ephemeral</Term>, which guarantees <Term>forward secrecy</Term>. Because both parties immediately discard their ephemeral private keys once session traffic keys are derived, an attacker who compromises the server&apos;s long-term certificate private key in the future still cannot decrypt historically recorded traffic.
        </P>
        <P>
          In TLS 1.2, this negotiation required two full round trips of setup before the browser could send a single byte of HTTP data: negotiating cipher suites, exchanging keys, verifying certificates, and validating handshake integrity. TLS 1.3 completely streamlined this flow, embedding the client&apos;s key share directly inside the very first flight.
        </P>
      </LessonSection>

      <LessonSection id="handshake-round-trips">
        <TryThis>
          <LI>Observe the baseline in <Strong>Full Handshake (1-RTT ECDHE)</Strong>: the client speculatively generates an ephemeral key pair and sends its KeyShare alongside <Term>ClientHello</Term>.</LI>
          <LI>Watch the server respond in a single return flight: it sends <Term>ServerHello</Term>, its own KeyShare, encrypted certificates, and a Finished token. Setup completes in exactly <Strong>1 RTT (300ms)</Strong>.</LI>
          <LI>Notice the client immediately follows with <Term>Finished</Term> and its encrypted HTTP payload&mdash;cutting connection setup time in half compared to TLS 1.2.</LI>
          <LI>Switch mode to <Strong>Session Resumption (0-RTT PSK)</Strong>: observe that setup round trips drop to <Strong>0 RTT (0ms)</Strong>. The client sends cached ticket credentials and encrypted <Term>early data</Term> in the very first flight.</LI>
          <LI>Toggle <Strong>replay attack</Strong> with anti-replay protection disabled: watch an attacker intercept and resend the 0-RTT flight, forcing the origin to execute the request twice (<Strong>replay vulnerability</Strong>).</LI>
          <LI>Toggle <Strong>server anti-replay protection</Strong>: observe the origin track single-use session tickets, successfully detecting and blocking duplicate early data.</LI>
        </TryThis>
        <TlsHandshakeFigure />
        <Callout kind="insight">
          TLS 1.3 eliminates an entire round trip by guessing the server&apos;s preferred key exchange algorithm upfront. With 0-RTT resumption, the client transmits HTTP data on the very first packet, but that speed trades away interactive handshake forward secrecy and invites replay attacks.
        </Callout>
      </LessonSection>

      <LessonSection id="replay-vulnerabilities">
        <Lead>
          Zero-RTT early data delivers instant application responses, but sending application payloads before completing an interactive cryptographic handshake breaks replay resistance.
        </Lead>
        <P>
          In a standard 1-RTT handshake, the server contributes fresh entropy (its own random nonce and ephemeral key share) before accepting any application data. That fresh interactive exchange prevents an adversary from capturing a packet and re-injecting it into the network later.
        </P>
        <P>
          In 0-RTT mode, however, early data is encrypted entirely under a Pre-Shared Key (PSK) derived from a previously issued session ticket. The server has not yet contributed fresh randomness to the exchange. If a client sends a 0-RTT packet containing <code>POST /api/orders/pay</code>, a passive eavesdropper on the network can record the raw encrypted bytes and replay them to the server minutes or hours later. Without mitigation, the server validates the ticket, decrypts the request, and processes the transaction a second time.
        </P>
        <P>
          Because of this fundamental exposure, RFC 8446 specifies strict deployment rules for 0-RTT early data:
        </P>
        <P>
          1. <Term>Method safety</Term>: Early data must only ever carry idempotent, safe requests (such as <code>GET</code> requests without state-mutating side effects). Non-idempotent methods (<code>POST</code>, <code>PUT</code>, <code>DELETE</code>) must be delayed until the 1-RTT handshake completes.
        </P>
        <P>
          2. <Term>Anti-replay mechanisms</Term>: Servers must implement replay defenses, such as tracking single-use ticket identifiers in an in-memory cache or Bloom filter, enforcing strict timestamp freshness windows with ClientHello recording, or utilizing distributed session databases.
        </P>
        <P>
          3. <Term>Replay rejection with 425</Term>: If an origin or edge proxy receives early data on an edge that cannot guarantee replay protection, it must reject the early data with HTTP status <code>425 Too Early</code>. This signals the client to replay the request over the secure 1-RTT connection without user-visible errors.
        </P>
      </LessonSection>
    </Lesson>
  );
}
