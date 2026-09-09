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
  DirtyReadFigure,
  ReadCommittedFigure,
} from "@/lessons/transactions/dirty-reads-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("dirty-reads");

export default function DirtyReadsPage() {
  return (
    <Lesson slug="dirty-reads">
      <LessonSection id="uncommitted">
        <Lead>
          A transaction in progress has already changed rows that it may yet undo.
          Whether anyone else can see those changes is not a detail — it is the
          weakest isolation level, and it lets a query return a number that was
          never true.
        </Lead>
        <P>
          Two accounts hold 100 each, so the total is 200. <Term>T1</Term> moves 50
          from alice to bob: two writes, which for a moment leave the pair
          inconsistent — 50 and 100, totalling 150 — before the second write
          restores the balance. Every transfer passes through such a moment. That
          is precisely what <Strong>atomicity</Strong> is for: nobody outside the
          transaction should ever observe it.
        </P>
        <P>
          Then T1 hits an error and rolls back. The reason does not matter — a
          constraint violation, a deadlock, a dropped connection. What matters is
          that both writes must un-happen, and the total was 200 the whole time as
          far as the database is concerned.
        </P>
      </LessonSection>

      <LessonSection id="watch-the-rollback">
        <TryThis>
          <LI>
            Step through. T1&apos;s writes appear as <Term>dashed</Term> values
            beside the committed ones — pending, not fact.
          </LI>
          <LI>
            Watch <Term>T2</Term>&apos;s reads on the right, and the total it
            reports.
          </LI>
          <LI>
            Shuffle until T2 reports <Strong>150</Strong> or{" "}
            <Strong>250</Strong> — roughly one run in three.
          </LI>
          <LI>
            Keep stepping to T1&apos;s <Term>ROLLBACK</Term>. The dashed values
            vanish; the number T2 reported does not.
          </LI>
        </TryThis>
        <DirtyReadFigure />
        <Callout kind="insight">
          The committed table is correct at the start and correct at the end —
          alice 100, bob 100, every run. Nothing was corrupted. A reader simply
          observed a moment that the database had promised nobody would see, and
          then acted on it. A report was filed, an alert fired, a decision made,
          on a total that never existed.
        </Callout>
        <P>
          There is a reason this bug hides. A read that catches{" "}
          <Strong>both</Strong> of T1&apos;s pending writes sees 50 and 150 and
          totals 200 — the right answer, by luck. Dirty reads happen in over forty
          per cent of runs here, but only about thirty produce a visibly wrong
          number. The rest look fine.
        </P>
      </LessonSection>

      <LessonSection id="read-committed">
        <P>
          <Term>Read committed</Term> is the fix, and it is exactly as narrow as
          its name: a read never returns a value that has not been committed. Same
          program, same interleavings, same rollback — the reader simply skips the
          pending column.
        </P>
        <ReadCommittedFigure />
        <P>
          Across two hundred seeds the total is 200 every time and the dirty-read
          counter never leaves zero. This is the default in PostgreSQL, Oracle and
          SQL Server, and read uncommitted is a level most engines will accept and
          then quietly decline to implement.
        </P>
        <Callout kind="warning">
          Read committed guarantees each read sees committed data — not that two
          reads see the <Strong>same</Strong> committed data. T2 could read alice
          before another transaction commits and bob after, and total a pair of
          values that were never simultaneously true. That is a{" "}
          <Term>non-repeatable read</Term>, and it needs a stronger level again.
          Every level is a statement about which anomalies remain, which is why
          &ldquo;we use transactions&rdquo; answers a narrower question than it
          appears to.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
