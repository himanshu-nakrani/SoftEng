import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { QuorumsFigure } from "@/lessons/distributed/quorums-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("quorums");

export default function QuorumsPage() {
  return (
    <Lesson slug="quorums">
      <LessonSection id="why-majority">
        <Lead>
          Replication gives you five copies of the data. The question a quorum
          answers is: how many of them do you have to hear from before you dare
          call an answer correct?
        </Lead>
        <P>
          The lazy answer is <Strong>all five</Strong>. Wait for every replica
          on a write and read every replica back, and you can never be wrong —
          but one slow or dead node now stalls every operation. The prior lesson
          on <Term>replication</Term> showed the opposite failure: return the
          moment the leader commits, replicate later, and a read from a lagging
          replica time-travels into the past. A quorum is the middle. You commit
          a write once <Term>W</Term> replicas have acked, and you answer a read
          from <Term>R</Term> replicas — with W and R both less than the five,
          so no single straggler blocks you.
        </P>
        <P>
          That sounds like it should let stale reads through, and it can. What
          stops it is one inequality. The five replicas are a fixed set; a write
          lands its newest version on some W of them, a read inspects some R of
          them. If <Strong>R + W {">"} N</Strong>, those two subsets are too big
          to fit inside five without touching — every read set must contain at
          least one replica that saw the newest write. The read takes the
          highest version it finds, so it cannot miss it. When R + W ≤ N the two
          sets can be disjoint, and a read that lands entirely on replicas the
          write skipped returns the previous value: real, committed, and stale.
        </P>
      </LessonSection>

      <LessonSection id="write-quorum">
        <TryThis>
          <LI>Leave W = R = 3 and let it run. The R + W − N meter reads +1, and the stale-read gauge sits at zero.</LI>
          <LI>Drag W down to 1. Writes commit on a single replica now — but watch what happens once the store reconfigures both quorums to 2.</LI>
        </TryThis>
        <QuorumsFigure />
        <Callout kind="insight">
          At W = 3, R = 3, N = 5 the overlap meter is +1 and no read ever comes
          back orange: over a hundred seconds of steady traffic (seed 42), the
          stale-read fraction is exactly <Strong>0%</Strong>. Widening W to 4
          keeps it at 0% too — more overlap never hurts correctness, it only
          costs more acks per write. A write returning after W acks does not
          mean the other replicas never get the data; they do, a moment later.
          It means the commit did not <Strong>wait</Strong> for them.
        </Callout>
      </LessonSection>

      <LessonSection id="read-quorum">
        <TryThis>
          <LI>During the scripted window the store runs at R = W = 2. R + W = 4, the overlap meter goes to −1, and orange reads appear.</LI>
          <LI>Set R = 3, W = 2 yourself (R + W = 5, exactly N). The overlap meter reads 0 — the boundary. Watch the gauge settle around a tenth.</LI>
          <LI>Now R = 1, W = 1. Every write touches one replica, every read one replica; they rarely match.</LI>
        </TryThis>
        <QuorumsFigure />
        <Callout kind="insight">
          The stale-read rate is pure overlap arithmetic (seed 42, measured over
          100s of steady traffic each): at <Strong>R + W = 4</Strong> (W = 2,
          R = 2) about <Strong>31%</Strong> of reads are stale; at{" "}
          <Strong>R + W = 5</Strong> — the boundary, overlap 0 — it drops to
          roughly <Strong>10%</Strong> (9.9% for W = 3 R = 2, 11.4% for W = 2
          R = 3); and at R + W = 6 it is zero. Push both quorums to the floor,
          R = W = 1, and <Strong>four reads in five</Strong> (80%) come back
          stale. Equal-or-below-N is not &ldquo;usually fine&rdquo; — it is a coin the
          system flips on every read.
        </Callout>
      </LessonSection>

      <LessonSection id="tuning">
        <Lead>
          R + W {">"} N is the only correctness rule. Everything else is where
          you spend the slack.
        </Lead>
        <P>
          The rule fixes a sum, not the split, so you get to choose which
          operation pays. A write-heavy store can set W low and R high — a write
          finishes after one ack, a read pays by consulting more replicas. A
          read-heavy store does the reverse: R = 1 for instant reads, and W
          large enough to keep R + W {">"} N. Either way the guarantee is
          identical; you have only moved the cost between the two paths. The
          figure shows this directly — W = 1, R = 5 and W = 5, R = 1 both hold
          the stale rate at 0%.
        </P>
        <P>
          The other cost is <Strong>availability under failure</Strong>. A
          quorum you cannot assemble is a quorum that refuses. Kill replicas in
          the figure: with W = 3, the store keeps committing while three
          replicas survive, but once a third one dies and only two remain, no
          write can gather its three acks — every write is{" "}
          <Strong>rejected</Strong> rather than dropped, a policy refusal, and
          the rejected-writes counter climbs. That is the deliberate trade: a
          higher W buys stronger overlap and cheaper reads, and pays for it by
          tolerating fewer failures before writes stop. This is a believable
          model of the arithmetic, not a real store — there is no read-repair or
          anti-entropy here, so a replica the write skipped stays behind until
          the next write happens to include it.
        </P>
        <Callout kind="note">
          The majority quorum, W = R = ⌈(N+1)/2⌉ — here 3 of 5 — is the
          symmetric choice: the smallest W and R that still satisfy R + W {">"}
          N, so it tolerates the most failures (any minority can be down) while
          keeping both paths as cheap as the rule allows. It is the default for
          a reason, but it is a default, not a law.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
