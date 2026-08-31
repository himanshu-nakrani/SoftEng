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
  SerializableFigure,
  WriteSkewFigure,
} from "@/lessons/transactions/write-skew-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("write-skew");

export default function WriteSkewPage() {
  return (
    <Lesson slug="write-skew">
      <LessonSection id="each-is-correct">
        <Lead>
          A snapshot gave the reader a consistent view. It did not give two readers
          the same view — and two transactions can each be correct against their own
          snapshot while together breaking a rule neither of them broke.
        </Lead>
        <P>
          Two doctors are on call, and the rule is that at least one must remain.
          Each transaction does the honest thing: it checks whether the{" "}
          <Strong>other</Strong> doctor is on call, sees that they are, concludes
          that leaving is safe, and takes only itself off. Read the code of either
          transaction in isolation and it is right.
        </P>
        <P>
          The important detail is that they write <Strong>different rows</Strong>.
          There is no overwrite, so there is nothing for a last-writer-wins check to
          catch, and no lost update to detect. The conflict is between one
          transaction&apos;s <Term>reads</Term> and the other&apos;s{" "}
          <Term>writes</Term> — which is exactly what a snapshot is designed not to
          show you.
        </P>
      </LessonSection>

      <LessonSection id="break-the-invariant">
        <TryThis>
          <LI>
            Step through. Each transaction checks the other row and sees{" "}
            <Strong>1</Strong>.
          </LI>
          <LI>
            Watch both commit. The committed table ends with{" "}
            <Term>alice_oncall</Term> 0 and <Term>bob_oncall</Term> 0.
          </LI>
          <LI>
            Shuffle. It happens in roughly three runs in four — the invariant
            usually loses.
          </LI>
        </TryThis>
        <WriteSkewFigure />
        <Callout kind="insight">
          Nobody is on call, and no transaction violated the rule. That is what
          makes write skew hard: there is no line to fix, because the bug is not in
          either transaction. It is in the assumption that a decision made against
          a snapshot is still valid when it commits.
        </Callout>
      </LessonSection>

      <LessonSection id="serializable">
        <P>
          <Term>Serializable</Term> is not a stricter snapshot — it is a different
          promise: the result must match <Strong>some</Strong> order in which the
          transactions ran one after another. No serial order produces two doctors
          leaving, so the database must refuse one of them.
        </P>
        <SerializableFigure />
        <P>
          It refuses by checking, at commit time, whether anything the transaction{" "}
          <Strong>read</Strong> has changed since it began. Here that is the other
          doctor&apos;s row, and the correspondence is exact: across two hundred
          seeds, the runs where a commit is refused are precisely the 151 runs that
          would otherwise have broken the invariant. Never more, never fewer.
        </P>
        <Callout kind="warning">
          The cost is a new failure your code must handle. Serializable does not
          make conflicts impossible, it makes them <Strong>visible</Strong> — as an
          error at commit, on a transaction that did nothing wrong. Any write path
          under it needs a retry loop, and a workload with heavy read-write overlap
          will spend real throughput on refused work. The choice is not
          &ldquo;which level is safest&rdquo; but which anomalies you can afford,
          and whether you would rather pay in retries or in invariants.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
