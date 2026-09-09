import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  CheckpointFigure,
  NoCheckpointFigure,
} from "@/lessons/durability/checkpoints-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("checkpoints");

export default function CheckpointsPage() {
  return (
    <Lesson slug="checkpoints">
      <LessonSection id="log-grows">
        <Lead>
          The last lesson bought durability with one sequential force per commit.
          It left two bills unpaid: the log grows forever, and recovery replays it
          from the beginning.
        </Lead>
        <P>
          Both matter more than they sound. A database up for a month has a
          month&rsquo;s log, and if restarting means reading all of it, then the
          time to recover is a function of <Strong>uptime</Strong> — the longer you
          run without incident, the worse the incident is. That is precisely
          backwards.
        </P>
        <P>
          The fix is the operation the previous figure performed without
          explanation. A <Term>checkpoint</Term> forces every dirty page to disk
          and writes a record saying it did. Afterwards, no record older than that
          one has anything left to replay — so redo can start there instead of at
          the beginning of time.
        </P>
        <Callout kind="insight">
          Be precise about the claim. A checkpoint does not make the repair
          smaller. It makes the <Strong>prefix of the log that still matters</Strong>{" "}
          shorter. Those are different things, and the figures below separate them
          into two counters.
        </Callout>
      </LessonSection>

      <LessonSection id="without-checkpoint">
        <P>
          Ten operations, a write-ahead log, and no checkpoint. T1, T2 and T3
          commit; T4 starts and never finishes. Nothing forces a page out during
          normal running, so the disk keeps its original values until the crash.
        </P>
        <TryThis>
          <LI>
            At crash 9, read the two recovery counters: redo considered{" "}
            <Strong>8</Strong> records and applied <Strong>4</Strong>.
          </LI>
          <LI>
            Now walk the crash point down. The scan shrinks only because the log
            is shorter — 8, then 6, then 3. Nothing bounds it but the crash.
          </LI>
          <LI>
            Note <Strong>page writes during the run: 0</Strong>. This policy never
            pays anything up front.
          </LI>
        </TryThis>
        <NoCheckpointFigure />
        <P>
          It is correct at every crash point — no acknowledged commit is ever lost.
          That is worth saying plainly, because it means everything that follows is
          about <Strong>cost</Strong>, not correctness. The problem is only that
          the work grows without limit.
        </P>
      </LessonSection>

      <LessonSection id="with-checkpoint">
        <P>
          The same ten operations, with the checkpoint at operation 5 actually
          taken. Every dirty page is forced, and a checkpoint record goes into the
          log at LSN 5.
        </P>
        <TryThis>
          <LI>
            At crash 9: redo now considers <Strong>5</Strong> records instead of 8,
            and the caption names the floor it starts from.
          </LI>
          <LI>
            Records applied falls from 4 to <Strong>3</Strong> — a smaller drop
            than the scan, and the last section is about why.
          </LI>
          <LI>
            The cost is in the other two meters: page writes ends at{" "}
            <Strong>6</Strong> against 4, log forces at <Strong>5</Strong> against
            3.
          </LI>
          <LI>
            <Strong>When</Strong> they were spent is the point. Scrub back to the
            power-failure frame: page writes reads <Strong>3</Strong> there,
            against 0 — three writes paid while nothing was wrong.
          </LI>
          <LI>
            Set the crash to 5, immediately after the checkpoint. Redo replays{" "}
            <Strong>nothing at all</Strong>: everything committed is already on
            disk.
          </LI>
        </TryThis>
        <CheckpointFigure />
        <P>
          Both figures end with the same disk — orders 2, stock 18, ledger 0 — and
          neither loses acknowledged work at any of the ten crash points. The
          checkpoint changed what recovery had to do, not what it concluded.
        </P>
        <Callout kind="insight">
          Recovery work moved <Strong>out of the crash and into normal running</Strong>.
          Three page writes were spent while nothing was wrong, so that fewer would
          be needed when something was. That is the entire economics of
          checkpointing, and it is why the interval is a tuning knob rather than a
          setting with a right answer — the right frequency depends on how much
          slower you are willing to be all the time in exchange for restarting
          faster once.
        </Callout>
      </LessonSection>

      <LessonSection id="two-bounds">
        <Lead>
          One thing the checkpoint did not do is give <Term>undo</Term> a floor —
          and it is worth understanding why, because the mistake is easy to make.
        </Lead>
        <P>
          Redo may start at the checkpoint because of a promise about{" "}
          <Strong>pages</Strong>: at the moment that record became durable, every
          logged change was already on disk. Undo is not asking about pages. It is
          asking which transactions never committed, and a transaction that was
          already running before the checkpoint is still running after it.
        </P>
        <P>
          The figure shows exactly that. T4 dirtied the ledger page at LSN 4, one
          record <Strong>before</Strong> the checkpoint. A checkpoint forces every
          dirty page and does not ask whose it is — so it wrote T4&rsquo;s
          uncommitted 9 to disk. Recovery has to reach back past its own floor to
          undo LSN 4 and put the ledger back to 0.
        </P>
        <Callout kind="warning">
          So the checkpoint <Strong>created</Strong> undo work that the other run
          never had: 0 records undone without it, 1 with it. Redo dropped from 4 to
          2 and undo rose from 0 to 1. A checkpoint is not a pure saving, and had
          undo stopped at the checkpoint the way redo does, T4&rsquo;s uncommitted
          value would have stayed on disk forever.
        </Callout>
        <P>
          The two passes have different bounds because they answer different
          questions. Real systems make undo&rsquo;s bound explicit by recording the
          list of live transactions inside the checkpoint, so recovery knows how
          far back it must reach without scanning to find out.
        </P>
        <P>
          One honest limit of this model: its checkpoints are <Term>sharp</Term> —
          they force every dirty page before writing the record, which is what
          licenses redo to start there. Production systems use{" "}
          <Term>fuzzy</Term> checkpoints that do not stop the world, and recover
          the same bound by recording the oldest dirty page&rsquo;s LSN instead.
          That changes where redo starts, not why it is allowed to start anywhere.
        </P>
      </LessonSection>
    </Lesson>
  );
}
