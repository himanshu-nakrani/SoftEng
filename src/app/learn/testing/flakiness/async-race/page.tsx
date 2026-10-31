import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  AsyncRaceAwaitingFigure,
  AsyncRaceSleepFigure,
} from "@/lessons/flakiness/async-race-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("async-race");

export default function AsyncRacePage() {
  return (
    <Lesson slug="async-race">
      <LessonSection id="sleep-anti-pattern">
        <Lead>
          An arbitrary sleep is not synchronization &mdash; it is a race condition
          with a delay timer attached.
        </Lead>
        <P>
          The two previous lessons showed tests colliding over shared slots and
          borrowing unmanaged setup. This lesson examines the most pervasive flake
          in asynchronous testing: racing against background execution.
        </P>
        <P>
          When code kicks off an asynchronous worker &mdash; writing to a database,
          dispatching an event, or polling an external API &mdash; a test runner
          needs to wait until that worker completes before evaluating assertions.
          Because the exact completion moment is unknown, developers frequently
          reach for an arbitrary delay: <Term>sleep</Term>(50ms).
        </P>
        <P>
          On a local development machine with an idle CPU, the background worker
          might finish in 5ms. A 50ms sleep feels generous, and the test passes on
          every local run. But when the suite runs in CI under container CPU limits,
          noisy neighbors, and thread scheduling contention, the worker is delayed
          or preempted. The test runner wakes up, evaluates its assertion before the
          worker writes its result, and fails.
        </P>
        <Callout kind="warning">
          Increasing the sleep from 50ms to 500ms does not fix the underlying race.
          It inflates the suite&rsquo;s total runtime while merely shifting the odds
          of an unlucky preemption. Any fixed sleep remains a wager against
          scheduler latency.
        </Callout>
      </LessonSection>

      <LessonSection id="timing-jitter">
        <P>
          Below is a model of an asynchronous worker and a test runner. The worker
          performs background work and writes <Strong>ready = 1</Strong>. In the
          sleep implementation, the test sleeps for 50ms and then asserts that{" "}
          <Strong>ready == 1</Strong>.
        </P>
        <TryThis>
          <LI>
            The figure opens at a <Strong>failing</Strong> seed (seed 42): the
            test runner wakes up from sleep and asserts before the worker has
            landed its write. The test sees <Strong>ready == 0</Strong> and fails,
            even though the worker completes immediately afterward.
          </LI>
          <LI>
            Reseed to seed 0: the scheduler gives the worker CPU time first, the
            worker sets <Strong>ready = 1</Strong>, and the test passes. The code
            is identical; only the scheduling order changed.
          </LI>
          <LI>
            Reseed across many runs: about <Strong>half</Strong> of the orders
            fail &mdash; 110 of the first 200 seeds, 517 of the first 1000.
          </LI>
        </TryThis>
        <AsyncRaceSleepFigure />
        <Callout kind="insight">
          The test did not fail due to a defect in logic. It failed because a fixed
          sleep assumes a hard upper bound on scheduler latency that preemptive
          operating systems and virtualized runtimes do not guarantee.
        </Callout>
      </LessonSection>

      <LessonSection id="deterministic-awaits">
        <Lead>
          Reliable asynchronous tests synchronize on state conditions, never on
          elapsed time.
        </Lead>
        <P>
          The deterministic solution is to replace the arbitrary sleep with
          explicit <Term>condition polling</Term> or an <Term>await</Term> on the
          expected event. Instead of guessing how long the worker needs, the test
          runner explicitly yields execution until <Strong>ready == 1</Strong> holds.
        </P>
        <TryThis>
          <LI>
            In the figure below, the test runner executes an{" "}
            <Strong>await ready == 1</Strong> condition wait. Notice the test lane
            parks in a blocked state while the worker executes.
          </LI>
          <LI>
            Reseed as many times as you like. With condition awaiting, exactly{" "}
            <Strong>0 of 1000</Strong> runs fail. The assertion cannot execute
            until the condition is satisfied.
          </LI>
        </TryThis>
        <AsyncRaceAwaitingFigure />
        <P>
          Modern testing frameworks embody this principle through primitives like
          Testing Library&rsquo;s <Strong>waitFor</Strong> or Playwright&rsquo;s
          auto-waiting assertions: they poll the target state with tight intervals
          under an overall timeout that only trips if the operation actually deadlocks.
        </P>
        <Callout kind="note">
          Condition polling is both faster and more reliable: on fast runs, the test
          resumes the millisecond the write lands rather than sleeping out an
          arbitrary duration, while under heavy CI load it patiently waits for the
          worker without flaking.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
