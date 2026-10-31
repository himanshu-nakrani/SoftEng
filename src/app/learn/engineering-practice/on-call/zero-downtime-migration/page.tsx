import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { ZeroDowntimeMigrationFigure } from "@/lessons/on-call/zero-downtime-migration-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("zero-downtime-migration");

export default function ZeroDowntimeMigrationPage() {
  return (
    <Lesson slug="zero-downtime-migration">
      <LessonSection id="live-database">
        <Lead>
          In a local development database, renaming a column takes five milliseconds. In production
          under one thousand writes per second, that same statement takes down the service.
        </Lead>
        <P>
          Relational databases maintain data integrity through locks. In PostgreSQL, schema alterations
          like <code>ALTER TABLE ... RENAME COLUMN</code> or splitting columns require an{" "}
          <Term>ACCESS EXCLUSIVE</Term> lock. This lock mode conflicts with every other lock type,
          including simple <code>SELECT</code>, <code>INSERT</code>, and <code>UPDATE</code> queries.
        </P>
        <P>
          Even when the catalog update itself is nearly instantaneous, the migration cannot acquire the
          lock until every in-flight transaction on that table finishes. While the migration transaction
          waits at the front of the lock queue, all subsequent incoming queries queue behind it. Under a
          workload of <Strong>1,000 writes per second</Strong>, a 250-millisecond queue wait stalls
          hundreds of worker threads, exhausts the database connection pool, and triggers request
          timeouts across client applications.
        </P>
        <P>
          The challenge: you have an active table where user names are stored in a single monolithic{" "}
          <code>name</code> column. You must split this into <code>first_name</code> and{" "}
          <code>last_name</code> without dropping a single write or returning broken profiles to users.
        </P>
      </LessonSection>

      <LessonSection id="migration-sequence">
        <TryThis>
          <LI>
            Move the slider to <Strong>Single ALTER TABLE</Strong> — an exclusive table lock queues
            incoming writes, dropping between 200 and 300 transactions (0 of 200 runs clean).
          </LI>
          <LI>
            Move the slider to <Strong>Deploy code before backfill</Strong> — writes proceed, but
            reading unbackfilled legacy rows triggers 200 to 300 null-pointer exceptions (0 of 200 runs clean).
          </LI>
          <LI>
            Move the slider to <Strong>Expand/Contract</Strong> — phased additions, dual writing,
            and batched backfills complete cleanly in all 200 of 200 runs with zero dropped writes.
          </LI>
        </TryThis>
        <ZeroDowntimeMigrationFigure />
        <Callout kind="insight">
          A naive rename drops 200 to 300 writes due to lock queuing, while deploying read code before
          backfilling crashes on unmigrated records. Only the five-phase expand/contract lifecycle
          achieves zero downtime (200/200 clean runs) because database schema mutations and application
          code releases remain backward-compatible at every boundary.
        </Callout>
      </LessonSection>

      <LessonSection id="expand-contract">
        <Lead>
          The fundamental rule of zero-downtime schema evolution: every database migration must be
          compatible with existing application code, and every application release must tolerate both schemas.
        </Lead>
        <P>
          To split or rename a live column safely, replace the single monolithic migration with the{" "}
          <Term>Expand/Contract</Term> pattern (also called Parallel Run), split across distinct
          deployment phases:
        </P>
        <P>
          <Strong>1. Expand (Database):</Strong> Add the new columns <code>first_name</code> and{" "}
          <code>last_name</code> as nullable columns without defaults. In modern engines, this is a
          metadata-only operation that takes a sub-millisecond lock. Existing application servers continue
          reading and writing only to <code>name</code> without interruption.
        </P>
        <P>
          <Strong>2. Dual Write (Application):</Strong> Deploy application code that begins writing to
          both the old column <code>name</code> and the new columns <code>first_name</code> and{" "}
          <code>last_name</code>. The application continues reading from <code>name</code>. From this point
          forward, every newly inserted or updated row is populated in both formats.
        </P>
        <P>
          <Strong>3. Backfill (Background Worker):</Strong> Run an asynchronous, throttled background job
          to backfill legacy rows where <code>first_name IS NULL</code>. Processing in batches (e.g., 500
          rows at a time with brief sleep intervals) prevents transaction log saturation, avoids long-lived
          row locks, and prevents replication lag on read replicas.
        </P>
        <P>
          <Strong>4. Contract - Reads (Application):</Strong> Once monitoring confirms zero unmigrated rows
          remain, deploy a new application version that switches all read queries to use{" "}
          <code>first_name</code> and <code>last_name</code>. The application can continue dual-writing or
          transition to writing only the new columns.
        </P>
        <P>
          <Strong>5. Contract - Cleanup (Database):</Strong> Deploy the final application code that removes
          all references to the legacy <code>name</code> column. Finally, issue{" "}
          <code>ALTER TABLE users DROP COLUMN name</code> during a low-traffic window to reclaim storage.
        </P>
        <P>
          Zero-downtime migrations trade rapid one-line execution for operational safety. What looks like
          one database change is actually a disciplined sequence of phased deployments spread across code
          and infrastructure.
        </P>
      </LessonSection>
    </Lesson>
  );
}
