import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Compare,
  CompareCol,
  Lead,
  LI,
  P,
  Strong,
  Term,
  TryThis,
  UL,
} from "@/components/lesson/prose";
import { GeoReplicationFigure } from "@/lessons/distributed/geo-replication-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("geo-replication");

export default function GeoReplicationPage() {
  return (
    <Lesson slug="geo-replication">
      <LessonSection id="speed-of-light">
        <Lead>
          Every constraint in this track so far has been an engineering
          decision wearing a costume. Capacity, replication lag, quorum size,
          timeout budgets — all of them move if you spend enough. This lesson
          is about the one that doesn&apos;t.
        </Lead>
        <P>
          Light in fiber travels about <Strong>200 km per millisecond</Strong>{" "}
          — two thirds of light in vacuum, because glass is slower than nothing.
          Virginia to Ireland is roughly 5,500 km, so a round trip between them
          is 11,000 km of glass and <Strong>at least 56 ms</Strong>. Real links
          measure closer to 75 or 80, because fiber follows shipping lanes and
          right-of-way rather than great circles, and every router on the path
          adds its own microseconds.
        </P>
        <P>
          Nothing in your stack touches that number. A faster disk doesn&apos;t.
          A bigger instance doesn&apos;t. A better protocol shaves the
          handshakes, not the distance. <Term>80 ms</Term> is not a performance
          problem to be tuned — it is 16,000 km of fiber, and it is the same
          this year as it will be in twenty. Which means: any design where a
          user in one region has to wait for a machine in another region has
          already spent that budget, on every single write, forever.
        </P>
        <P>
          So this is the capstone, and it is not a new idea. It is every idea
          from this module — <Term>replication lag</Term>,{" "}
          <Term>CAP</Term>, <Term>last-write-wins</Term>,{" "}
          <Term>failover</Term> — run at a distance where the network delay
          stops being an implementation detail and becomes the product
          decision. Two regions, one dataset, and exactly two ways to arrange
          them. Both are correct. Both cost something, and the something is
          visible on a meter.
        </P>
      </LessonSection>

      <LessonSection id="two-regions">
        <P>
          Two regions with their own users and their own database, and one
          ocean between them. In <Strong>active-active</Strong>, the default
          here, each database answers its own region&apos;s writes immediately —
          about 17 ms, a hop across a datacenter — and ships the change across
          afterwards. That is the entire trick, and it is why the local number
          is so good: <Strong>the write is fast because it hasn&apos;t told the
          truth yet</Strong>. For one full crossing, the other side of the
          planet has no idea it happened.
        </P>
        <P>
          The divider prints the crossing you are watching, in milliseconds and
          in kilometres of fiber, and the packets obey it — drag{" "}
          <Term>inter-region rtt</Term> to 300 ms and a single replication dot
          takes nearly four seconds to cross the stage, because that is what
          150 ms each way looks like when you can see it.
        </P>
        <GeoReplicationFigure />
        <P>
          The badge over each database says what it may do with a write, and
          the chip under each app is what that region&apos;s users are actually
          waiting. Watch the two latency meters together: in active-active they
          are twins. Everything that follows is about what that symmetry costs.
        </P>
        <TryThis>
          <LI>
            Leave everything alone and watch{" "}
            <Term>conflicts (lww losses)</Term> climb. Eight deliberately hot
            rows, two continents, three writes a second each — and roughly one
            write in three is quietly overwritten by a write it never saw.
          </LI>
          <LI>
            Now drag <Term>inter-region rtt</Term> from 40 to 300. The counter
            more than doubles, because the flight window is exactly how long
            two regions are allowed to write in the dark. Drop{" "}
            <Term>write rate / region</Term> to 1 instead and it nearly stops —
            same system, colder keys.
          </LI>
          <LI>
            Flip <Term>write mode</Term> to single-primary and watch the two
            latency meters split: us-east doesn&apos;t move, eu-west steps onto
            the ocean and stays there. Conflicts stop dead in the same instant.
          </LI>
        </TryThis>
      </LessonSection>

      <LessonSection id="conflict-or-wait">
        <P>
          That is the whole decision, and the figure puts both halves of it on
          screen at once. There is no third arrangement.
        </P>
        <Compare>
          <CompareCol title="active-active">
            Every region writes locally, 17 ms, always available even when the
            other region is gone. In exchange, two regions can update the same
            key inside one flight window, and when the copies meet{" "}
            <Term>last-write-wins</Term> keeps one. The other write is deleted:
            no error, no retry, no log line anyone reads. The orange dot
            travelling back to the client is the sim being kinder than reality —
            in production, nobody is told at all.
          </CompareCol>
          <CompareCol title="single-primary">
            One region owns the writes, so there is exactly one order of events
            and conflicts are impossible by construction. In exchange, half
            your users pay a full inter-region round trip on every save — 100 ms
            against 17 — and when the primary&apos;s region dies, they can&apos;t
            write at all until somebody promotes a replacement.
          </CompareCol>
        </Compare>
        <P>
          Notice which meter each mode moves. Nothing you can buy makes both
          numbers small: the conflict counter and the eu-west latency trace are
          two readings of the same physics, and pushing one down pushes the
          other up. What you can do is <Strong>choose per operation</Strong>,
          which is what real systems do — the shopping cart goes active-active,
          the payment goes to a primary, and they live in the same product.
        </P>
        <P>
          Last-write-wins is only the cheapest resolution, not the only one.
          The alternatives all cost you something in the data model rather than
          the network:
        </P>
        <UL>
          <LI>
            <Term>CRDTs</Term> — counters, sets and sequences with a merge
            defined so that any two copies converge to the same value, no
            matter what order the updates arrive in. Both writes survive.
            &quot;Add to cart&quot; merges beautifully; &quot;change my
            shipping address&quot; has no merge, only a choice.
          </LI>
          <LI>
            <Term>Vector clocks</Term> — don&apos;t resolve anything, but they
            can tell a genuine conflict from a stale overwrite, so the system
            can hand both versions to the application instead of guessing.
          </LI>
          <LI>
            <Term>Application merge</Term> — you write the function. The most
            work, and the only option that can encode &quot;the newer address
            wins unless the older one has a completed shipment against it&quot;.
          </LI>
        </UL>
        <Callout kind="warning">
          Last-write-wins also assumes the two clocks agree. They don&apos;t:
          two servers a continent apart can disagree by tens of milliseconds,
          which is the same order as the flight window they are resolving. A
          write can lose to one that happened after it in real time — which is
          why systems that take this seriously either synchronise clocks
          obsessively or refuse to use wall time as an arbiter at all.
        </Callout>
      </LessonSection>

      <LessonSection id="region-failover">
        <P>
          Then us-east dies — not a server, the region. Kill it yourself, or
          watch the scripted outage, and run it in both modes, because the
          difference is the entire argument.
        </P>
        <P>
          In <Strong>active-active</Strong> nothing happens to eu-west. It was
          already a full copy and already its own users&apos; writer, so there
          is no election, no promotion and no data loss — its writes keep
          committing in 17 ms while the other half of the stage turns red. That
          is the pitch, and the conflicts counter has been paying for it every
          second of every ordinary day since the run started.
        </P>
        <P>
          In <Strong>single-primary</Strong> the same outage is an incident.
          eu-west&apos;s writes cross an ocean to find nobody home and come back
          red, and they keep doing that until a promotion — which the sim does
          for you at a suspiciously convenient moment. Watch{" "}
          <Term>lost writes</Term> jump when it lands: those are writes us-east
          committed and acknowledged but never shipped, and the new primary has
          never heard of them. That number is your <Term>RPO</Term>, and its
          size is the replication lag at the moment of death. The badge on the
          dead region shows it accumulating live, before the failover claims it.
        </P>
        <P>
          The runbook reality is worse than the animation in three ways worth
          naming:
        </P>
        <UL marker="index">
          <LI>
            <Strong>The promotion is a decision, not an event.</Strong> Somebody
            has to be sure the old primary is really dead rather than briefly
            unreachable, because two primaries accepting writes at once is
            <Term>split brain</Term> and it is far more expensive than an
            outage. That is why real failovers are fenced, and why the minutes
            of paging are usually longer than the outage that caused them.
          </LI>
          <LI>
            <Strong>The old region comes back.</Strong> When it does, it is
            holding writes that no longer exist anywhere else. It must be
            rewound, not merged — which the sim does silently, and which in
            production is the part that generates the support tickets.
          </LI>
          <LI>
            <Strong>Your users have to be steered.</Strong> Promoting a database
            achieves nothing while traffic still resolves to a dead region;
            moving it — DNS with health checks, anycast, a global load balancer
            — is its own machinery with its own failure modes, and its own
            lesson.
          </LI>
        </UL>
        <Callout kind="insight">
          Two production systems, one sentence each.{" "}
          <Term>Google Spanner</Term> takes the wait: writes go through a
          consensus round across regions and commit-wait for clock uncertainty
          on top, so you get one global order and pay for it on every write.{" "}
          <Term>DynamoDB global tables</Term> take the merge: every region
          accepts writes locally and reconciles by last-writer-wins, so you get
          local latency everywhere and lose the writes that lost. Same physics,
          opposite invoice — and you have now watched both of them run.
        </Callout>
        <Callout kind="note">
          Which closes the track. Twenty-two lessons back it was one client and
          one server, and the only question was whether the server could keep
          up. Everything since has been a variation on one theme: the moment
          your system is bigger than a single machine, correctness stops being
          a property of code and becomes a property of{" "}
          <Strong>time, distance and failure</Strong> — three things you
          negotiate with, never defeat.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
