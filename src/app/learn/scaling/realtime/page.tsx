import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { RealtimeFigure } from "@/lessons/scaling/realtime-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WebSockets vs Polling",
};

export default function RealtimePage() {
  return (
    <Lesson slug="realtime">
      <LessonSection id="the-question">
        <Lead>
          HTTP has a shape: the client asks, the server answers. But what
          if the <em>server</em> has news — a message arrives, a price
          moves, a deploy finishes? <Strong>Someone has to notice.</Strong>
        </Lead>
        <P>
          The oldest answer is <Term>polling</Term>: ask on a timer.
          &quot;Anything yet? Anything yet?&quot; It works everywhere HTTP
          works, and it has a cost you can predict before running the sim:
          the asking itself. The newer answer is the{" "}
          <Term>WebSocket</Term> — open one connection, keep it open, and
          let the server <Strong>push</Strong> through it the moment
          something happens.
        </P>
      </LessonSection>

      <LessonSection id="race">
        <P>
          Same wire, same stream of events — only the delivery model
          changes. Watch the rhythm of polling first (amber ask, cyan
          &quot;nothing&quot;), then flip to websocket and watch both the
          waste and the wait disappear.
        </P>
        <RealtimeFigure />
        <Callout kind="insight">
          Polling&apos;s two costs move in opposite directions:{" "}
          <Strong>poll faster</Strong> → less latency, more wasted
          requests. <Strong>Poll slower</Strong> → less waste, events sit
          undelivered (watch the server&apos;s chip). There is no interval
          that wins both — that tension IS the argument for push.
        </Callout>
      </LessonSection>

      <LessonSection id="tradeoffs">
        <P>
          So why does polling still exist? Because a held-open socket
          isn&apos;t free either: every connected client costs the server a
          file descriptor, buffer memory, and heartbeat traffic — a million
          idle sockets is a real capacity problem (and load balancers,
          proxies, and mobile networks all have opinions about long-lived
          connections). Polling is stateless, cache-friendly, and boring —
          the right choice when updates are rare and staleness is cheap.
        </P>
        <Callout kind="note">
          The middle grounds are worth knowing: <Term>long polling</Term>{" "}
          (the server holds the request open until there&apos;s news) and{" "}
          <Term>server-sent events</Term> (one-way push over plain HTTP).
          Rule of thumb: chat and games want sockets; a badge count that
          updates hourly wants a poll.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
