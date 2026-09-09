import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import {
  LostUpdateFigure,
  LostUpdateSerializableFigure,
} from "@/lessons/transactions/lost-update-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("lost-update");

export default function LostUpdatePage() {
  return (
    <Lesson slug="lost-update">
      <LessonSection id="both-read-first">
        <Lead>
          A balance of 100, a deposit of 50, a withdrawal of 30. The answer is 120.
          Run the two as concurrent transactions at read committed and you get 120
          about a quarter of the time.
        </Lead>
        <P>
          Each transaction does three things: read the balance, compute a new value
          from what it read, and write it back. If both read before either writes,
          both compute from 100 — one produces 150, the other 70 — and whichever
          writes second overwrites the first. One update is simply gone, and no
          error is reported, because as far as the database is concerned two
          transactions wrote a row and both succeeded.
        </P>
        <P>
          This is <Term>Data Races</Term> from the concurrency track, one layer up.
          The same read-modify-write, the same scheduler free to cut between the
          read and the write. A transaction is not a smaller window than a thread —
          it is a much larger one.
        </P>
      </LessonSection>

      <LessonSection id="watch-it-vanish">
        <TryThis>
          <LI>
            Step through and watch both transactions read <Strong>100</Strong>.
          </LI>
          <LI>
            Watch each write its own answer, and the second overwrite the first.
          </LI>
          <LI>
            Shuffle. The balance lands on 150, 70 or 120 — wrong in roughly three
            runs in four.
          </LI>
          <LI>
            Find a 120 run and see why: one transaction finished entirely before
            the other read.
          </LI>
        </TryThis>
        <LostUpdateFigure />
        <Callout kind="insight">
          Unlike write skew, both transactions write the <Strong>same row</Strong>.
          That makes this detectable by a mechanism that only watches writes, which
          is why databases offer cheap targeted fixes — <Term>SELECT … FOR UPDATE</Term>{" "}
          to lock the row before reading, or a single atomic{" "}
          <Term>UPDATE balance = balance - 30</Term> that never reads into the
          application at all. Neither helps with write skew, where there is no
          shared row to lock.
        </Callout>
      </LessonSection>

      <LessonSection id="retry">
        <P>
          Serializable does something more honest than fixing it. Run the same
          program and the balance <Strong>still</Strong> ends at 150 or 70 — but one
          transaction&apos;s commit is refused.
        </P>
        <LostUpdateSerializableFigure />
        <P>
          That is the guarantee stated exactly: the result matches some order in
          which the transactions that <Strong>committed</Strong> ran one after
          another. A refused transaction did not commit, so its update is absent —
          and 150 is a perfectly correct outcome for &ldquo;the deposit happened,
          the withdrawal failed&rdquo;. Reaching 120 requires the application to{" "}
          <Strong>retry</Strong> the refused transaction, which then reads 150 and
          writes 120.
        </P>
        <Callout kind="warning">
          So serializable does not remove the problem, it relocates it — from a
          silently wrong number to a visible error you are obliged to handle. Every
          write path under it needs a retry loop. The 151 runs in 200 that lost an
          update above are exactly the 151 refused here, and that correspondence is
          the whole value: the database fails precisely when, and only when, it
          would otherwise have lied.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
