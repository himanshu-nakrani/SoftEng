import {
  INODE_COUNTERS,
  runInode,
  type InodeConfig,
} from "@/engine/algo/inode";
import type { AlgoDef } from "@/engine/algo/types";
import type { InodeState } from "@/engine/algo/views/inode";

/**
 * The Inode — archetype B (`engine: "steps"`).
 *
 * A file is a list of blocks, and the list lives in a small fixed record.
 * Four direct pointers name data from inside the inode; past that, an
 * indirect block of four more pointers holds the names, and every data
 * block in that range costs an extra pointer read. Measured: a 4-block
 * file is 4 inode reads, 4 data reads, 0 pointer reads; a 5-block file
 * pays 1 pointer read; an 8-block file pays 4.
 *
 * THE CONTROL IS HOW MANY DATA BLOCKS THE FILE HAS. 4 / 5 / 8 are the
 * interesting stops: the last direct, the first extra pointer read, and
 * a full indirect block. Every position past 4 adds one pointer read.
 *
 * Two defs, same slider, same counters. The first opens at 4 so the
 * pointer-reads meter stays at 0; the second opens at 5 so the extra
 * read is the first thing that happens after the four directs. Dragging
 * either across 4 is the same run.
 *
 * MODELLING NOTE, and its limits. The producer consults the inode on
 * every block and charges one pointer read per indirect data block, so
 * the meters are the access path, not a buffer cache. A real kernel
 * would cache the inode and, after the first fetch, the indirect block.
 * Deliberately absent: double-indirect, extents, directories as inodes
 * of their own. Those change how many extra blocks you walk, not the
 * fact that a pointer block is a pointer block.
 */

const CODE = [
  "direct pointer",
  "indirect then data",
];

const counters = [
  { key: INODE_COUNTERS.inodeReads, label: "inode reads" },
  { key: INODE_COUNTERS.pointerReads, label: "pointer reads" },
  { key: INODE_COUNTERS.dataReads, label: "data reads" },
];

const sizeControl = {
  label: "file blocks",
  min: 1,
  max: 8,
  default: 5,
} as const;

function def(
  id: string,
  title: string,
  defaultSize: number,
): AlgoDef<InodeState, InodeConfig> {
  return {
    id,
    title,
    code: CODE,
    counters,
    size: { ...sizeControl, default: defaultSize },
    generateInput: (_rng, size) => ({ size }),
    run: (input) => runInode(input),
  };
}

/** Four blocks, every name still inside the inode. */
export const inodeDirectAlgo = def("inode-direct", "direct pointers", 4);

/** Five blocks, the first that pays a pointer read. */
export const inodeAlgo = def("inode", "indirect block", 5);
