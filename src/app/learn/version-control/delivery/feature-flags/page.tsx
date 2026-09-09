import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis, UL } from "@/components/lesson/prose";
import { FeatureFlagsFigure } from "@/lessons/delivery/feature-flags-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("feature-flags");

export default function FeatureFlagsPage() {
  return (
    <Lesson slug="feature-flags">
      <LessonSection id="deploy-vs-release">
        <Lead>
          A canary and a blue-green deploy both answer the same question: which
          build is running. To undo either one, you deploy again. A feature flag
          asks a different question, and its answer is that you do not have to
          deploy to change what your users see at all.
        </Lead>
        <P>
          The move is to ship the new code to every server with it turned{" "}
          <Strong>off</Strong>. It compiles, it deploys, it sits in production on
          the whole fleet — and it does nothing, because a runtime value gates
          the branch that reaches it. Nobody runs it. That is a{" "}
          <Term>deploy</Term>: the code is present. It is not yet a{" "}
          <Term>release</Term>: no user meets it.
        </P>
        <P>
          <Term>Releasing</Term> is then a separate act — flipping that runtime
          value. No image is built, nothing is rolled out; a request that used to
          take the old branch takes the new one on its next call. Because the
          release is a value and not a deployment, undoing it is a value too: you
          flip it back and the new branch goes dark again in the time it takes to
          write one field. That decoupling is the whole idea, and it is exactly
          what the other two methods lack — their rollback is a deployment
          because their release was one.
        </P>
      </LessonSection>

      <LessonSection id="dark">
        <TryThis>
          <LI>
            The run opens with the flag <Term>off</Term>. The new path is drawn
            on the stage but takes no traffic — deployed, and dark. Let it reach
            the <Term>t=9</Term> beat, where the flag flips on for everyone.
          </LI>
          <LI>
            Watch the <Term>traffic on new path</Term> bar climb to full and red
            errors appear — with no deploy having happened. The build never
            changed; only a value did.
          </LI>
        </TryThis>
        <FeatureFlagsFigure />
        <P>
          The new path is deliberately bad: it errors on roughly{" "}
          <Strong>70%</Strong> of the requests it runs. While the flag is off,
          the error rate sits near the old path&apos;s baseline of about{" "}
          <Strong>1%</Strong> — the new code is present on every server and
          contributes nothing, because no request is routed through it. When the
          flag flips on at <Term>t=9</Term>, every request begins taking the new
          branch: in the run the error rate climbs from zero through about{" "}
          <Strong>24%</Strong> a second and a half later, past <Strong>60%</Strong>{" "}
          at three seconds, and settles near the path&apos;s own{" "}
          <Strong>70%</Strong> failure rate as the last old-path responses drain.
        </P>
        <Callout kind="insight">
          Nothing was deployed between the dark state and the failing state. The
          same build produced both. The flag is the only thing that moved, which
          is why moving it back is not a rollback deploy — it is the same one
          value, set the other way.
        </Callout>
      </LessonSection>

      <LessonSection id="releasing">
        <TryThis>
          <LI>
            After the flip, once the error rate is clearly elevated, press{" "}
            <Term>kill flag</Term> and watch the error counter stop climbing
            almost at once — no deploy, just the value set back to off.
          </LI>
          <LI>
            Now set <Term>flag</Term> to <Term>on for beta</Term>. Only the
            labelled cohort — about a fifth of requests — runs the new path, so
            the error rate lands near a fifth of what &ldquo;on for
            everyone&rdquo; produced.
          </LI>
        </TryThis>
        <FeatureFlagsFigure />
        <P>
          Killing the flag is the property the other methods cannot match.
          Pressing <Term>kill flag</Term> at an error rate near{" "}
          <Strong>90%</Strong>, the <Term>failed requests</Term> counter freezes
          on the next tick — no request routed to the new path after that — and
          the error rate decays as the in-flight work drains: through the low{" "}
          <Strong>50s</Strong> a second and a half later, under <Strong>20%</Strong>{" "}
          by three seconds, and back to the baseline by around four. The tail is
          the requests already on the new path when you flipped; the flip only
          governs where <em>new</em> requests go. No deployment ran to make any
          of that happen.
        </P>
        <P>
          The second thing a flag can do that a share cannot is choose{" "}
          <em>who</em> by attribute rather than by luck. A canary routes a random
          percentage of traffic; <Term>on for beta</Term> routes a{" "}
          <Strong>named</Strong> cohort — an internal team, one region, the
          accounts that opted in. In the run about <Strong>20%</Strong> of
          requests carry the beta label, so with the flag on for beta the new
          path serves roughly that fifth of traffic and the overall error rate
          settles around <Strong>16%</Strong> — the cohort&apos;s share times the
          path&apos;s own failure rate, which the noisy meter samples around
          rather than pins. The others in that fifth are not unlucky; they are the
          group you chose.
        </P>
        <Callout kind="insight">
          A canary bounds the blast radius by a random <em>fraction</em>; a flag
          can bound it by a chosen <em>attribute</em>. Turning it off costs no
          deployment either way, so the same flip that exposes the cohort is the
          one that retracts it — release and un-release are the same cheap move.
        </Callout>
      </LessonSection>

      <LessonSection id="flag-debt">
        <Lead>
          The flip is free. The flag is not. Every flag you add is a permanent
          fork in the code that has to keep working with the value on and with it
          off, and the two together are the cost the cheerful version of this
          story leaves out.
        </Lead>
        <P>
          A flag is a runtime branch, and a branch is two code paths. Both must
          be correct, which means both must be tested. One flag is two
          configurations. Two independent flags are four; ten are{" "}
          <Strong>1,024</Strong>. In general <Strong>N</Strong> live flags mean{" "}
          <Strong>2^N</Strong> possible combinations of on and off, and a real
          test suite exercises a handful of them — the default set, plus whatever
          combinations someone thought to pin. The rest are configurations your
          system can enter in production and your tests have never run.
        </P>
        <P>
          This is why a flag that outlives its rollout is <Term>debt</Term>. The
          purpose of the flag in this lesson was to release the new path safely
          and to be able to kill it fast. Once the new path is trusted and the
          old one is gone, the flag guards nothing — but the branch is still
          there, still doubling the configuration space, still a value someone
          can flip by accident. The discipline that keeps flags cheap is the part
          most teams skip:
        </P>
        <UL>
          <LI>
            <Strong>A flag is temporary by default.</Strong> It exists to carry
            one release from dark to trusted. Give it an owner and an expiry when
            you create it, not later.
          </LI>
          <LI>
            <Strong>Removing a flag is finishing the release.</Strong> Delete the
            dead branch, keep the path that won, and the configuration space
            halves. A rollout is not done when the flag is on; it is done when the
            flag is gone.
          </LI>
          <LI>
            <Strong>Long-lived flags are a different thing.</Strong> A kill switch
            or an entitlement that is meant to live forever is a real feature, not
            a rollout in progress — and it earns its permanent test coverage on
            both sides precisely because it is permanent.
          </LI>
        </UL>
        <Callout kind="insight">
          The flag decoupled deploy from release, which is what made rollback
          instant. The same decoupling makes the flag itself easy to forget,
          because forgetting it costs nothing today. It costs later, as an
          untested combination in a space that doubled every time someone else
          did the same. Ship flags freely; remove them deliberately.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
