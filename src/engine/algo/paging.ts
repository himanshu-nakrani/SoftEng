import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type {
  FrameChip,
  PagingState,
  PteChip,
  TlbChip,
} from "./views/paging";

/**
 * Virtual memory — a step producer for archetype B, over `PagingState`.
 *
 * Not a scheduler: each access is a fixed walk. A virtual page number (0–15)
 * splits into a 2-bit directory index and a 2-bit table index. The walk is
 * directory then PTE. A TLB, when sized above zero, can skip that walk. A
 * demand-paged run starts with every PTE invalid; the first access faults,
 * allocates a frame, and (under pressure) evicts.
 *
 * WHAT IS MODELLED. Two-level translation, a fully-associative FIFO TLB,
 * demand paging, and three replacement policies (FIFO, LRU, CLOCK). CLOCK
 * uses the PTE referenced bit; FIFO ignores it; LRU recency is the frame
 * list order.
 *
 * Deliberately absent: ASID/PCID (a context switch flushes the whole TLB),
 * multi-page sizes, dirty-bit writeback cost as a separate disk write,
 * and software vs hardware walker. Those change constants. The argument is
 * that a hit in the TLB is not a walk, a fault is not a hit, and a victim
 * is a policy, not a mystery.
 */

export type Replacement = "none" | "fifo" | "lru" | "clock";

export interface PagingConfig {
  /** 0 disables the TLB. */
  tlbSize: number;
  /** Physical frames. Identity map uses the first `frames` VPNs when not demand. */
  frames: number;
  replacement: Replacement;
  /** If true, every PTE starts invalid. */
  demand: boolean;
  /** Virtual page numbers to access, in order. */
  accesses: number[];
}

export const PAGING_COUNTERS = {
  walks: "walks",
  tlbHits: "tlbHits",
  tlbMisses: "tlbMisses",
  faults: "faults",
  evictions: "evictions",
  diskReads: "diskReads",
} as const;

const VPNS = 16;
const DIR_SHIFT = 2;
const TAB_MASK = 3;

interface Pte {
  present: boolean;
  pfn: number | null;
  referenced: boolean;
}

