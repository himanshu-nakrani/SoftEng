"use client";

import type { LessonSim } from "../types";
import {
  FALLBACK_PACKET_STYLE,
  resolvePacketStyles,
  type PacketStyleSource,
} from "./PacketLayer";

/** Just enough of a lesson to print its key. */
export type PacketLegendSource = PacketStyleSource &
  Pick<LessonSim<unknown>, "packetLegend">;

interface PacketLegendProps {
  sim: PacketLegendSource;
}

/**
 * The key for the stage's packet colors: one chip per type the lesson declares
 * in `packetLegend`, in the order it declared them.
 *
 * Colors come from `resolvePacketStyles` — the same call `PacketLayer` makes,
 * including the lesson's `packetStyles` overrides — so a swatch cannot drift
 * from the dot it explains. Nothing is guessed from the sim's spawn behavior:
 * a lesson with no `packetLegend` renders no element at all (and no strip, no
 * border, no padding), because a legend the author didn't write is a legend
 * that would list "request, response, drop" on a lesson about quorums.
 */
export function PacketLegend({ sim }: PacketLegendProps) {
  const entries = sim.packetLegend;
  if (!entries || entries.length === 0) return null;

  const styles = resolvePacketStyles(sim);

  return (
    <ul
      aria-label="Packet key"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-2"
    >
      {entries.map((entry) => {
        const style = styles[entry.type] ?? FALLBACK_PACKET_STYLE;
        return (
          <li key={entry.type} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: style.color }}
            />
            <span className="tech-label">{entry.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
