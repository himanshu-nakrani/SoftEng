import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis, UL } from "@/components/lesson/prose";
import { CanaryReleasesFigure } from "@/lessons/delivery/canary-releases-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("canary-releases");

export default function CanaryReleasesPage() {
  return (
    <Lesson slug="canary-releases">
      <LessonSection id="all-at-once">
        <Lead>
          The new build passed every test you have. That is not the same as
          saying it works — it only says it survives the inputs you thought to
          write down. The way you find out about the rest is by giving it real
          traffic, and the only question is how much.
        </Lead>
        <P>
          The tempting answer is all of it. You have one fleet, you flip it to{" "}
          <Term>v1.5</Term>, and every request now meets the new version. If it
          is good, you are done in one move. If it is bad — if it errors on the
          requests it receives — then every request meets a version that
          errors, and your error rate is the version&apos;s error rate. There is
          no fraction of users who got lucky. A deploy that fails{" "}
          <Strong>100%</Strong> of what it touches, given 100% of the traffic,
          fails <Strong>100%</Strong> of requests.
        </P>
        <P>
          A <Term>canary release</Term> refuses that bet. Instead of moving the
          whole fleet at once, you route a small, chosen fraction of traffic to
          the new version and leave everyone else on the version you already
          trust. The name is the coal-mine bird: it is exposed first, on
          purpose, so that its distress is your warning and not your outage.
        </P>
      </LessonSection>

      <LessonSection id="canary">
        <TryThis>
          <LI>
            The run opens at <Term>0%</Term> canary share — every request goes
            to <Term>v1.4</Term> and comes back clean. Let it run to the{" "}
            <Term>t=9</Term> beat, where it ships <Term>v1.5</Term> to 20% of
            traffic and the first red errors appear.
          </LI>
          <LI>
            Now drag <Term>canary share</Term> yourself. Watch the{" "}
            <Term>error rate</Term> meter track the handle — and watch that
            green still outnumbers red on the stage, because most requests never
            touch the bad version.
          </LI>
        </TryThis>
        <CanaryReleasesFigure />
        <P>
          <Term>v1.5</Term> is deliberately a bad version: it errors on roughly{" "}
          <Strong>80%</Strong> of the requests it receives. What the canary
          share changes is not that failure rate — it is how many requests are
          exposed to it. At a <Term>20%</Term> share about four of every five
          requests still go to the healthy <Term>v1.4</Term>, so the overall
          error rate lands near <Strong>16%</Strong> — the share times the
          version&apos;s own failure rate, which the noisy meter samples around
          rather than pins exactly. Push the share to <Term>100%</Term> and the
          bound is gone: the error rate climbs to roughly <Strong>80%</Strong>,
          essentially the bad version&apos;s failure rate, because now nothing
          is protected from it.
        </P>
        <Callout kind="insight">
          The error rate is the canary share multiplied by how bad the version
          is. The version&apos;s badness is fixed the moment you build it; the
          share is the one term you control at deploy time. Choosing a small
          share is choosing a small blast radius.
        </Callout>
      </LessonSection>

      <LessonSection id="rollback">
        <TryThis>
          <LI>
            Push <Term>canary share</Term> up so the error rate is clearly
            elevated, then press <Term>roll back</Term>.
          </LI>
          <LI>
            Watch the error rate collapse back to the baseline within a second
            or two — and count how few new red errors appear after you press it.
          </LI>
        </TryThis>
        <P>
          The bound on the damage is only half of what the canary buys you. The
          other half is that the error rate is now a <Strong>signal</Strong>{" "}
          instead of a catastrophe. A small share failing is visible on the
          meter and survivable at the same time, which means you get to notice
          it and act on it before it becomes everyone&apos;s problem.
        </P>
        <P>
          Acting on it is one move: send the canary&apos;s traffic back to the
          version that works. Press <Term>roll back</Term> and the share drops
          to zero — in the run, an error rate sitting above <Strong>70%</Strong>{" "}
          falls to under <Strong>1%</Strong> almost immediately, and the only
          errors that still arrive are the handful of requests already in flight
          when you pressed it. That is the property a canary is built to give
          you: a bad release is not a disaster you have to dig out of, it is a
          slider you can move back. Killing <Term>v1.5</Term> outright by
          clicking it makes the point from the other side — its share of traffic
          then fails completely, and the error rate rises to match exactly that
          share.
        </P>
        <Callout kind="insight">
          Roll back cost you the fraction of requests the canary was serving,
          for the time it took you to react — and nothing else. The comparison
          is not &quot;canary versus no bug.&quot; It is &quot;a bounded, brief,
          reversible failure&quot; versus &quot;the whole fleet on the bad
          version.&quot;
        </Callout>
      </LessonSection>

      <LessonSection id="blind-spots">
        <Lead>
          A canary is a sampling instrument, and it is honest only about what it
          samples. It catches the faults that show up in the traffic it
          receives, at the scale it runs, for the time it runs — and it is blind
          to everything else.
        </Lead>
        <P>
          The failure in the simulation is the easy kind: loud, immediate, and
          uniform across requests. Route 5% of traffic to it and 5% of requests
          fail, right away, on the meter. Real bad versions are not always so
          cooperative. Consider what a small, short canary genuinely has not
          seen:
        </P>
        <UL>
          <LI>
            <Strong>A bug behind a rare input.</Strong> If the fault only fires
            on a code path one request in ten thousand takes, a 5% canary
            handling a few hundred requests may never take that path at all. The
            error rate reads zero because the trigger never arrived, not because
            it is not there.
          </LI>
          <LI>
            <Strong>A slow resource leak.</Strong> A version that leaks a little
            memory per request looks perfect for the first several minutes and
            falls over an hour later. A canary you promoted after two minutes of
            clean traffic promoted a version whose failure had not started yet.
          </LI>
          <LI>
            <Strong>A failure that only appears at full scale.</Strong> Contention
            on a shared lock, a connection pool that is fine at 5% load and
            exhausts at 100%, a cache that only thrashes under the full key set —
            these are invisible to a canary by definition, because the canary is
            running at a fraction of the load that causes them.
          </LI>
        </UL>
        <P>
          A 5% canary running for two minutes has seen 5% of the traffic for two
          minutes, and nothing else. That is the whole of its evidence. A clean
          canary is a reason to widen the share and wait, watching the same
          signal at the larger scale and the longer duration — not a proof that
          the version is good. The value is real and the bound is real; so is
          the edge of what it can tell you.
        </P>
      </LessonSection>
    </Lesson>
  );
}
