import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { TcpHandshakeFigure } from "@/lessons/web-requests/tcp-handshake-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("tcp-handshake");

export default function TcpHandshakePage() {
  return (
    <Lesson slug="tcp-handshake">
      <LessonSection id="before-any-data">
        <Lead>
          You resolved the name; now you have an address. You still cannot send
          your request. TCP will not carry a single byte of data until both
          ends have agreed to a connection, and they agree with a{" "}
          <Term>three-way handshake</Term>.
        </Lead>
        <P>
          The client sends a <Strong>SYN</Strong> — a request to open. The
          server answers <Strong>SYN-ACK</Strong> — yes, and here is my side of
          it. The client answers <Strong>ACK</Strong> — acknowledged — and the
          connection is open. Three messages, but the important count is round
          trips: by the time the client has the SYN-ACK in hand, one full round
          trip has passed, and only now may it send the request.
        </P>
        <P>
          That is a cost you pay before the useful work even begins, and it is
          the same on every fresh connection. The rest of this lesson is that
          cost on a clean link, and the very different cost when the link starts
          losing packets.
        </P>
      </LessonSection>

      <LessonSection id="do-the-handshake">
        <P>
          Watch one connection open: a cyan <Term>SYN</Term> crosses to the
          server, a violet <Term>SYN-ACK</Term> comes back, an amber{" "}
          <Term>ACK</Term> returns — and right behind the ACK, the request goes.
          The response completes a second round trip.
        </P>
        <P>
          The meters make the arithmetic exact. With the default 250ms one-way
          latency the round trip is 500ms, so <Term>time to send</Term> — the
          moment the client can finally transmit its request — settles at about{" "}
          <Strong>500ms</Strong>, one clean RTT. <Term>Time to first byte</Term>
          lands near <Strong>1000ms</Strong>: two round trips, because the
          handshake bought the right to send and then the request/response spent
          another RTT of its own.
        </P>
        <TcpHandshakeFigure />
        <Callout kind="insight">
          Half of the time-to-first-byte on a fresh connection went to setup,
          not to the request. Nothing was slow — the server did no real work
          yet — the latency was purely the price of establishing a connection.
          That is why the next lesson is about not throwing the connection away.
        </Callout>
      </LessonSection>

      <LessonSection id="lossy-links">
        <P>
          Now raise <Term>packet loss</Term>. Setup packets begin vanishing on
          the wire — a SYN or a SYN-ACK that simply never arrives, shown as a
          fading red drop. Here is the part that surprises people: nothing
          reacts. There is no error, no immediate retry. The sender is waiting
          for a reply that was never coming, and it has no way to know the
          difference between &quot;lost&quot; and &quot;still on its way&quot;.
        </P>
        <P>
          The only thing that eventually notices is a <Term>retransmit
          timeout</Term>. TCP sets that timer well above one round trip on
          purpose — retransmitting too eagerly would pile more packets onto a
          link that is already dropping them — so a single lost handshake packet
          costs a whole timeout, not a round trip. Watch <Term>worst first
          byte</Term> jump past <Strong>3000ms</Strong> while the average
          creeps up only a little. The checkpoint asks you how long a lost SYN
          costs before it happens.
        </P>
        <Callout kind="warning">
          Loss does not raise latency evenly; it lengthens the <Strong>tail</Strong>.
          Most connections still complete in 2 RTT, but the unlucky ones pay an
          RTO on top, and it is the tail that shows up as &quot;the site
          sometimes takes forever to load&quot;. An average latency graph can
          look healthy while a real fraction of your users are stuck waiting on
          a timeout for a packet nobody knows is gone.
        </Callout>
      </LessonSection>

      <LessonSection id="cost-of-a-connection">
        <P>
          Two facts fall out of this. First, a connection is not free — it is a
          full round trip of latency before the first request, every time you
          open one. Second, that round trip is also a fragility: the handshake
          is exactly the moment there is no data flowing to piggyback loss
          detection on, so a dropped setup packet is the most expensive kind of
          loss there is.
        </P>
        <P>
          Both point the same direction. If opening a connection costs a round
          trip and risks a timeout, then opening a fresh one for every request
          is a waste you can measure — which is the problem the next two lessons
          take apart. Modern stacks also attack the setup cost directly:{" "}
          <Term>TLS 1.3</Term> folds encryption setup into the same round trips,
          and <Term>QUIC</Term> combines the transport and crypto handshakes so
          a connection can often send data in zero or one round trip. The lever
          they are all pulling is the one you just measured.
        </P>
      </LessonSection>
    </Lesson>
  );
}