export function runPaging(cfg: PagingConfig): AlgoStep<PagingState>[] {
  const tables: Pte[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => ({
      present: false,
      pfn: null,
      referenced: false,
    })),
  );

  if (!cfg.demand) {
    for (let vpn = 0; vpn < Math.min(VPNS, cfg.frames); vpn++) {
      pte(vpn).present = true;
      pte(vpn).pfn = vpn;
    }
  }

  const frames: { vpn: number | null }[] = Array.from({ length: cfg.frames }, () => ({
    vpn: null,
  }));
  if (!cfg.demand) {
    for (let vpn = 0; vpn < Math.min(VPNS, cfg.frames); vpn++) {
      frames[vpn]!.vpn = vpn;
    }
  }

  const tlb: { vpn: number; pfn: number }[] = [];
  const recency: number[] = [];
  let clockHand = 0;
  let last: PagingState["last"];
  let activeDir = -1;
  let activeTab = -1;
  let activeVpn = -1;
  let victimPfn = -1;
  let walkedTable = -1;

  const rec = new StepRecorder<PagingState>(() => snapshot());

  function pte(vpn: number): Pte {
    return tables[vpn >> DIR_SHIFT]![vpn & TAB_MASK]!;
  }

  function snapshot(): PagingState {
    const dir: PteChip[] = [0, 1, 2, 3].map((d) => {
      const anyPresent = tables[d]!.some((e) => e.present);
      return {
        label: `${d * 4}–${d * 4 + 3}`,
        pfn: d,
        present: anyPresent,
        referenced: false,
        active: d === activeDir,
      };
    });
    const table: PteChip[] =
      walkedTable < 0
        ? []
        : tables[walkedTable]!.map((e, i) => {
            const vpn = (walkedTable << DIR_SHIFT) | i;
            return {
              label: String(vpn),
              pfn: e.pfn,
              present: e.present,
              referenced: e.referenced,
              active: vpn === activeVpn,
            };
          });
    const tlbChips: TlbChip[] = tlb.map((e) => ({
      ...e,
      active: e.vpn === activeVpn && last?.kind === "tlb-hit",
    }));
    const frameChips: FrameChip[] = frames.map((f, pfn) => ({
      pfn,
      vpn: f.vpn,
      referenced: f.vpn !== null ? pte(f.vpn).referenced : false,
      victim: pfn === victimPfn,
    }));
    return {
      directory: dir,
      table,
      tlb: tlbChips,
      frames: frameChips,
      tlbEnabled: cfg.tlbSize > 0,
      last,
      stamp: stampOf(),
    };
  }

  function stampOf(): string {
    const hits = rec.count(PAGING_COUNTERS.tlbHits);
    const misses = rec.count(PAGING_COUNTERS.tlbMisses);
    const faults = rec.count(PAGING_COUNTERS.faults);
    const evicts = rec.count(PAGING_COUNTERS.evictions);
    if (cfg.tlbSize > 0) return `${hits} tlb hit${hits === 1 ? "" : "s"} · ${misses} miss${misses === 1 ? "" : "es"}`;
    if (cfg.demand) {
      return evicts > 0
        ? `${faults} fault${faults === 1 ? "" : "s"} · ${evicts} evict${evicts === 1 ? "" : "s"}`
        : `${faults} fault${faults === 1 ? "" : "s"}`;
    }
    const walks = rec.count(PAGING_COUNTERS.walks);
    return walks === 0 ? "no walks yet" : `${walks} walk${walks === 1 ? "" : "s"}`;
  }

  rec.record({
    note: cfg.demand
      ? `Demand paging, ${cfg.frames} frame${cfg.frames === 1 ? "" : "s"}, ${cfg.replacement === "none" ? "no eviction" : cfg.replacement + " replacement"}.`
      : cfg.tlbSize > 0
        ? `A TLB of ${cfg.tlbSize}. A hit skips the walk.`
        : "Two-level page tables. A translation walks the directory, then the table.",
  });

  for (const vpn of cfg.accesses) {
    access(vpn);
  }
  return rec.steps;

  function access(vpn: number): void {
    activeDir = -1;
    activeTab = -1;
    activeVpn = vpn;
    victimPfn = -1;
    walkedTable = -1;
    last = undefined;

    if (cfg.tlbSize > 0) {
      const hit = tlb.find((e) => e.vpn === vpn);
      if (hit) {
        rec.bump(PAGING_COUNTERS.tlbHits);
        last = { kind: "tlb-hit", vpn };
        pte(vpn).referenced = true;
        touchRecency(hit.pfn);
        rec.record({
          codeLine: 0,
          note: `VPN ${vpn}: TLB hit → frame ${hit.pfn}. No walk.`,
        });
        return;
      }
      rec.bump(PAGING_COUNTERS.tlbMisses);
    }

    walk(vpn);
    const entry = pte(vpn);
    if (!entry.present) {
      fault(vpn);
    } else {
      entry.referenced = true;
      if (entry.pfn !== null) touchRecency(entry.pfn);
      fillTlb(vpn, entry.pfn!);
    }
  }

  function walk(vpn: number): void {
    rec.bump(PAGING_COUNTERS.walks, 2);
    activeDir = vpn >> DIR_SHIFT;
    activeTab = vpn & TAB_MASK;
    walkedTable = activeDir;
    last = { kind: "walk", vpn };
    rec.record({
      codeLine: 1,
      note: `VPN ${vpn}: directory[${activeDir}] then table[${activeTab}].`,
    });
  }

  function fault(vpn: number): void {
    rec.bump(PAGING_COUNTERS.faults);
    rec.bump(PAGING_COUNTERS.diskReads);
    last = { kind: "fault", vpn };
    const pfn = allocate(vpn);
    const entry = pte(vpn);
    entry.present = true;
    entry.pfn = pfn;
    entry.referenced = true;
    fillTlb(vpn, pfn);
    rec.record({
      codeLine: 2,
      note:
        victimPfn >= 0
          ? `Page fault VPN ${vpn}: evicted frame ${victimPfn}, loaded into frame ${pfn}.`
          : `Page fault VPN ${vpn}: loaded into free frame ${pfn}.`,
    });
  }

  function allocate(vpn: number): number {
    const free = frames.findIndex((f) => f.vpn === null);
    if (free >= 0) {
      frames[free]!.vpn = vpn;
      recency.push(free);
      return free;
    }
    const victim = pickVictim();
    victimPfn = victim;
    rec.bump(PAGING_COUNTERS.evictions);
    last = { kind: "evict", vpn };
    const old = frames[victim]!.vpn;
    if (old !== null) {
      const oldPte = pte(old);
      oldPte.present = false;
      oldPte.pfn = null;
      oldPte.referenced = false;
      const tlbAt = tlb.findIndex((e) => e.vpn === old);
      if (tlbAt >= 0) tlb.splice(tlbAt, 1);
    }
    frames[victim]!.vpn = vpn;
    recency.push(victim);
    return victim;
  }

  function pickVictim(): number {
    if (cfg.replacement === "clock") {
      for (let n = 0; n < cfg.frames * 2; n++) {
        const pfn = clockHand;
        clockHand = (clockHand + 1) % cfg.frames;
        const mapped = frames[pfn]!.vpn;
        if (mapped === null) return pfn;
        if (!pte(mapped).referenced) return pfn;
        pte(mapped).referenced = false;
      }
      return clockHand;
    }
    if (cfg.replacement === "lru") {
      return recency.shift() ?? 0;
    }
    // fifo and none (none should not evict; still pick oldest mapped)
    return recency.shift() ?? 0;
  }

  function touchRecency(pfn: number): void {
    if (cfg.replacement !== "lru") return;
    const i = recency.indexOf(pfn);
    if (i >= 0) recency.splice(i, 1);
    recency.push(pfn);
  }

  function fillTlb(vpn: number, pfn: number): void {
    if (cfg.tlbSize <= 0) return;
    const existing = tlb.findIndex((e) => e.vpn === vpn);
    if (existing >= 0) {
      tlb[existing]!.pfn = pfn;
      return;
    }
    if (tlb.length >= cfg.tlbSize) tlb.shift();
    tlb.push({ vpn, pfn });
  }
}
