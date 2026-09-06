/**
 * Paging view state — archetype B, for virtual-memory lessons.
 *
 * Pure data so a lesson `.ts` can drive address translation, the TLB, faults,
 * and replacement without importing a component.
 *
 * A virtual page number is 4 bits (0–15), split into a 2-bit directory index
 * and a 2-bit table index. That is a two-level walk you can draw: four
 * directory chips, then the four PTEs of the table just visited. Physical
 * frames sit below; the TLB, when enabled, sits above the walk.
 */

export type PagingKind = "walk" | "tlb-hit" | "fault" | "evict";

export interface PteChip {
  /** Label, e.g. "0–3" for a directory slot or a VPN for a PTE. */
  label: string;
  pfn: number | null;
  present: boolean;
  referenced: boolean;
  active: boolean;
}

export interface TlbChip {
  vpn: number;
  pfn: number;
  active: boolean;
}

export interface FrameChip {
  pfn: number;
  vpn: number | null;
  referenced: boolean;
  victim: boolean;
}

export interface PagingState {
  directory: PteChip[];
  /** The L2 table touched this step; empty on a pure TLB hit. */
  table: PteChip[];
  tlb: TlbChip[];
  frames: FrameChip[];
  tlbEnabled: boolean;
  last?: { kind: PagingKind; vpn: number };
  stamp: string;
}
