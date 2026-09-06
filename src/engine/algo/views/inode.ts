/**
 * Inode view — a small inode with direct pointers plus one indirect block.
 *
 * File size is in data blocks. Reading the last block is the interesting
 * access: within the direct range it is inode + data; past it, inode +
 * indirect + data.
 */

export interface InodePtr {
  label: string;
  /** Block number, or null if unused. */
  block: number | null;
  active: boolean;
  kind: "direct" | "indirect" | "data";
}

export interface InodeState {
  size: number;
  directs: InodePtr[];
  indirect: InodePtr[];
  data: InodePtr[];
  last?: { block: number; via: "direct" | "indirect" };
  stamp: string;
}
