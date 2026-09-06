import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Compare,
  CompareCol,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import {
  NoneFigure,
  UserFigure,
} from "@/lessons/defense-in-depth/credential-stuffing-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("credential-stuffing");

export default function CredentialStuffingPage() {
  return (
    <Lesson slug="credential-stuffing">
      <LessonSection id="six-guesses">
        <Lead>
          The password is on attempt five. Whether that attempt is allowed
          to run is which key the bucket sits on.
        </Lead>
        <P>
          <Term>Credential stuffing</Term> is many passwords against one
          account. This toy is six guesses at <Term>ada</Term>. The IPs
          rotate <Strong>a, b, c, a, b, c</Strong> — two tries per address.
          Attempt 5 is the password <Term>ok</Term>. The other five are
          wrong. The cap is <Strong>3</Strong>.
        </P>
        <P>
          There is no CAPTCHA and no progressive backoff. Six attempts, cap
          3. The lesson is which key the bucket is on.
        </P>
        <Compare>
          <CompareCol title="IP bucket · cap 3">
            Three addresses, two tries each. Stolen <Strong>1</Strong>,
            blocked <Strong>0</Strong>, attempts <Strong>6</Strong>.
            Rotation stays under the cap, so attempt 5 still runs.
          </CompareCol>
          <CompareCol title="Username bucket · cap 3">
            One key: ada. Stolen <Strong>0</Strong>, blocked{" "}
            <Strong>3</Strong>. Attempts 4–6 never run the password.
          </CompareCol>
        </Compare>
      </LessonSection>

      <LessonSection id="no-limit">
        <P>
          No bucket at all. Every guess is tried, including the one that
          matches.
        </P>
        <TryThis>
          <LI>
            The first caption is &quot;No rate limit. Six guesses.&quot;
            Buckets reads none.
          </LI>
          <LI>
            Skip to the end. Attempts <Strong>6</Strong>, stolen{" "}
            <Strong>1</Strong>, blocked <Strong>0</Strong>. Attempt 5
            reads <Term>ok</Term>. The last caption is &quot;Stuffing
            succeeded.&quot; Stamp <Strong>stolen</Strong>.
          </LI>
        </TryThis>
        <NoneFigure />
        <Callout kind="insight">
          With no limit, six guesses steal the account. The password was
          sitting on attempt 5, and nothing stopped it.
        </Callout>
      </LessonSection>

      <LessonSection id="user-bucket">
        <Lead>
          Bucket the username. The thing being guessed is ada, not the
          address.
        </Lead>
        <P>
          Same six guesses, same cap 3. The bucket is now on{" "}
          <Term>ada</Term>. Attempts 1–3 spend the three tokens. Attempts
          4–6 are blocked, so the correct password never runs.
        </P>
        <TryThis>
          <LI>
            The first caption is &quot;Username bucket cap 3.&quot;
          </LI>
          <LI>
            Skip to the end. Attempts <Strong>6</Strong>, stolen{" "}
            <Strong>0</Strong>, blocked <Strong>3</Strong>. Attempts 4–6
            read <Term>block</Term>. Stamp <Strong>3 blocked</Strong>.
          </LI>
        </TryThis>
        <UserFigure />
        <Callout kind="insight">
          The IP rotation was a distraction. Two tries per address stays
          under a cap of 3, which is why an IP bucket still steals the
          account: stolen 1, blocked 0, attempts 6. The username is the key
          that makes the cap mean something.
        </Callout>
        <Callout kind="warning">
          Six attempts, cap 3. Not CAPTCHA, not progressive backoff. A real
          login would add those. They do not change the argument: stuffing
          is many passwords against one account, so the bucket belongs on
          the account.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
