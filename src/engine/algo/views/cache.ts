/**
 * Buffer-cache view — cached pages vs disk, with a dirty set that a crash
 * discards. Write-back delays the disk write; fsync / write-through does not.
 */

export type CachePolicy = "writeback" | "writethrough";
export type CachePhase = "run" | "crash" | "done";

export interface CachePage {
  id: string;
  cached: number;
  disk: number;
  dirty: boolean;
  active: boolean;
}

export interface CacheState {
  policy: CachePolicy;
  pages: CachePage[];
  phase: CachePhase;
  stamp: string;
}
