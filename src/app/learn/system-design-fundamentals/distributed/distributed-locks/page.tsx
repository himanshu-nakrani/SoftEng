import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { DistributedLocksFigure } from "@/lessons/distributed/distributed-locks-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("distributed-locks");

export default function DistributedLocksPage() {
  return (
    <Lesson slug="distributed-locks">
      <LessonSection id="across-machines">
        <Lead>
          A mutex inside one process is backed by memory the whole program can
          see. A lock across machines has no such shared ground: the worker
          holding it and the service granting it are connected only by messages,
          and messages can be slow, lost, or overtaken.
        </Lead>
        <P>
          That gap forces one hard decision. If a worker takes the lock and then
          goes silent, the lock service has to choose between two stories it{" "}
          <Strong>cannot tell apart</Strong>: the worker crashed and will never
          come back, or the worker is merely slow and will finish any moment. Wait
          forever on the first story and one dead worker freezes the system.
          Reclaim too eagerly on the second and you hand the lock to someone else
          while the original holder is still working.
        </P>
        <P>
          The universal answer is a <Term>lease</Term>: the lock is granted for a
          fixed span of time and expires on its own. The service stops needing to
          know whether the holder is alive — it only watches a clock. That trades
          the impossible question for a comfortable one, and it is where the
          trouble begins, because a lease is a bet about elapsed time, and time
          is exactly the thing a distributed system is worst at agreeing on.
        </P>
      </LessonSection>

      <LessonSection id="lease-expiry">
        <P>
          Watch the steady state first: <Strong>worker-a</Strong> holds the lease,
          writes to the store, and renews before the lease runs out. Then a
          scripted beat freezes it — a garbage-collection pause, a descheduled VM,
          any stall that stops the process without killing it.
        </P>
        <TryThis>
          <LI>
            Let it run. worker-a is paused for one lease plus a margin, so it
            misses its renewal and its lease lapses while it is frozen.
          </LI>
          <LI>
            The surprise: a paused process stops keeping time too. worker-a wakes
            up still believing it holds the lock, because from inside the freeze
            no time passed at all.
          </LI>
        </TryThis>
        <DistributedLocksFigure />
        <P>
          The lock service cannot tell the pause from a crash, so once its lease
          timer runs out it reclaims the lock and grants it to{" "}
          <Strong>worker-b</Strong>, which acquires it legitimately. For a few
          seconds two workers each believe they hold the one lock — the stage says{" "}
          <Strong>TWO HOLDERS · ONE LOCK</Strong>. When worker-a wakes and writes,
          its write goes straight to the store, which knows nothing about leases;
          it just records what it is told. Now two writers have touched the shared
          resource, which is the exact outcome the lock existed to prevent.
        </P>
        <Callout kind="warning">
          No timeout fixes this. Whatever expiry you pick, a pause can exceed it —
          garbage collectors and hypervisors do not consult your lease. Making the
          lease shorter only makes the service reclaim it sooner, widening the
          window in which a slow-but-alive holder becomes a stale one. The failure
          is structural, not a matter of tuning.
        </Callout>
      </LessonSection>

      <LessonSection id="fencing">
        <P>
          The fix does not try to stop the stale holder from writing — it cannot
          be reached, and it does not know it is stale. Instead it moves the check
          to the one place every write must pass: the store. Each lease grant
          carries a <Term>fencing token</Term>, a number that only ever increases.
          worker-a held token 1; when the service re-granted the lock, worker-b
          got token 2. The store remembers the highest token it has accepted and{" "}
          <Strong>rejects</Strong> any write carrying a lower one.
        </P>
        <TryThis>
          <LI>
            Turn on <Strong>fencing tokens</Strong> and let the same beat play. The
            store&rsquo;s fence rises to 2 when worker-b writes.
          </LI>
          <LI>
            The stale write from worker-a still arrives — but now it carries token
            1, below the fence, so the store refuses it. The refusal is a policy
            decision, not a dropped packet; watch the writes-rejected meter climb
            in grey.
          </LI>
        </TryThis>
        <DistributedLocksFigure />
        <P>
          The two runs are worth comparing directly. By roughly twenty-five
          seconds at the default settings, both have accepted the same{" "}
          <Strong>twelve</Strong> good writes and left the store&rsquo;s token at{" "}
          <Strong>2</Strong>, and in both the split-brain is real — two workers
          believe they hold the lock either way. The difference is only what the
          store does with the stale writer&rsquo;s writes: with fencing off,{" "}
          <Strong>nine</Strong> of them land and corrupt the resource; with fencing
          on, those same nine are <Strong>rejected</Strong> and the corruption
          count stays at zero.
        </P>
        <Callout kind="insight">
          Fencing does not prevent the split-brain — two holders still exist. It
          makes the split-brain <Strong>harmless</Strong>, by giving the shared
          resource the last word. Correctness stops depending on whether the lease
          expiry was accurate and starts depending only on a monotonic counter,
          which no pause can turn back.
        </Callout>
      </LessonSection>

      <LessonSection id="clocks">
        <Lead>
          A lease is a bet on elapsed time, and every party to it reads a
          different clock. The holder times its own work, the service times the
          lease, and neither clock is guaranteed to advance at the same rate — nor
          to advance at all, during a pause.
        </Lead>
        <P>
          That is why tightening clock synchronization does not rescue the naive
          lock. Even with perfect clocks, a process frozen mid-operation resumes
          believing no time has passed; the wall clock moved, but the worker&rsquo;s
          view of it did not. Clock <Term>skew</Term> between machines makes it
          worse, but it is not the root cause — the pause alone is enough. Expiry,
          in a distributed system, is <Strong>advisory</Strong>: a hint about who
          probably still holds the lock, never a guarantee.
        </P>
        <P>
          Fencing is what converts that advisory hint into a safety guarantee. The
          lease still decides who <Strong>gets</Strong> to act, on a best-effort
          timer; the token decides whose action is allowed to <Strong>land</Strong>
          , with no timing assumption at all. That division — a clock for
          liveness, a monotonic counter for safety — is the pattern behind every
          correct distributed lock, and it is why any lock built on expiry alone is
          a lock only when nothing pauses.
        </P>
      </LessonSection>
    </Lesson>
  );
}
