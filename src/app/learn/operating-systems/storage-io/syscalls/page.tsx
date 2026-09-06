import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  BatchedFigure,
  OneByteFigure,
} from "@/lessons/storage-io/syscalls-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("syscalls");

export default function SyscallsPage() {
  return (
    <Lesson slug="syscalls">
      <LessonSection id="the-trap">
        <Lead>
          User mode cannot talk to devices. A <Term>write</Term> is a{" "}
          <Term>trap</Term> into the kernel, a copy of the bytes, and a
          return.
        </Lead>
        <P>
          The process is in <Term>user mode</Term>. It has a buffer and a
          file descriptor, and it cannot issue I/O. To write, it raises a
          trap. The CPU switches to <Term>kernel mode</Term>, the kernel
          copies the payload out of user memory, then it returns. That round
          trip is a <Term>system call</Term>.
        </P>
        <P>
          The mode switch is the cost: change privilege, validate the
          pointer, copy, restore. The bytes are the work. Eight one-byte
          writes do the switch eight times for eight bytes. One eight-byte
          write does it once for the same eight bytes.
        </P>
      </LessonSection>

      <LessonSection id="one-byte">
        <TryThis>
          <LI>
            Leave calls at <Strong>8</Strong>. The stamp says{" "}
            <Strong>0 traps · user</Strong>. The caption is &quot;8 writes
            of 1 byte each.&quot; USER is lit; KERNEL is hollow. Copied is
            0.
          </LI>
          <LI>
            Step. USER goes hollow, KERNEL lights. Caption: &quot;Trap into
            kernel (call 1/8).&quot; Stamp <Strong>1 trap · kernel</Strong>.
            Traps is <Strong>1</Strong>; copied is still 0. The trap has
            not copied yet.
          </LI>
          <LI>
            Next step copies. Caption: &quot;Copy 1 byte from user.&quot;
            Copies <Strong>1</Strong>, bytes <Strong>1</Strong>. Then
            &quot;Return to user mode.&quot; Stamp{" "}
            <Strong>1 trap · user</Strong>.
          </LI>
          <LI>
            Skip to the end. Meters: <Strong>8</Strong> traps,{" "}
            <Strong>8</Strong> copies, <Strong>8</Strong> bytes. Stamp{" "}
            <Strong>8 traps · user</Strong>. Eight round trips for eight
            bytes.
          </LI>
        </TryThis>
        <OneByteFigure />
        <Callout kind="insight">
          Each byte paid a trap. Copies equals traps because each call
          copies once, and each call moved one byte.
        </Callout>
        <P>
          Drag to <Strong>1</Strong>: one trap, one copy, one byte. Drag to{" "}
          <Strong>4</Strong>: four of each. Every extra call is one more
          mode switch. The bytes meter never outruns the traps meter on this
          figure, because the payload per call is 1.
        </P>
      </LessonSection>

      <LessonSection id="batched">
        <Lead>
          The same eight bytes, in one call. The slider is no longer how
          many writes — it is how many bytes that one write carries.
        </Lead>
        <TryThis>
          <LI>
            Leave bytes at <Strong>8</Strong>. The caption is &quot;1 write
            of 8 bytes each.&quot; Stamp still{" "}
            <Strong>0 traps · user</Strong>.
          </LI>
          <LI>
            Three steps: trap (call 1/1), &quot;Copy 8 bytes from
            user,&quot; return. Stamp ends at{" "}
            <Strong>1 trap · user</Strong>. Meters: <Strong>1</Strong> trap,{" "}
            <Strong>1</Strong> copy, <Strong>8</Strong> bytes.
          </LI>
          <LI>
            Drag to <Strong>4</Strong>. Still one trap, one copy; bytes
            drop to <Strong>4</Strong>. Drag to <Strong>1</Strong>: traps{" "}
            <Strong>1</Strong>, copies <Strong>1</Strong>, bytes{" "}
            <Strong>1</Strong> — the same run as the one-byte figure at 1
            call.
          </LI>
        </TryThis>
        <BatchedFigure />
        <Callout kind="insight">
          Same eight bytes. Seven fewer traps. The mode switch is the cost;
          batching is the lever. The trap did not get cheaper.
        </Callout>
        <P>
          A copy is one per call, not one per byte. That is why the copies
          meter stays at <Strong>1</Strong> while the bytes meter follows
          the slider. On the one-byte figure those two meters were glued
          together; here they split.
        </P>
        <Callout kind="warning">
          This is write(), and write() still traps. Real syscall numbers,
          page copies versus registers, and vdso fast paths are absent —
          gettimeofday might skip the trap on this hardware; moving bytes
          into a file does not. The argument does not need a cheaper trap.
          It needs fewer of them.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
