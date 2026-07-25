import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { FanoutFigure } from "@/lessons/distributed/fanout-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fan-out: Push vs Pull",
};

export default function FanoutPage() {
  return (
    <Lesson slug="fanout">
      <LessonSection id="push-vs-pull">
        <Lead>
          A home timeline is a join: everyone you follow, newest first. The
          only real question is <em>when</em> you run it — once per post, or
          once per app open.
        </Lead>
        <P>
          <Strong>Push</Strong> (<Term>fan-out on write</Term>) runs it at
          write time: the moment a post is created, a copy is written into
          every follower&apos;s timeline. Reads become a single lookup of a
          list that already exists — and one post costs as many writes as
          the author has followers.
        </P>
        <P>
          <Strong>Pull</Strong> (<Term>fan-out on read</Term>) runs it at
          read time: the post is stored once, and when someone opens the
          app you fetch the recent posts of everyone they follow and merge.
          One write per post, forever — and every feed load pays for a
          few-hundred-way merge, over and over, for as long as anyone keeps
          scrolling.
        </P>
        <P>
          Neither is a trick. They are the same work, billed to different
          sides of the system: push buys cheap reads with expensive writes,
          pull buys cheap writes with expensive reads. What decides between
          them is not taste but <Strong>ratio</Strong> — how many times a
          post is read versus written, and how lopsided the follower graph
          is.
        </P>
      </LessonSection>

      <LessonSection id="celebrity">
        <P>
          The simulation starts in push. Watch the first scripted post at
          10³ followers: a thousand timeline writes hit the{" "}
          <Term>fanout-q</Term>, the three-node fleet applies them at 2,000
          writes/s, and the backlog is gone before you finish this
          sentence. Fan-out on write is genuinely great — at normal scale.
        </P>
        <P>
          Now break it yourself. Drag <Term>10^N followers</Term> — each
          notch is a decade, 10² up to 10⁷ — and press <Term>POST</Term>.
          The stage never draws a dot per write (the packet pool holds 128;
          you are asking for millions), so read the aggregates instead: the
          backlog plate above the queue, the load bar filling one seventh
          per decade, and <Term>timeline staleness</Term> — backlog ÷ drain
          rate, the seconds until the last follower sees the post.
        </P>
        <FanoutFigure />
        <Callout kind="warning">
          Staleness drains at exactly one second per second, because the
          fleet is already flat out. So a 5,000,000-follower post is not
          &ldquo;slow&rdquo; — it is <Strong>~42 minutes</Strong> of queue
          at 2,000 writes/s, during which the account is posting again.
          Doubling the fleet moves that wall to 21 minutes. It does not
          remove it.
        </Callout>
      </LessonSection>

      <LessonSection id="hybrid">
        <P>
          Switch <Term>fan-out</Term> to <Term>pull</Term> and post again:
          write cost collapses to 1, the backlog stays empty, staleness is
          zero — and <Term>read ops</Term> climbs with the reader-rate
          slider, because every single feed load now merges 200 author
          feeds. You did not delete the work. You moved it to the busiest
          path in the system.
        </P>
        <P>
          <Term>Hybrid</Term> is the split that actually ships:{" "}
          <Strong>push for ordinary accounts, pull for the celebrities</Strong>.
          The vast majority of posts fan out on write, exactly as before,
          because a thousand writes is nothing. The handful of accounts
          with millions of followers are written once and merged into each
          timeline at read time — so a feed load costs one precomputed
          lookup plus a few celebrity feeds, and no single tap can ever
          queue five million writes.
        </P>
        <Callout kind="insight">
          This is how real home timelines work — Twitter/X famously runs
          fan-out on write with celebrity accounts carved out, and
          Instagram-style feeds land in the same place from the other
          direction. The general principle outlives the example:{" "}
          <Strong>fan-out cost should follow the shape of the graph, not
          one rule</Strong>. When a distribution has a tail this heavy, the
          tail gets its own policy — otherwise the tail becomes the system.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
