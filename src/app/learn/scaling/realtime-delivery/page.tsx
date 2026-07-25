import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { RealtimeDeliveryFigure } from "@/lessons/scaling/realtime-delivery-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("realtime-delivery");

export default function RealtimeDeliveryPage() {
  return (
    <Lesson slug="realtime-delivery">
      <LessonSection id="three-ways">
        <Lead>
          HTTP has one direction built in: the client asks, the server answers.
          So when the server is the one with news — a message, a price, a
          notification — it has no way to say so. Everything below is a
          workaround for that single missing arrow.
        </Lead>
        <P>
          <Strong>Short-polling</Strong> is the brute-force fix: the client
          asks again every few seconds. It is trivially simple, it works
          through every proxy ever built, and it burns a full round trip
          whether or not there is anything to say. A quiet chat room polled
          every second is a request per second per client that answers{" "}
          <Term>204 No Content</Term> — and a message still waits, on average,
          half a poll interval before anyone comes to collect it. Poll faster
          and latency drops in exact proportion to how much bandwidth and CPU
          you set on fire.
        </P>
        <P>
          <Strong>Long-polling</Strong> keeps the request but stops answering
          it. The client asks, and the server simply doesn&apos;t reply —
          it <Strong>parks</Strong> the request, holding the connection open
          until something happens or a timeout expires. When a message arrives
          the parked request is answered instantly, and the client immediately
          issues another. One request per client, one wire-hop of latency, no
          empty answers. What it costs is a server that is now holding an open
          connection per idle client instead of forgetting them between polls.
        </P>
        <P>
          <Strong>WebSockets</Strong> drop the pretence. One HTTP request
          upgrades to a raw bidirectional wire that stays open for the life of
          the session, and either side can write at any moment. There is no
          request to answer, no round trip to wait for, and nothing travels
          client→server unless the client has something to say. The price is
          the same one long-polling pays, made permanent and explicit.
        </P>
        <Callout kind="insight">
          The trade is not really about latency — long-poll and websockets are
          within a wire-hop of each other. It is about{" "}
          <Strong>where the waiting lives</Strong>. Short-polling keeps the
          waiting on the client and the server stays stateless. Long-polling
          and websockets move the waiting into the server, which now holds a
          file descriptor, a socket buffer and a slice of memory per connected
          user — and has to have somewhere to put a million of them.
        </Callout>
      </LessonSection>

      <LessonSection id="pick-transport">
        <P>
          Three clients, one chat server, one message a second arriving for
          somebody. Press play and leave it on <Term>short-poll</Term> for a
          few seconds first: the small grey dots coming back are empty
          responses — a request, a round trip and a bit of server work that
          carried no information at all.
        </P>
        <RealtimeDeliveryFigure />
        <P>
          Now flip <Term>transport</Term> and watch two meters argue.{" "}
          <Term>wasted requests</Term> is the count of empty answers per
          second: it sits around 2/s in short-poll and drops to exactly zero in
          both of the others, because neither one ever asks a question it
          doesn&apos;t already know the answer to.{" "}
          <Term>message latency</Term> — the time from a message arriving at
          the server to it landing on a device — falls with it.
        </P>
        <P>
          Drag <Term>poll interval</Term> around while you are in short-poll.
          It is the whole trade in one slider: at 3 seconds the waste meter
          calms down to well under one per second and messages sit around for
          well over a second waiting to be collected; at 0.25 seconds latency
          closes most of the gap to a websocket and you are paying twelve
          requests a second to deliver one message. The other two transports
          ignore the slider entirely.
        </P>
        <P>
          The <Term>connections held</Term> meter is the bill. In short-poll it
          reads zero — the server holds nothing between polls, which is exactly
          why polling scales so stupidly well. In long-poll it counts the
          parked requests (the same number appears as a chip on{" "}
          <Term>chat-1</Term>); in websocket mode it counts open sockets. Turn
          the <Term>event rate</Term> up and notice what does <em>not</em>{" "}
          change: connection count is a function of how many users you have,
          never of how busy they are.
        </P>
      </LessonSection>

      <LessonSection id="reconnect-storm">
        <P>
          Held connections have a failure mode that stateless polling
          doesn&apos;t, and you meet it the first time you deploy. At the
          18-second mark, <Term>chat-1</Term> restarts — a perfectly routine
          deploy. Every parked long-poll dies mid-park. Every websocket drops.
          Every client turns orange at the same instant, because they were all
          severed by the same event.
        </P>
        <P>
          Then they all do the correct thing: they reconnect. And because they
          were severed together, they wait the same backoff and come back
          together. Watch the load bar inside <Term>chat-1</Term> when the herd
          lands — the reconnect itself is the expensive part (TLS handshake,
          auth, re-subscribing, rehydrating whatever session state the process
          just lost), so a restart is followed immediately by the single
          heaviest second the server has all day. With three clients it is a
          blip; with fifty thousand it is an outage, and the outage generates
          another synchronized herd when <em>it</em> ends.
        </P>
        <P>
          Now switch <Term>reconnect jitter</Term> on and press{" "}
          <Term>restart server</Term> to run the deploy again. Nothing about
          the failure changed — the same three clients are severed at the same
          moment and every one of them still reconnects. The only difference is
          a random delay of up to a couple of seconds added to each retry, and the
          spike simply isn&apos;t there.
        </P>
        <Callout kind="warning">
          Three habits, in order of how much they buy you.{" "}
          <Strong>Jittered exponential backoff</Strong> on every reconnect:
          double the delay each attempt <em>and</em> randomize it, or a fleet
          that retries in lockstep will keep the server down by trying to reach
          it. <Strong>Connection draining</Strong> before a planned restart:
          stop accepting new connections, close the existing ones gradually
          over the next minute or two, and clients reconnect on their own
          staggered schedule instead of all at once. And note that{" "}
          <Strong>&ldquo;just use websockets&rdquo; makes this worse, not
          better</Strong> — the more state a connection carries, the more it
          costs to rebuild, and the more the restart hurts.
        </Callout>
        <P>
          If the shape feels familiar, it should: identical clients doing the
          identical correct thing at the identical moment is the same physics
          as a cache stampede. Any time a system synchronizes its clients — an
          outage, a deploy, a cron at midnight, a TTL that expires for everyone
          at once — randomness is the cheapest fix there is.
        </P>
      </LessonSection>
    </Lesson>
  );
}
