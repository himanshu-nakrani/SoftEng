import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { InodePtr, InodeState } from "./views/inode";

/**
 * Inodes — a step producer over `InodeState`.
 *
 * An inode holds DIRECT direct pointers and one indirect block of INDIRECT
 * pointers. File size is in data blocks. The run reads every block in order
 * so the extra pointer read appears the moment size leaves the direct range.
 *
 * Deliberately absent: double-indirect, extents, directories as inodes of
 * their own. Those change how many extra blocks you walk, not the fact that
 * a pointer block is a pointer block.
 */

export const DIRECT = 4;
export const INDIRECT = 4;

export interface InodeConfig {
  /** Data blocks in the file. 1 .. DIRECT+INDIRECT. */
  size: number;
}

export const INODE_COUNTERS = {
  inodeReads: "inodeReads",
  pointerReads: "pointerReads",
  dataReads: "dataReads",
} as const;

export function runInode(cfg: InodeConfig): AlgoStep<InodeState>[] {
  const size = Math.max(1, Math.min(DIRECT + INDIRECT, cfg.size));
  const directs: InodePtr[] = Array.from({ length: DIRECT }, (_, i) => ({
    label: `d${i}`,
    block: i < size ? i : null,
    active: false,
    kind: "direct" as const,
  }));
  const needIndirect = size > DIRECT;
  const indirect: InodePtr[] = Array.from({ length: INDIRECT }, (_, i) => ({
    label: `i${i}`,
    block: needIndirect && DIRECT + i < size ? DIRECT + i : null,
    active: false,
    kind: "indirect" as const,
  }));
  const data: InodePtr[] = Array.from({ length: size }, (_, i) => ({
    label: `b${i}`,
    block: i,
    active: false,
    kind: "data" as const,
  }));
  let last: InodeState["last"];

  const rec = new StepRecorder<InodeState>(() => snapshot());

  function clear(): void {
    for (const p of [...directs, ...indirect, ...data]) p.active = false;
  }

  function snapshot(): InodeState {
    return {
      size,
      directs: directs.map((p) => ({ ...p })),
      indirect: indirect.map((p) => ({ ...p })),
      data: data.map((p) => ({ ...p })),
      last,
      stamp:
        rec.count(INODE_COUNTERS.pointerReads) === 0
          ? `${size} block${size === 1 ? "" : "s"} · direct ${DIRECT}`
          : `${rec.count(INODE_COUNTERS.pointerReads)} pointer read${rec.count(INODE_COUNTERS.pointerReads) === 1 ? "" : "s"}`,
    };
  }

  rec.record({
    note:
      size <= DIRECT
        ? `A ${size}-block file fits in the ${DIRECT} direct pointers.`
        : `A ${size}-block file needs the indirect block for blocks ${DIRECT}–${size - 1}.`,
  });

  for (let b = 0; b < size; b++) {
    clear();
    rec.bump(INODE_COUNTERS.inodeReads);
    if (b < DIRECT) {
      directs[b]!.active = true;
      data[b]!.active = true;
      last = { block: b, via: "direct" };
      rec.bump(INODE_COUNTERS.dataReads);
      rec.record({
        codeLine: 0,
        note: `Read block ${b} via direct pointer d${b}.`,
      });
    } else {
      rec.bump(INODE_COUNTERS.pointerReads);
      const slot = b - DIRECT;
      indirect[slot]!.active = true;
      data[b]!.active = true;
      last = { block: b, via: "indirect" };
      rec.bump(INODE_COUNTERS.dataReads);
      rec.record({
        codeLine: 1,
        note: `Read block ${b} via indirect slot i${slot} — one extra pointer read.`,
      });
    }
  }

  return rec.steps;
}
